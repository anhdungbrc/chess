const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_TYPES = new Set(['p', 'n', 'b', 'r', 'q', 'k']);

/**
 * Decodes the piece-placement segment of a FEN string into an 8x8 board matrix matching chess.board().
 *
 * @param {string} fen - Full or placement-only FEN string from backend game history.
 * @returns {Array<Array<{ square: string, type: string, color: 'w' | 'b' } | null>>} 8x8 board grid (row 0 = rank 8).
 * @throws {Error} When the FEN placement string is missing or does not represent an 8x8 board.
 */
export function parseFenBoard(fen) {
  if (typeof fen !== 'string' || !fen.trim()) {
    throw new Error('FEN string must be a non-empty string');
  }

  const placement = fen.trim().split(/\s+/)[0];
  const ranks = placement.split('/');
  if (ranks.length !== 8) {
    throw new Error(`Invalid FEN rank count: expected 8, got ${ranks.length}`);
  }

  const board = [];
  for (let row = 0; row < 8; row += 1) {
    const rankCells = [];
    for (const symbol of ranks[row]) {
      const emptyCount = Number(symbol);
      if (Number.isInteger(emptyCount) && emptyCount >= 1 && emptyCount <= 8) {
        for (let i = 0; i < emptyCount; i += 1) {
          rankCells.push(null);
        }
        continue;
      }

      const lower = symbol.toLowerCase();
      if (!PIECE_TYPES.has(lower)) {
        throw new Error(`Invalid FEN piece symbol: ${symbol}`);
      }

      const col = rankCells.length;
      if (col >= 8) {
        throw new Error(`FEN rank ${8 - row} exceeds 8 columns`);
      }

      rankCells.push({
        square: `${FILES[col]}${8 - row}`,
        type: lower,
        color: symbol === lower ? 'b' : 'w',
      });
    }

    if (rankCells.length !== 8) {
      throw new Error(`FEN rank ${8 - row} has ${rankCells.length} columns instead of 8`);
    }
    board.push(rankCells);
  }

  return board;
}

/**
 * Derives the board and navigation control state for either live play or a historical review ply.
 *
 * @param {object | null} game - Current game snapshot returned by the backend API.
 * @param {number | null} reviewPly - Target review ply (0..totalPlies-1), or null for live position.
 * @returns {{
 *   isReviewing: boolean,
 *   effectivePly: number,
 *   totalPlies: number,
 *   board: Array<Array<{ square: string, type: string, color: 'w' | 'b' } | null>> | null,
 *   turn: 'w' | 'b' | null,
 *   inCheck: boolean,
 *   lastMove: { from: string, to: string } | null,
 *   activeHistoryIndex: number,
 *   canStepBackward: boolean,
 *   canStepForward: boolean,
 * }} Resolved presentation view state.
 */
export function resolveReviewViewState(game, reviewPly) {
  if (!game) {
    return {
      isReviewing: false,
      effectivePly: 0,
      totalPlies: 0,
      board: null,
      turn: null,
      inCheck: false,
      lastMove: null,
      activeHistoryIndex: -1,
      canStepBackward: false,
      canStepForward: false,
    };
  }

  const history = game.history ?? [];
  const totalPlies = history.length;

  // Treat any ply at or beyond the latest move as live mode so callers cannot drift past current play.
  const isHistoricalPly =
    typeof reviewPly === 'number' &&
    Number.isFinite(reviewPly) &&
    totalPlies > 0 &&
    reviewPly < totalPlies;

  if (!isHistoricalPly) {
    return {
      isReviewing: false,
      effectivePly: totalPlies,
      totalPlies,
      board: game.board,
      turn: game.turn,
      inCheck: Boolean(game.inCheck),
      lastMove: game.lastMove ?? null,
      activeHistoryIndex: totalPlies - 1,
      canStepBackward: totalPlies > 0,
      canStepForward: false,
    };
  }

  const effectivePly = Math.max(0, Math.trunc(reviewPly));
  if (effectivePly === 0) {
    const startFen = game.initialFen;
    const startTurn = startFen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
    return {
      isReviewing: true,
      effectivePly: 0,
      totalPlies,
      board: parseFenBoard(startFen),
      turn: startTurn,
      inCheck: false,
      lastMove: null,
      activeHistoryIndex: -1,
      canStepBackward: false,
      canStepForward: true,
    };
  }

  const move = history[effectivePly - 1];
  const moveTurn = move.fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
  return {
    isReviewing: true,
    effectivePly,
    totalPlies,
    board: parseFenBoard(move.fen),
    turn: moveTurn,
    inCheck: Boolean(move.inCheck),
    lastMove: { from: move.from, to: move.to },
    activeHistoryIndex: effectivePly - 1,
    canStepBackward: true,
    canStepForward: true,
  };
}

/**
 * Formats a 1-based history ply into standard move-number notation for the review banner.
 *
 * @param {Array<{ color: 'w' | 'b', san: string }>} history - Game move history array.
 * @param {number} ply - 1-based ply index (1..history.length).
 * @returns {string} Formatted label such as '1. e4' or '1... e5', or empty string if out of range.
 */
export function formatReviewMoveLabel(history, ply) {
  const move = history?.[ply - 1];
  if (!move) {
    return '';
  }
  const moveNumber = Math.ceil(ply / 2);
  return move.color === 'w' ? `${moveNumber}. ${move.san}` : `${moveNumber}... ${move.san}`;
}

