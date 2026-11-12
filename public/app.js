import { formatEvalScore, uciToMoveSquares } from './analysisHelper.js';
import { createStockfishAnalyzer } from './stockfishClient.js';
import { formatReviewMoveLabel, resolveReviewViewState } from './reviewHelper.js';
import {
  canInteractWithBoard,
  computeCapturedMaterial,
  formatClockMs,
  resolveInviteUrl,
  resolveSquareFromPoint,
  resolveViewerColor,
} from './chessUiHelper.js';
import {
  getAvatarSvg,
  getClassificationBadgeInfo,
  getPieceSvg,
  playChessSound,
} from './chessAssets.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const PROMOTION_LABELS = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
};

const DRAW_REASON_LABELS = {
  stalemate: 'by stalemate',
  threefold_repetition: 'by threefold repetition',
  insufficient_material: 'by insufficient material',
  fifty_move_rule: 'by 50-move rule',
  draw: 'by agreement',
};

const FALLBACK_BOTS = [
  {
    id: 'martin',
    name: 'Martin',
    rating: 250,
    difficulty: 'easy',
    tagline: 'Friendly beginner who plays casual, forgiving moves.',
    avatarId: 'martin',
  },
  {
    id: 'elani',
    name: 'Elani',
    rating: 800,
    difficulty: 'medium',
    tagline: 'Club player who spots basic tactics and avoids hanging pieces.',
    avatarId: 'elani',
  },
  {
    id: 'antonio',
    name: 'Antonio',
    rating: 1500,
    difficulty: 'hard',
    tagline: 'Calculating master looking for tactical combos and checkmates.',
    avatarId: 'antonio',
  },
];

const FALLBACK_TIME_CONTROLS = [
  { id: 'untimed', label: 'Untimed', category: 'untimed' },
  { id: '1+0', label: '1 min', category: 'bullet' },
  { id: '3+0', label: '3 min', category: 'blitz' },
  { id: '3+2', label: '3 | 2', category: 'blitz' },
  { id: '10+0', label: '10 min', category: 'rapid' },
];

const state = {
  bots: FALLBACK_BOTS,
  timeControls: FALLBACK_TIME_CONTROLS,
  selectedMode: 'bot',
  selectedBotId: 'elani',
  selectedColor: 'w',
  selectedTimeControl: '10+0',
  activeTab: 'play',
  isMuted: false,
  isFlipped: false,
  game: null,
  seatToken: null,
  viewerSlot: null,
  eventSource: null,
  selectedSquare: null,
  isPendingRequest: false,
  pendingPromotion: null,
  reviewPly: null,
  dismissedGameOverForId: null,
  dismissedGameOverRound: null,
  markedSquares: new Set(),
  arrows: new Set(),
  clockSyncedAt: 0,
  clockBaseRemaining: null,
  timeoutTriggeredForMove: false,
  dragState: null,
  rightDragStartSquare: null,
  analysisScriptUrl: null,
  analyzer: null,
  analysisAbortController: null,
  analysis: null,
  analysisKey: null,
  analysisProgress: null,
};

const elements = {
  navPlayBtn: document.getElementById('nav-play-btn'),
  navBotsBtn: document.getElementById('nav-bots-btn'),
  navFlipBtn: document.getElementById('nav-flip-btn'),
  navSoundBtn: document.getElementById('nav-sound-btn'),
  soundLabel: document.getElementById('sound-label'),
  topAvatar: document.getElementById('top-avatar'),
  topName: document.getElementById('top-name'),
  topRating: document.getElementById('top-rating'),
  topCaptures: document.getElementById('top-captures'),
  topAdvantage: document.getElementById('top-advantage'),
  topClock: document.getElementById('top-clock'),
  bottomAvatar: document.getElementById('bottom-avatar'),
  bottomName: document.getElementById('bottom-name'),
  bottomRating: document.getElementById('bottom-rating'),
  bottomCaptures: document.getElementById('bottom-captures'),
  bottomAdvantage: document.getElementById('bottom-advantage'),
  bottomClock: document.getElementById('bottom-clock'),
  board: document.getElementById('chess-board'),
  boardArrows: document.getElementById('board-arrows'),
  dragGhost: document.getElementById('drag-ghost'),
  statusBanner: document.getElementById('status-banner'),
  returnLiveBtn: document.getElementById('return-live-btn'),
  botTaglineBox: document.getElementById('bot-tagline-box'),
  botTagline: document.getElementById('bot-tagline'),
  inviteLinkBox: document.getElementById('invite-link-box'),
  inviteLinkInput: document.getElementById('invite-link-input'),
  copyInviteBtn: document.getElementById('copy-invite-btn'),
  joinMatchBox: document.getElementById('join-match-box'),
  joinMatchLabel: document.getElementById('join-match-label'),
  joinNameInput: document.getElementById('join-name-input'),
  joinMatchBtn: document.getElementById('join-match-btn'),
  friendOfferBanner: document.getElementById('friend-offer-banner'),
  friendOfferText: document.getElementById('friend-offer-text'),
  offerAcceptBtn: document.getElementById('offer-accept-btn'),
  offerDeclineBtn: document.getElementById('offer-decline-btn'),
  errorBanner: document.getElementById('error-banner'),
  tabPlayBtn: document.getElementById('tab-play-btn'),
  tabSetupBtn: document.getElementById('tab-setup-btn'),
  panelPlayView: document.getElementById('panel-play-view'),
  panelSetupView: document.getElementById('panel-setup-view'),
  modeBotBtn: document.getElementById('mode-bot-btn'),
  modeFriendBtn: document.getElementById('mode-friend-btn'),
  botSetupSection: document.getElementById('bot-setup-section'),
  friendSetupSection: document.getElementById('friend-setup-section'),
  friendNameInput: document.getElementById('friend-name-input'),
  botList: document.getElementById('bot-list'),
  colorPicker: document.getElementById('color-picker'),
  colorWhiteBtn: document.getElementById('color-white-btn'),
  colorBlackBtn: document.getElementById('color-black-btn'),
  colorRandomBtn: document.getElementById('color-random-btn'),
  timeControlList: document.getElementById('time-control-list'),
  newGameBtn: document.getElementById('new-game-btn'),
  flipBtn: document.getElementById('flip-btn'),
  undoBtn: document.getElementById('undo-btn'),
  drawBtn: document.getElementById('draw-btn'),
  resignBtn: document.getElementById('resign-btn'),
  rematchBtn: document.getElementById('rematch-btn'),
  reviewFirstBtn: document.getElementById('review-first-btn'),
  reviewPrevBtn: document.getElementById('review-prev-btn'),
  reviewNextBtn: document.getElementById('review-next-btn'),
  reviewLiveBtn: document.getElementById('review-live-btn'),
  moveHistory: document.getElementById('move-history'),
  promotionModal: document.getElementById('promotion-modal'),
  promotionChoices: document.getElementById('promotion-choices'),
  promotionCancelBtn: document.getElementById('promotion-cancel-btn'),
  gameOverModal: document.getElementById('game-over-modal'),
  gameOverTitle: document.getElementById('game-over-title'),
  gameOverSubtitle: document.getElementById('game-over-subtitle'),
  gameOverScore: document.getElementById('game-over-score'),
  gameOverPlayerAvatar: document.getElementById('game-over-player-avatar'),
  gameOverBotAvatar: document.getElementById('game-over-bot-avatar'),
  gameOverCloseBtn: document.getElementById('game-over-close-btn'),
  modalRematchBtn: document.getElementById('modal-rematch-btn'),
  modalNewGameBtn: document.getElementById('modal-new-game-btn'),
  modalReviewBtn: document.getElementById('modal-review-btn'),
  reviewAnalyzeBtn: document.getElementById('review-analyze-btn'),
  evalBar: document.getElementById('eval-bar'),
  evalBarFill: document.getElementById('eval-bar-fill'),
  evalBarScore: document.getElementById('eval-bar-score'),
  analysisPanel: document.getElementById('analysis-panel'),
  analysisProgress: document.getElementById('analysis-progress'),
  analysisCancelBtn: document.getElementById('analysis-cancel-btn'),
  analysisAccuracyRow: document.getElementById('analysis-accuracy-row'),
  analysisWhiteAcc: document.getElementById('analysis-white-acc'),
  analysisBlackAcc: document.getElementById('analysis-black-acc'),
  evalGraphWrap: document.getElementById('eval-graph-wrap'),
  evalGraph: document.getElementById('eval-graph'),
  analysisCounts: document.getElementById('analysis-counts'),
  analysisMoveNote: document.getElementById('analysis-move-note'),
};

/**
 * Displays or clears an error banner message in the UI.
 *
 * @param {string | null} message - Error text to display, or null to hide.
 * @returns {void}
 */
function setErrorMessage(message) {
  if (!message) {
    elements.errorBanner.hidden = true;
    elements.errorBanner.textContent = '';
    return;
  }
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = false;
}

/**
 * Loads the persisted seat token and slot for a friend room from sessionStorage.
 *
 * @param {string} gameId - Friend room identifier.
 * @returns {{ seatToken: string, viewerSlot: 'p1' | 'p2' } | null} Stored seat credentials or null.
 */
function loadSeatSession(gameId) {
  try {
    const raw = window.sessionStorage?.getItem(`chess_friend_seat_${gameId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.seatToken === 'string' && parsed.viewerSlot) {
      return { seatToken: parsed.seatToken, viewerSlot: parsed.viewerSlot };
    }
  } catch {
    // Ignore storage access errors in restricted browser contexts.
  }
  return null;
}

/**
 * Persists the seat token and slot for a friend room in sessionStorage so refreshes keep the player's seat.
 *
 * @param {string} gameId - Friend room identifier.
 * @param {string} seatToken - Secret seat token returned by create or join.
 * @param {'p1' | 'p2'} viewerSlot - Non-secret seat slot identifier.
 * @returns {void}
 */
function saveSeatSession(gameId, seatToken, viewerSlot) {
  try {
    window.sessionStorage?.setItem(
      `chess_friend_seat_${gameId}`,
      JSON.stringify({ seatToken, viewerSlot })
    );
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

/**
 * Returns the active viewer's controlled piece color ('w' or 'b'), or null when spectating.
 *
 * @returns {'w' | 'b' | null} Active viewer color.
 */
function getViewerColor() {
  return resolveViewerColor(state.game, state.viewerSlot);
}

/**
 * Sends a JSON HTTP request to the backend chess API and attaches X-Player-Token when present.
 *
 * @param {string} url - API endpoint path.
 * @param {RequestInit} [options] - Fetch configuration options.
 * @returns {Promise<any>} Parsed JSON response payload.
 */
async function requestJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.seatToken ? { 'X-Player-Token': state.seatToken } : {}),
    ...(options.headers ?? {}),
  };
  const response = await fetch(url, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `HTTP ${response.status}`);
  }
  return payload;
}

/**
 * Switches the active right-hand panel tab between live play and new game setup.
 *
 * @param {'play' | 'setup'} tabName - Target panel tab.
 * @returns {void}
 */
function setActiveTab(tabName) {
  state.activeTab = tabName;
  const isPlay = tabName === 'play';
  elements.panelPlayView.hidden = !isPlay;
  elements.panelSetupView.hidden = isPlay;
  elements.tabPlayBtn.classList.toggle('is-active', isPlay);
  elements.tabPlayBtn.setAttribute('aria-selected', String(isPlay));
  elements.tabSetupBtn.classList.toggle('is-active', !isPlay);
  elements.tabSetupBtn.setAttribute('aria-selected', String(!isPlay));
  elements.navPlayBtn.classList.toggle('is-active', isPlay);
  elements.navBotsBtn.classList.toggle('is-active', !isPlay);
}

/**
 * Synchronizes local clock baseline timestamps whenever a fresh snapshot arrives from the server.
 *
 * @param {object | null} game - Latest game snapshot.
 * @returns {void}
 */
function syncLocalClockBaseline(game) {
  state.timeoutTriggeredForMove = false;
  if (!game?.clock) {
    state.clockBaseRemaining = null;
    state.clockSyncedAt = 0;
    return;
  }
  state.clockBaseRemaining = { ...game.clock.remainingMs };
  state.clockSyncedAt = performance.now();
}

/**
 * Computes current display milliseconds for White and Black without mutating game state.
 *
 * @returns {{ w: number, b: number } | null} Remaining milliseconds or null for untimed games.
 */
function getLiveClockRemaining() {
  const clock = state.game?.clock;
  if (!clock || !state.clockBaseRemaining) {
    return null;
  }
  if (!clock.isRunning || !clock.activeColor) {
    return { ...state.clockBaseRemaining };
  }
  const elapsed = Math.max(0, performance.now() - state.clockSyncedAt);
  return {
    w:
      clock.activeColor === 'w'
        ? Math.max(0, state.clockBaseRemaining.w - elapsed)
        : state.clockBaseRemaining.w,
    b:
      clock.activeColor === 'b'
        ? Math.max(0, state.clockBaseRemaining.b - elapsed)
        : state.clockBaseRemaining.b,
  };
}

/**
 * Updates only the top and bottom clock DOM elements to avoid re-rendering the board on ticks.
 *
 * @returns {void}
 */
function updateClockElements() {
  const { game } = state;
  const remaining = getLiveClockRemaining();
  const topColor = state.isFlipped ? 'w' : 'b';
  const bottomColor = state.isFlipped ? 'b' : 'w';

  if (!game || !game.clock || !remaining) {
    elements.topClock.hidden = true;
    elements.bottomClock.hidden = true;
    return;
  }

  const applyClockNode = (node, color) => {
    const ms = remaining[color];
    const isActive = game.clock.isRunning && game.clock.activeColor === color;
    node.hidden = false;
    node.textContent = formatClockMs(ms);
    node.classList.toggle('is-active', isActive);
    node.classList.toggle('is-dark-clock', color === 'b');
    node.classList.toggle('is-low', ms < 20000);
  };

  applyClockNode(elements.topClock, topColor);
  applyClockNode(elements.bottomClock, bottomColor);

  if (
    game.clock.isRunning &&
    game.clock.activeColor &&
    remaining[game.clock.activeColor] <= 0 &&
    !state.isPendingRequest &&
    !state.timeoutTriggeredForMove
  ) {
    state.timeoutTriggeredForMove = true;
    triggerServerTimeoutCheck();
  }
}

/**
 * Computes human-readable game outcome copy for status banners and the Game Over modal.
 *
 * @param {object} game - Finished game snapshot.
 * @returns {{ headline: string, subtitle: string, score: string }} Display outcome details.
 */
function describeGameOutcome(game) {
  const reasonMap = {
    checkmate: 'by checkmate',
    timeout: 'on time',
    resigned: 'by resignation',
  };

  if (game.mode === 'friend') {
    const viewerColor = getViewerColor();
    if (game.winner) {
      const winnerName = game.players?.[game.winner]?.name ?? (game.winner === 'w' ? 'White' : 'Black');
      const headline = viewerColor
        ? game.winner === viewerColor
          ? 'You Won!'
          : `${winnerName} Won`
        : `${winnerName} Won`;
      return {
        headline,
        subtitle: reasonMap[game.status] ?? 'victory',
        score: game.winner === 'w' ? '1 - 0' : '0 - 1',
      };
    }
    return {
      headline: 'Draw',
      subtitle: DRAW_REASON_LABELS[game.status] ?? 'by draw',
      score: '½ - ½',
    };
  }

  if (game.winner === game.playerColor) {
    return {
      headline: 'You Won!',
      subtitle: reasonMap[game.status] ?? 'victory',
      score: game.playerColor === 'w' ? '1 - 0' : '0 - 1',
    };
  }

  if (game.winner === game.aiColor) {
    const botName = game.bot?.name ?? 'Bot';
    return {
      headline: `${botName} Won`,
      subtitle: reasonMap[game.status] ?? 'victory',
      score: game.aiColor === 'w' ? '1 - 0' : '0 - 1',
    };
  }

  return {
    headline: 'Draw',
    subtitle: DRAW_REASON_LABELS[game.status] ?? 'by draw',
    score: '½ - ½',
  };
}

/**
 * Computes status banner text and styling state for the active or reviewed position.
 *
 * @param {object} game - Current game snapshot.
 * @param {object} view - Resolved review/live view state.
 * @returns {{ text: string, isCheck: boolean, isOver: boolean, isReview: boolean }} Banner state.
 */
function formatStatusBanner(game, view) {
  if (state.isPendingRequest) {
    const loadingText =
      game.mode === 'friend' ? 'Syncing match...' : `${game.bot?.name ?? 'Bot'} is thinking...`;
    return {
      text: loadingText,
      isCheck: false,
      isOver: false,
      isReview: false,
    };
  }
  if (view.isReviewing) {
    const moveLabel =
      view.effectivePly === 0
        ? 'Starting Position'
        : formatReviewMoveLabel(game.history, view.effectivePly);
    const checkSuffix = view.inCheck ? ' (Check)' : '';
    return {
      text: `Reviewing ${moveLabel} (${view.effectivePly}/${view.totalPlies})${checkSuffix}`,
      isCheck: view.inCheck,
      isOver: false,
      isReview: true,
    };
  }
  if (game.status === 'waiting') {
    const viewerColor = getViewerColor();
    return {
      text: viewerColor
        ? 'Waiting for friend to join...'
        : 'Open seat ready — click Join to play',
      isCheck: false,
      isOver: false,
      isReview: false,
    };
  }
  if (game.status !== 'playing') {
    const outcome = describeGameOutcome(game);
    return {
      text: `${outcome.headline} ${outcome.subtitle}`,
      isCheck: false,
      isOver: true,
      isReview: false,
    };
  }

  const sideLabel = game.turn === 'w' ? 'White' : 'Black';
  if (game.mode === 'friend') {
    const viewerColor = getViewerColor();
    const activeName = game.players?.[game.turn]?.name ?? sideLabel;
    const turnText = !viewerColor
      ? `Spectating • ${activeName}'s Turn (${sideLabel})`
      : game.turn === viewerColor
        ? `Your Turn (${sideLabel})`
        : `${activeName}'s Turn (${sideLabel})`;
    return {
      text: game.inCheck ? `Check! ${turnText}` : turnText,
      isCheck: game.inCheck,
      isOver: false,
      isReview: false,
    };
  }

  const turnText =
    game.turn === game.playerColor
      ? `Your Turn (${sideLabel})`
      : `${game.bot?.name ?? 'Bot'}'s Turn (${sideLabel})`;

  return {
    text: game.inCheck ? `Check! ${turnText}` : turnText,
    isCheck: game.inCheck,
    isOver: false,
    isReview: false,
  };
}

/**
 * Returns legal target moves originating from the currently selected square.
 *
 * @param {object} game - Current game snapshot.
 * @param {string | null} fromSquare - Selected algebraic square or null.
 * @returns {Array<{ from: string, to: string, promotion?: string }>} Matching legal moves.
 */
function getLegalMovesFromSquare(game, fromSquare) {
  if (!game || !fromSquare) {
    return [];
  }
  return game.legalMoves.filter((move) => move.from === fromSquare);
}

/**
 * Renders top and bottom player cards with avatars, ratings, captured pieces, and material points.
 *
 * @param {object} view - Resolved review/live view state.
 * @returns {void}
 */
function renderPlayerCards(view) {
  const { game } = state;
  if (!game) {
    return;
  }

  const captures = computeCapturedMaterial(game.history, view.effectivePly);
  const topColor = state.isFlipped ? 'w' : 'b';
  const bottomColor = state.isFlipped ? 'b' : 'w';

  const viewerColor = getViewerColor();
  const populateCard = (sideColor, avatarEl, nameEl, ratingEl, capturesEl, advantageEl) => {
    if (game.mode === 'friend') {
      const seat = game.players?.[sideColor];
      const isSelf = viewerColor === sideColor;
      avatarEl.innerHTML = getAvatarSvg('player');
      nameEl.textContent = seat?.joined
        ? `${seat.name}${isSelf ? ' (You)' : ''}`
        : `Waiting (${sideColor === 'w' ? 'White' : 'Black'})...`;
      ratingEl.hidden = true;
      ratingEl.textContent = '';
    } else {
      const isPlayer = sideColor === game.playerColor;
      const bot = game.bot ?? FALLBACK_BOTS[1];

      avatarEl.innerHTML = getAvatarSvg(isPlayer ? 'player' : bot.avatarId);
      nameEl.textContent = isPlayer ? 'You' : bot.name;
      if (isPlayer) {
        ratingEl.hidden = true;
        ratingEl.textContent = '';
      } else {
        ratingEl.hidden = false;
        ratingEl.textContent = `(${bot.rating})`;
      }
    }

    const capturedTypes = sideColor === 'w' ? captures.capturedByWhite : captures.capturedByBlack;
    const capturedPieceColor = sideColor === 'w' ? 'b' : 'w';
    capturesEl.innerHTML = '';
    for (const type of capturedTypes) {
      const icon = document.createElement('span');
      icon.className = 'captured-icon';
      icon.innerHTML = getPieceSvg(capturedPieceColor, type);
      capturesEl.appendChild(icon);
    }

    if (captures.advantageSide === sideColor && captures.advantagePoints > 0) {
      advantageEl.hidden = false;
      advantageEl.textContent = `+${captures.advantagePoints}`;
    } else {
      advantageEl.hidden = true;
      advantageEl.textContent = '';
    }
  };

  populateCard(
    topColor,
    elements.topAvatar,
    elements.topName,
    elements.topRating,
    elements.topCaptures,
    elements.topAdvantage
  );
  populateCard(
    bottomColor,
    elements.bottomAvatar,
    elements.bottomName,
    elements.bottomRating,
    elements.bottomCaptures,
    elements.bottomAdvantage
  );

  updateClockElements();
}

/**
 * Builds a cache key identifying a unique game, round, and move count for analysis results.
 *
 * @param {object | null} game - Current game snapshot.
 * @returns {string | null} Composite key or null when no game is loaded.
 */
function getGameAnalysisKey(game) {
  if (!game) {
    return null;
  }
  return `${game.id}:${game.round ?? 1}:${game.history?.length ?? 0}`;
}

/**
 * Returns the cached Stockfish analysis report when it matches the currently loaded game state.
 *
 * @param {object | null} game - Current game snapshot.
 * @returns {object | null} Matching analysis report or null.
 */
function getActiveAnalysis(game) {
  if (!game || !state.analysis) {
    return null;
  }
  return state.analysisKey === getGameAnalysisKey(game) ? state.analysis : null;
}

/**
 * Checks whether Chess.com-style post-game analysis can run on the current finished match.
 *
 * @param {object | null} game - Current game snapshot.
 * @returns {boolean} True when Stockfish is configured, the game has ended, and moves exist.
 */
function canReviewGame(game) {
  return Boolean(
    game &&
      state.analysisScriptUrl &&
      game.status !== 'playing' &&
      game.status !== 'waiting' &&
      (game.history?.length ?? 0) > 0
  );
}

/**
 * Cancels any in-flight Stockfish analysis worker and clears progress state.
 *
 * @returns {void}
 */
function cancelActiveAnalysis() {
  if (state.analysisAbortController) {
    state.analysisAbortController.abort();
    state.analysisAbortController = null;
  }
  state.analysisProgress = null;
  state.analyzer?.dispose();
}

/**
 * Renders the vertical evaluation bar along the board edge for the active ply.
 *
 * @param {object} view - Resolved review/live view state.
 * @param {object | null} activeAnalysis - Completed game analysis report, if available.
 * @returns {void}
 */
function renderEvalBar(view, activeAnalysis) {
  if (!activeAnalysis) {
    elements.evalBar.hidden = true;
    return;
  }

  const pos = activeAnalysis.positions[view.effectivePly] ?? activeAnalysis.positions.at(-1);
  const rawWin = pos?.winPercent ?? 50;
  // Keep a small visible sliver unless a forced mate or checkmate decides the position.
  const isDecided = typeof pos?.eval?.mate === 'number' && pos.eval.mate !== 0;
  const whiteHeight = isDecided ? (pos.eval.mate > 0 ? 100 : 0) : Math.max(4, Math.min(96, rawWin));
  const whiteAhead = rawWin >= 50;
  const placeAtBottom = state.isFlipped ? !whiteAhead : whiteAhead;

  elements.evalBar.hidden = false;
  elements.evalBar.classList.toggle('is-flipped', state.isFlipped);
  elements.evalBarFill.style.height = `${whiteHeight.toFixed(1)}%`;
  elements.evalBarScore.textContent = formatEvalScore(pos?.eval);
  elements.evalBarScore.classList.toggle('is-bottom', placeAtBottom);
  elements.evalBarScore.classList.toggle('is-top', !placeAtBottom);
}

/**
 * Renders the Chess.com-style Game Review panel with progress, accuracy cards, SVG eval graph, and move callouts.
 *
 * @param {object} view - Resolved review/live view state.
 * @param {object | null} activeAnalysis - Completed game analysis report, if available.
 * @returns {void}
 */
function renderAnalysisPanel(view, activeAnalysis) {
  const isRunning = Boolean(state.analysisProgress);
  if (!isRunning && !activeAnalysis) {
    elements.analysisPanel.hidden = true;
    return;
  }

  elements.analysisPanel.hidden = false;
  if (isRunning) {
    elements.analysisProgress.hidden = false;
    elements.analysisProgress.textContent = `Analyzing ${state.analysisProgress.completed}/${state.analysisProgress.total}...`;
    elements.analysisCancelBtn.hidden = false;
    elements.analysisAccuracyRow.hidden = true;
    elements.evalGraphWrap.hidden = true;
    elements.analysisCounts.hidden = true;
    elements.analysisMoveNote.hidden = false;
    elements.analysisMoveNote.textContent = 'Running Stockfish WASM locally in your browser...';
    return;
  }

  elements.analysisProgress.hidden = true;
  elements.analysisCancelBtn.hidden = true;
  elements.analysisAccuracyRow.hidden = false;
  elements.evalGraphWrap.hidden = false;
  elements.analysisCounts.hidden = false;
  elements.analysisMoveNote.hidden = false;

  const { summary, positions, moves } = activeAnalysis;
  elements.analysisWhiteAcc.textContent =
    summary.whiteAccuracy !== null ? `${summary.whiteAccuracy}%` : '--';
  elements.analysisBlackAcc.textContent =
    summary.blackAccuracy !== null ? `${summary.blackAccuracy}%` : '--';

  // Build SVG area graph of White win% (0..100) across all plies.
  const ns = 'http://www.w3.org/2000/svg';
  const graphW = 320;
  const graphH = 68;
  elements.evalGraph.innerHTML = '';

  const midLine = document.createElementNS(ns, 'line');
  midLine.setAttribute('x1', '0');
  midLine.setAttribute('y1', String(graphH / 2));
  midLine.setAttribute('x2', String(graphW));
  midLine.setAttribute('y2', String(graphH / 2));
  midLine.setAttribute('stroke', 'rgba(255,255,255,0.18)');
  midLine.setAttribute('stroke-width', '1');
  elements.evalGraph.appendChild(midLine);

  const count = positions.length;
  const xForPly = (ply) => (count <= 1 ? 0 : (ply / (count - 1)) * graphW);
  const yForWin = (winPct) => ((100 - winPct) / 100) * graphH;

  if (count > 1) {
    const pts = positions.map((p) => `${xForPly(p.ply).toFixed(1)},${yForWin(p.winPercent).toFixed(1)}`);
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', `0,${graphH} ${pts.join(' ')} ${graphW},${graphH}`);
    poly.setAttribute('fill', 'rgba(243, 241, 234, 0.85)');
    elements.evalGraph.appendChild(poly);
  }

  const cursorX = xForPly(view.effectivePly);
  const cursor = document.createElementNS(ns, 'line');
  cursor.setAttribute('x1', cursorX.toFixed(1));
  cursor.setAttribute('y1', '0');
  cursor.setAttribute('x2', cursorX.toFixed(1));
  cursor.setAttribute('y2', String(graphH));
  cursor.setAttribute('stroke', '#81b64c');
  cursor.setAttribute('stroke-width', '2');
  elements.evalGraph.appendChild(cursor);

  elements.analysisCounts.innerHTML = '';
  for (const key of ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']) {
    const info = getClassificationBadgeInfo(key);
    const chip = document.createElement('div');
    chip.className = 'analysis-count-chip';
    const labelSpan = document.createElement('span');
    labelSpan.innerHTML = `<strong style="color:${info.color}">${info.symbol}</strong> ${info.label}`;
    const valueSpan = document.createElement('strong');
    valueSpan.textContent = `${summary.counts.w[key]} / ${summary.counts.b[key]}`;
    chip.append(labelSpan, valueSpan);
    elements.analysisCounts.appendChild(chip);
  }

  if (view.effectivePly === 0) {
    elements.analysisMoveNote.textContent =
      'Starting position — select any move or click the graph to inspect evaluations.';
    return;
  }

  const moveAnalysis = moves[view.effectivePly - 1];
  if (!moveAnalysis) {
    elements.analysisMoveNote.textContent = '';
    return;
  }
  const badge = getClassificationBadgeInfo(moveAnalysis.classification);
  const label = formatReviewMoveLabel(state.game.history, view.effectivePly);
  const evalText = formatEvalScore(moveAnalysis.evalAfter);
  const bestSq = uciToMoveSquares(moveAnalysis.bestMoveUci);
  const bestHint =
    bestSq && moveAnalysis.bestMoveUci !== moveAnalysis.playedUci
      ? ` • Best was ${bestSq.from}→${bestSq.to}${bestSq.promotion ? `=${bestSq.promotion.toUpperCase()}` : ''}`
      : '';
  elements.analysisMoveNote.textContent = `${label} is ${badge.label} (${evalText})${bestHint}`;
}

/**
 * Appends an arrow marker definition and line onto the board SVG overlay.
 *
 * @param {string} id - SVG marker id.
 * @param {string} color - Arrow stroke and head fill CSS color.
 * @param {{ x: number, y: number }} p1 - Origin square center in 800x800 SVG space.
 * @param {{ x: number, y: number }} p2 - Destination square center in 800x800 SVG space.
 * @returns {void}
 */
function appendBoardArrow(id, color, p1, p2) {
  const ns = 'http://www.w3.org/2000/svg';
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    return;
  }

  let defs = elements.boardArrows.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(ns, 'defs');
    elements.boardArrows.appendChild(defs);
  }
  if (!elements.boardArrows.querySelector(`#${id}`)) {
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '4');
    marker.setAttribute('markerHeight', '4');
    marker.setAttribute('refX', '2.5');
    marker.setAttribute('refY', '2');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS(ns, 'polygon');
    polygon.setAttribute('points', '0 0, 4 2, 0 4');
    polygon.setAttribute('fill', color);
    marker.appendChild(polygon);
    defs.appendChild(marker);
  }

  // Pull back the endpoint slightly so the arrowhead tip rests cleanly inside the target square.
  const trim = 22;
  const x2 = p2.x - (dx / len) * trim;
  const y2 = p2.y - (dy / len) * trim;

  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', String(p1.x));
  line.setAttribute('y1', String(p1.y));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '15');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('marker-end', `url(#${id})`);
  elements.boardArrows.appendChild(line);
}

/**
 * Renders SVG tactical arrows drawn by right-dragging plus the engine's best-move suggestion arrow during review.
 *
 * @param {object} [view] - Resolved review/live view state.
 * @param {object | null} [activeAnalysis] - Completed game analysis report, if available.
 * @returns {void}
 */
function renderBoardArrows(
  view = resolveReviewViewState(state.game, state.reviewPly),
  activeAnalysis = getActiveAnalysis(state.game)
) {
  elements.boardArrows.innerHTML = '';
  const bestMove =
    activeAnalysis && view && view.effectivePly >= 1
      ? activeAnalysis.moves[view.effectivePly - 1]
      : null;
  const bestSquares =
    bestMove && bestMove.bestMoveUci !== bestMove.playedUci
      ? uciToMoveSquares(bestMove.bestMoveUci)
      : null;

  if (state.arrows.size === 0 && !bestSquares) {
    return;
  }

  const squareCenter = (squareName) => {
    const fileIdx = FILES.indexOf(squareName[0]);
    const rankNum = Number(squareName[1]);
    const row = 8 - rankNum;
    const visualCol = state.isFlipped ? 7 - fileIdx : fileIdx;
    const visualRow = state.isFlipped ? 7 - row : row;
    return {
      x: visualCol * 100 + 50,
      y: visualRow * 100 + 50,
    };
  };

  if (bestSquares) {
    appendBoardArrow(
      'chess-best-arrow-head',
      'rgba(129, 182, 76, 0.9)',
      squareCenter(bestSquares.from),
      squareCenter(bestSquares.to)
    );
  }

  for (const key of state.arrows) {
    const [from, to] = key.split('->');
    appendBoardArrow(
      'chess-arrow-head',
      'rgba(255, 170, 0, 0.85)',
      squareCenter(from),
      squareCenter(to)
    );
  }
}

/**
 * Renders the 8x8 interactive chess board according to orientation, highlights, SVG pieces, and review state.
 *
 * @param {object} view - Resolved review/live view state.
 * @param {object | null} [activeAnalysis] - Completed game analysis report, if available.
 * @returns {void}
 */
function renderBoard(view, activeAnalysis = getActiveAnalysis(state.game)) {
  const { game } = state;
  if (!game || !view.board) {
    return;
  }

  elements.board.innerHTML = '';
  elements.board.classList.toggle('is-reviewing', view.isReviewing);
  const rowOrder = state.isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colOrder = state.isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const activeMoveAnalysis =
    activeAnalysis && view.effectivePly >= 1
      ? activeAnalysis.moves[view.effectivePly - 1]
      : null;

  const legalTargets = view.isReviewing
    ? new Set()
    : new Set(getLegalMovesFromSquare(game, state.selectedSquare).map((m) => m.to));

  for (let visualRow = 0; visualRow < 8; visualRow += 1) {
    const row = rowOrder[visualRow];
    for (let visualCol = 0; visualCol < 8; visualCol += 1) {
      const col = colOrder[visualCol];
      const squareName = `${FILES[col]}${8 - row}`;
      const piece = view.board[row][col];
      const isLight = (row + col) % 2 === 0;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `square ${isLight ? 'light' : 'dark'}`;
      btn.dataset.square = squareName;
      btn.setAttribute('aria-label', squareName);
      btn.disabled = state.isPendingRequest;

      if (
        view.lastMove &&
        (view.lastMove.from === squareName || view.lastMove.to === squareName)
      ) {
        btn.classList.add('last-move');
      }
      if (!view.isReviewing && state.selectedSquare === squareName) {
        btn.classList.add('selected');
      }
      if (state.markedSquares.has(squareName)) {
        btn.classList.add('right-marked');
      }
      if (legalTargets.has(squareName)) {
        btn.classList.add('legal-target');
        if (piece) {
          btn.classList.add('has-piece');
        }
      }
      if (view.inCheck && piece && piece.type === 'k' && piece.color === view.turn) {
        btn.classList.add('in-check');
      }

      if (visualCol === 0) {
        const rankLabel = document.createElement('span');
        rankLabel.className = 'coord-rank';
        rankLabel.textContent = String(8 - row);
        btn.appendChild(rankLabel);
      }
      if (visualRow === 7) {
        const fileLabel = document.createElement('span');
        fileLabel.className = 'coord-file';
        fileLabel.textContent = FILES[col];
        btn.appendChild(fileLabel);
      }

      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = 'piece';
        if (state.dragState?.hasDragged && state.dragState.fromSquare === squareName) {
          pieceEl.classList.add('is-dragging-origin');
        }
        pieceEl.innerHTML = getPieceSvg(piece.color, piece.type);
        btn.appendChild(pieceEl);
      }

      if (activeMoveAnalysis && view.lastMove?.to === squareName) {
        const badgeInfo = getClassificationBadgeInfo(activeMoveAnalysis.classification);
        const badgeEl = document.createElement('span');
        badgeEl.className = 'square-badge';
        badgeEl.style.backgroundColor = badgeInfo.color;
        badgeEl.title = badgeInfo.label;
        badgeEl.textContent = badgeInfo.symbol;
        btn.appendChild(badgeEl);
      }

      elements.board.appendChild(btn);
    }
  }

  renderBoardArrows(view, activeAnalysis);
}

/**
 * Builds an interactive history cell button for one ply or a spacer when Black has not moved yet.
 *
 * @param {{ san: string } | undefined} move - Move record at moveIndex, if present.
 * @param {number} moveIndex - Zero-based index inside game.history.
 * @param {number} activeHistoryIndex - Currently highlighted zero-based history index.
 * @param {object | null} [moveAnalysis] - Optional analyzed move entry for badge display.
 * @returns {HTMLElement} Button element for a move or placeholder span.
 */
function createHistoryMoveCell(move, moveIndex, activeHistoryIndex, moveAnalysis = null) {
  if (!move) {
    const placeholder = document.createElement('span');
    placeholder.className = 'history-placeholder';
    return placeholder;
  }

  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'history-move-btn';
  moveBtn.disabled = state.isPendingRequest;
  moveBtn.classList.toggle('is-active', moveIndex === activeHistoryIndex);

  const sanSpan = document.createElement('span');
  sanSpan.textContent = move.san;
  moveBtn.appendChild(sanSpan);

  if (moveAnalysis) {
    const badgeInfo = getClassificationBadgeInfo(moveAnalysis.classification);
    const pill = document.createElement('span');
    pill.className = 'move-class-pill';
    pill.style.color = badgeInfo.color;
    pill.textContent = badgeInfo.symbol;
    pill.title = badgeInfo.label;
    moveBtn.appendChild(pill);
  }

  moveBtn.addEventListener('click', () => setReviewPly(moveIndex + 1));
  return moveBtn;
}

/**
 * Renders the move list grouped into numbered clickable White/Black pairs.
 *
 * @param {object} view - Resolved review/live view state.
 * @param {object | null} [activeAnalysis] - Completed game analysis report, if available.
 * @returns {void}
 */
function renderHistory(view, activeAnalysis = null) {
  const history = state.game?.history ?? [];
  elements.moveHistory.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No moves played yet. Make a move on the board!';
    elements.moveHistory.appendChild(empty);
    return;
  }

  for (let i = 0; i < history.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const num = document.createElement('span');
    num.className = 'history-num';
    num.textContent = `${i / 2 + 1}.`;

    const whiteCell = createHistoryMoveCell(
      history[i],
      i,
      view.activeHistoryIndex,
      activeAnalysis?.moves?.[i] ?? null
    );
    const blackCell = createHistoryMoveCell(
      history[i + 1],
      i + 1,
      view.activeHistoryIndex,
      activeAnalysis?.moves?.[i + 1] ?? null
    );

    row.append(num, whiteCell, blackCell);
    elements.moveHistory.appendChild(row);
  }

  if (!view.isReviewing) {
    elements.moveHistory.scrollTop = elements.moveHistory.scrollHeight;
  } else if (view.effectivePly === 0) {
    elements.moveHistory.scrollTop = 0;
  } else {
    const activeBtn = elements.moveHistory.querySelector('.history-move-btn.is-active');
    activeBtn?.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Renders the game mode switch, bot cards, color selector, and time control pills in the New Game setup tab.
 *
 * @returns {void}
 */
function renderSetupOptions() {
  const isFriendMode = state.selectedMode === 'friend';
  elements.modeBotBtn.classList.toggle('is-selected', !isFriendMode);
  elements.modeFriendBtn.classList.toggle('is-selected', isFriendMode);
  elements.botSetupSection.hidden = isFriendMode;
  elements.friendSetupSection.hidden = !isFriendMode;
  elements.colorRandomBtn.hidden = !isFriendMode;
  elements.colorPicker.classList.toggle('is-three-cols', isFriendMode);
  if (!isFriendMode && state.selectedColor === 'random') {
    state.selectedColor = 'w';
  }
  elements.newGameBtn.textContent = isFriendMode ? 'Create Friend Link' : 'Play';

  elements.botList.innerHTML = '';
  for (const bot of state.bots) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `bot-card${state.selectedBotId === bot.id ? ' is-selected' : ''}`;
    card.setAttribute('aria-pressed', String(state.selectedBotId === bot.id));

    const avatar = document.createElement('div');
    avatar.className = 'bot-card-avatar';
    avatar.innerHTML = getAvatarSvg(bot.avatarId);

    const info = document.createElement('div');
    info.className = 'bot-card-info';

    const title = document.createElement('div');
    title.className = 'bot-card-title';
    title.innerHTML = `${bot.name} <span class="bot-card-rating">(${bot.rating})</span>`;

    const tagline = document.createElement('div');
    tagline.className = 'bot-card-tagline';
    tagline.textContent = bot.tagline;

    info.append(title, tagline);
    card.append(avatar, info);
    card.addEventListener('click', () => {
      state.selectedBotId = bot.id;
      renderSetupOptions();
    });
    elements.botList.appendChild(card);
  }

  elements.colorWhiteBtn.classList.toggle('is-selected', state.selectedColor === 'w');
  elements.colorBlackBtn.classList.toggle('is-selected', state.selectedColor === 'b');
  elements.colorRandomBtn.classList.toggle('is-selected', state.selectedColor === 'random');

  elements.timeControlList.innerHTML = '';
  for (const tc of state.timeControls) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `time-pill${state.selectedTimeControl === tc.id ? ' is-selected' : ''}`;
    pill.textContent = tc.label;
    pill.addEventListener('click', () => {
      state.selectedTimeControl = tc.id;
      renderSetupOptions();
    });
    elements.timeControlList.appendChild(pill);
  }
}

/**
 * Resolves any active incoming friend offer (draw, takeback, or rematch) awaiting this player's response.
 *
 * @param {object} game - Current friend game snapshot.
 * @param {'w' | 'b' | null} viewerColor - Controlled piece color.
 * @returns {{ endpoint: 'draw' | 'takeback' | 'rematch', label: string } | null} Active prompt details or null.
 */
function resolveIncomingOffer(game, viewerColor) {
  if (game.mode !== 'friend' || !viewerColor) {
    return null;
  }
  const opponentColor = viewerColor === 'w' ? 'b' : 'w';
  const opponentName = game.players?.[opponentColor]?.name ?? 'Friend';
  if (game.status === 'playing' && game.pendingDrawBy === opponentColor) {
    return { endpoint: 'draw', label: `${opponentName} offered a draw` };
  }
  if (game.status === 'playing' && game.pendingTakebackBy === opponentColor) {
    return { endpoint: 'takeback', label: `${opponentName} requested a takeback` };
  }
  if (
    game.status !== 'playing' &&
    game.status !== 'waiting' &&
    game.pendingRematchBy === opponentColor
  ) {
    return { endpoint: 'rematch', label: `${opponentName} wants a rematch` };
  }
  return null;
}

/**
 * Updates the Chess.com-style Game Over overlay visibility and outcome copy.
 *
 * @param {object} game - Current game snapshot.
 * @returns {void}
 */
function renderGameOverModal(game) {
  const isFinished = game && game.status !== 'playing' && game.status !== 'waiting';
  const currentRound = game?.round ?? 1;
  const isDismissed =
    state.dismissedGameOverForId === game?.id && state.dismissedGameOverRound === currentRound;
  const shouldShow = isFinished && !state.isPendingRequest && !isDismissed;

  if (!shouldShow) {
    elements.gameOverModal.hidden = true;
    return;
  }

  const outcome = describeGameOutcome(game);
  const viewerColor = getViewerColor();
  elements.gameOverTitle.textContent = outcome.headline;
  elements.gameOverSubtitle.textContent = outcome.subtitle;
  elements.gameOverScore.textContent = outcome.score;
  elements.gameOverPlayerAvatar.innerHTML = getAvatarSvg('player');
  elements.gameOverBotAvatar.innerHTML = getAvatarSvg(
    game.mode === 'friend' ? 'player' : game.bot?.avatarId ?? 'elani'
  );
  elements.modalNewGameBtn.textContent = game.mode === 'friend' ? 'New Game' : 'New Bot';
  elements.modalReviewBtn.hidden = !canReviewGame(game);
  elements.modalReviewBtn.disabled = Boolean(state.analysisProgress);

  if (game.mode === 'friend') {
    if (!viewerColor) {
      elements.modalRematchBtn.hidden = true;
    } else {
      elements.modalRematchBtn.hidden = false;
      const opponentColor = viewerColor === 'w' ? 'b' : 'w';
      const sentByMe = game.pendingRematchBy === viewerColor;
      const sentByOpp = game.pendingRematchBy === opponentColor;
      elements.modalRematchBtn.disabled = sentByMe;
      elements.modalRematchBtn.textContent = sentByMe
        ? 'Waiting...'
        : sentByOpp
          ? 'Accept Rematch'
          : 'Rematch';
    }
  } else {
    elements.modalRematchBtn.hidden = false;
    elements.modalRematchBtn.disabled = false;
    elements.modalRematchBtn.textContent = 'Rematch';
  }

  elements.gameOverModal.hidden = false;
}

/**
 * Updates all UI panels from current application state.
 *
 * @returns {void}
 */
function renderApp() {
  if (!state.game) {
    elements.statusBanner.textContent = state.isPendingRequest
      ? 'Starting game...'
      : 'Unable to load game';
    elements.statusBanner.classList.remove('is-check', 'is-over', 'is-review');
    elements.returnLiveBtn.hidden = true;
    elements.inviteLinkBox.hidden = true;
    elements.joinMatchBox.hidden = true;
    elements.friendOfferBanner.hidden = true;
    elements.undoBtn.disabled = true;
    elements.drawBtn.hidden = true;
    elements.resignBtn.disabled = true;
    elements.newGameBtn.disabled = state.isPendingRequest;
    elements.rematchBtn.disabled = state.isPendingRequest;
    elements.reviewFirstBtn.disabled = true;
    elements.reviewPrevBtn.disabled = true;
    elements.reviewNextBtn.disabled = true;
    elements.reviewLiveBtn.disabled = true;
    elements.reviewAnalyzeBtn.hidden = true;
    elements.evalBar.hidden = true;
    elements.analysisPanel.hidden = true;
    elements.gameOverModal.hidden = true;
    return;
  }

  const game = state.game;
  const isFriendMode = game.mode === 'friend';
  const viewerColor = getViewerColor();
  const activeAnalysis = getActiveAnalysis(game);
  const view = resolveReviewViewState(game, state.reviewPly);
  if (!view.isReviewing && state.reviewPly !== null) {
    state.reviewPly = null;
  }

  const banner = formatStatusBanner(game, view);
  elements.statusBanner.textContent = banner.text;
  elements.statusBanner.classList.toggle('is-check', banner.isCheck);
  elements.statusBanner.classList.toggle('is-over', banner.isOver);
  elements.statusBanner.classList.toggle('is-review', banner.isReview);
  elements.returnLiveBtn.hidden = !view.isReviewing || state.isPendingRequest;

  elements.botTaglineBox.hidden = isFriendMode;
  elements.botTagline.textContent = game.bot?.tagline ?? 'Good luck!';

  // Invite and Join cards only appear in friend rooms while waiting for the second player.
  const showInvite = isFriendMode && game.status === 'waiting' && Boolean(viewerColor);
  const showJoin = isFriendMode && game.status === 'waiting' && !viewerColor;
  elements.inviteLinkBox.hidden = !showInvite;
  if (showInvite) {
    elements.inviteLinkInput.value = resolveInviteUrl(window.location.origin, game.id);
  }
  elements.joinMatchBox.hidden = !showJoin;
  if (showJoin) {
    const openSide = game.players?.w?.joined ? 'Black' : 'White';
    elements.joinMatchLabel.textContent = `Join match as ${openSide}`;
    elements.joinMatchBtn.disabled = state.isPendingRequest;
  }

  const incomingOffer = resolveIncomingOffer(game, viewerColor);
  elements.friendOfferBanner.hidden = !incomingOffer;
  if (incomingOffer) {
    elements.friendOfferText.textContent = incomingOffer.label;
    elements.offerAcceptBtn.disabled = state.isPendingRequest;
    elements.offerDeclineBtn.disabled = state.isPendingRequest;
  }

  if (isFriendMode) {
    const isParticipant = Boolean(viewerColor);
    const hasPlayedMove = isParticipant && game.history.some((move) => move.color === viewerColor);
    const canRequestTakeback =
      !state.isPendingRequest &&
      !view.isReviewing &&
      isParticipant &&
      game.status === 'playing' &&
      hasPlayedMove &&
      !game.pendingTakebackBy;
    const canOfferDraw =
      !state.isPendingRequest &&
      !view.isReviewing &&
      isParticipant &&
      game.status === 'playing' &&
      !game.pendingDrawBy;
    const canResign =
      !state.isPendingRequest && !view.isReviewing && isParticipant && game.status === 'playing';
    const isFinished = game.status !== 'playing' && game.status !== 'waiting';
    const canRematch =
      !state.isPendingRequest &&
      isParticipant &&
      isFinished &&
      game.pendingRematchBy !== viewerColor;

    elements.undoBtn.textContent =
      isParticipant && game.pendingTakebackBy === viewerColor ? 'Requested...' : 'Takeback';
    elements.undoBtn.disabled = !canRequestTakeback;
    elements.drawBtn.hidden = !isParticipant;
    elements.drawBtn.textContent =
      isParticipant && game.pendingDrawBy === viewerColor ? 'Offered...' : 'Draw';
    elements.drawBtn.disabled = !canOfferDraw;
    elements.resignBtn.disabled = !canResign;
    elements.rematchBtn.textContent =
      isParticipant && game.pendingRematchBy === viewerColor ? 'Waiting...' : 'Rematch';
    elements.rematchBtn.disabled = !canRematch;
  } else {
    const minUndoPlies = game.playerColor === 'b' ? 1 : 0;
    const canUndo =
      !state.isPendingRequest && !view.isReviewing && game.history.length > minUndoPlies;
    const canResign =
      !state.isPendingRequest && game.status === 'playing' && !view.isReviewing;

    elements.undoBtn.textContent = 'Takeback';
    elements.undoBtn.disabled = !canUndo;
    elements.drawBtn.hidden = true;
    elements.resignBtn.disabled = !canResign;
    elements.rematchBtn.textContent = 'Rematch';
    elements.rematchBtn.disabled = state.isPendingRequest;
  }

  elements.newGameBtn.disabled = state.isPendingRequest;
  elements.reviewFirstBtn.disabled = state.isPendingRequest || !view.canStepBackward;
  elements.reviewPrevBtn.disabled = state.isPendingRequest || !view.canStepBackward;
  elements.reviewNextBtn.disabled = state.isPendingRequest || !view.canStepForward;
  elements.reviewLiveBtn.disabled = state.isPendingRequest || !view.canStepForward;
  elements.reviewAnalyzeBtn.hidden = !canReviewGame(game);
  elements.reviewAnalyzeBtn.disabled = state.isPendingRequest || Boolean(state.analysisProgress);
  elements.reviewAnalyzeBtn.textContent = activeAnalysis ? 'Review Ready' : 'Game Review';

  renderPlayerCards(view);
  renderEvalBar(view, activeAnalysis);
  renderBoard(view, activeAnalysis);
  renderHistory(view, activeAnalysis);
  renderAnalysisPanel(view, activeAnalysis);
  renderGameOverModal(game);
}

/**
 * Opens the pawn promotion picker modal for a pending move.
 *
 * @param {string} from - Origin square.
 * @param {string} to - Destination promotion square.
 * @param {string[]} choices - Allowed promotion piece codes.
 * @returns {void}
 */
function openPromotionModal(from, to, choices) {
  state.pendingPromotion = { from, to };
  elements.promotionChoices.innerHTML = '';
  const color = getViewerColor() ?? state.game.turn;

  for (const pieceType of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'promotion-btn';

    const svgWrap = document.createElement('span');
    svgWrap.className = 'promotion-svg';
    svgWrap.innerHTML = getPieceSvg(color, pieceType);

    const label = document.createElement('span');
    label.className = 'promotion-label';
    label.textContent = PROMOTION_LABELS[pieceType] ?? pieceType;

    btn.append(svgWrap, label);
    btn.addEventListener('click', () => {
      const pending = state.pendingPromotion;
      closePromotionModal();
      if (pending) {
        submitMove(pending.from, pending.to, pieceType);
      }
    });
    elements.promotionChoices.appendChild(btn);
  }

  elements.promotionModal.hidden = false;
}

/**
 * Closes the pawn promotion modal and clears pending promotion state.
 *
 * @returns {void}
 */
function closePromotionModal() {
  state.pendingPromotion = null;
  elements.promotionModal.hidden = true;
}

/**
 * Plays the appropriate chess audio cue based on the executed move(s) and game status.
 *
 * @param {object} previousGame - Game snapshot before the action.
 * @param {object} nextGame - Game snapshot after the action.
 * @returns {void}
 */
function playSoundForTransition(previousGame, nextGame) {
  if (nextGame.status !== 'playing' && previousGame?.status === 'playing') {
    playChessSound('gameOver', state.isMuted);
    return;
  }
  const latest = nextGame.history.at(-1);
  if (!latest) {
    return;
  }
  if (nextGame.inCheck) {
    playChessSound('check', state.isMuted);
  } else if (latest.san === 'O-O' || latest.san === 'O-O-O') {
    playChessSound('castle', state.isMuted);
  } else if (latest.captured) {
    playChessSound('capture', state.isMuted);
  } else {
    playChessSound('move', state.isMuted);
  }
}

/**
 * Runs an async API action while locking board input and surfacing request errors.
 *
 * @param {() => Promise<void>} task - Async API operation updating state.game.
 * @returns {Promise<void>}
 */
async function runPendingAction(task) {
  if (state.isPendingRequest) {
    return;
  }

  closePromotionModal();
  setErrorMessage(null);
  state.selectedSquare = null;
  state.isPendingRequest = true;
  renderApp();

  try {
    await task();
  } catch (err) {
    setErrorMessage(err.message);
  } finally {
    state.isPendingRequest = false;
    renderApp();
  }
}

/**
 * Sends a move to the backend API and updates game state with the AI reply.
 *
 * @param {string} from - Origin square.
 * @param {string} to - Target square.
 * @param {string} [promotion] - Optional promotion piece code.
 * @returns {Promise<void>}
 */
async function submitMove(from, to, promotion) {
  if (!state.game) {
    return;
  }

  const prevGame = state.game;
  await runPendingAction(async () => {
    const result = await requestJson(`/api/games/${state.game.id}/move`, {
      method: 'POST',
      body: JSON.stringify({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      }),
    });
    state.game = result.game;
    state.reviewPly = null;
    state.markedSquares.clear();
    state.arrows.clear();
    syncLocalClockBaseline(result.game);
    playSoundForTransition(prevGame, result.game);
  });
}

/**
 * Attempts to play a move from fromSquare to toSquare, prompting for promotion when needed.
 *
 * @param {string} fromSquare - Origin algebraic square.
 * @param {string} toSquare - Target algebraic square.
 * @returns {boolean} True if the move is legal and either submitted or opened promotion modal.
 */
function tryPlayOrPromoteMove(fromSquare, toSquare) {
  const { game } = state;
  if (!game) {
    return false;
  }

  const candidateMoves = getLegalMovesFromSquare(game, fromSquare).filter(
    (move) => move.to === toSquare
  );
  if (candidateMoves.length === 0) {
    return false;
  }

  const promotionChoices = candidateMoves
    .map((move) => move.promotion)
    .filter(Boolean);
  if (promotionChoices.length > 0) {
    openPromotionModal(fromSquare, toSquare, promotionChoices);
    return true;
  }

  submitMove(fromSquare, toSquare);
  return true;
}

/**
 * Handles left-click semantics for selecting a friendly piece or playing a legal target move.
 *
 * @param {string} squareName - Clicked algebraic square.
 * @param {{ type: string, color: 'w' | 'b' } | null} piece - Piece on clicked square, if any.
 * @returns {void}
 */
/**
 * Handles square selection or move submission for the viewer's controlled color.
 *
 * @param {string} squareName - Algebraic square clicked by the player.
 * @param {{ color: 'w' | 'b', type: string } | null} piece - Piece occupying the clicked square, if any.
 */
function handleSquareSelectOrMove(squareName, piece) {
  const { game } = state;
  const viewerColor = getViewerColor();
  if (
    !game ||
    state.isPendingRequest ||
    !canInteractWithBoard(game, viewerColor, state.reviewPly !== null)
  ) {
    return;
  }

  if (state.selectedSquare === squareName) {
    state.selectedSquare = null;
    renderApp();
    return;
  }

  if (state.selectedSquare && tryPlayOrPromoteMove(state.selectedSquare, squareName)) {
    return;
  }

  state.selectedSquare = piece && piece.color === viewerColor ? squareName : null;
  renderApp();
}

/**
 * Updates selection, legal target dots, and dragging origin classes in place so active pointer nodes stay attached.
 *
 * @param {string | null} selectedSquare - Selected algebraic square or null to clear.
 * @param {boolean} isDragging - Whether a drag gesture is actively hiding the origin piece.
 * @returns {void}
 */
function applySelectionClasses(selectedSquare, isDragging) {
  const legalTargets = new Set(
    getLegalMovesFromSquare(state.game, selectedSquare).map((m) => m.to)
  );

  for (const btn of elements.board.querySelectorAll('.square')) {
    const sq = btn.dataset.square;
    const isOrigin = sq === selectedSquare;
    btn.classList.toggle('selected', isOrigin);
    btn.classList.toggle('legal-target', legalTargets.has(sq));
    btn.classList.toggle('has-piece', legalTargets.has(sq) && Boolean(btn.querySelector('.piece')));
    const pieceEl = btn.querySelector('.piece');
    if (pieceEl) {
      pieceEl.classList.toggle('is-dragging-origin', isDragging && isOrigin);
    }
  }
}

/**
 * Clears active drag ghost state and hover highlights.
 *
 * @returns {void}
 */
function clearDragState() {
  state.dragState = null;
  elements.dragGhost.hidden = true;
  elements.dragGhost.innerHTML = '';
  for (const cell of elements.board.querySelectorAll('.drag-hover')) {
    cell.classList.remove('drag-hover');
  }
  for (const pieceEl of elements.board.querySelectorAll('.is-dragging-origin')) {
    pieceEl.classList.remove('is-dragging-origin');
  }
}

/**
 * Handles pointerdown on the board for both left drag/click moves and right-click arrows/highlights.
 *
 * @param {PointerEvent} event - Board pointerdown event.
 * @returns {void}
 */
function handleBoardPointerDown(event) {
  if (!state.game || state.isPendingRequest) {
    return;
  }

  const rect = elements.board.getBoundingClientRect();
  const squareName = resolveSquareFromPoint(event.clientX, event.clientY, rect, state.isFlipped);
  if (!squareName) {
    return;
  }

  if (event.button === 2) {
    state.rightDragStartSquare = squareName;
    return;
  }

  if (event.button !== 0) {
    return;
  }

  if (state.markedSquares.size > 0 || state.arrows.size > 0) {
    state.markedSquares.clear();
    state.arrows.clear();
    renderBoardArrows();
    for (const el of elements.board.querySelectorAll('.right-marked')) {
      el.classList.remove('right-marked');
    }
  }

  const view = resolveReviewViewState(state.game, state.reviewPly);
  const viewerColor = getViewerColor();
  if (!canInteractWithBoard(state.game, viewerColor, view.isReviewing)) {
    return;
  }

  const squareBtn = elements.board.querySelector(`[data-square="${squareName}"]`);
  const fileIdx = FILES.indexOf(squareName[0]);
  const rowIdx = 8 - Number(squareName[1]);
  const piece = view.board?.[rowIdx]?.[fileIdx] ?? null;

  if (piece && piece.color === viewerColor) {
    state.dragState = {
      fromSquare: squareName,
      piece,
      startX: event.clientX,
      startY: event.clientY,
      hasDragged: false,
      wasAlreadySelected: state.selectedSquare === squareName,
    };
    if (squareBtn?.setPointerCapture) {
      try {
        squareBtn.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failure on synthetic test events.
      }
    }
  } else {
    handleSquareSelectOrMove(squareName, piece);
  }
}

/**
 * Tracks floating piece position during pointer drag-and-drop.
 *
 * @param {PointerEvent} event - Global pointermove event.
 * @returns {void}
 */
function handlePointerMove(event) {
  const drag = state.dragState;
  if (!drag) {
    return;
  }

  const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (!drag.hasDragged && distance > 6) {
    drag.hasDragged = true;
    state.selectedSquare = drag.fromSquare;
    // Update classes in place instead of rebuilding the board grid so pointer capture stays intact.
    applySelectionClasses(drag.fromSquare, true);
    elements.dragGhost.innerHTML = getPieceSvg(drag.piece.color, drag.piece.type);
    elements.dragGhost.hidden = false;
  }

  if (!drag.hasDragged) {
    return;
  }

  elements.dragGhost.style.left = `${event.clientX}px`;
  elements.dragGhost.style.top = `${event.clientY}px`;

  const rect = elements.board.getBoundingClientRect();
  const hoverSquare = resolveSquareFromPoint(event.clientX, event.clientY, rect, state.isFlipped);
  for (const cell of elements.board.querySelectorAll('.drag-hover')) {
    cell.classList.remove('drag-hover');
  }
  if (hoverSquare) {
    const hoverCell = elements.board.querySelector(`[data-square="${hoverSquare}"]`);
    hoverCell?.classList.add('drag-hover');
  }
}

/**
 * Completes drag-and-drop move execution, click selection, or right-click annotations on pointerup.
 *
 * @param {PointerEvent} event - Global pointerup event.
 * @returns {void}
 */
function handlePointerUp(event) {
  if (event.button === 2 && state.rightDragStartSquare) {
    const startSquare = state.rightDragStartSquare;
    state.rightDragStartSquare = null;
    const rect = elements.board.getBoundingClientRect();
    const endSquare = resolveSquareFromPoint(event.clientX, event.clientY, rect, state.isFlipped);
    if (!endSquare) {
      return;
    }
    if (endSquare === startSquare) {
      if (state.markedSquares.has(endSquare)) {
        state.markedSquares.delete(endSquare);
      } else {
        state.markedSquares.add(endSquare);
      }
      renderBoard(resolveReviewViewState(state.game, state.reviewPly));
    } else {
      const arrowKey = `${startSquare}->${endSquare}`;
      if (state.arrows.has(arrowKey)) {
        state.arrows.delete(arrowKey);
      } else {
        state.arrows.add(arrowKey);
      }
      renderBoardArrows();
    }
    return;
  }

  const drag = state.dragState;
  if (!drag) {
    return;
  }

  const rect = elements.board.getBoundingClientRect();
  const dropSquare = resolveSquareFromPoint(event.clientX, event.clientY, rect, state.isFlipped);
  const wasDragged = drag.hasDragged;
  const fromSquare = drag.fromSquare;
  const piece = drag.piece;
  const wasAlreadySelected = drag.wasAlreadySelected;
  clearDragState();

  if (wasDragged) {
    if (dropSquare && dropSquare !== fromSquare && tryPlayOrPromoteMove(fromSquare, dropSquare)) {
      return;
    }
    if (dropSquare && dropSquare !== fromSquare) {
      playChessSound('illegal', state.isMuted);
    }
    state.selectedSquare = fromSquare;
    renderApp();
    return;
  }

  // Treat short non-dragged presses as standard click-to-select/deselect.
  if (wasAlreadySelected) {
    state.selectedSquare = null;
    renderApp();
  } else {
    handleSquareSelectOrMove(fromSquare, piece);
  }
}

/**
 * Switches the board between live play (null) and a specific historical review ply.
 *
 * @param {number | null} targetPly - Target ply index (0..history.length-1), or null for live.
 * @returns {void}
 */
function setReviewPly(targetPly) {
  if (!state.game || state.isPendingRequest) {
    return;
  }

  closePromotionModal();
  state.selectedSquare = null;
  const totalPlies = state.game.history.length;
  state.reviewPly =
    targetPly === null || targetPly >= totalPlies ? null : Math.max(0, targetPly);
  renderApp();
}

/**
 * Steps the history viewer one ply backward when earlier positions exist.
 *
 * @returns {void}
 */
function stepReviewBackward() {
  if (!state.game || state.isPendingRequest) {
    return;
  }
  const view = resolveReviewViewState(state.game, state.reviewPly);
  if (!view.canStepBackward) {
    return;
  }
  setReviewPly(view.effectivePly - 1);
}

/**
 * Steps the history viewer one ply forward toward the live position.
 *
 * @returns {void}
 */
function stepReviewForward() {
  if (!state.game || state.isPendingRequest) {
    return;
  }
  const view = resolveReviewViewState(state.game, state.reviewPly);
  if (!view.canStepForward) {
    return;
  }
  setReviewPly(view.effectivePly + 1);
}

/**
 * Handles Left/Right arrow keys for navigating move history without interfering with inputs or modals.
 *
 * @param {KeyboardEvent} event - Document keydown event.
 * @returns {void}
 */
function handleHistoryKeydown(event) {
  if (!state.game || state.isPendingRequest || !elements.promotionModal.hidden) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const target = event.target;
  const tagName = target?.tagName;
  if (
    tagName === 'INPUT' ||
    tagName === 'SELECT' ||
    tagName === 'TEXTAREA' ||
    target?.isContentEditable
  ) {
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    stepReviewBackward();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    stepReviewForward();
  }
}

/**
 * Synchronizes server clock expiration when the client countdown reaches 0ms.
 *
 * @returns {Promise<void>}
 */
async function triggerServerTimeoutCheck() {
  if (!state.game || state.game.status !== 'playing' || state.isPendingRequest) {
    return;
  }

  const prevGame = state.game;
  try {
    const synced = await requestJson(`/api/games/${state.game.id}/timeout`, {
      method: 'POST',
    });
    state.game = synced;
    syncLocalClockBaseline(synced);
    if (synced.status !== 'playing') {
      playSoundForTransition(prevGame, synced);
      renderApp();
    } else if (synced.clock?.isRunning && synced.clock.activeColor) {
      // Wait the tiny drift delta before checking timeout again if the client ticked slightly ahead of server.
      const remaining = synced.clock.remainingMs[synced.clock.activeColor];
      setTimeout(() => {
        state.timeoutTriggeredForMove = false;
      }, Math.max(50, remaining + 20));
    }
  } catch (err) {
    setErrorMessage(err.message);
  }
}

/**
 * Closes any active Server-Sent Events stream for friend matches.
 *
 * @returns {void}
 */
function disconnectGameEvents() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

/**
 * Applies an incoming public game snapshot received over SSE without duplicating own-move sounds.
 *
 * @param {object} incoming - Parsed public game snapshot from the server SSE stream.
 * @returns {void}
 */
function applyIncomingSseGame(incoming) {
  const prevGame = state.game;
  if (!prevGame || !incoming || incoming.id !== prevGame.id) {
    return;
  }

  const isUnchanged =
    prevGame.history.length === incoming.history.length &&
    prevGame.status === incoming.status &&
    prevGame.turn === incoming.turn &&
    prevGame.round === incoming.round &&
    prevGame.players?.w?.joined === incoming.players?.w?.joined &&
    prevGame.players?.b?.joined === incoming.players?.b?.joined &&
    prevGame.players?.w?.slot === incoming.players?.w?.slot &&
    prevGame.players?.b?.slot === incoming.players?.b?.slot &&
    prevGame.pendingDrawBy === incoming.pendingDrawBy &&
    prevGame.pendingTakebackBy === incoming.pendingTakebackBy &&
    prevGame.pendingRematchBy === incoming.pendingRematchBy;
  if (isUnchanged) {
    return;
  }

  const roundChanged = (prevGame.round ?? 1) !== (incoming.round ?? 1);
  const historyShrunk = incoming.history.length < prevGame.history.length;
  if (roundChanged || historyShrunk) {
    cancelActiveAnalysis();
    state.analysis = null;
    state.analysisKey = null;
    state.reviewPly = null;
    state.selectedSquare = null;
    state.dismissedGameOverForId = null;
    state.dismissedGameOverRound = null;
    state.timeoutTriggeredForMove = false;
  }
  if (roundChanged) {
    state.markedSquares.clear();
    state.arrows.clear();
    // Rematches swap colors in place, so flip the board to keep the viewer's pieces at the bottom.
    const nextViewerColor = resolveViewerColor(incoming, state.viewerSlot);
    if (nextViewerColor) {
      state.isFlipped = nextViewerColor === 'b';
    }
  }

  state.game = incoming;
  syncLocalClockBaseline(incoming);
  if (incoming.history.length > prevGame.history.length || incoming.status !== prevGame.status) {
    playSoundForTransition(prevGame, incoming);
  }
  renderApp();
}

/**
 * Opens an SSE stream for a friend game room so moves, offers, and rematches sync live.
 *
 * @param {string} gameId - Friend room identifier.
 * @returns {void}
 */
function connectGameEvents(gameId) {
  disconnectGameEvents();
  if (typeof EventSource !== 'function' || !gameId) {
    return;
  }

  const source = new EventSource(`/api/games/${encodeURIComponent(gameId)}/events`);
  state.eventSource = source;
  source.addEventListener('game', (event) => {
    try {
      const incoming = JSON.parse(event.data);
      applyIncomingSseGame(incoming);
    } catch {
      // Ignore malformed SSE frames so the stream stays alive.
    }
  });
}

/**
 * Starts a brand new bot or friend game from the setup panel and switches to the Play tab.
 *
 * @param {{ mode?: 'bot' | 'friend', botId?: string, playerColor?: 'w' | 'b' | 'random', timeControl?: string, playerName?: string }} [override] - Optional settings override for Rematch.
 * @returns {Promise<void>}
 */
async function startNewGame(override = {}) {
  const mode = override.mode ?? state.selectedMode;
  const playerColor = override.playerColor ?? state.selectedColor;
  const botId = override.botId ?? state.selectedBotId;
  const timeControl = override.timeControl ?? state.selectedTimeControl;
  const playerName =
    override.playerName ?? (elements.friendNameInput?.value?.trim() || undefined);

  await runPendingAction(async () => {
    cancelActiveAnalysis();
    state.analysis = null;
    state.analysisKey = null;
    disconnectGameEvents();
    const payload =
      mode === 'friend'
        ? { mode: 'friend', playerColor, timeControl, ...(playerName ? { playerName } : {}) }
        : { mode: 'bot', playerColor, botId, timeControl };

    const created = await requestJson('/api/games', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.game = created;
    state.seatToken = created.seatToken ?? null;
    state.viewerSlot = created.viewerSlot ?? null;
    state.reviewPly = null;
    state.dismissedGameOverForId = null;
    state.dismissedGameOverRound = null;
    state.markedSquares.clear();
    state.arrows.clear();

    if (mode === 'friend') {
      if (created.seatToken && created.viewerSlot) {
        saveSeatSession(created.id, created.seatToken, created.viewerSlot);
      }
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', `/?game=${encodeURIComponent(created.id)}`);
      }
      state.isFlipped = getViewerColor() === 'b';
      connectGameEvents(created.id);
    } else {
      if (window.history?.replaceState && window.location?.search) {
        window.history.replaceState(null, '', '/');
      }
      state.isFlipped = created.playerColor === 'b';
    }

    syncLocalClockBaseline(created);
    setActiveTab('play');
  });
}

/**
 * Claims the open seat in a waiting friend room and persists the returned seat token.
 *
 * @returns {Promise<void>}
 */
async function joinFriendMatch() {
  if (!state.game || state.game.mode !== 'friend' || state.game.status !== 'waiting') {
    return;
  }

  const playerName = elements.joinNameInput?.value?.trim() || undefined;
  await runPendingAction(async () => {
    const joined = await requestJson(`/api/games/${state.game.id}/join`, {
      method: 'POST',
      body: JSON.stringify(playerName ? { playerName } : {}),
    });
    state.game = joined;
    state.seatToken = joined.seatToken ?? null;
    state.viewerSlot = joined.viewerSlot ?? null;
    if (joined.seatToken && joined.viewerSlot) {
      saveSeatSession(joined.id, joined.seatToken, joined.viewerSlot);
    }
    state.isFlipped = getViewerColor() === 'b';
    syncLocalClockBaseline(joined);
    if (!state.eventSource) {
      connectGameEvents(joined.id);
    }
  });
}

/**
 * Sends a friend-room negotiation action (draw, takeback, or rematch) for the active seat.
 *
 * @param {'draw' | 'takeback' | 'rematch'} endpoint - Friend action route suffix.
 * @param {'offer' | 'request' | 'accept' | 'decline'} action - Action verb to send.
 * @returns {Promise<void>}
 */
async function sendFriendAction(endpoint, action) {
  if (!state.game || state.game.mode !== 'friend' || !getViewerColor()) {
    return;
  }

  const prevGame = state.game;
  await runPendingAction(async () => {
    const updated = await requestJson(`/api/games/${state.game.id}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    if ((prevGame.round ?? 1) !== (updated.round ?? 1)) {
      cancelActiveAnalysis();
      state.analysis = null;
      state.analysisKey = null;
      state.reviewPly = null;
      state.dismissedGameOverForId = null;
      state.dismissedGameOverRound = null;
      state.markedSquares.clear();
      state.arrows.clear();
      state.isFlipped = resolveViewerColor(updated, state.viewerSlot) === 'b';
    } else if (updated.history.length < prevGame.history.length) {
      cancelActiveAnalysis();
      state.analysis = null;
      state.analysisKey = null;
      state.reviewPly = null;
      state.dismissedGameOverForId = null;
      state.dismissedGameOverRound = null;
    }
    state.game = updated;
    syncLocalClockBaseline(updated);
    if (updated.status !== prevGame.status || updated.history.length !== prevGame.history.length) {
      playSoundForTransition(prevGame, updated);
    }
  });
}

/**
 * Copies the active friend invite URL to the clipboard with brief button feedback.
 *
 * @returns {Promise<void>}
 */
async function copyInviteLink() {
  const link = elements.inviteLinkInput?.value;
  if (!link) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
    } else {
      elements.inviteLinkInput.select();
      document.execCommand?.('copy');
    }
    elements.copyInviteBtn.textContent = 'Copied!';
    setTimeout(() => {
      if (elements.copyInviteBtn) {
        elements.copyInviteBtn.textContent = 'Copy';
      }
    }, 1500);
  } catch {
    elements.inviteLinkInput.select();
  }
}

/**
 * Resigns the active game for an authenticated player and displays the Game Over modal.
 *
 * @returns {Promise<void>}
 */
async function resignActiveGame() {
  if (!state.game || state.game.status !== 'playing' || state.reviewPly !== null) {
    return;
  }
  if (state.game.mode === 'friend' && !getViewerColor()) {
    return;
  }

  const prevGame = state.game;
  await runPendingAction(async () => {
    const updated = await requestJson(`/api/games/${state.game.id}/resign`, {
      method: 'POST',
    });
    state.game = updated;
    syncLocalClockBaseline(updated);
    playSoundForTransition(prevGame, updated);
  });
}

/**
 * Undoes the last turn in bot mode or requests a mutual takeback in friend mode.
 *
 * @returns {Promise<void>}
 */
async function undoTurn() {
  if (!state.game || state.reviewPly !== null) {
    return;
  }

  if (state.game.mode === 'friend') {
    if (state.game.status !== 'playing' || !getViewerColor()) {
      return;
    }
    await sendFriendAction('takeback', 'request');
    return;
  }

  await runPendingAction(async () => {
    const updated = await requestJson(`/api/games/${state.game.id}/undo`, {
      method: 'POST',
    });
    cancelActiveAnalysis();
    state.analysis = null;
    state.analysisKey = null;
    state.game = updated;
    state.reviewPly = null;
    state.dismissedGameOverForId = null;
    state.dismissedGameOverRound = null;
    syncLocalClockBaseline(updated);
  });
}

/**
 * Runs client-side Stockfish WASM analysis on the finished match and opens interactive Game Review.
 *
 * @returns {Promise<void>}
 */
async function startGameReview() {
  const game = state.game;
  if (!canReviewGame(game) || state.isPendingRequest || state.analysisProgress) {
    return;
  }

  dismissGameOverModal();
  setActiveTab('play');

  const key = getGameAnalysisKey(game);
  if (state.analysis && state.analysisKey === key) {
    if (state.reviewPly === null && game.history.length > 0) {
      state.reviewPly = 1;
    }
    renderApp();
    return;
  }

  cancelActiveAnalysis();
  setErrorMessage(null);
  const controller = new AbortController();
  state.analysisAbortController = controller;
  state.analysisProgress = { completed: 0, total: game.history.length + 1 };
  renderApp();

  try {
    if (!state.analyzer) {
      state.analyzer = createStockfishAnalyzer({
        scriptUrl: state.analysisScriptUrl,
        depth: 10,
      });
    }
    const report = await state.analyzer.analyzeGame(game, {
      depth: 10,
      signal: controller.signal,
      onProgress: (progress) => {
        state.analysisProgress = progress;
        renderAnalysisPanel(resolveReviewViewState(state.game, state.reviewPly), null);
      },
    });
    if (controller.signal.aborted || getGameAnalysisKey(state.game) !== key) {
      return;
    }
    state.analysis = report;
    state.analysisKey = key;
    if (state.reviewPly === null && game.history.length > 0) {
      state.reviewPly = 1;
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      setErrorMessage(err?.message || 'Unable to analyze game');
    }
  } finally {
    if (state.analysisAbortController === controller) {
      state.analysisAbortController = null;
      state.analysisProgress = null;
    }
    renderApp();
  }
}

/**
 * Maps a click on the SVG evaluation graph onto the nearest historical ply.
 *
 * @param {MouseEvent} event - Click event on the eval graph SVG.
 * @returns {void}
 */
function handleEvalGraphClick(event) {
  const activeAnalysis = getActiveAnalysis(state.game);
  if (!activeAnalysis || activeAnalysis.positions.length <= 1) {
    return;
  }
  const rect = elements.evalGraph.getBoundingClientRect();
  if (rect.width <= 0) {
    return;
  }
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const targetPly = Math.round(ratio * (activeAnalysis.positions.length - 1));
  setReviewPly(targetPly);
}

/**
 * Handles Rematch clicks uniformly for both the action bar and Game Over modal.
 *
 * @returns {Promise<void>}
 */
async function handleRematchAction() {
  if (!state.game) {
    return;
  }

  if (state.game.mode === 'friend') {
    const viewerColor = getViewerColor();
    if (!viewerColor) {
      return;
    }
    const opponentColor = viewerColor === 'w' ? 'b' : 'w';
    const action = state.game.pendingRematchBy === opponentColor ? 'accept' : 'request';
    await sendFriendAction('rematch', action);
    return;
  }

  await startNewGame({
    mode: 'bot',
    botId: state.game.bot?.id ?? state.selectedBotId,
    playerColor: state.game.playerColor ?? state.selectedColor,
    timeControl: state.game.clock?.timeControl ?? 'untimed',
  });
}

/**
 * Responds to whichever friend offer (draw, takeback, or rematch) is currently targeted at this viewer.
 *
 * @param {'accept' | 'decline'} action - Response action verb.
 * @returns {Promise<void>}
 */
async function respondToIncomingOffer(action) {
  if (!state.game || state.game.mode !== 'friend') {
    return;
  }
  const offer = resolveIncomingOffer(state.game, getViewerColor());
  if (!offer) {
    return;
  }
  await sendFriendAction(offer.endpoint, action);
}

/**
 * Toggles board orientation between White-bottom and Black-bottom views.
 *
 * @returns {void}
 */
function toggleBoardFlip() {
  state.isFlipped = !state.isFlipped;
  renderApp();
}

/**
 * Toggles synthesized sound effects on or off.
 *
 * @returns {void}
 */
function toggleSoundMute() {
  state.isMuted = !state.isMuted;
  elements.navSoundBtn.setAttribute('aria-pressed', String(!state.isMuted));
  elements.soundLabel.textContent = state.isMuted ? 'Muted' : 'Sound On';
}

/**
 * Updates the selected setup mode ('bot' or 'friend') and ensures valid side selection.
 *
 * @param {'bot' | 'friend'} mode - Selected game mode.
 * @returns {void}
 */
function setSelectedMode(mode) {
  state.selectedMode = mode;
  if (mode === 'bot' && state.selectedColor === 'random') {
    state.selectedColor = 'w';
  }
  renderSetupOptions();
}

/**
 * Updates the selected starting color preference in the setup panel.
 *
 * @param {'w' | 'b' | 'random'} color - Selected piece color preference.
 * @returns {void}
 */
function setSelectedColor(color) {
  state.selectedColor = color;
  renderSetupOptions();
}

/**
 * Dismisses the Game Over modal for the current room and round without hiding future rematch rounds.
 *
 * @returns {void}
 */
function dismissGameOverModal() {
  if (state.game) {
    state.dismissedGameOverForId = state.game.id;
    state.dismissedGameOverRound = state.game.round ?? 1;
  }
}

/**
 * Loads bots and time controls from /api/meta, then resumes a friend URL (?game=<id>) or creates an initial bot game.
 *
 * @returns {Promise<void>}
 */
async function bootstrapApp() {
  try {
    const meta = await requestJson('/api/meta');
    if (Array.isArray(meta.bots) && meta.bots.length > 0) {
      state.bots = meta.bots;
    }
    if (Array.isArray(meta.timeControls) && meta.timeControls.length > 0) {
      state.timeControls = meta.timeControls;
    }
    if (typeof meta.analysisEngine?.scriptUrl === 'string') {
      state.analysisScriptUrl = meta.analysisEngine.scriptUrl;
    }
  } catch {
    // Keep local fallback metadata if /api/meta temporarily fails.
  }

  const gameIdFromUrl = new URLSearchParams(window.location?.search ?? '').get('game')?.trim();
  if (gameIdFromUrl) {
    const savedSeat = loadSeatSession(gameIdFromUrl);
    state.seatToken = savedSeat?.seatToken ?? null;
    state.viewerSlot = savedSeat?.viewerSlot ?? null;
    try {
      const loaded = await requestJson(`/api/games/${encodeURIComponent(gameIdFromUrl)}`);
      state.game = loaded;
      state.viewerSlot = loaded.viewerSlot ?? state.viewerSlot;
      if (loaded.mode === 'friend') {
        state.selectedMode = 'friend';
        state.isFlipped = getViewerColor() === 'b';
        connectGameEvents(loaded.id);
      } else {
        state.isFlipped = loaded.playerColor === 'b';
      }
      renderSetupOptions();
      syncLocalClockBaseline(loaded);
      setActiveTab('play');
      renderApp();
      return;
    } catch (err) {
      state.seatToken = null;
      state.viewerSlot = null;
      renderSetupOptions();
      renderApp();
      setErrorMessage(err.message);
      return;
    }
  }

  renderSetupOptions();
  await startNewGame();
}

elements.navPlayBtn.addEventListener('click', () => setActiveTab('play'));
elements.navBotsBtn.addEventListener('click', () => setActiveTab('setup'));
elements.navFlipBtn.addEventListener('click', toggleBoardFlip);
elements.navSoundBtn.addEventListener('click', toggleSoundMute);
elements.tabPlayBtn.addEventListener('click', () => setActiveTab('play'));
elements.tabSetupBtn.addEventListener('click', () => setActiveTab('setup'));

elements.modeBotBtn.addEventListener('click', () => setSelectedMode('bot'));
elements.modeFriendBtn.addEventListener('click', () => setSelectedMode('friend'));
elements.colorWhiteBtn.addEventListener('click', () => setSelectedColor('w'));
elements.colorBlackBtn.addEventListener('click', () => setSelectedColor('b'));
elements.colorRandomBtn.addEventListener('click', () => setSelectedColor('random'));

elements.copyInviteBtn.addEventListener('click', copyInviteLink);
elements.joinMatchBtn.addEventListener('click', joinFriendMatch);
elements.joinNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    joinFriendMatch();
  }
});

elements.newGameBtn.addEventListener('click', () => startNewGame());
elements.flipBtn.addEventListener('click', toggleBoardFlip);
elements.undoBtn.addEventListener('click', undoTurn);
elements.drawBtn.addEventListener('click', () => sendFriendAction('draw', 'offer'));
elements.resignBtn.addEventListener('click', resignActiveGame);
elements.offerAcceptBtn.addEventListener('click', () => respondToIncomingOffer('accept'));
elements.offerDeclineBtn.addEventListener('click', () => respondToIncomingOffer('decline'));
elements.rematchBtn.addEventListener('click', handleRematchAction);
elements.modalReviewBtn.addEventListener('click', startGameReview);
elements.reviewAnalyzeBtn.addEventListener('click', startGameReview);
elements.analysisCancelBtn.addEventListener('click', () => {
  cancelActiveAnalysis();
  renderApp();
});
elements.evalGraph.addEventListener('click', handleEvalGraphClick);
elements.modalRematchBtn.addEventListener('click', handleRematchAction);
elements.modalNewGameBtn.addEventListener('click', () => {
  dismissGameOverModal();
  renderApp();
  setActiveTab('setup');
});
elements.gameOverCloseBtn.addEventListener('click', () => {
  dismissGameOverModal();
  renderApp();
});

elements.returnLiveBtn.addEventListener('click', () => setReviewPly(null));
elements.reviewFirstBtn.addEventListener('click', () => setReviewPly(0));
elements.reviewPrevBtn.addEventListener('click', stepReviewBackward);
elements.reviewNextBtn.addEventListener('click', stepReviewForward);
elements.reviewLiveBtn.addEventListener('click', () => setReviewPly(null));

elements.board.addEventListener('pointerdown', handleBoardPointerDown);
elements.board.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('pointermove', handlePointerMove);
document.addEventListener('pointerup', handlePointerUp);
document.addEventListener('pointercancel', clearDragState);
document.addEventListener('keydown', handleHistoryKeydown);

elements.promotionCancelBtn.addEventListener('click', () => {
  closePromotionModal();
  state.selectedSquare = null;
  renderApp();
});
elements.promotionModal.addEventListener('click', (event) => {
  if (event.target === elements.promotionModal) {
    closePromotionModal();
    state.selectedSquare = null;
    renderApp();
  }
});

setInterval(updateClockElements, 100);
bootstrapApp();
