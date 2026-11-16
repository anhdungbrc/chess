import {
  classifyMove,
  detectBrilliantMove,
  detectGreatMove,
  evalToWinPercent,
  isPieceSacrifice,
  isSafeRunnerUpMove,
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
 *   trapSuggestion?: { suggestedMoveUci?: string, nextSetupMove?: string, name?: object, type?: string } | null,
 * }} params - Engine analysis of the previous position, new snapshot, new position analysis, and optional active trap recommendation.
 * @returns {{ classification: string, winLoss: number, accuracy: number, moverColor: 'w' | 'b', playedUci: string, bestMoveUci: string | null, to: string, isTrapMove?: boolean } | null}
 *   Grade, or null when the positions are not provably one move apart or the previous analysis used the wrong side to move.
 */
export function gradeCompanionMove({ prev, snapshot, analysis, trapSuggestion = null }) {
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

  // Acknowledge intentional trap moves even when engine assesses them as blunders/mistakes
  const isTrapMove = Boolean(
    trapSuggestion &&
      (playedUci === trapSuggestion.suggestedMoveUci || playedUci === trapSuggestion.nextSetupMove)
  );

  if (isTrapMove) {
    if (classification === 'blunder' || classification === 'mistake' || classification === 'inaccuracy') {
      classification = 'risky_trap';
    }
  }

  return {
    classification,
    winLoss: graded.winLoss,
    accuracy: graded.accuracy,
    moverColor,
    playedUci,
    bestMoveUci: prev.bestMoveUci,
    to,
    isTrapMove,
  };
}

/**
 * Formats trap recommendation or warning details into a presentation view model.
 *
 * @param {{
 *   id?: string,
 *   name?: { vi?: string, en?: string },
 *   type?: 'offensive' | 'defensive' | 'tactical',
 *   suggestedMoveUci?: string,
 *   punishAvoidUci?: string,
 *   punishMoveUci?: string,
 *   description?: { vi?: string, en?: string },
 * } | null | undefined} trap - Resolved trap recommendation object.
 * @param {'vi' | 'en'} [lang='vi'] - Active interface language.
 * @returns {{
 *   badgeClass: string,
 *   badgeText: string,
 *   titleText: string,
 *   moveText: string,
 *   avoidText: string,
 *   descText: string,
 *   moveUci: string | null,
 *   arrowColor: string,
 * } | null} Presentation model or null when trap is null/empty.
 */
export function formatTrapCard(trap, lang = 'vi') {
  if (!trap || !trap.type) {
    return null;
  }

  const isEn = lang === 'en';
  let badgeClass = 'trap-badge-offensive';
  let badgeText = isEn ? '🏹 Offensive Trap' : '🏹 Đòn bẫy tấn công';
  // Red arrow for all trap recommendations and alerts per user specification
  let arrowColor = 'rgba(239, 68, 68, 0.95)';

  if (trap.isKingSacrifice) {
    badgeClass = 'trap-badge-extreme trap-badge-king-hunt';
    badgeText = isEn ? '🔥 King Hunt Sacrifice' : '🔥 Thí quân diệt Vua';
    arrowColor = 'rgba(239, 68, 68, 0.98)';
  } else if (trap.isExtremeSacrifice) {
    badgeClass = 'trap-badge-extreme';
    const levelStr =
      trap.sacrificeLevel === 'queen'
        ? isEn ? 'Queen' : 'Hậu'
        : trap.sacrificeLevel === 'rook'
          ? isEn ? 'Rook' : 'Xe'
          : trap.sacrificeLevel === 'minor'
            ? isEn ? 'Piece' : 'Quân'
            : isEn ? 'Pawn' : 'Tốt';
    badgeText = isEn ? `🔥 Extreme ${levelStr} Sacrifice` : `🔥 Thí ${levelStr} cực mạnh`;
  } else if (trap.isRisky) {
    badgeClass = 'trap-badge-risky';
    badgeText = isEn ? '🏹 Risky Trap' : '🏹 Bẫy mạo hiểm';
  } else if (trap.type === 'defensive') {
    badgeClass = 'trap-badge-defensive';
    badgeText = isEn ? '⚠️ Trap Alert!' : '⚠️ Cảnh báo bẫy!';
  } else if (trap.type === 'tactical') {
    badgeClass = 'trap-badge-tactical';
    badgeText = isEn ? '🎯 Tactical Strike' : '🎯 Đòn chiến thuật';
  }

  const titleText = trap.name?.[lang] || trap.name?.vi || (isEn ? 'Chess Trap' : 'Đòn bẫy cờ vua');
  const descText = trap.description?.[lang] || trap.description?.vi || '';

  const suggested = trap.suggestedMoveUci || '';
  let moveText = '';
  if (suggested) {
    if (trap.type === 'defensive') {
      moveText = isEn ? `Defensive Move: ${suggested}` : `Nước giải vây: ${suggested}`;
    } else {
      moveText = isEn ? `Suggested Move: ${suggested}` : `Nước gợi ý: ${suggested}`;
    }
  }

  let avoidText = '';
  if (trap.punishAvoidUci) {
    avoidText = isEn ? `Avoid Move: ${trap.punishAvoidUci}` : `Tránh đi: ${trap.punishAvoidUci}`;
  }

  const roadmapSteps = Array.isArray(trap.sequence)
    ? trap.sequence.map((step, idx) => ({
        stepNumber: idx + 1,
        move: step.move,
        san: step.san || step.move,
        label: step.label?.[lang] || step.label?.vi || step.label?.en || '',
        isCurrent: idx === 0,
        isSacrifice: Boolean(idx === 0 && trap.isExtremeSacrifice),
      }))
    : [];

  return {
    badgeClass,
    badgeText,
    titleText,
    moveText,
    avoidText,
    descText,
    moveUci: suggested || null,
    arrowColor,
    isExtremeSacrifice: Boolean(trap.isExtremeSacrifice),
    isKingSacrifice: Boolean(trap.isKingSacrifice),
    sacrificeLevel: trap.sacrificeLevel || null,
    sequence: Array.isArray(trap.sequence) ? trap.sequence : [],
    roadmapSteps,
    branches: trap.branches || null,
  };
}

/**
 * Resolves the primary recommendation label, move, and color based on active Trap Mode and Anti-Streak protection.
 *
 * @param {{
 *   bestMoveUci: string | null,
 *   scoreText?: string,
 *   trap?: {
 *     suggestedMoveUci?: string,
 *     punishAvoidUci?: string,
 *     name?: { vi?: string, en?: string },
 *     type?: 'offensive' | 'defensive' | 'tactical',
 *     sequence?: Array<{ move: string, san?: string, label?: { vi?: string, en?: string } }>,
 *   } | null,
 *   trapModeActive?: boolean,
 *   secondBestMoveUci?: string | null,
 *   secondBestScoreText?: string,
 *   bestEval?: { cp?: number | null, mate?: number | null } | null,
 *   secondBestEval?: { cp?: number | null, mate?: number | null } | null,
 *   streak?: number,
 *   threshold?: number,
 *   antiStreakActive?: boolean,
 *   moverColor?: 'w' | 'b',
 *   lang?: 'vi' | 'en',
 * }} params - Hint resolution parameters.
 * @returns {{
 *   label: string,
 *   primaryMoveUci: string | null,
 *   primaryColor: string,
 *   isTrapPrimary: boolean,
 *   isAntiStreakPrimary?: boolean,
 *   sequence: Array<{ move: string, san?: string, label?: { vi?: string, en?: string } }>,
 * }} Resolved primary hint descriptor.
 */
export function resolveCompanionPrimaryHint({
  bestMoveUci,
  scoreText = '',
  trap = null,
  trapModeActive = false,
  secondBestMoveUci = null,
  secondBestScoreText = '',
  bestEval = null,
  secondBestEval = null,
  streak = 0,
  threshold = 5,
  antiStreakActive = false,
  continuousAttackActive = false,
  kingSacrifice = null,
  selectedMoveUci = null,
  moverColor = 'w',
  lang = 'vi',
}) {
  const isEn = lang === 'en';
  const cleanScore = scoreText ? ` (${scoreText})` : '';

  // 0. User-selected move from trap card or proactive pill takes absolute precedence
  if (selectedMoveUci) {
    const trapName = trap?.name?.[lang] || trap?.name?.vi || (isEn ? 'Selected Move' : 'Nước đã chọn');
    const label = isEn
      ? `🏹 Selected Trap Move: ${selectedMoveUci} (${trapName})`
      : `🏹 Nước giăng bẫy đã chọn: ${selectedMoveUci} (${trapName})`;

    return {
      label,
      primaryMoveUci: selectedMoveUci,
      primaryColor: 'rgba(239, 68, 68, 0.95)',
      isAttackSacrificePrimary: false,
      isTrapPrimary: true,
      isAntiStreakPrimary: false,
      sequence: Array.isArray(trap?.sequence) ? trap.sequence : [],
    };
  }

  // 1. Continuous King-Sacrifice Attack Mode takes priority when active and a sacrificial attack exists
  if (continuousAttackActive && kingSacrifice?.suggestedMoveUci) {
    const attackName =
      kingSacrifice.name?.[lang] || kingSacrifice.name?.vi || (isEn ? 'King Hunt Attack' : 'Tấn công vào Vua');
    const primaryMoveUci = kingSacrifice.suggestedMoveUci;
    const label = isEn
      ? `🔥 King Hunt Sacrifice: ${primaryMoveUci} (${attackName})`
      : `🔥 Thí quân diệt Vua: ${primaryMoveUci} (${attackName})`;

    return {
      label,
      primaryMoveUci,
      primaryColor: 'rgba(239, 68, 68, 0.98)',
      isAttackSacrificePrimary: true,
      isTrapPrimary: false,
      isAntiStreakPrimary: false,
      sequence: Array.isArray(kingSacrifice.sequence) ? kingSacrifice.sequence : [],
    };
  }

  // 2. Anti-Streak Protection: When player has played consecutive best moves >= threshold, suggest safe 2nd move
  if (antiStreakActive && streak >= threshold) {
    if (secondBestMoveUci) {
      const isSafe = isSafeRunnerUpMove({ bestEval, secondBestEval, moverColor });
      if (isSafe) {
        const cleanSecondScore = secondBestScoreText ? ` (${secondBestScoreText})` : '';
        const label = isEn
          ? `🛡️ Anti-Streak (${streak} in a row): Recommended 2nd move ${secondBestMoveUci}${cleanSecondScore}`
          : `🛡️ Chống chuỗi tối ưu (${streak} nước liên tiếp): Đề xuất nước thứ 2 ${secondBestMoveUci}${cleanSecondScore}`;
        return {
          label,
          primaryMoveUci: secondBestMoveUci,
          primaryColor: 'rgba(245, 158, 11, 0.95)',
          isTrapPrimary: false,
          isAntiStreakPrimary: true,
          sequence: [],
        };
      }
      // If 2nd move is too risky or blunder, fall back to best move with clear warning
      const moveStr = bestMoveUci || '-';
      const label = isEn
        ? `⚠️ Streak ${streak}! 2nd move is too risky, keeping best move ${moveStr}${cleanScore}`
        : `⚠️ Chuỗi ${streak} nước tối ưu! Nước thứ 2 rủi ro cao, giữ nước tối ưu ${moveStr}${cleanScore}`;
      return {
        label,
        primaryMoveUci: bestMoveUci,
        primaryColor: 'rgba(129, 182, 76, 0.9)',
        isTrapPrimary: false,
        isAntiStreakPrimary: false,
        sequence: Array.isArray(trap?.sequence) ? trap.sequence : [],
      };
    }
  }

  // 2. When Trap Mode is enabled and a trap is detected, elevate the trap to primary recommendation
  if (trapModeActive && trap?.suggestedMoveUci) {
    const trapName = trap.name?.[lang] || trap.name?.vi || (isEn ? 'Trap' : 'Đòn bẫy');
    const primaryMoveUci = trap.suggestedMoveUci;
    const isDefensive = trap.type === 'defensive';
    // Red arrow for all trap recommendations
    const primaryColor = 'rgba(239, 68, 68, 0.95)';

    let label = '';
    if (isDefensive) {
      const avoid = trap.punishAvoidUci
        ? isEn
          ? `Avoid ${trap.punishAvoidUci}, `
          : `Tránh ${trap.punishAvoidUci}, `
        : '';
      label = isEn
        ? `⚠️ Trap Alert: ${avoid}play ${primaryMoveUci} (${trapName})`
        : `⚠️ Cảnh báo bẫy: ${avoid}hãy đi ${primaryMoveUci} (${trapName})`;
    } else if (trap.isExtremeSacrifice) {
      label = isEn
        ? `🔥 Extreme Sacrifice: ${primaryMoveUci} (${trapName})`
        : `🔥 Thí quân cực mạnh: ${primaryMoveUci} (${trapName})`;
    } else if (trap.isRisky) {
      label = isEn
        ? `🏹 Risky Trap: ${primaryMoveUci} (${trapName})`
        : `🏹 Bẫy mạo hiểm: ${primaryMoveUci} (${trapName})`;
    } else {
      label = isEn
        ? `🏹 Trap Move: ${primaryMoveUci} (${trapName})`
        : `🏹 Nước giăng bẫy: ${primaryMoveUci} (${trapName})`;
    }

    return {
      label,
      primaryMoveUci,
      primaryColor,
      isTrapPrimary: true,
      isAntiStreakPrimary: false,
      sequence: Array.isArray(trap.sequence) ? trap.sequence : [],
    };
  }

  // When Trap Mode is enabled but no trap is available in this position, clarify status
  if (trapModeActive && !trap) {
    const moveStr = bestMoveUci || '-';
    const label = isEn
      ? `Best Move: ${moveStr}${cleanScore} • No trap in this position`
      : `Nước tối ưu: ${moveStr}${cleanScore} • Chưa có đòn bẫy ở thế cờ này`;

    return {
      label,
      primaryMoveUci: bestMoveUci,
      primaryColor: 'rgba(129, 182, 76, 0.9)',
      isTrapPrimary: false,
      isAntiStreakPrimary: false,
      sequence: [],
    };
  }

  // When Continuous King-Sacrifice Attack Mode is enabled but no sacrifice is available, clarify status
  if (continuousAttackActive && !kingSacrifice) {
    const moveStr = bestMoveUci || '-';
    const label = isEn
      ? `Best Move: ${moveStr}${cleanScore} • No king sacrifice available`
      : `Nước tối ưu: ${moveStr}${cleanScore} • Chưa có cơ hội thí quân vào Vua`;

    return {
      label,
      primaryMoveUci: bestMoveUci,
      primaryColor: 'rgba(129, 182, 76, 0.9)',
      isAttackSacrificePrimary: false,
      isTrapPrimary: false,
      isAntiStreakPrimary: false,
      sequence: [],
    };
  }

  // Default mode: standard Stockfish best move is primary
  const moveStr = bestMoveUci || '';
  const label = isEn
    ? `Best move: ${moveStr}${cleanScore}`
    : `Nước tối ưu: ${moveStr}${cleanScore}`;

  return {
    label,
    primaryMoveUci: bestMoveUci,
    primaryColor: 'rgba(129, 182, 76, 0.9)',
    isAttackSacrificePrimary: false,
    isTrapPrimary: false,
    isAntiStreakPrimary: false,
    sequence: Array.isArray(trap?.sequence) ? trap.sequence : [],
  };
}

/**
 * Formats button text and tooltip for the Continuous King-Sacrifice Attack Mode toggle.
 *
 * @param {boolean} isActive - Whether continuous sacrificial attack mode is currently active.
 * @param {'vi' | 'en'} [lang='vi'] - Active interface language.
 * @returns {{ buttonText: string, titleText: string }} Presentation labels.
 */
export function formatContinuousAttackButtonText(isActive, lang = 'vi') {
  const isEn = lang === 'en';
  if (isActive) {
    return {
      buttonText: isEn ? '🔥 King Hunt Sacrifice: ACTIVE' : '🔥 Tấn công thí quân: ĐANG BẬT',
      titleText: isEn
        ? 'Continuous sacrificial king hunt mode is ACTIVE. Click to disable.'
        : 'Chế độ bất chấp thí quân xé toang đường vào Vua đang BẬT. Bấm để tắt.',
    };
  }
  return {
    buttonText: isEn ? '🔥 King Hunt Sacrifice: OFF' : '🔥 Tấn công thí quân: TẮT',
    titleText: isEn
      ? 'Click to enable continuous sacrificial king hunt mode.'
      : 'Bấm để bật chế độ bất chấp thí quân tấn công cực mạnh vào Vua đối phương.',
  };
}

/**
 * Formats user-facing label and title for the Anti-Streak toggle button.
 *
 * @param {boolean} active - Whether anti-streak protection is enabled.
 * @param {number} streak - Current consecutive best moves streak.
 * @param {number} threshold - Threshold to trigger anti-streak mitigation.
 * @param {'vi' | 'en'} [lang='vi'] - Active interface language.
 * @returns {{ buttonText: string, titleText: string, isTriggered: boolean }} Button presentation model.
 */
export function formatAntiStreakButtonText(active, streak, threshold, lang = 'vi') {
  const isEn = lang === 'en';
  const isTriggered = active && streak >= threshold;
  if (!active) {
    return {
      buttonText: isEn ? '🛡️ Anti-Streak: OFF' : '🛡️ Chống chuỗi tối ưu: TẮT',
      titleText: isEn
        ? 'Enable protection against continuous best moves'
        : 'Bật chế độ chống các nước đi tốt nhất liên tục',
      isTriggered: false,
    };
  }
  const countStr = `${streak}/${threshold}`;
  const statusStr = isTriggered
    ? isEn ? `🔥 TRIGGERED (${countStr})` : `🔥 ĐANG KÍCH HOẠT (${countStr})`
    : isEn ? `ON (${countStr})` : `BẬT (${countStr})`;

  return {
    buttonText: `🛡️ ${isEn ? 'Anti-Streak' : 'Chống chuỗi'}: ${statusStr}`,
    titleText: isEn
      ? `Protection active (${streak}/${threshold} consecutive best moves)`
      : `Đang bảo vệ (${streak}/${threshold} nước tối ưu liên tiếp)`,
    isTriggered,
  };
}

/**
 * Formats proactive trap candidates into interactive UI view model pills.
 *
 * @param {Array<{ trap: object, nextSetupMove: string, remainingSteps: number }> | null | undefined} candidates - Candidate traps from finder.
 * @param {string} [lang='vi'] - Active UI language ('vi' | 'en').
 * @returns {Array<{
 *   id: string,
 *   name: string,
 *   nextMoveText: string,
 *   setupMoveUci: string,
 *   stepsText: string,
 *   remainingSteps: number,
 *   trap: object,
 * }>} Formatted pill view model array.
 */
export function formatProactiveTrapList(candidates, lang = 'vi') {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const isVi = lang === 'vi';

  // Map candidates to interactive pill items
  return candidates.map((item) => {
    const name = item.trap?.name?.[lang] || item.trap?.name?.vi || item.trap?.name?.en || item.trap?.id || '';
    const steps = item.remainingSteps || 1;
    const stepsText = isVi ? `${steps} nước` : `${steps} plies`;
    const nextMoveText = isVi ? `Đi ${item.nextSetupMove} (${stepsText})` : `Play ${item.nextSetupMove} (${stepsText})`;

    return {
      id: item.trap?.id || '',
      name,
      setupMoveUci: item.nextSetupMove || '',
      nextMoveText,
      stepsText,
      remainingSteps: steps,
      trap: item.trap,
    };
  });
}

/**
 * Formats user-facing label and title for the Companion Auto-move toggle button.
 *
 * @param {boolean} enabled - Whether auto-move is currently active.
 * @param {number | string} [delay='3-10s'] - Configured move delay in milliseconds or formatted range label.
 * @param {'vi' | 'en'} [lang='vi'] - Active interface language.
 * @returns {{ buttonText: string, titleText: string }} Presentation labels.
 */
export function formatAutoMoveButtonText(enabled, delay = '3-10s', lang = 'vi') {
  const isEn = lang === 'en';
  if (enabled) {
    const delayStr = typeof delay === 'number' ? ` (~${delay}ms)` : ` (${delay})`;
    return {
      buttonText: isEn ? `⚡ Auto-move: ON${delayStr}` : `⚡ Tự động đánh: BẬT${delayStr}`,
      titleText: isEn
        ? 'Auto-move mode is ACTIVE. Click to disable.'
        : 'Chế độ tự động đánh theo gợi ý đang BẬT. Bấm để tắt.',
    };
  }
  return {
    buttonText: isEn ? '⚡ Auto-move: OFF' : '⚡ Tự động đánh: TẮT',
    titleText: isEn
      ? 'Click to enable auto-move mode on Chess.com.'
      : 'Bấm để bật chế độ tự động đánh theo gợi ý trên Chess.com.',
  };
}

