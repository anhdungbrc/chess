const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const CAPTURE_SORT_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const PIECE_POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const LOW_TIME_THRESHOLD_MS = 20 * 1000;

/**
 * Formats a remaining clock budget in milliseconds using Chess.com display rules.
 * Shows tenths of a second below 20 seconds and mm:ss at or above 20 seconds.
 *
 * @param {number} ms - Remaining clock time in milliseconds.
 * @returns {string} Formatted clock text such as '10:00' or '0:19.4'.
 */
export function formatClockMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00.0';
  }

  if (ms < LOW_TIME_THRESHOLD_MS) {
    const totalTenths = Math.floor(ms / 100);
    const seconds = Math.floor(totalTenths / 10);
    const tenth = totalTenths % 10;
    return `0:${String(seconds).padStart(2, '0')}.${tenth}`;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Computes captured pieces and net material advantage up to a target ply index.
 *
 * @param {Array<{ color: 'w' | 'b', captured?: string, promotion?: string }>} history - Full game move history.
 * @param {number} [plyCount] - Number of plies to include (defaults to full history length).
 * @returns {{
 *   capturedByWhite: string[],
 *   capturedByBlack: string[],
 *   advantageSide: 'w' | 'b' | null,
 *   advantagePoints: number,
 * }} Sorted captured pieces per side and material advantage summary.
 */
export function computeCapturedMaterial(history, plyCount) {
  const safeHistory = Array.isArray(history) ? history : [];
  const limit =
    typeof plyCount === 'number' && Number.isFinite(plyCount)
      ? Math.max(0, Math.min(safeHistory.length, Math.trunc(plyCount)))
      : safeHistory.length;

  const capturedByWhite = [];
  const capturedByBlack = [];
  let whiteMaterialDelta = 0;
  let blackMaterialDelta = 0;

  for (let i = 0; i < limit; i += 1) {
    const move = safeHistory[i];
    if (!move) {
      continue;
    }

    if (move.captured) {
      const capturedValue = PIECE_POINTS[move.captured] ?? 0;
      if (move.color === 'w') {
        capturedByWhite.push(move.captured);
        whiteMaterialDelta += capturedValue;
      } else {
        capturedByBlack.push(move.captured);
        blackMaterialDelta += capturedValue;
      }
    }

    // Account for promoted piece value minus the sacrificed pawn so +N matches board material.
    if (move.promotion) {
      const promoNet = (PIECE_POINTS[move.promotion] ?? 0) - PIECE_POINTS.p;
      if (move.color === 'w') {
        whiteMaterialDelta += promoNet;
      } else {
        blackMaterialDelta += promoNet;
      }
    }
  }

  const sortCaptures = (a, b) => (CAPTURE_SORT_ORDER[a] ?? 9) - (CAPTURE_SORT_ORDER[b] ?? 9);
  capturedByWhite.sort(sortCaptures);
  capturedByBlack.sort(sortCaptures);

  const diff = whiteMaterialDelta - blackMaterialDelta;
  return {
    capturedByWhite,
    capturedByBlack,
    advantageSide: diff > 0 ? 'w' : diff < 0 ? 'b' : null,
    advantagePoints: Math.abs(diff),
  };
}

/**
 * Maps viewport pointer coordinates onto an algebraic board square for the active orientation.
 *
 * @param {number} clientX - Pointer X coordinate in viewport space.
 * @param {number} clientY - Pointer Y coordinate in viewport space.
 * @param {{ left: number, top: number, width: number, height: number }} rect - Board element bounds.
 * @param {boolean} isFlipped - True when viewed from Black's perspective.
 * @returns {string | null} Algebraic square ('a1'..'h8') or null if outside board bounds.
 */
export function resolveSquareFromPoint(clientX, clientY, rect, isFlipped) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) {
    return null;
  }

  const visualCol = Math.min(7, Math.floor((relX / rect.width) * 8));
  const visualRow = Math.min(7, Math.floor((relY / rect.height) * 8));
  const col = isFlipped ? 7 - visualCol : visualCol;
  const row = isFlipped ? 7 - visualRow : visualRow;

  return `${FILES[col]}${8 - row}`;
}

/**
 * Resolves the active viewer's piece color ('w' or 'b') for bot or friend snapshots, or null for spectators.
 *
 * @param {object | null} game - Game snapshot returned by backend API or SSE stream.
 * @param {'p1' | 'p2' | null} viewerSlot - Authenticated slot assigned to this browser tab.
 * @returns {'w' | 'b' | null} Controlled piece color or null when spectating.
 */
export function resolveViewerColor(game, viewerSlot) {
  if (!game) {
    return null;
  }
  if (game.mode !== 'friend') {
    return game.playerColor ?? null;
  }
  if (!viewerSlot || !game.players) {
    return null;
  }
  if (game.players.w?.slot === viewerSlot) {
    return 'w';
  }
  if (game.players.b?.slot === viewerSlot) {
    return 'b';
  }
  return null;
}

/**
 * Builds a shareable invite URL for a friend match from window origin and gameId.
 *
 * @param {string} origin - Browser window origin (e.g. 'http://localhost:3000').
 * @param {string} gameId - Friend room identifier.
 * @returns {string} Shareable URL containing the game query parameter.
 */
export function resolveInviteUrl(origin, gameId) {
  const cleanOrigin = String(origin ?? '').replace(/\/+$/, '');
  return `${cleanOrigin}/?game=${encodeURIComponent(gameId)}`;
}

/**
 * Builds the WebSocket URL for a friend room's real-time chat channel from window.location fields.
 *
 * @param {{ protocol?: string, host?: string }} locationLike - Browser location object.
 * @param {string} gameId - Friend room identifier.
 * @returns {string} WebSocket URL using ws:// or wss://.
 */
export function resolveChatWsUrl(locationLike, gameId) {
  const wsProtocol = locationLike?.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = String(locationLike?.host ?? '');
  return `${wsProtocol}//${host}/api/games/${encodeURIComponent(gameId)}/chat-ws`;
}

/**
 * Determines whether the current viewer is permitted to send chat messages in this match.
 *
 * @param {object | null} game - Current game snapshot.
 * @param {'w' | 'b' | null} viewerColor - Controlled seat color, or null when spectating.
 * @returns {boolean} True only for seated players in a friend room.
 */
export function canSendMatchChat(game, viewerColor) {
  return Boolean(game && game.mode === 'friend' && (viewerColor === 'w' || viewerColor === 'b'));
}

/**
 * Filters a slot-indexed avatar bubble map to retain only entries whose expiry is still in the future.
 *
 * @param {Record<string, { text: string, expiresAt: number }> | null | undefined} bubblesBySlot - Map keyed by player slot ('p1' | 'p2').
 * @param {number} nowMs - Current epoch timestamp in milliseconds.
 * @returns {Record<string, { text: string, expiresAt: number }>} Active non-expired bubble map.
 */
export function resolveActiveAvatarBubbles(bubblesBySlot, nowMs) {
  const active = {};
  if (!bubblesBySlot || typeof bubblesBySlot !== 'object') {
    return active;
  }
  for (const [slot, entry] of Object.entries(bubblesBySlot)) {
    if (entry && typeof entry.text === 'string' && entry.text.length > 0 && entry.expiresAt > nowMs) {
      active[slot] = { text: entry.text, expiresAt: entry.expiresAt };
    }
  }
  return active;
}

/**
 * Resolves the active speech bubble text for a given board side ('w' or 'b') in a friend match.
 *
 * @param {object | null} game - Current game snapshot.
 * @param {'w' | 'b'} sideColor - Piece color displayed on the target player card.
 * @param {Record<string, { text: string, expiresAt: number }> | null | undefined} bubblesBySlot - Active bubbles keyed by player slot.
 * @param {number} nowMs - Current epoch timestamp in milliseconds.
 * @returns {{ text: string } | null} Active bubble payload for that side, or null.
 */
export function resolveAvatarChatBubble(game, sideColor, bubblesBySlot, nowMs) {
  if (!game || game.mode !== 'friend') {
    return null;
  }
  const slot = game.players?.[sideColor]?.slot;
  if (!slot || !bubblesBySlot) {
    return null;
  }
  const entry = bubblesBySlot[slot];
  if (!entry || typeof entry.text !== 'string' || entry.text.length === 0 || entry.expiresAt <= nowMs) {
    return null;
  }
  return { text: entry.text };
}

/**
 * Determines whether the current viewer can select and move pieces on the board.
 *
 * @param {object | null} game - Current game snapshot.
 * @param {'w' | 'b' | null} viewerColor - Piece color controlled by this viewer.
 * @param {boolean} isReviewing - True when browsing historical plies.
 * @returns {boolean} True only on the viewer's live active turn.
 */
export function canInteractWithBoard(game, viewerColor, isReviewing) {
  if (!game || isReviewing || !viewerColor) {
    return false;
  }
  return game.status === 'playing' && game.turn === viewerColor;
}

/**
 * Converts an algebraic square ('a1'..'h8') to 8x8 board array indices.
 *
 * @param {string} square - Algebraic chess square.
 * @returns {{ row: number, col: number } | null} Zero-based indices or null if malformed.
 */
function squareToIndices(square) {
  if (typeof square !== 'string' || square.length !== 2) {
    return null;
  }
  const col = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  if (col < 0 || !Number.isInteger(rank) || rank < 1 || rank > 8) {
    return null;
  }
  return { row: 8 - rank, col };
}

/**
 * Builds a client-side optimistic snapshot immediately after a player move so UI renders before server round-trip completes.
 *
 * @param {object | null} game - Current live game snapshot.
 * @param {{ from: string, to: string, promotion?: string }} move - Legal move submitted by the player.
 * @returns {object | null} Cloned optimistic snapshot flagged with isOptimistic: true, or original game if invalid.
 */
export function applyOptimisticMove(game, { from, to, promotion } = {}) {
  const fromPos = squareToIndices(from);
  const toPos = squareToIndices(to);
  if (!game?.board || !fromPos || !toPos) {
    return game;
  }

  const movingPiece = game.board[fromPos.row]?.[fromPos.col];
  if (!movingPiece) {
    return game;
  }

  const nextBoard = game.board.map((rank) =>
    rank.map((cell) => (cell ? { ...cell } : null))
  );

  let capturedType = nextBoard[toPos.row][toPos.col]?.type ?? null;
  const isCastling = movingPiece.type === 'k' && Math.abs(toPos.col - fromPos.col) === 2;
  const isEnPassant =
    movingPiece.type === 'p' &&
    fromPos.col !== toPos.col &&
    !nextBoard[toPos.row][toPos.col];

  // Clear the en-passant victim behind the target square before moving the pawn.
  if (isEnPassant) {
    capturedType = nextBoard[fromPos.row][toPos.col]?.type ?? 'p';
    nextBoard[fromPos.row][toPos.col] = null;
  }

  // Shift the corresponding rook alongside a two-square king castling move.
  if (isCastling) {
    const isKingside = toPos.col > fromPos.col;
    const rookFromCol = isKingside ? 7 : 0;
    const rookToCol = isKingside ? 5 : 3;
    const rookPiece = nextBoard[fromPos.row][rookFromCol];
    if (rookPiece) {
      nextBoard[fromPos.row][rookFromCol] = null;
      nextBoard[fromPos.row][rookToCol] = {
        ...rookPiece,
        square: `${FILES[rookToCol]}${8 - fromPos.row}`,
      };
    }
  }

  nextBoard[fromPos.row][fromPos.col] = null;
  nextBoard[toPos.row][toPos.col] = {
    square: to,
    type: promotion || movingPiece.type,
    color: movingPiece.color,
  };

  const nextTurn = movingPiece.color === 'w' ? 'b' : 'w';
  const matchedLegal = game.legalMoves?.find(
    (entry) =>
      entry.from === from &&
      entry.to === to &&
      (!promotion || entry.promotion === promotion)
  );
  const optimisticSan =
    matchedLegal?.san ??
    (isCastling ? (toPos.col > fromPos.col ? 'O-O' : 'O-O-O') : to);

  const nextHistory = [
    ...(game.history ?? []),
    {
      color: movingPiece.color,
      from,
      to,
      san: optimisticSan,
      ...(capturedType ? { captured: capturedType } : {}),
      ...(promotion ? { promotion } : {}),
    },
  ];

  // Advance the displayed turn clock locally until the authoritative server snapshot arrives.
  const nextClock = game.clock
    ? {
        ...game.clock,
        isRunning: true,
        activeColor: nextTurn,
      }
    : game.clock;

  return {
    ...game,
    isOptimistic: true,
    board: nextBoard,
    turn: nextTurn,
    // Server computes exact check/checkmate status; keep board unblocked while in flight.
    inCheck: false,
    // Prevent a second move until the authoritative snapshot restores legalMoves.
    legalMoves: [],
    lastMove: { from, to },
    history: nextHistory,
    clock: nextClock,
  };
}

/**
 * Resolves localized labels, icons, and accessible attributes for fullscreen toggle buttons.
 *
 * @param {boolean} isFullscreen - Current fullscreen active state.
 * @returns {{
 *   label: string,
 *   title: string,
 *   glyph: string,
 *   ariaPressed: boolean,
 * }} Button presentation and accessibility metadata.
 */
export function resolveFullscreenButtonMetadata(isFullscreen) {
  if (isFullscreen) {
    return {
      label: 'Exit Full Screen',
      title: 'Exit Full Screen (Esc)',
      glyph: '✕',
      ariaPressed: true,
    };
  }
  return {
    label: 'Full Screen',
    title: 'Enter Full Screen (F)',
    glyph: '⛶',
    ariaPressed: false,
  };
}

/**
 * Computes bounded square chessboard dimensions and layout mode to maximize viewport usage in fullscreen.
 *
 * @param {{
 *   viewportWidth?: number,
 *   viewportHeight?: number,
 *   isMobile?: boolean,
 *   isLandscape?: boolean,
 *   hasEvalBar?: boolean,
 * } | null | undefined} options - Viewport geometry and active layout flags.
 * @returns {{
 *   boardSizePx: number,
 *   isCompactLayout: boolean,
 * }} Sized square pixel width/height and layout compactness flag.
 */
export function resolveFullscreenDimensions(options) {
  const width = Math.max(0, Number(options?.viewportWidth) || 0);
  const height = Math.max(0, Number(options?.viewportHeight) || 0);
  const isMobile = Boolean(options?.isMobile);
  const isLandscape = Boolean(options?.isLandscape);
  const hasEvalBar = Boolean(options?.hasEvalBar);

  // Fallback defaults for missing or unmeasured viewports.
  if (width <= 0 || height <= 0) {
    return { boardSizePx: 640, isCompactLayout: false };
  }

  // Account for non-board UI chrome (player cards, margins, eval bar).
  const evalBarWidth = hasEvalBar ? 36 : 0;
  const horizontalPadding = isMobile ? (isLandscape ? 24 : 16) : 48;
  const maxAvailableWidth = Math.max(280, width - evalBarWidth - horizontalPadding);

  // Vertical chrome: player cards (~40-44px each) + gaps (~16-24px total).
  // In mobile landscape, cards are ultra-compact (~24px each) or stacked beside the board.
  const isCompactLayout = isMobile && isLandscape;
  const verticalChrome = isCompactLayout ? 56 : (isMobile ? 104 : 116);
  const maxAvailableHeight = Math.max(280, height - verticalChrome);

  // Chessboards are strictly 1:1 square. Clamp to the smaller dimension.
  const boardSizePx = Math.floor(Math.min(maxAvailableWidth, maxAvailableHeight));

  return {
    boardSizePx: Math.max(280, boardSizePx),
    isCompactLayout,
  };
}


