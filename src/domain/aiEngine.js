import { Chess } from 'chess.js';

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const MATE_SCORE = 100000;
const HARD_NODE_BUDGET = 60000;

// Piece-square tables oriented from rank 8 (row 0) down to rank 1 (row 7) for White.
const PST = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
};

/**
 * Returns the positional piece-square bonus for a piece at (row, col).
 *
 * @param {'p' | 'n' | 'b' | 'r' | 'q' | 'k'} type - Piece type code.
 * @param {'w' | 'b'} color - Piece color.
 * @param {number} row - Board row index (0 is rank 8).
 * @param {number} col - Board column index (0 is file a).
 * @returns {number} Positional bonus in centipawns from that side's perspective.
 */
function getPieceSquareBonus(type, color, row, col) {
  const table = PST[type];
  if (!table) {
    return 0;
  }
  const tableRow = color === 'w' ? row : 7 - row;
  return table[tableRow][col];
}

/**
 * Evaluates a chess position statically from White's perspective.
 *
 * @param {Chess} chess - Active chess.js instance representing the current position.
 * @param {number} [remainingDepth=0] - Remaining search plies so faster mates rank higher.
 * @returns {number} Positive score favors White; negative score favors Black.
 */
export function evaluateBoard(chess, remainingDepth = 0) {
  if (chess.isCheckmate()) {
    // Prefer shorter mating sequences by rewarding larger remaining depth.
    return chess.turn() === 'w'
      ? -(MATE_SCORE + remainingDepth)
      : MATE_SCORE + remainingDepth;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!piece) {
        continue;
      }
      const material = PIECE_VALUES[piece.type] ?? 0;
      const positional = getPieceSquareBonus(piece.type, piece.color, row, col);
      const total = material + positional;
      score += piece.color === 'w' ? total : -total;
    }
  }
  return score;
}

/**
 * Computes a heuristic ordering score so alpha-beta examines strong tactical moves first.
 *
 * @param {import('chess.js').Move} move - Verbose move object from chess.js.
 * @returns {number} Priority score (higher is searched earlier).
 */
function scoreMoveForOrdering(move) {
  let priority = 0;
  if (move.captured) {
    // MVV-LVA prioritizes capturing high-value pieces with low-value attackers.
    const victim = PIECE_VALUES[move.captured] ?? 0;
    const attacker = PIECE_VALUES[move.piece] ?? 0;
    priority += victim * 10 - attacker;
  }
  if (move.promotion) {
    priority += PIECE_VALUES[move.promotion] ?? 0;
  }
  if (move.san.includes('#')) {
    priority += 50000;
  } else if (move.san.includes('+')) {
    priority += 50;
  }
  return priority;
}

/**
 * Returns moves sorted descending by tactical priority for faster alpha-beta pruning.
 *
 * @param {import('chess.js').Move[]} moves - Unordered legal moves.
 * @returns {import('chess.js').Move[]} Sorted copy of legal moves.
 */
function orderMoves(moves) {
  return [...moves].sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));
}

/**
 * Runs minimax search with alpha-beta pruning from White's maximizing perspective.
 *
 * @param {Chess} chess - Mutable chess.js instance updated in place via move/undo.
 * @param {number} depth - Remaining search depth in plies.
 * @param {number} alpha - Best guaranteed score for White.
 * @param {number} beta - Best guaranteed score for Black.
 * @param {boolean} isMaximizing - True when White is to move.
 * @param {{ nodes: number, budget: number }} state - Shared search budget tracker.
 * @returns {number} Evaluated minimax score for the current node.
 */
function minimax(chess, depth, alpha, beta, isMaximizing, state) {
  state.nodes += 1;
  if (depth === 0 || chess.isGameOver() || state.nodes >= state.budget) {
    return evaluateBoard(chess, depth);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = minimax(chess, depth - 1, alpha, beta, false, state);
      chess.undo();
      if (score > best) {
        best = score;
      }
      if (best > alpha) {
        alpha = best;
      }
      if (alpha >= beta || state.nodes >= state.budget) {
        break;
      }
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    chess.move(move);
    const score = minimax(chess, depth - 1, alpha, beta, true, state);
    chess.undo();
    if (score < best) {
      best = score;
    }
    if (best < beta) {
      beta = best;
    }
    if (alpha >= beta || state.nodes >= state.budget) {
      break;
    }
  }
  return best;
}

/**
 * Formats a chess.js verbose move into the domain move payload.
 *
 * @param {import('chess.js').Move} move - Selected chess.js move object.
 * @returns {{ from: string, to: string, promotion?: string, san: string }} Public move shape.
 */
function formatMoveResult(move) {
  return {
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion } : {}),
    san: move.san,
  };
}

/**
 * Selects an AI move for the given FEN position and difficulty level.
 *
 * @param {string} fen - Valid FEN position string.
 * @param {'easy' | 'medium' | 'hard'} difficulty - Desired AI strength level.
 * @returns {{ from: string, to: string, promotion?: string, san: string } | null} Best move or null if game over.
 * @throws {Error} When difficulty is unsupported or FEN is invalid.
 */
export function chooseAiMove(fen, difficulty) {
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw new Error(`Unsupported AI difficulty: ${difficulty}`);
  }

  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    return null;
  }

  const moves = orderMoves(chess.moves({ verbose: true }));
  const isMaximizing = chess.turn() === 'w';
  const depthByDifficulty = { easy: 1, medium: 2, hard: 3 };
  const depth = depthByDifficulty[difficulty];
  const state = { nodes: 0, budget: HARD_NODE_BUDGET };

  const scoredMoves = [];
  let alpha = -Infinity;
  let beta = Infinity;

  for (const move of moves) {
    chess.move(move);
    const score = minimax(chess, depth - 1, alpha, beta, !isMaximizing, state);
    chess.undo();
    scoredMoves.push({ move, score });

    if (isMaximizing) {
      if (score > alpha) {
        alpha = score;
      }
    } else if (score < beta) {
      beta = score;
    }
  }

  scoredMoves.sort((a, b) => (isMaximizing ? b.score - a.score : a.score - b.score));

  if (difficulty === 'easy') {
    // Keep immediate checkmates deterministic while adding variety across non-mating top moves.
    if (Math.abs(scoredMoves[0].score) >= MATE_SCORE) {
      return formatMoveResult(scoredMoves[0].move);
    }
    const candidateCount = Math.min(3, scoredMoves.length);
    const pickedIndex = Math.floor(Math.random() * candidateCount);
    return formatMoveResult(scoredMoves[pickedIndex].move);
  }

  return formatMoveResult(scoredMoves[0].move);
}
