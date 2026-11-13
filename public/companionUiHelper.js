import { isSamePosition } from './companionHelper.js';

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

