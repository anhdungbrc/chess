import {
  classifyMove,
  detectBrilliantMove,
  detectGreatMove,
  evalToWinPercent,
  isPieceSacrifice,
} from './analysisHelper.js';
import { isSamePosition } from './companionHelper.js';
import { parseFenBoard } from './reviewHelper.js';

const FILE_LETTERS = 'abcdefgh';

/**
 * Compares only the piece-placement field of two FENs (relay turn and counters are unreliable).
 *
 * @param {string | null | undefined} fenA - First FEN.
 * @param {string | null | undefined} fenB - Second FEN.
 * @returns {boolean} True when both are strings with identical piece placement.
 */
export function hasSamePlacement(fenA, fenB) {
  if (typeof fenA !== 'string' || typeof fenB !== 'string') {
    return false;
  }
  return fenA.trim().split(/\s+/)[0] === fenB.trim().split(/\s+/)[0];
}

/**
 * Returns a copy of a FEN with the side-to-move field replaced.
 *
 * @param {string} fen - Source FEN.
 * @param {'w' | 'b'} turn - Side to move to write.
 * @returns {string} FEN with the new turn field.
 */
export function setFenTurn(fen, turn) {
  const parts = fen.trim().split(/\s+/);
  parts[1] = turn;
  return parts.join(' ');
}

/**
 * Infers the single move that turns one board placement into another, without trusting any turn or highlight data.
 *
 * @param {string} prevFen - FEN before the move.
 * @param {string} nextFen - FEN after the move.
 * @returns {{ moverColor: 'w' | 'b', from: string, to: string, promotion: string, movedType: string, capturedType: string | null } | null}
 *   The move, or null when the placements are equal, malformed, or differ by more than one ply.
 */
export function inferMoveFromBoards(prevFen, nextFen) {
  let prevBoard;
  let nextBoard;
  try {
    prevBoard = parseFenBoard(prevFen);
    nextBoard = parseFenBoard(nextFen);
  } catch {
    return null;
  }

  // Per colour: squares that lost one of its pieces ("left") and squares where a new piece of it appeared ("arrived").
  const left = { w: [], b: [] };
  const arrived = { w: [], b: [] };
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const before = prevBoard[row][col];
      const after = nextBoard[row][col];
      const square = `${FILE_LETTERS[col]}${8 - row}`;
      const isSame = before && after && before.color === after.color && before.type === after.type;
      if (before && !isSame) {
        left[before.color].push({ square, type: before.type });
      }
      if (after && !isSame) {
        arrived[after.color].push({ square, type: after.type });
      }
    }
  }

  const moverColor = arrived.w.length > 0 ? 'w' : 'b';
  const enemyColor = moverColor === 'w' ? 'b' : 'w';
  const moverArrived = arrived[moverColor];
  const moverLeft = left[moverColor];
  // A single ply never adds enemy pieces and removes at most one (capture or en passant).
  if (moverArrived.length === 0 || arrived[enemyColor].length > 0 || left[enemyColor].length > 1) {
    return null;
  }
  const capturedType = left[enemyColor][0]?.type ?? null;

  if (moverArrived.length === 1 && moverLeft.length === 1) {
    const { square: from, type: movedType } = moverLeft[0];
    const { square: to, type: landedType } = moverArrived[0];
    if (landedType !== movedType && movedType !== 'p') {
      return null;
    }
    return { moverColor, from, to, promotion: landedType !== movedType ? landedType : '', movedType, capturedType };
  }

  // Castling moves king and rook together; report the king move and require no capture.
  if (moverArrived.length === 2 && moverLeft.length === 2 && capturedType === null) {
    const king = moverLeft.find((entry) => entry.type === 'k');
    const kingTarget = moverArrived.find((entry) => entry.type === 'k');
    if (king && kingTarget) {
      return { moverColor, from: king.square, to: kingTarget.square, promotion: '', movedType: 'k', capturedType: null };
    }
  }
  return null;
}

/**
 * Formats user-facing status indicators for the live companion synchronizer.
 *
 * @param {{
 *   fen?: string,
 *   turn?: 'w' | 'b',
 *   lastMove?: { from: string, to: string } | null,
 *   orientation?: 'white' | 'black',
 *   timestamp?: number,
 * } | null} snapshot - Current companion snapshot or null when waiting.
 * @param {'vi' | 'en'} [lang='vi'] - Active interface language.
 * @returns {{ statusText: string, turnColor: 'w' | 'b', isSynced: boolean }} Formatted status wrapper.
 */
export function formatCompanionStatus(snapshot, lang = 'vi') {
  if (!snapshot || !snapshot.fen) {
    return {
      statusText:
        lang === 'en'
          ? 'Waiting for Chess.com board state...'
          : 'Đang đợi thế cờ từ Chess.com...',
      turnColor: 'w',
      isSynced: false,
    };
  }

  const turn = snapshot.turn === 'b' ? 'b' : 'w';
  const turnName =
    lang === 'en'
      ? turn === 'w' ? 'White to move' : 'Black to move'
      : turn === 'w' ? 'Lượt Trắng' : 'Lượt Đen';

  let moveSuffix = '';
  if (snapshot.lastMove?.from && snapshot.lastMove?.to) {
    const moveStr = `${snapshot.lastMove.from}-${snapshot.lastMove.to}`;
    moveSuffix = lang === 'en' ? ` • Last: ${moveStr}` : ` • Nước vừa đi: ${moveStr}`;
  }

  return {
    statusText: `${turnName}${moveSuffix}`,
    turnColor: turn,
    isSynced: true,
  };
}

/**
 * Formats optimal move and Stockfish evaluation score hint text.
 *
 * @param {string} bestmove - UCI coordinate move (e.g. 'e7e5' or 'e7e8q').
 * @param {string} scoreText - Formatted score string (e.g. '+0.4' or 'M2').
 * @param {'vi' | 'en'} [lang='vi'] - Active interface language.
 * @returns {string} Formatted recommendation hint text.
 */
export function formatBestMoveHint(bestmove, scoreText, lang = 'vi') {
  if (!bestmove) {
    return '';
  }
  const cleanScore = scoreText ? ` (${scoreText})` : '';
  if (lang === 'en') {
    return `Best move: ${bestmove}${cleanScore}`;
  }
  return `Nước tối ưu: ${bestmove}${cleanScore}`;
}

/**
 * Resolves active board viewing perspective for companion mode.
 *
 * @param {unknown} orientation - Snapshot orientation candidate.
 * @param {'white' | 'black'} [defaultOrientation='white'] - Fallback perspective.
 * @returns {'white' | 'black'} Resolved orientation.
 */
export function resolveCompanionBoardOrientation(orientation, defaultOrientation = 'white') {
  if (orientation === 'black') {
    return 'black';
  }
  if (orientation === 'white') {
    return 'white';
  }
  return defaultOrientation;
}

/**
 * Parses the piece placement component of a FEN string into an 8x8 matrix.
 * Row 0 corresponds to Rank 8 (black's back rank), Row 7 corresponds to Rank 1 (white's back rank).
 *
 * @param {string} fen - Standard FEN string.
 * @returns {Array<Array<string | null>>} 8x8 board matrix.
 */
export function fenToBoardMatrix(fen) {
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  if (typeof fen !== 'string') {
    return grid;
  }

  const piecePlacement = fen.trim().split(/\s+/)[0];
  if (!piecePlacement) {
    return grid;
  }

  const ranks = piecePlacement.split('/');
  for (let r = 0; r < Math.min(8, ranks.length); r += 1) {
    const rankStr = ranks[r];
    let fileIdx = 0;

    for (let i = 0; i < rankStr.length && fileIdx < 8; i += 1) {
      const char = rankStr[i];
      const emptyCount = Number(char);

      if (Number.isInteger(emptyCount) && emptyCount >= 1 && emptyCount <= 8) {
        fileIdx += emptyCount;
      } else {
        grid[r][fileIdx] = char;
        fileIdx += 1;
      }
    }
  }

  return grid;
}

/**
 * Determines whether Stockfish engine analysis should be triggered for a new FEN.
 * Avoids redundant analysis runs when position placement and active turn remain identical.
 *
 * @param {string | null | undefined} previousFen - Previous analyzed FEN string.
 * @param {string | null | undefined} nextFen - Newly received candidate FEN string.
 * @returns {boolean} True if analysis should execute.
 */
export function shouldTriggerAnalysis(previousFen, nextFen) {
  if (!nextFen) {
    return false;
  }
  if (!previousFen) {
    return true;
  }
  return !isSamePosition(previousFen, nextFen);
}


/**
 * Grades the move that led from the previous analyzed position to the current one (Chess.com-style review).
 * The move and mover are inferred from the two boards because the relay's turn/highlight data is unreliable.
 *
 * @param {{
 *   prev: { fen: string, eval: object, secondBestEval: object | null, bestMoveUci: string | null } | null,
 *   snapshot: { fen: string },
 *   analysis: { eval: object, bestMoveUci: string | null },
 * }} params - Engine analysis of the previous position (analyzed with the correct side to move), the new snapshot, and engine analysis of the new position.
 * @returns {{ classification: string, winLoss: number, accuracy: number, moverColor: 'w' | 'b', playedUci: string, bestMoveUci: string | null, to: string } | null}
 *   Grade, or null when the positions are not provably one move apart or the previous analysis used the wrong side to move.
 */
export function gradeCompanionMove({ prev, snapshot, analysis }) {
  if (!prev || !snapshot?.fen || !analysis) {
    return null;
  }
  const move = inferMoveFromBoards(prev.fen, snapshot.fen);
  // If the stored previous analysis was run for the other side, its eval and best move are meaningless here.
  if (!move || prev.fen.trim().split(/\s+/)[1] !== move.moverColor) {
    return null;
  }
  const { moverColor, from, to, promotion, movedType, capturedType } = move;

  const playedUci = `${from}${to}${promotion}`;
  const graded = classifyMove({
    prevEval: prev.eval,
    nextEval: analysis.eval,
    moverColor,
    playedUci,
    bestMoveUci: prev.bestMoveUci,
  });

  const toMoverWin = (evalScore) => {
    const whiteWin = evalToWinPercent(evalScore);
    return moverColor === 'w' ? whiteWin : 100 - whiteWin;
  };
  const prevWinMover = toMoverWin(prev.eval);
  let classification = graded.classification;

  if (
    detectBrilliantMove({
      isSacrifice: isPieceSacrifice({
        movedType,
        capturedType,
        playedTo: to,
        // The engine's best reply in the new position is the opponent's most likely recapture.
        replyUci: analysis.bestMoveUci,
      }),
      winLoss: graded.winLoss,
      prevWinMover,
      nextWinMover: toMoverWin(analysis.eval),
    })
  ) {
    classification = 'brilliant';
  } else if (
    classification === 'best' &&
    detectGreatMove({
      isExactBest: playedUci === prev.bestMoveUci,
      bestWinMover: prevWinMover,
      secondBestWinMover: prev.secondBestEval ? toMoverWin(prev.secondBestEval) : null,
    })
  ) {
    classification = 'great';
  }

  return {
    classification,
    winLoss: graded.winLoss,
    accuracy: graded.accuracy,
    moverColor,
    playedUci,
    bestMoveUci: prev.bestMoveUci,
    to,
  };
}
