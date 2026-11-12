import crypto from 'node:crypto';
import { Chess } from 'chess.js';
import { chooseAiMove } from '../domain/aiEngine.js';
import { resolveBotSelection } from '../domain/botProfiles.js';
import { findTimeControl } from '../domain/timeControls.js';

const MAX_STORED_GAMES = 200;
const MAX_CHAT_MESSAGES = 100;

/**
 * Error thrown when a requested game ID does not exist in memory.
 */
export class GameNotFoundError extends Error {
  /**
   * Creates a GameNotFoundError instance.
   *
   * @param {string} gameId - Missing game identifier.
   */
  constructor(gameId) {
    super(`Game not found: ${gameId}`);
    this.name = 'GameNotFoundError';
  }
}

/**
 * Error thrown when a player attempts an illegal or out-of-turn move.
 */
export class InvalidMoveError extends Error {
  /**
   * Creates an InvalidMoveError instance.
   *
   * @param {string} message - Reason why the move was rejected.
   */
  constructor(message) {
    super(message);
    this.name = 'InvalidMoveError';
  }
}

/**
 * Error thrown when an action cannot be performed because the game has ended.
 */
export class GameOverError extends Error {
  /**
   * Creates a GameOverError instance.
   *
   * @param {string} message - Explanation of the finished game state.
   */
  constructor(message) {
    super(message);
    this.name = 'GameOverError';
  }
}

/**
 * Error thrown when a game action conflicts with current turn or processing state.
 */
export class InvalidGameStateError extends Error {
  /**
   * Creates an InvalidGameStateError instance.
   *
   * @param {string} message - Conflict description.
   */
  constructor(message) {
    super(message);
    this.name = 'InvalidGameStateError';
  }
}

/**
 * Error thrown when a friend-game action lacks a valid seat token for the required player.
 */
export class UnauthorizedActionError extends Error {
  /**
   * Creates an UnauthorizedActionError instance.
   *
   * @param {string} message - Authorization failure reason.
   */
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedActionError';
  }
}

/**
 * Resolves the acting player's color for a game action and guards against unauthorized or waiting-room calls.
 *
 * @param {object} record - Stored game record.
 * @param {string | undefined} playerToken - Caller seat token from X-Player-Token header.
 * @returns {'w' | 'b'} Authorized side color.
 * @throws {UnauthorizedActionError | InvalidGameStateError} When token is invalid in friend mode or room is waiting.
 */
function requireActorColor(record, playerToken) {
  if (record.mode !== 'friend') {
    return record.playerColor;
  }
  const actorColor = resolveSeatByToken(record, playerToken);
  if (!actorColor) {
    throw new UnauthorizedActionError('Valid player token is required for this game');
  }
  if (!record.seats.w || !record.seats.b) {
    throw new InvalidGameStateError('Waiting for opponent to join');
  }
  return actorColor;
}

/**
 * Resolves the color ('w' or 'b') associated with a seat token in a friend game, or null otherwise.
 *
 * @param {object} record - Stored game record.
 * @param {string | undefined} playerToken - Caller seat token from request headers.
 * @returns {'w' | 'b' | null} Matched seat color or null.
 */
function resolveSeatByToken(record, playerToken) {
  if (record.mode !== 'friend' || !playerToken) {
    return null;
  }
  if (record.seats.w?.token === playerToken) {
    return 'w';
  }
  if (record.seats.b?.token === playerToken) {
    return 'b';
  }
  return null;
}

/**
 * Formats a seat entry for public snapshots without exposing its secret seatToken.
 *
 * @param {{ name: string, slot: 'p1' | 'p2' } | null} seat - Internal seat record.
 * @returns {{ name: string | null, joined: boolean, slot: 'p1' | 'p2' | null }} Public seat summary.
 */
function formatPublicSeat(seat) {
  if (!seat) {
    return { name: null, joined: false, slot: null };
  }
  return { name: seat.name, joined: true, slot: seat.slot };
}

/**
 * Derives high-level game status and winner from the game record and chess.js state.
 *
 * @param {{ mode: 'bot' | 'friend', seats?: { w: object | null, b: object | null }, chess: Chess, resignedBy: 'w' | 'b' | null, timedOutColor: 'w' | 'b' | null }} record - Stored game record.
 * @returns {{ status: string, winner: 'w' | 'b' | null }} Current status and winner if any.
 */
function resolveGameOutcome(record) {
  if (record.mode === 'friend' && (!record.seats.w || !record.seats.b)) {
    return { status: 'waiting', winner: null };
  }
  if (record.resignedBy) {
    return {
      status: 'resigned',
      winner: record.resignedBy === 'w' ? 'b' : 'w',
    };
  }
  if (record.timedOutColor) {
    return {
      status: 'timeout',
      winner: record.timedOutColor === 'w' ? 'b' : 'w',
    };
  }
  if (record.drawAgreed) {
    return { status: 'draw', winner: null };
  }

  const { chess } = record;
  if (chess.isCheckmate()) {
    return {
      status: 'checkmate',
      winner: chess.turn() === 'w' ? 'b' : 'w',
    };
  }
  if (chess.isStalemate()) {
    return { status: 'stalemate', winner: null };
  }
  if (chess.isThreefoldRepetition()) {
    return { status: 'threefold_repetition', winner: null };
  }
  if (chess.isInsufficientMaterial()) {
    return { status: 'insufficient_material', winner: null };
  }
  if (chess.isDrawByFiftyMoves()) {
    return { status: 'fifty_move_rule', winner: null };
  }
  if (chess.isDraw()) {
    return { status: 'draw', winner: null };
  }
  return { status: 'playing', winner: null };
}

/**
 * Formats a chess.js move object into the shared service move payload.
 *
 * @param {import('chess.js').Move} move - Verbose chess.js move record.
 * @returns {{ color: 'w' | 'b', from: string, to: string, san: string, promotion?: string }} Normalized move summary.
 */
function formatExecutedMove(move) {
  return {
    color: move.color,
    from: move.from,
    to: move.to,
    san: move.san,
    ...(move.promotion ? { promotion: move.promotion } : {}),
  };
}

/**
 * Formats a chess.js history move with post-move FEN, check state, and captured piece for review and material tracking.
 *
 * @param {import('chess.js').Move} move - Verbose chess.js move record from history.
 * @returns {{ color: 'w' | 'b', from: string, to: string, san: string, promotion?: string, captured?: string, fen: string, inCheck: boolean }} History entry with position snapshot.
 */
function formatHistoryEntry(move) {
  return {
    ...formatExecutedMove(move),
    ...(move.captured ? { captured: move.captured } : {}),
    fen: move.after,
    // Derive check status from SAN markers generated by chess.js to avoid re-instantiating Chess per ply.
    inCheck: move.san.endsWith('+') || move.san.endsWith('#'),
  };
}

/**
 * Creates internal clock state for a timed game or returns null for untimed games.
 *
 * @param {{ id: string, initialMs: number | null, incrementMs: number }} preset - Resolved time control preset.
 * @returns {{ timeControl: string, initialMs: number, incrementMs: number, remainingMs: { w: number, b: number }, activeSince: number | null, historySnapshots: Array<{ w: number, b: number }> } | null} Clock state or null.
 */
function createClockState(preset) {
  if (preset.initialMs === null) {
    return null;
  }
  const initialRemaining = { w: preset.initialMs, b: preset.initialMs };
  return {
    timeControl: preset.id,
    initialMs: preset.initialMs,
    incrementMs: preset.incrementMs,
    remainingMs: { ...initialRemaining },
    activeSince: null,
    historySnapshots: [{ ...initialRemaining }],
  };
}

/**
 * Deducts elapsed time for the active side since the last timestamp and triggers timeout when remaining time reaches 0.
 *
 * @param {object} record - Stored game record.
 * @param {number} currentNow - Current epoch timestamp in milliseconds.
 * @returns {void}
 */
function syncClockState(record, currentNow) {
  const { clock, chess } = record;
  if (
    !clock ||
    clock.activeSince === null ||
    isRecordGameOver(record)
  ) {
    return;
  }

  const activeColor = chess.turn();
  const elapsed = Math.max(0, currentNow - clock.activeSince);
  const nextRemaining = clock.remainingMs[activeColor] - elapsed;

  if (nextRemaining <= 0) {
    clock.remainingMs[activeColor] = 0;
    clock.activeSince = null;
    record.timedOutColor = activeColor;
    return;
  }

  clock.remainingMs[activeColor] = nextRemaining;
  clock.activeSince = currentNow;
}

/**
 * Updates the clock after a completed move by applying thinking elapsed time, Fischer increment, and history snapshot.
 *
 * @param {object} record - Stored game record.
 * @param {'w' | 'b'} moverColor - Side that just completed a move.
 * @param {number} startMs - Timestamp when the move computation began.
 * @param {number} endMs - Timestamp when the move completed.
 * @returns {boolean} True when the move stays within clock budget; false if the mover flagged during computation.
 */
function applyClockAfterMove(record, moverColor, startMs, endMs) {
  const { clock, chess } = record;
  if (!clock) {
    return true;
  }

  const elapsed = Math.max(0, endMs - startMs);
  const remainingAfterThink = clock.remainingMs[moverColor] - elapsed;
  if (remainingAfterThink <= 0) {
    clock.remainingMs[moverColor] = 0;
    clock.activeSince = null;
    record.timedOutColor = moverColor;
    return false;
  }

  const isFinished = chess.isGameOver();
  clock.remainingMs[moverColor] = remainingAfterThink + (isFinished ? 0 : clock.incrementMs);
  // Start the opponent's clock after move 1 completes; stop both clocks once the game ends.
  clock.activeSince = isFinished ? null : endMs;
  clock.historySnapshots.push({ ...clock.remainingMs });
  return true;
}

/**
 * Serializes internal clock state into the public API snapshot format.
 *
 * @param {object} record - Stored game record.
 * @param {string} status - Resolved game status.
 * @returns {{ timeControl: string, initialMs: number, incrementMs: number, remainingMs: { w: number, b: number }, activeColor: 'w' | 'b' | null, isRunning: boolean } | null} Clock snapshot or null.
 */
function buildClockSnapshot(record, status) {
  const { clock, chess } = record;
  if (!clock) {
    return null;
  }
  const isRunning = status === 'playing' && clock.activeSince !== null;
  return {
    timeControl: clock.timeControl,
    initialMs: clock.initialMs,
    incrementMs: clock.incrementMs,
    remainingMs: { ...clock.remainingMs },
    activeColor: isRunning ? chess.turn() : null,
    isRunning,
  };
}

/**
 * Converts a stored game record into a serializable client snapshot without exposing secret seat tokens.
 *
 * @param {object} record - Stored game entry.
 * @param {'w' | 'b' | null} [viewerColor] - Authenticated seat color for friend games, or null for spectators/public broadcasts.
 * @returns {object} Public game snapshot for API consumers.
 */
function buildSnapshot(record, viewerColor = null) {
  const { chess } = record;
  const { status, winner } = resolveGameOutcome(record);
  const verboseHistory = chess.history({ verbose: true });
  const lastEntry = verboseHistory.at(-1) ?? null;

  const isLegalMoveTurn =
    status === 'playing' &&
    (record.mode === 'friend' || chess.turn() === record.playerColor);
  const legalMoves = isLegalMoveTurn
    ? chess.moves({ verbose: true }).map((move) => ({
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
        san: move.san,
      }))
    : [];

  const baseSnapshot = {
    id: record.id,
    mode: record.mode,
    round: record.round,
    initialFen: verboseHistory[0]?.before ?? chess.fen(),
    fen: chess.fen(),
    board: chess.board(),
    turn: chess.turn(),
    clock: buildClockSnapshot(record, status),
    status,
    winner,
    inCheck: chess.inCheck(),
    legalMoves,
    history: verboseHistory.map(formatHistoryEntry),
    lastMove: lastEntry ? formatExecutedMove(lastEntry) : null,
  };

  if (record.mode === 'friend') {
    const viewerSeat = viewerColor ? record.seats[viewerColor] : null;
    return {
      ...baseSnapshot,
      playerColor: viewerSeat ? viewerColor : null,
      aiColor: null,
      difficulty: null,
      bot: null,
      viewerRole: viewerSeat ? 'player' : 'spectator',
      viewerColor: viewerSeat ? viewerColor : null,
      viewerSlot: viewerSeat ? viewerSeat.slot : null,
      players: {
        w: formatPublicSeat(record.seats.w),
        b: formatPublicSeat(record.seats.b),
      },
      pendingDrawBy: record.pendingDrawBy,
      pendingTakebackBy: record.pendingTakebackBy,
      pendingRematchBy: record.pendingRematchBy,
    };
  }

  return {
    ...baseSnapshot,
    playerColor: record.playerColor,
    aiColor: record.aiColor,
    difficulty: record.difficulty,
    bot: record.bot,
  };
}

/**
 * Executes one AI move on the game if the game is still active and it is the AI's turn.
 *
 * @param {{ chess: Chess, aiColor: 'w' | 'b', difficulty: 'easy' | 'medium' | 'hard' }} record - Game record.
 * @param {Function} chooseMove - AI move selection dependency.
 * @returns {object | null} Executed AI move summary or null if no move was made.
 */
function performAiTurn(record, chooseMove) {
  if (record.chess.isGameOver() || record.chess.turn() !== record.aiColor) {
    return null;
  }
  const chosen = chooseMove(record.chess.fen(), record.difficulty);
  if (!chosen) {
    return null;
  }
  return formatExecutedMove(record.chess.move(chosen));
}

/**
 * Checks whether the game has reached any terminal state (board outcome, draw agreement, resignation, or timeout).
 *
 * @param {object} record - Stored game record.
 * @returns {boolean} True when no further moves are permitted.
 */
function isRecordGameOver(record) {
  return Boolean(
    record.resignedBy || record.timedOutColor || record.drawAgreed || record.chess.isGameOver()
  );
}

/**
 * Restores the game clock state to match the remaining move ply count after an undo or takeback.
 *
 * @param {object} record - Stored game record.
 * @param {number} currentNow - Current epoch timestamp in milliseconds.
 * @returns {void}
 */
function restoreClockToHistoryLength(record, currentNow) {
  if (!record.clock) {
    return;
  }
  const remainingPlies = record.chess.history().length;
  record.clock.historySnapshots.length = remainingPlies + 1;
  const restored = record.clock.historySnapshots.at(-1) ?? {
    w: record.clock.initialMs,
    b: record.clock.initialMs,
  };
  record.clock.remainingMs = { ...restored };
  record.clock.activeSince = remainingPlies > 0 && !record.chess.isGameOver() ? currentNow : null;
}

/**
 * Resets a completed friend room into the next round while swapping White and Black seats.
 *
 * @param {object} record - Stored friend game record.
 * @returns {void}
 */
function startNextFriendRound(record) {
  const previousWhite = record.seats.w;
  record.seats.w = record.seats.b;
  record.seats.b = previousWhite;
  record.chess = new Chess();
  record.resignedBy = null;
  record.timedOutColor = null;
  record.drawAgreed = false;
  record.pendingDrawBy = null;
  record.pendingTakebackBy = null;
  record.pendingRematchBy = null;
  record.round += 1;
  record.clock = createClockState(record.timePreset);
}

/**
 * Creates an in-memory chess game service coordinating bot matches, friend rooms, moves, and clocks.
 *
 * @param {{ chooseMove?: Function, now?: () => number, randomInt?: (max: number) => number }} [options] - Optional dependencies for testing.
 * @returns {object} Game service API methods.
 */
export function createGameService({
  chooseMove = chooseAiMove,
  now = () => Date.now(),
  randomInt = crypto.randomInt,
} = {}) {
  const games = new Map();
  const subscribers = new Map();
  const chatSubscribers = new Map();

  /**
   * Dispatches a payload to all listeners registered for a game room without letting one failure block others.
   *
   * @param {Map<string, Set<Function>>} listenerMap - Target listener registry.
   * @param {string} gameId - Target game identifier.
   * @param {unknown} payload - Event payload passed to each listener.
   * @returns {void}
   */
  function emitRoomListeners(listenerMap, gameId, payload) {
    const listeners = listenerMap.get(gameId);
    if (!listeners || listeners.size === 0) {
      return;
    }
    for (const listener of [...listeners]) {
      try {
        listener(payload);
      } catch {
        // Isolate listener failures so one closed stream does not block remaining subscribers.
      }
    }
  }

  /**
   * Registers a room-scoped listener in a registry map and returns an idempotent unsubscribe handle.
   *
   * @param {Map<string, Set<Function>>} listenerMap - Target listener registry.
   * @param {string} gameId - Target game identifier.
   * @param {Function} listener - Callback to register.
   * @returns {() => void} Unsubscribe cleanup callback.
   */
  function addRoomListener(listenerMap, gameId, listener) {
    let listeners = listenerMap.get(gameId);
    if (!listeners) {
      listeners = new Set();
      listenerMap.set(gameId, listeners);
    }
    listeners.add(listener);
    return () => {
      const current = listenerMap.get(gameId);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        listenerMap.delete(gameId);
      }
    };
  }

  /**
   * Broadcasts the latest public snapshot to all active SSE listeners subscribed to a game.
   *
   * @param {object} record - Updated internal game record.
   * @returns {void}
   */
  function notifySubscribers(record) {
    if (!subscribers.has(record.id)) {
      return;
    }
    emitRoomListeners(subscribers, record.id, buildSnapshot(record));
  }

  /**
   * Appends a chat entry to a friend room while capping history length and notifies active chat subscribers.
   *
   * @param {object} record - Stored friend game record.
   * @param {object} entry - Formatted chat entry.
   * @returns {object} Stored chat entry copy.
   */
  function appendChatEntry(record, entry) {
    record.chatMessages.push(entry);
    // Evict oldest messages so long-lived rematch rooms stay bounded in memory.
    if (record.chatMessages.length > MAX_CHAT_MESSAGES) {
      record.chatMessages.splice(0, record.chatMessages.length - MAX_CHAT_MESSAGES);
    }
    const snapshot = { ...entry };
    emitRoomListeners(chatSubscribers, record.id, snapshot);
    return snapshot;
  }

  /**
   * Resolves a player display name for a given side in a friend room.
   *
   * @param {object} record - Stored friend game record.
   * @param {'w' | 'b'} color - Target color.
   * @returns {string} Seat display name or color fallback.
   */
  function getSeatDisplayName(record, color) {
    return record.seats?.[color]?.name ?? (color === 'w' ? 'White' : 'Black');
  }

  /**
   * Emits a system-authored chat message in a friend room.
   *
   * @param {object} record - Stored friend game record.
   * @param {string} text - System event description.
   * @param {{ isRoundDivider?: boolean }} [options] - Optional round separator flag.
   * @returns {void}
   */
  function appendSystemChat(record, text, { isRoundDivider = false } = {}) {
    if (record.mode !== 'friend') {
      return;
    }
    appendChatEntry(record, {
      id: crypto.randomUUID(),
      kind: 'system',
      round: record.round,
      text,
      timestamp: now(),
      ...(isRoundDivider ? { isRoundDivider: true } : {}),
    });
  }

  /**
   * Formats the round-start banner message showing assigned White and Black players.
   *
   * @param {object} record - Stored friend game record.
   * @returns {string} Round start summary text.
   */
  function formatRoundStartText(record) {
    return `Round ${record.round} started — ${getSeatDisplayName(record, 'w')} (White) vs ${getSeatDisplayName(record, 'b')} (Black)`;
  }

  /**
   * Formats a board-termination system chat message when a friend move ends the match.
   *
   * @param {object} record - Stored friend game record.
   * @returns {string} Human-readable outcome description.
   */
  function formatFriendOutcomeChat(record) {
    const { status, winner } = resolveGameOutcome(record);
    if (status === 'checkmate' && winner) {
      return `${getSeatDisplayName(record, winner)} won by checkmate`;
    }
    const drawLabels = {
      stalemate: 'Game drawn by stalemate',
      threefold_repetition: 'Game drawn by threefold repetition',
      insufficient_material: 'Game drawn by insufficient material',
      fifty_move_rule: 'Game drawn by 50-move rule',
    };
    return drawLabels[status] ?? 'Game drawn';
  }

  /**
   * Synchronizes clock state and emits a system chat message when a friend clock flags.
   *
   * @param {object} record - Stored game record.
   * @param {number} currentNow - Current epoch timestamp in milliseconds.
   * @returns {boolean} True when this sync transitioned the game into a timeout state.
   */
  function syncClockAndRecordTimeout(record, currentNow) {
    const wasTimedOut = Boolean(record.timedOutColor);
    syncClockState(record, currentNow);
    const newlyTimedOut = !wasTimedOut && Boolean(record.timedOutColor);
    if (newlyTimedOut && record.mode === 'friend') {
      const loser = record.timedOutColor;
      const winner = loser === 'w' ? 'b' : 'w';
      appendSystemChat(
        record,
        `${getSeatDisplayName(record, loser)} ran out of time — ${getSeatDisplayName(record, winner)} won`
      );
    }
    return newlyTimedOut;
  }

  /**
   * Stores a new game record while keeping memory bounded via FIFO eviction.
   *
   * @param {object} record - Internal game record to store.
   * @returns {void}
   */
  function saveGameRecord(record) {
    if (games.size >= MAX_STORED_GAMES) {
      const oldestKey = games.keys().next().value;
      games.delete(oldestKey);
      subscribers.delete(oldestKey);
      chatSubscribers.delete(oldestKey);
    }
    games.set(record.id, record);
  }

  /**
   * Creates a new bot or friend chess game and returns its initial snapshot (plus host seatToken in friend mode).
   *
   * @param {{ mode?: 'bot' | 'friend', playerColor: 'w' | 'b' | 'random', difficulty?: 'easy' | 'medium' | 'hard', botId?: string, timeControl?: string, playerName?: string }} params - New game options.
   * @returns {object} Initial game snapshot.
   */
  function createGame({
    mode = 'bot',
    playerColor,
    difficulty,
    botId,
    timeControl = 'untimed',
    playerName,
  }) {
    const timePreset = findTimeControl(timeControl);
    if (!timePreset) {
      throw new Error(`Unsupported time control: ${timeControl}`);
    }

    const id = crypto.randomUUID();

    if (mode === 'friend') {
      const hostColor =
        playerColor === 'random' ? (randomInt(2) === 0 ? 'w' : 'b') : playerColor;
      const hostToken = crypto.randomUUID();
      const hostSeat = {
        token: hostToken,
        name: playerName ?? 'Player 1',
        slot: 'p1',
      };
      const record = {
        id,
        mode: 'friend',
        round: 1,
        chess: new Chess(),
        seats: {
          w: hostColor === 'w' ? hostSeat : null,
          b: hostColor === 'b' ? hostSeat : null,
        },
        timePreset,
        clock: createClockState(timePreset),
        resignedBy: null,
        timedOutColor: null,
        drawAgreed: false,
        pendingDrawBy: null,
        pendingTakebackBy: null,
        pendingRematchBy: null,
        chatMessages: [],
        isProcessing: false,
      };
      saveGameRecord(record);
      return {
        ...buildSnapshot(record, hostColor),
        seatToken: hostToken,
      };
    }

    const { bot, difficulty: resolvedDifficulty } = resolveBotSelection({ botId, difficulty });
    const aiColor = playerColor === 'w' ? 'b' : 'w';
    const record = {
      id,
      mode: 'bot',
      round: 1,
      chess: new Chess(),
      playerColor,
      aiColor,
      difficulty: resolvedDifficulty,
      bot,
      clock: createClockState(timePreset),
      resignedBy: null,
      timedOutColor: null,
      isProcessing: false,
    };

    if (playerColor === 'b') {
      const openStart = now();
      const openingMove = performAiTurn(record, chooseMove);
      if (openingMove && record.clock) {
        // Keep move 1 free of elapsed deduction while starting the player's clock immediately afterward.
        applyClockAfterMove(record, aiColor, openStart, openStart);
        record.clock.activeSince = now();
      }
    }

    saveGameRecord(record);
    return buildSnapshot(record);
  }

  /**
   * Claims the open seat in a waiting friend room and transitions the game to 'playing'.
   *
   * @param {string} gameId - Target friend room identifier.
   * @param {{ playerName?: string, playerToken?: string }} [options] - Guest display name and optional existing token.
   * @returns {object} Joined snapshot including the assigned guest seatToken.
   * @throws {GameNotFoundError | InvalidGameStateError} When missing, not a friend room, already joined, or full.
   */
  function joinGame(gameId, { playerName, playerToken } = {}) {
    const record = games.get(gameId);
    if (!record) {
      throw new GameNotFoundError(gameId);
    }
    if (record.mode !== 'friend') {
      throw new InvalidGameStateError('Cannot join a bot game');
    }
    if (resolveSeatByToken(record, playerToken)) {
      throw new InvalidGameStateError('You have already joined this game');
    }

    const openColor = !record.seats.w ? 'w' : !record.seats.b ? 'b' : null;
    if (!openColor) {
      throw new InvalidGameStateError('Game room is already full');
    }

    const guestToken = crypto.randomUUID();
    record.seats[openColor] = {
      token: guestToken,
      name: playerName ?? 'Player 2',
      slot: 'p2',
    };

    appendSystemChat(record, formatRoundStartText(record), { isRoundDivider: true });
    notifySubscribers(record);
    return {
      ...buildSnapshot(record, openColor),
      seatToken: guestToken,
    };
  }

  /**
   * Finds an existing game snapshot by ID (synchronizing clock state) or returns null when absent.
   *
   * @param {string} gameId - Game identifier.
   * @param {string} [playerToken] - Optional seat token for friend games.
   * @returns {object | null} Game snapshot or null.
   */
  function findGame(gameId, playerToken) {
    const record = games.get(gameId);
    if (!record) {
      return null;
    }
    if (syncClockAndRecordTimeout(record, now())) {
      notifySubscribers(record);
    }
    const viewerColor = resolveSeatByToken(record, playerToken);
    return buildSnapshot(record, viewerColor);
  }

  /**
   * Retrieves an existing game snapshot by ID or throws GameNotFoundError.
   *
   * @param {string} gameId - Game identifier.
   * @param {string} [playerToken] - Optional seat token for friend games.
   * @returns {object} Game snapshot.
   * @throws {GameNotFoundError} When gameId does not exist.
   */
  function getGame(gameId, playerToken) {
    const snapshot = findGame(gameId, playerToken);
    if (!snapshot) {
      throw new GameNotFoundError(gameId);
    }
    return snapshot;
  }

  /**
   * Synchronizes the server-authoritative clock for a game and returns the updated snapshot.
   *
   * @param {string} gameId - Target game identifier.
   * @returns {object} Synchronized game snapshot.
   * @throws {GameNotFoundError} When gameId does not exist.
   */
  function syncClock(gameId) {
    return getGame(gameId);
  }

  /**
   * Applies the player's move and runs the AI reply in bot mode when the game remains active.
   *
   * @param {string} gameId - Target game identifier.
   * @param {{ from: string, to: string, promotion?: string }} moveInput - Player move coordinates.
   * @param {string} [playerToken] - Seat token authenticating the caller in friend mode.
   * @returns {{ game: object, playerMove: object, aiMove: object | null }} Updated snapshot and executed moves.
   * @throws {GameNotFoundError | GameOverError | InvalidGameStateError | InvalidMoveError | UnauthorizedActionError} On invalid game, token, or move.
   */
  function applyPlayerMove(gameId, { from, to, promotion }, playerToken) {
    const record = games.get(gameId);
    if (!record) {
      throw new GameNotFoundError(gameId);
    }
    if (record.isProcessing) {
      throw new InvalidGameStateError('Move is already being processed for this game');
    }

    const actorColor = requireActorColor(record, playerToken);
    const moveTime = now();
    syncClockAndRecordTimeout(record, moveTime);

    if (isRecordGameOver(record)) {
      throw new GameOverError('Cannot make a move after the game has ended');
    }
    if (record.chess.turn() !== actorColor) {
      throw new InvalidMoveError('It is not the player turn');
    }

    record.isProcessing = true;
    // Snapshot post-sync clock so an AI failure rolls back turn increments atomically without refunding prior wait time.
    const clockBackup = record.clock
      ? {
          remainingMs: { ...record.clock.remainingMs },
          activeSince: record.clock.activeSince,
          snapshotLength: record.clock.historySnapshots.length,
        }
      : null;

    try {
      let executedPlayerMove;
      try {
        executedPlayerMove = record.chess.move({ from, to, promotion });
      } catch {
        throw new InvalidMoveError(`Illegal chess move from ${from} to ${to}`);
      }

      applyClockAfterMove(record, actorColor, moveTime, moveTime);

      if (record.mode === 'friend') {
        // Playing a move implicitly clears any open draw or takeback requests.
        record.pendingDrawBy = null;
        record.pendingTakebackBy = null;
        if (isRecordGameOver(record)) {
          appendSystemChat(record, formatFriendOutcomeChat(record));
        }
        notifySubscribers(record);
        return {
          game: buildSnapshot(record, actorColor),
          playerMove: formatExecutedMove(executedPlayerMove),
          aiMove: null,
        };
      }

      let aiMove = null;
      try {
        const aiStart = now();
        aiMove = performAiTurn(record, chooseMove);
        if (aiMove && record.clock) {
          const aiEnd = now();
          const withinBudget = applyClockAfterMove(record, record.aiColor, aiStart, aiEnd);
          if (!withinBudget) {
            // Undo the AI move if the AI exceeded its clock while calculating.
            record.chess.undo();
            aiMove = null;
          }
        }
      } catch (err) {
        // Roll back the player's move and turn clock changes so the game is never stranded on the AI's turn.
        record.chess.undo();
        if (record.clock && clockBackup) {
          record.clock.remainingMs = { ...clockBackup.remainingMs };
          record.clock.activeSince = clockBackup.activeSince;
          record.clock.historySnapshots.length = clockBackup.snapshotLength;
        }
        throw err;
      }

      return {
        game: buildSnapshot(record),
        playerMove: formatExecutedMove(executedPlayerMove),
        aiMove,
      };
    } finally {
      record.isProcessing = false;
    }
  }

  /**
   * Records a player resignation on an active game and halts the game clock.
   *
   * @param {string} gameId - Target game identifier.
   * @param {string} [playerToken] - Seat token authenticating the caller in friend mode.
   * @returns {object} Final game snapshot with status 'resigned'.
   * @throws {GameNotFoundError | InvalidGameStateError | GameOverError | UnauthorizedActionError} When missing, unauthorized, busy, or ended.
   */
  function resignGame(gameId, playerToken) {
    const record = games.get(gameId);
    if (!record) {
      throw new GameNotFoundError(gameId);
    }
    if (record.isProcessing) {
      throw new InvalidGameStateError('Cannot resign while a move is being processed');
    }

    const actorColor = requireActorColor(record, playerToken);
    syncClockAndRecordTimeout(record, now());
    if (isRecordGameOver(record)) {
      throw new GameOverError('Cannot resign after the game has ended');
    }

    record.resignedBy = actorColor;
    record.pendingDrawBy = null;
    record.pendingTakebackBy = null;
    if (record.clock) {
      record.clock.activeSince = null;
    }
    if (record.mode === 'friend') {
      const winnerColor = actorColor === 'w' ? 'b' : 'w';
      appendSystemChat(
        record,
        `${getSeatDisplayName(record, actorColor)} resigned — ${getSeatDisplayName(record, winnerColor)} won`
      );
    }
    notifySubscribers(record);
    return buildSnapshot(record, record.mode === 'friend' ? actorColor : null);
  }

  /**
   * Validates common preconditions for friend-only interactive actions (draw, takeback, rematch).
   *
   * @param {string} gameId - Target game identifier.
   * @param {string | undefined} playerToken - Caller seat token.
   * @param {{ requirePlaying: boolean }} options - Whether the game must be actively playing or already ended.
   * @returns {{ record: object, actorColor: 'w' | 'b', opponentColor: 'w' | 'b' }} Authorized friend context.
   * @throws {GameNotFoundError | InvalidGameStateError | UnauthorizedActionError | GameOverError} On precondition failure.
   */
  function prepareFriendAction(gameId, playerToken, { requirePlaying }) {
    const record = games.get(gameId);
    if (!record) {
      throw new GameNotFoundError(gameId);
    }
    if (record.mode !== 'friend') {
      throw new InvalidGameStateError('Action is only supported in friend games');
    }
    if (record.isProcessing) {
      throw new InvalidGameStateError('Another action is being processed for this game');
    }

    const actorColor = requireActorColor(record, playerToken);
    syncClockAndRecordTimeout(record, now());
    const finished = isRecordGameOver(record);

    if (requirePlaying && finished) {
      throw new GameOverError('Cannot perform this action after the game has ended');
    }
    if (!requirePlaying && !finished) {
      throw new InvalidGameStateError('Game is still in progress');
    }

    return {
      record,
      actorColor,
      opponentColor: actorColor === 'w' ? 'b' : 'w',
    };
  }

  /**
   * Processes draw offers, acceptances, and declines between players in a friend match.
   *
   * @param {string} gameId - Target game identifier.
   * @param {string | undefined} playerToken - Caller seat token.
   * @param {'offer' | 'accept' | 'decline'} action - Draw coordination action.
   * @returns {object} Updated game snapshot for the acting player.
   */
  function handleDrawAction(gameId, playerToken, action) {
    const { record, actorColor, opponentColor } = prepareFriendAction(gameId, playerToken, {
      requirePlaying: true,
    });

    if (action === 'offer') {
      if (record.pendingDrawBy) {
        throw new InvalidGameStateError('A draw offer is already pending');
      }
      record.pendingDrawBy = actorColor;
      appendSystemChat(record, `${getSeatDisplayName(record, actorColor)} offered a draw`);
    } else if (action === 'accept') {
      if (record.pendingDrawBy !== opponentColor) {
        throw new InvalidGameStateError('No opponent draw offer to accept');
      }
      record.drawAgreed = true;
      record.pendingDrawBy = null;
      record.pendingTakebackBy = null;
      if (record.clock) {
        record.clock.activeSince = null;
      }
      appendSystemChat(
        record,
        `${getSeatDisplayName(record, actorColor)} accepted the draw — Game drawn`
      );
    } else if (action === 'decline') {
      if (record.pendingDrawBy !== opponentColor) {
        throw new InvalidGameStateError('No opponent draw offer to decline');
      }
      record.pendingDrawBy = null;
      appendSystemChat(
        record,
        `${getSeatDisplayName(record, actorColor)} declined the draw offer`
      );
    }

    notifySubscribers(record);
    return buildSnapshot(record, actorColor);
  }

  /**
   * Processes takeback requests, acceptances (1 or 2 plies with clock restore), and declines in a friend match.
   *
   * @param {string} gameId - Target game identifier.
   * @param {string | undefined} playerToken - Caller seat token.
   * @param {'request' | 'accept' | 'decline'} action - Takeback coordination action.
   * @returns {object} Updated game snapshot for the acting player.
   */
  function handleTakebackAction(gameId, playerToken, action) {
    const { record, actorColor, opponentColor } = prepareFriendAction(gameId, playerToken, {
      requirePlaying: true,
    });

    if (action === 'request') {
      const history = record.chess.history({ verbose: true });
      if (!history.some((move) => move.color === actorColor)) {
        throw new InvalidGameStateError('You have no move to take back');
      }
      if (record.pendingTakebackBy) {
        throw new InvalidGameStateError('A takeback request is already pending');
      }
      record.pendingTakebackBy = actorColor;
      appendSystemChat(record, `${getSeatDisplayName(record, actorColor)} requested a takeback`);
    } else if (action === 'accept') {
      const requesterColor = record.pendingTakebackBy;
      if (requesterColor !== opponentColor) {
        throw new InvalidGameStateError('No opponent takeback request to accept');
      }
      const history = record.chess.history({ verbose: true });
      const lastMove = history.at(-1);
      // Undo 1 ply if opponent has not replied yet; undo 2 plies to return to requester's previous turn.
      const pliesToUndo = lastMove?.color === requesterColor ? 1 : 2;
      for (let i = 0; i < pliesToUndo; i += 1) {
        record.chess.undo();
      }
      record.pendingTakebackBy = null;
      record.pendingDrawBy = null;
      restoreClockToHistoryLength(record, now());
      appendSystemChat(record, `${getSeatDisplayName(record, actorColor)} accepted the takeback`);
    } else if (action === 'decline') {
      if (record.pendingTakebackBy !== opponentColor) {
        throw new InvalidGameStateError('No opponent takeback request to decline');
      }
      record.pendingTakebackBy = null;
      appendSystemChat(record, `${getSeatDisplayName(record, actorColor)} declined the takeback`);
    }

    notifySubscribers(record);
    return buildSnapshot(record, actorColor);
  }

  /**
   * Processes rematch requests, acceptances (swapping seats for the next round), and declines in a finished friend match.
   *
   * @param {string} gameId - Target game identifier.
   * @param {string | undefined} playerToken - Caller seat token.
   * @param {'request' | 'accept' | 'decline'} action - Rematch coordination action.
   * @returns {object} Updated game snapshot for the acting player.
   */
  function handleRematchAction(gameId, playerToken, action) {
    const { record, actorColor, opponentColor } = prepareFriendAction(gameId, playerToken, {
      requirePlaying: false,
    });

    if (action === 'request') {
      if (record.pendingRematchBy === actorColor) {
        throw new InvalidGameStateError('Rematch request is already pending');
      }
      if (record.pendingRematchBy === opponentColor) {
        // Mutual simultaneous rematch requests immediately start the swapped round while preserving chat history.
        startNextFriendRound(record);
        appendSystemChat(record, formatRoundStartText(record), { isRoundDivider: true });
      } else {
        record.pendingRematchBy = actorColor;
        appendSystemChat(record, `${getSeatDisplayName(record, actorColor)} requested a rematch`);
      }
    } else if (action === 'accept') {
      if (record.pendingRematchBy !== opponentColor) {
        throw new InvalidGameStateError('No opponent rematch request to accept');
      }
      startNextFriendRound(record);
      appendSystemChat(record, formatRoundStartText(record), { isRoundDivider: true });
    } else if (action === 'decline') {
      if (record.pendingRematchBy !== opponentColor) {
        throw new InvalidGameStateError('No opponent rematch request to decline');
      }
      record.pendingRematchBy = null;
      appendSystemChat(record, `${getSeatDisplayName(record, actorColor)} declined the rematch`);
    }

    notifySubscribers(record);
    return buildSnapshot(record, resolveSeatByToken(record, playerToken));
  }

  /**
   * Retrieves an existing friend room record for chat operations or throws if missing or bot mode.
   *
   * @param {string} gameId - Target game identifier.
   * @returns {object} Stored friend game record.
   * @throws {GameNotFoundError | InvalidGameStateError} When game is missing or not a friend room.
   */
  function requireFriendChatRoom(gameId) {
    const record = games.get(gameId);
    if (!record) {
      throw new GameNotFoundError(gameId);
    }
    if (record.mode !== 'friend') {
      throw new InvalidGameStateError('Chat is only supported in friend games');
    }
    return record;
  }

  /**
   * Appends a player-authored chat message to a friend room after verifying seat ownership.
   *
   * @param {string} gameId - Target friend room identifier.
   * @param {string | undefined} playerToken - Caller seat token.
   * @param {string} text - Validated chat text.
   * @returns {object} Stored chat message entry.
   * @throws {GameNotFoundError | InvalidGameStateError | UnauthorizedActionError} When missing, bot mode, or not a seated player.
   */
  function sendChatMessage(gameId, playerToken, text) {
    const record = requireFriendChatRoom(gameId);
    const senderColor = resolveSeatByToken(record, playerToken);
    if (!senderColor) {
      throw new UnauthorizedActionError('Valid player token is required to send chat messages');
    }
    const seat = record.seats[senderColor];
    return appendChatEntry(record, {
      id: crypto.randomUUID(),
      kind: 'player',
      senderName: seat.name,
      senderSlot: seat.slot,
      senderColor,
      round: record.round,
      text,
      timestamp: now(),
    });
  }

  /**
   * Lists the current in-memory chat history for a friend room.
   *
   * @param {string} gameId - Target friend room identifier.
   * @returns {Array<object>} Cloned list of chat entries.
   * @throws {GameNotFoundError | InvalidGameStateError} When missing or not a friend room.
   */
  function listChatMessages(gameId) {
    const record = requireFriendChatRoom(gameId);
    return record.chatMessages.map((entry) => ({ ...entry }));
  }

  /**
   * Registers a listener for real-time chat messages on a friend room and returns an unsubscribe handle.
   *
   * @param {string} gameId - Target friend room identifier.
   * @param {(entry: object) => void} listener - Callback invoked when a chat entry is appended.
   * @returns {() => void} Unsubscribe cleanup function.
   * @throws {GameNotFoundError | InvalidGameStateError} When missing or not a friend room.
   */
  function subscribeChat(gameId, listener) {
    requireFriendChatRoom(gameId);
    return addRoomListener(chatSubscribers, gameId, listener);
  }

  /**
   * Registers a listener for public snapshot updates on a game and returns an unsubscribe handle.
   *
   * @param {string} gameId - Target game identifier.
   * @param {(snapshot: object) => void} listener - Callback invoked with updated public snapshots.
   * @returns {() => void} Unsubscribe cleanup function.
   * @throws {GameNotFoundError} When gameId does not exist.
   */
  function subscribeGame(gameId, listener) {
    if (!games.has(gameId)) {
      throw new GameNotFoundError(gameId);
    }
    return addRoomListener(subscribers, gameId, listener);
  }

  /**
   * Reverts the game to the player's previous decision point in bot mode and restores clock state.
   *
   * @param {string} gameId - Target game identifier.
   * @returns {object} Updated game snapshot after undo.
   * @throws {GameNotFoundError | InvalidGameStateError} When game is missing, busy, or a friend game.
   */
  function undoLastTurn(gameId) {
    const record = games.get(gameId);
    if (!record) {
      throw new GameNotFoundError(gameId);
    }
    if (record.mode === 'friend') {
      throw new InvalidGameStateError('Unilateral undo is not allowed in friend games');
    }
    if (record.isProcessing) {
      throw new InvalidGameStateError('Cannot undo while a move is being processed');
    }

    const history = record.chess.history({ verbose: true });
    // Preserve the AI opening move when the player chose Black and has not moved yet.
    const minPlies = record.playerColor === 'b' ? 1 : 0;
    if (history.length <= minPlies && !record.resignedBy && !record.timedOutColor) {
      return buildSnapshot(record);
    }

    const lastMove = history.at(-1);
    const pliesToUndo =
      history.length > minPlies && lastMove
        ? lastMove.color === record.playerColor
          ? 1
          : 2
        : 0;
    const removablePlies = Math.min(pliesToUndo, history.length - minPlies);
    for (let i = 0; i < removablePlies; i += 1) {
      record.chess.undo();
    }

    record.resignedBy = null;
    record.timedOutColor = null;

    restoreClockToHistoryLength(record, now());

    return buildSnapshot(record);
  }

  return {
    createGame,
    joinGame,
    findGame,
    getGame,
    subscribeGame,
    sendChatMessage,
    listChatMessages,
    subscribeChat,
    syncClock,
    applyPlayerMove,
    resignGame,
    handleDrawAction,
    handleTakebackAction,
    handleRematchAction,
    undoLastTurn,
  };
}
