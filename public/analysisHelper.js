const CLASSIFICATION_KEYS = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
const UCI_SQUARE_REGEX = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/**
 * Parses a UCI engine `info` line into a White-perspective evaluation snapshot.
 *
 * @param {string} line - Raw UCI output line emitted by Stockfish.
 * @param {'w' | 'b'} turnColor - Side to move in the evaluated FEN position.
 * @returns {{ depth: number, cp: number | null, mate: number | null, pv: string[], bestMoveUci: string | null } | null} Normalized evaluation or null for non-exact info lines.
 */
export function parseUciInfoLine(line, turnColor) {
  if (typeof line !== 'string' || !line.startsWith('info ')) {
    return null;
  }
  // Skip aspiration-window bound estimates because Stockfish emits an exact score for each completed depth.
  if (/\b(?:upperbound|lowerbound)\b/.test(line)) {
    return null;
  }

  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)\b/);
  if (!scoreMatch) {
    return null;
  }

  const depthMatch = line.match(/\bdepth\s+(\d+)\b/);
  const depth = depthMatch ? Number(depthMatch[1]) : 0;
  const rawValue = Number(scoreMatch[2]);
  const sign = turnColor === 'b' ? -1 : 1;
  const normalizedValue = rawValue === 0 ? 0 : rawValue * sign;

  const pvMatch = line.match(/\bpv\s+(.+)$/);
  const pv = pvMatch
    ? pvMatch[1]
        .trim()
        .split(/\s+/)
        .filter((token) => UCI_SQUARE_REGEX.test(token))
    : [];

  return {
    depth,
    cp: scoreMatch[1] === 'cp' ? normalizedValue : null,
    mate: scoreMatch[1] === 'mate' ? normalizedValue : null,
    pv,
    bestMoveUci: pv[0] ?? null,
  };
}

/**
 * Converts a White-perspective evaluation score into White's expected winning percentage (0 to 100).
 *
 * @param {{ cp?: number | null, mate?: number | null } | null | undefined} evalScore - Normalized position evaluation.
 * @returns {number} White win probability percentage in [0, 100].
 */
export function evalToWinPercent(evalScore) {
  if (!evalScore) {
    return 50;
  }
  if (typeof evalScore.mate === 'number') {
    if (evalScore.mate > 0) {
      return 100;
    }
    if (evalScore.mate < 0) {
      return 0;
    }
    return 50;
  }

  const cp = Math.max(-10000, Math.min(10000, evalScore.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Formats a White-perspective evaluation score for display on the eval bar and move notes.
 *
 * @param {{ cp?: number | null, mate?: number | null } | null | undefined} evalScore - Normalized position evaluation.
 * @returns {string} Compact score label such as '+1.4', '-0.8', '0.0', 'M3', or '-M2'.
 */
export function formatEvalScore(evalScore) {
  if (!evalScore) {
    return '0.0';
  }
  if (typeof evalScore.mate === 'number' && evalScore.mate !== 0) {
    return evalScore.mate > 0 ? `M${evalScore.mate}` : `-M${Math.abs(evalScore.mate)}`;
  }

  const roundedTenths = Math.round((evalScore.cp ?? 0) / 10) / 10;
  if (Math.abs(roundedTenths) < 0.05) {
    return '0.0';
  }
  return `${roundedTenths > 0 ? '+' : ''}${roundedTenths.toFixed(1)}`;
}

/**
 * Computes a Chess.com-style per-move accuracy score (0 to 100) from Win% drop.
 *
 * @param {number} winLoss - Non-negative drop in the mover's winning percentage.
 * @returns {number} Accuracy percentage in [0, 100].
 */
export function computeMoveAccuracy(winLoss) {
  if (!Number.isFinite(winLoss) || winLoss <= 0) {
    return 100;
  }
  const raw = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Classifies a played move and computes its accuracy from pre-move and post-move evaluations.
 *
 * @param {{
 *   prevEval: { cp: number | null, mate: number | null },
 *   nextEval: { cp: number | null, mate: number | null },
 *   moverColor: 'w' | 'b',
 *   playedUci: string,
 *   bestMoveUci: string | null,
 *   isCheckmate?: boolean,
 * }} params - Evaluation context around the played move.
 * @returns {{ classification: 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder', winLoss: number, accuracy: number }} Move classification and accuracy metrics.
 */
export function classifyMove({
  prevEval,
  nextEval,
  moverColor,
  playedUci,
  bestMoveUci,
  isCheckmate = false,
}) {
  const prevWinWhite = evalToWinPercent(prevEval);
  const nextWinWhite = evalToWinPercent(nextEval);
  const prevWin = moverColor === 'w' ? prevWinWhite : 100 - prevWinWhite;
  const nextWin = moverColor === 'w' ? nextWinWhite : 100 - nextWinWhite;
  const winLoss = Math.max(0, prevWin - nextWin);

  const isExactBest = isCheckmate || (Boolean(bestMoveUci) && playedUci === bestMoveUci);
  let classification;
  if (isExactBest || winLoss <= 1.5) {
    classification = 'best';
  } else if (winLoss <= 4) {
    classification = 'excellent';
  } else if (winLoss <= 8) {
    classification = 'good';
  } else if (winLoss <= 15) {
    classification = 'inaccuracy';
  } else if (winLoss <= 25) {
    classification = 'mistake';
  } else {
    classification = 'blunder';
  }

  return {
    classification,
    winLoss: Number(winLoss.toFixed(2)),
    accuracy: Number(computeMoveAccuracy(isExactBest ? 0 : winLoss).toFixed(1)),
  };
}

/**
 * Aggregates per-move analysis records into per-side average accuracy and classification counts.
 *
 * @param {Array<{ color: 'w' | 'b', classification: string, accuracy: number }>} moveAnalyses - Analyzed move entries.
 * @returns {{ whiteAccuracy: number | null, blackAccuracy: number | null, counts: { w: Record<string, number>, b: Record<string, number> } }} Summary stats for White and Black.
 */
export function summarizeGameAnalysis(moveAnalyses) {
  const emptyCounts = () => Object.fromEntries(CLASSIFICATION_KEYS.map((key) => [key, 0]));
  const counts = { w: emptyCounts(), b: emptyCounts() };
  const totals = { w: { sum: 0, count: 0 }, b: { sum: 0, count: 0 } };

  for (const entry of moveAnalyses ?? []) {
    const color = entry?.color;
    if (color !== 'w' && color !== 'b') {
      continue;
    }
    if (entry.classification in counts[color]) {
      counts[color][entry.classification] += 1;
    }
    if (Number.isFinite(entry.accuracy)) {
      totals[color].sum += entry.accuracy;
      totals[color].count += 1;
    }
  }

  const avg = (side) =>
    side.count > 0 ? Number((side.sum / side.count).toFixed(1)) : null;

  return {
    whiteAccuracy: avg(totals.w),
    blackAccuracy: avg(totals.b),
    counts,
  };
}

/**
 * Decodes a UCI move string ('e2e4', 'a7a8q') into origin, destination, and optional promotion piece.
 *
 * @param {string | null | undefined} uci - Engine move in UCI coordinate notation.
 * @returns {{ from: string, to: string, promotion?: string } | null} Decoded move squares or null when invalid.
 */
export function uciToMoveSquares(uci) {
  if (typeof uci !== 'string') {
    return null;
  }
  const match = uci.trim().match(UCI_SQUARE_REGEX);
  if (!match) {
    return null;
  }
  return {
    from: match[1],
    to: match[2],
    ...(match[3] ? { promotion: match[3] } : {}),
  };
}

const PIECE_POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SACRIFICE_MIN_POINTS = 3;
const BRILLIANT_MAX_WIN_LOSS = 2;
const BRILLIANT_MAX_PRIOR_WIN = 90;
const BRILLIANT_MIN_RESULT_WIN = 45;
const GREAT_MIN_GAP = 15;

/**
 * Detects whether a move gives up material: the moved piece is captured on its destination by the opponent's best reply.
 *
 * @param {{ movedType: string, capturedType: string | null, playedTo: string, replyUci: string | null }} params - Moved piece, piece it captured (if any), destination square, and opponent's best reply in UCI.
 * @returns {boolean} True when the net loss (moved piece minus captured piece) is at least 3 points.
 */
export function isPieceSacrifice({ movedType, capturedType, playedTo, replyUci }) {
  const reply = uciToMoveSquares(replyUci);
  // Without a recapture on the destination square the piece was not actually given up.
  if (!reply || reply.to !== playedTo) {
    return false;
  }
  const net = (PIECE_POINTS[movedType] ?? 0) - (PIECE_POINTS[capturedType] ?? 0);
  return net >= SACRIFICE_MIN_POINTS;
}

/**
 * Decides whether a move deserves the Brilliant (genius) badge.
 *
 * @param {{ isSacrifice: boolean, winLoss: number, prevWinMover: number, nextWinMover: number }} params - Sacrifice flag and mover-perspective win% data.
 * @returns {boolean} True for a near-best sacrifice that keeps the mover from losing, played in a position not already clearly won.
 */
export function detectBrilliantMove({ isSacrifice, winLoss, prevWinMover, nextWinMover }) {
  return (
    isSacrifice &&
    winLoss <= BRILLIANT_MAX_WIN_LOSS &&
    prevWinMover < BRILLIANT_MAX_PRIOR_WIN &&
    nextWinMover >= BRILLIANT_MIN_RESULT_WIN
  );
}

/**
 * Decides whether a move deserves the Great badge: the engine's best move when the runner-up is much worse.
 *
 * @param {{ isExactBest: boolean, bestWinMover: number, secondBestWinMover: number | null }} params - Best-move flag and mover-perspective win% of the top two engine lines.
 * @returns {boolean} True when the best move beats the second-best by at least 15 win%.
 */
export function detectGreatMove({ isExactBest, bestWinMover, secondBestWinMover }) {
  if (!isExactBest || typeof secondBestWinMover !== 'number') {
    return false;
  }
  return bestWinMover - secondBestWinMover >= GREAT_MIN_GAP;
}

/**
 * Reads the MultiPV rank of a UCI info line.
 *
 * @param {string} line - Raw UCI info line.
 * @returns {number} Rank (1 = best line); 1 when the line carries no multipv token.
 */
export function parseMultiPvIndex(line) {
  const match = typeof line === 'string' ? line.match(/\bmultipv\s+(\d+)\b/) : null;
  return match ? Number(match[1]) : 1;
}

export const DEFAULT_CONSECUTIVE_BEST_MOVES_THRESHOLD = 5;
export const MAX_SAFE_RUNNER_UP_CP_LOSS = 150;
export const MAX_SAFE_RUNNER_UP_WIN_LOSS = 10;

/**
 * Computes the number of consecutive top engine moves ('best', 'great', 'brilliant') made by a player from the latest moves.
 *
 * @param {Array<{ color: 'w' | 'b', classification?: string }> | null | undefined} gradedMoves - List of graded moves in chronological order.
 * @param {'w' | 'b'} playerColor - Side of the player to track ('w' or 'b').
 * @returns {number} Consecutive top moves count (streak).
 */
export function computeConsecutiveBestMovesStreak(gradedMoves, playerColor) {
  if (!Array.isArray(gradedMoves) || gradedMoves.length === 0) {
    return 0;
  }
  let streak = 0;
  // Iterate backwards from the latest move to count the streak for playerColor
  for (let i = gradedMoves.length - 1; i >= 0; i -= 1) {
    const item = gradedMoves[i];
    if (!item || item.color !== playerColor) {
      continue; // Skip opponent moves to track player's sequence
    }
    const c = item.classification;
    if (c === 'best' || c === 'great' || c === 'brilliant') {
      streak += 1;
    } else {
      break; // Any non-top move breaks the consecutive streak
    }
  }
  return streak;
}

/**
 * Assesses whether a runner-up engine move is tactically safe to recommend as an anti-detection alternative.
 *
 * @param {{
 *   bestEval: { cp?: number | null, mate?: number | null } | null | undefined,
 *   secondBestEval: { cp?: number | null, mate?: number | null } | null | undefined,
 *   moverColor: 'w' | 'b',
 *   maxWinLoss?: number,
 *   maxCpLoss?: number,
 * }} params - Position evaluation of best move, second best move, mover color, and tolerance thresholds.
 * @returns {boolean} True if second-best move does not blunder the game or allow forced mate.
 */
export function isSafeRunnerUpMove({
  bestEval,
  secondBestEval,
  moverColor,
  maxWinLoss = MAX_SAFE_RUNNER_UP_WIN_LOSS,
  maxCpLoss = MAX_SAFE_RUNNER_UP_CP_LOSS,
}) {
  if (!bestEval || !secondBestEval) {
    return false;
  }

  // Reject runner-up moves that allow opponent to deliver forced checkmate
  if (typeof secondBestEval.mate === 'number') {
    const isMated = moverColor === 'w' ? secondBestEval.mate < 0 : secondBestEval.mate > 0;
    if (isMated) {
      return false; // Do not blunder into checkmate
    }
  }

  // Calculate win probability loss from mover's perspective
  const toMoverWin = (evalScore) => {
    const whiteWin = evalToWinPercent(evalScore);
    return moverColor === 'w' ? whiteWin : 100 - whiteWin;
  };
  const bestWin = toMoverWin(bestEval);
  const secondWin = toMoverWin(secondBestEval);
  const winLoss = Math.max(0, bestWin - secondWin);

  if (winLoss > maxWinLoss) {
    return false;
  }

  // Check centipawn gap when both are cp evaluations
  if (typeof bestEval.cp === 'number' && typeof secondBestEval.cp === 'number') {
    const moverBestCp = moverColor === 'w' ? bestEval.cp : -bestEval.cp;
    const moverSecondCp = moverColor === 'w' ? secondBestEval.cp : -secondBestEval.cp;
    const cpLoss = Math.max(0, moverBestCp - moverSecondCp);
    if (cpLoss > maxCpLoss) {
      return false;
    }
  }

  return true;
}
