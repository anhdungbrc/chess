import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCompanionStatus,
  formatBestMoveHint,
  resolveCompanionBoardOrientation,
  fenToBoardMatrix,
  shouldTriggerAnalysis,
  gradeCompanionMove,
  hasSamePlacement,
  inferMoveFromBoards,
  setFenTurn,
  ensureFenCastlingRights,
  formatTrapCard,
  formatAntiStreakButtonText,
  formatContinuousAttackButtonText,
  resolveCompanionPrimaryHint,
  formatProactiveTrapList,
} from '../public/companionUiHelper.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MOVE_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

/**
 * Validates formatCompanionStatus formats waiting and synchronized states.
 */
test('formatCompanionStatus returns waiting status when snapshot is null', () => {
  const resultVi = formatCompanionStatus(null, 'vi');
  assert.equal(resultVi.isSynced, false);
  assert.ok(resultVi.statusText.includes('Đang đợi'));

  const resultEn = formatCompanionStatus(null, 'en');
  assert.equal(resultEn.isSynced, false);
  assert.ok(resultEn.statusText.includes('Waiting'));
});

/**
 * Validates formatCompanionStatus formats active turn and move metadata.
 */
test('formatCompanionStatus returns active turn and move info for synchronized snapshot', () => {
  const snapshot = {
    fen: MOVE_FEN,
    turn: 'b',
    lastMove: { from: 'e2', to: 'e4' },
    orientation: 'white',
    timestamp: 1731479800000,
  };

  const result = formatCompanionStatus(snapshot, 'vi');
  assert.equal(result.isSynced, true);
  assert.equal(result.turnColor, 'b');
  assert.ok(result.statusText.includes('e2-e4') || result.statusText.includes('e4'));
});

/**
 * Validates formatBestMoveHint formats best move and centipawn evaluation.
 */
test('formatBestMoveHint formats optimal move coordinates and evaluation score', () => {
  const hintVi = formatBestMoveHint('e7e5', '+0.4', 'vi');
  assert.ok(hintVi.includes('e7e5'));
  assert.ok(hintVi.includes('+0.4'));

  const hintEn = formatBestMoveHint('e7e5', '+0.4', 'en');
  assert.ok(hintEn.includes('e7e5'));
  assert.ok(hintEn.includes('+0.4'));
});

/**
 * Validates resolveCompanionBoardOrientation respects snapshot orientation.
 */
test('resolveCompanionBoardOrientation prioritizes snapshot orientation with white fallback', () => {
  assert.equal(resolveCompanionBoardOrientation('black'), 'black');
  assert.equal(resolveCompanionBoardOrientation('white'), 'white');
  assert.equal(resolveCompanionBoardOrientation(undefined), 'white');
  assert.equal(resolveCompanionBoardOrientation(null), 'white');
});

/**
 * Validates fenToBoardMatrix converts FEN string to 8x8 matrix.
 */
test('fenToBoardMatrix converts starting position FEN to 8x8 board grid', () => {
  const grid = fenToBoardMatrix(START_FEN);
  assert.equal(grid.length, 8);
  assert.equal(grid[0].length, 8);

  // Rank 8 (black rooks, knights, etc.)
  assert.deepEqual(grid[0], ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']);
  // Rank 7 (black pawns)
  assert.deepEqual(grid[1], ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p']);
  // Rank 2 (white pawns)
  assert.deepEqual(grid[6], ['P', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'.toLowerCase()].map(() => 'P'));
  // Rank 1 (white pieces)
  assert.deepEqual(grid[7], ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']);
});

/**
 * Validates shouldTriggerAnalysis triggers only when piece placement or turn changes.
 */
test('shouldTriggerAnalysis avoids duplicate analysis on unchanged positions', () => {
  assert.equal(shouldTriggerAnalysis(null, START_FEN), true);
  assert.equal(shouldTriggerAnalysis(START_FEN, MOVE_FEN), true);
  assert.equal(shouldTriggerAnalysis(START_FEN, START_FEN), false);

  const startClockChange = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 10';
  assert.equal(shouldTriggerAnalysis(START_FEN, startClockChange), false);
});


const SAC_PREV_FEN = '4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1';
const SAC_NEXT_FEN = '4k3/8/4p3/3Q4/8/8/8/4K3 b - - 0 1';

/**
 * Verifies gradeCompanionMove grades a normal best move from consecutive snapshot analyses.
 * Expected: e2e4 equal to the previous best move is 'best' with 100 accuracy, attributed to White.
 */
test('gradeCompanionMove grades the best move', () => {
  const graded = gradeCompanionMove({
    prev: { fen: START_FEN, eval: { cp: 30, mate: null }, secondBestEval: null, bestMoveUci: 'e2e4' },
    snapshot: { fen: MOVE_FEN, turn: 'b', lastMove: { from: 'e2', to: 'e4' } },
    analysis: { eval: { cp: 30, mate: null }, bestMoveUci: 'e7e5' },
  });
  assert.equal(graded.classification, 'best');
  assert.equal(graded.moverColor, 'w');
  assert.equal(graded.playedUci, 'e2e4');
  assert.equal(graded.accuracy, 100);
});

/**
 * Verifies a best move whose runner-up is far worse is upgraded to 'great'.
 */
test('gradeCompanionMove upgrades a unique best move to great', () => {
  const graded = gradeCompanionMove({
    prev: { fen: START_FEN, eval: { cp: 30, mate: null }, secondBestEval: { cp: -400, mate: null }, bestMoveUci: 'e2e4' },
    snapshot: { fen: MOVE_FEN, turn: 'b', lastMove: { from: 'e2', to: 'e4' } },
    analysis: { eval: { cp: 30, mate: null }, bestMoveUci: 'e7e5' },
  });
  assert.equal(graded.classification, 'great');
});

/**
 * Verifies a near-best queen sacrifice recaptured by a pawn is graded 'brilliant'.
 */
test('gradeCompanionMove detects a brilliant sacrifice', () => {
  const graded = gradeCompanionMove({
    prev: { fen: SAC_PREV_FEN, eval: { cp: 50, mate: null }, secondBestEval: null, bestMoveUci: 'd1d5' },
    snapshot: { fen: SAC_NEXT_FEN, turn: 'b', lastMove: { from: 'd1', to: 'd5' } },
    analysis: { eval: { cp: 40, mate: null }, bestMoveUci: 'e6d5' },
  });
  assert.equal(graded.classification, 'brilliant');
});

/**
 * Verifies a blunder is graded from the mover's win% drop (Black queen hung, evaluated from White's view).
 */
test('gradeCompanionMove grades a blunder', () => {
  const graded = gradeCompanionMove({
    prev: { fen: START_FEN, eval: { cp: 30, mate: null }, secondBestEval: null, bestMoveUci: 'd2d4' },
    snapshot: { fen: MOVE_FEN, turn: 'b', lastMove: { from: 'e2', to: 'e4' } },
    analysis: { eval: { cp: -900, mate: null }, bestMoveUci: 'e7e5' },
  });
  assert.equal(graded.classification, 'blunder');
});

/**
 * Verifies gradeCompanionMove recognizes intentional risky trap move instead of treating it purely as a blunder.
 */
test('gradeCompanionMove recognizes intentional risky trap move when trapSuggestion matches', () => {
  const trapSuggestion = {
    id: 'blackburne_shilling',
    suggestedMoveUci: 'e2e4',
    name: { vi: 'Bẫy Blackburne', en: 'Blackburne Trap' },
    type: 'offensive',
  };
  const graded = gradeCompanionMove({
    prev: { fen: START_FEN, eval: { cp: 30, mate: null }, secondBestEval: null, bestMoveUci: 'd2d4' },
    snapshot: { fen: MOVE_FEN, turn: 'b', lastMove: { from: 'e2', to: 'e4' } },
    analysis: { eval: { cp: -900, mate: null }, bestMoveUci: 'e7e5' },
    trapSuggestion,
  });
  assert.equal(graded.classification, 'risky_trap');
  assert.equal(graded.isTrapMove, true);
});

/**
 * Verifies gradeCompanionMove ignores an unreliable relay turn on the new snapshot and relies on board diff.
 * Expected: a wrong snapshot.turn / missing lastMove still grades the move.
 */
test('gradeCompanionMove does not depend on snapshot turn or lastMove', () => {
  const graded = gradeCompanionMove({
    prev: { fen: START_FEN, eval: { cp: 30, mate: null }, secondBestEval: null, bestMoveUci: 'e2e4' },
    snapshot: { fen: MOVE_FEN.replace(' b ', ' w '), turn: 'w', lastMove: null },
    analysis: { eval: { cp: 30, mate: null }, bestMoveUci: 'e7e5' },
  });
  assert.equal(graded.classification, 'best');
});

/**
 * Verifies a move is not graded when the stored previous analysis used the wrong side to move,
 * or when the snapshots are more than one move apart.
 */
test('gradeCompanionMove returns null for wrong-turn or non-consecutive positions', () => {
  const analysis = { eval: { cp: 0, mate: null }, bestMoveUci: 'e7e5' };
  const wrongTurnPrev = { fen: START_FEN.replace(' w ', ' b '), eval: { cp: 30, mate: null }, secondBestEval: null, bestMoveUci: 'e2e4' };
  assert.equal(gradeCompanionMove({ prev: wrongTurnPrev, snapshot: { fen: MOVE_FEN }, analysis }), null);

  const prev = { fen: START_FEN, eval: { cp: 30, mate: null }, secondBestEval: null, bestMoveUci: 'e2e4' };
  const twoMovesLater = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  assert.equal(gradeCompanionMove({ prev, snapshot: { fen: twoMovesLater }, analysis }), null);
  assert.equal(gradeCompanionMove({ prev: null, snapshot: { fen: MOVE_FEN }, analysis }), null);
});

/**
 * Verifies inferMoveFromBoards recovers the move from two placements: normal, capture, en passant, castling, promotion.
 * Expected: exact from/to/mover/piece data; identical or multi-move diffs return null.
 */
test('inferMoveFromBoards infers one-ply moves from placement diff', () => {
  assert.deepEqual(inferMoveFromBoards(START_FEN, MOVE_FEN), {
    moverColor: 'w', from: 'e2', to: 'e4', promotion: '', movedType: 'p', capturedType: null,
  });
  assert.deepEqual(
    inferMoveFromBoards('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', '4k3/8/8/3P4/8/8/8/4K3 b - - 0 1'),
    { moverColor: 'w', from: 'e4', to: 'd5', promotion: '', movedType: 'p', capturedType: 'p' }
  );
  assert.deepEqual(
    inferMoveFromBoards('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1', '4k3/8/3P4/8/8/8/8/4K3 b - - 0 1'),
    { moverColor: 'w', from: 'e5', to: 'd6', promotion: '', movedType: 'p', capturedType: 'p' }
  );
  assert.deepEqual(
    inferMoveFromBoards('4k3/8/8/8/8/8/8/4K2R w - - 0 1', '4k3/8/8/8/8/8/8/5RK1 b - - 0 1'),
    { moverColor: 'w', from: 'e1', to: 'g1', promotion: '', movedType: 'k', capturedType: null }
  );
  assert.deepEqual(
    inferMoveFromBoards('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'Q3k3/8/8/8/8/8/8/4K3 b - - 0 1'),
    { moverColor: 'w', from: 'a7', to: 'a8', promotion: 'q', movedType: 'p', capturedType: null }
  );
  assert.equal(inferMoveFromBoards(START_FEN, START_FEN), null);
  assert.equal(
    inferMoveFromBoards(START_FEN, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'),
    null
  );
});

/**
 * Verifies setFenTurn rewrites only the side-to-move field and hasSamePlacement ignores turn.
 */
test('setFenTurn and hasSamePlacement operate on the FEN fields they own', () => {
  assert.equal(setFenTurn(START_FEN, 'b'), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
  assert.equal(hasSamePlacement(START_FEN, START_FEN.replace(' w ', ' b ')), true);
  assert.equal(hasSamePlacement(START_FEN, MOVE_FEN), false);
  assert.equal(hasSamePlacement(null, START_FEN), false);
});

/**
 * Verifies ensureFenCastlingRights preserves active castling rights or infers valid rights
 * when the incoming FEN has '-' but kings and rooks remain on their starting squares.
 */
test('ensureFenCastlingRights restores and validates castling rights for Stockfish analysis', () => {
  // 1. Starting position FEN with '-' for castling is restored to 'KQkq'
  const startFenNoCastling = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
  const restoredStart = ensureFenCastlingRights(startFenNoCastling, 'KQkq');
  assert.equal(restoredStart.castling, 'KQkq');
  assert.equal(restoredStart.fen, START_FEN);

  // 2. Middle game position where Black's a8 rook moved (1rbqk2r), White intact
  const midGameFen = '1rbqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w - - 0 5';
  const restoredMid = ensureFenCastlingRights(midGameFen, 'KQkq');
  assert.equal(restoredMid.castling, 'KQk'); // Black h8 rook intact, Black a8 rook vacated
  assert.ok(restoredMid.fen.includes(' w KQk - 0 5'));

  // 3. FEN that already has explicit castling rights preserves them after grid verification
  const explicitFen = '1rbqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 2 5';
  const preserved = ensureFenCastlingRights(explicitFen, 'KQkq');
  assert.equal(preserved.castling, 'KQk'); // a8 is empty, so 'q' revoked by grid check
  assert.ok(preserved.fen.includes(' w KQk - 2 5'));

  // 4. Kings already moved, returns '-'
  const noRightsFen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
  const noRights = ensureFenCastlingRights(noRightsFen, 'KQkq');
  assert.equal(noRights.castling, '-');
  assert.equal(noRights.fen, '4k3/8/8/8/8/8/8/4K3 w - - 0 1');
});

/**
 * Validates formatTrapCard constructs presentation model for offensive, defensive, and tactical traps.
 */
test('formatTrapCard formats viewModel for companion trap cards across languages', () => {
  // 1. Null trap returns null
  assert.equal(formatTrapCard(null, 'vi'), null);

  // 2. Offensive trap
  const offensiveMock = {
    id: 'legal_trap',
    name: { vi: 'Bẫy Légal', en: "Légal's Trap" },
    type: 'offensive',
    suggestedMoveUci: 'f3e5',
    description: { vi: 'Thí Hậu bằng Nxe5!', en: 'Queen sacrifice with Nxe5!' },
  };

  const cardVi = formatTrapCard(offensiveMock, 'vi');
  assert.ok(cardVi);
  assert.equal(cardVi.badgeClass, 'trap-badge-offensive');
  assert.ok(cardVi.badgeText.includes('tấn công'));
  assert.equal(cardVi.titleText, 'Bẫy Légal');
  assert.ok(cardVi.moveText.includes('f3e5'));
  assert.equal(cardVi.descText, 'Thí Hậu bằng Nxe5!');
  assert.equal(cardVi.moveUci, 'f3e5');
  assert.equal(cardVi.arrowColor, 'rgba(239, 68, 68, 0.95)', 'Offensive trap arrow should be high-visibility red');

  const cardEn = formatTrapCard(offensiveMock, 'en');
  assert.ok(cardEn);
  assert.ok(cardEn.badgeText.includes('Offensive'));
  assert.equal(cardEn.titleText, "Légal's Trap");

  // 3. Defensive warning trap
  const defensiveMock = {
    id: 'legal_trap',
    name: { vi: 'Cảnh báo Bẫy Légal', en: "Légal's Trap Alert" },
    type: 'defensive',
    suggestedMoveUci: 'd6e5',
    punishAvoidUci: 'g4d1',
    description: { vi: 'Đừng ăn Hậu!', en: 'Do not take Queen!' },
  };

  const cardDef = formatTrapCard(defensiveMock, 'vi');
  assert.ok(cardDef);
  assert.equal(cardDef.badgeClass, 'trap-badge-defensive');
  assert.ok(cardDef.badgeText.includes('Cảnh báo'));
  assert.ok(cardDef.avoidText.includes('g4d1'));

  // 4. Risky trap
  const riskyMock = {
    id: 'risky_trap',
    name: { vi: 'Đòn bẫy Mạo hiểm', en: 'Risky Trap' },
    type: 'tactical',
    isRisky: true,
    suggestedMoveUci: 'g4h2',
    description: { vi: 'Chấp nhận mạo hiểm', en: 'Accept risk' },
  };
  const cardRisky = formatTrapCard(riskyMock, 'vi');
  assert.ok(cardRisky);
  assert.equal(cardRisky.arrowColor, 'rgba(239, 68, 68, 0.95)');
  assert.equal(cardRisky.badgeClass, 'trap-badge-risky');
  assert.ok(cardRisky.badgeText.includes('Mạo hiểm') || cardRisky.badgeText.includes('mạo hiểm'));
});

/**
 * Validates resolveCompanionPrimaryHint prioritizes trap moves when Trap Mode is toggled ON.
 */
test('resolveCompanionPrimaryHint overrides primary move and styling when Trap Mode is active', () => {
  const offensiveTrap = {
    id: 'legal_trap',
    name: { vi: 'Bẫy Légal', en: "Légal's Trap" },
    type: 'offensive',
    suggestedMoveUci: 'f3e5',
    sequence: [
      { move: 'f3e5', san: 'Nxe5!' },
      { move: 'g4d1', san: 'Bxd1?' },
      { move: 'c4f7', san: 'Bxf7+' },
    ],
  };

  // 1. Trap Mode ON with trap available -> Trap move becomes primary
  const trapActive = resolveCompanionPrimaryHint({
    bestMoveUci: 'd2d4',
    scoreText: '+0.5',
    trap: offensiveTrap,
    trapModeActive: true,
    lang: 'vi',
  });
  assert.equal(trapActive.isTrapPrimary, true);
  assert.equal(trapActive.primaryColor, 'rgba(239, 68, 68, 0.95)', 'Primary trap arrow must be high-visibility red');
  assert.equal(trapActive.primaryMoveUci, 'f3e5');
  assert.ok(trapActive.label.includes('f3e5'));
  assert.ok(trapActive.label.includes('Légal'));
  assert.equal(trapActive.sequence.length, 3);

  // 2. Trap Mode ON without trap available -> Stockfish move remains with indicator note
  const trapActiveNoTrap = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    scoreText: '+0.2',
    trap: null,
    trapModeActive: true,
    lang: 'vi',
  });
  assert.equal(trapActiveNoTrap.isTrapPrimary, false);
  assert.equal(trapActiveNoTrap.primaryMoveUci, 'e2e4');
  assert.ok(trapActiveNoTrap.label.includes('Chưa có đòn bẫy'));

  // 3. Trap Mode OFF -> Stockfish best move is normal primary
  const trapInactive = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    scoreText: '+0.2',
    trap: offensiveTrap,
    trapModeActive: false,
    lang: 'vi',
  });
  assert.equal(trapInactive.isTrapPrimary, false);
  assert.equal(trapInactive.primaryMoveUci, 'e2e4');
  assert.ok(!trapInactive.label.includes('Bẫy Légal'));
});

/**
 * Validates formatProactiveTrapList transforms candidate list into UI view model pills.
 */
test('formatProactiveTrapList formats candidates into interactive view model', () => {
  const candidates = [
    {
      trap: {
        id: 'legal_trap',
        name: { vi: 'Bẫy Légal', en: "Légal's Trap" },
      },
      nextSetupMove: 'f1c4',
      remainingSteps: 2,
    },
  ];

  const listVi = formatProactiveTrapList(candidates, 'vi');
  assert.equal(listVi.length, 1);
  assert.equal(listVi[0].id, 'legal_trap');
  assert.equal(listVi[0].name, 'Bẫy Légal');
  assert.ok(listVi[0].nextMoveText.includes('f1c4'));
  assert.equal(listVi[0].setupMoveUci, 'f1c4');

  const listEn = formatProactiveTrapList(candidates, 'en');
  assert.equal(listEn[0].name, "Légal's Trap");

  assert.deepEqual(formatProactiveTrapList([], 'vi'), []);
  assert.deepEqual(formatProactiveTrapList(null, 'vi'), []);
});

/**
 * Validates formatTrapCard handles extreme sacrifice traps with prominent badge and roadmap steps.
 */
test('formatTrapCard formats extreme sacrifice traps with extreme badge and combo roadmap', () => {
  const extremeSacrificeTrap = {
    id: 'damiano_trap',
    name: { vi: 'Bẫy Thí Mã Damiano', en: "Damiano's Trap" },
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'minor',
    suggestedMoveUci: 'f3e5',
    sequence: [
      { move: 'f3e5', san: 'Nxe5!', label: { vi: '1. Thí Mã cực mạnh', en: '1. Extreme Knight sacrifice' } },
      { move: 'f6e5', san: 'fxe5?', label: { vi: '2. Đen sập bẫy ăn Mã', en: '2. Black greedily captures knight' } },
      { move: 'd1h5', san: 'Qh5+', label: { vi: '3. Hậu chiếu kéo Vua ra ngoài', en: '3. Queen checks' } },
    ],
  };

  const cardVi = formatTrapCard(extremeSacrificeTrap, 'vi');
  assert.ok(cardVi);
  assert.equal(cardVi.badgeClass, 'trap-badge-extreme');
  assert.ok(cardVi.badgeText.includes('Thí'));
  assert.equal(cardVi.isExtremeSacrifice, true);
  assert.ok(Array.isArray(cardVi.roadmapSteps));
  assert.equal(cardVi.roadmapSteps.length, 3);
  assert.equal(cardVi.roadmapSteps[0].isSacrifice, true);

  const cardEn = formatTrapCard(extremeSacrificeTrap, 'en');
  assert.ok(cardEn);
  assert.equal(cardEn.badgeClass, 'trap-badge-extreme');
  assert.ok(cardEn.badgeText.includes('Sacrifice'));

  // resolveCompanionPrimaryHint should feature extreme sacrifice styling
  const hintVi = resolveCompanionPrimaryHint({
    bestMoveUci: 'f3e5',
    trap: extremeSacrificeTrap,
    trapModeActive: true,
    lang: 'vi',
  });
  assert.ok(hintVi.label.includes('Thí quân'));
});

/**
 * Validates resolveCompanionPrimaryHint elevates second best move when streak reaches threshold and runner-up is safe.
 */
test('resolveCompanionPrimaryHint promotes safe runner-up move when consecutive streak reaches 10', () => {
  // Case 1: Active anti-streak, streak reaches threshold 10, runner-up is safe
  const resultSafe = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    scoreText: '+0.4',
    secondBestMoveUci: 'd2d4',
    secondBestScoreText: '+0.3',
    bestEval: { cp: 40, mate: null },
    secondBestEval: { cp: 30, mate: null },
    streak: 10,
    threshold: 10,
    antiStreakActive: true,
    moverColor: 'w',
    lang: 'vi',
  });
  assert.equal(resultSafe.primaryMoveUci, 'd2d4');
  assert.equal(resultSafe.primaryColor, 'rgba(245, 158, 11, 0.95)');
  assert.equal(resultSafe.isAntiStreakPrimary, true);
  assert.ok(resultSafe.label.includes('Chống chuỗi tối ưu'));
  assert.ok(resultSafe.label.includes('d2d4'));

  // Case 2: Active anti-streak, streak 10, but runner-up is unsafe (blunder)
  const resultUnsafe = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    scoreText: '+0.4',
    secondBestMoveUci: 'g2g4',
    secondBestScoreText: '-2.5',
    bestEval: { cp: 40, mate: null },
    secondBestEval: { cp: -250, mate: null },
    streak: 10,
    threshold: 10,
    antiStreakActive: true,
    moverColor: 'w',
    lang: 'vi',
  });
  assert.equal(resultUnsafe.primaryMoveUci, 'e2e4');
  assert.equal(resultUnsafe.isAntiStreakPrimary, false);
  assert.ok(resultUnsafe.label.includes('rủi ro cao'));

  // Case 3: Streak below threshold (e.g. 5) -> normal best move
  const resultBelow = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    scoreText: '+0.4',
    secondBestMoveUci: 'd2d4',
    secondBestScoreText: '+0.3',
    bestEval: { cp: 40, mate: null },
    secondBestEval: { cp: 30, mate: null },
    streak: 3,
    threshold: 5,
    antiStreakActive: true,
    moverColor: 'w',
    lang: 'vi',
  });
  assert.equal(resultBelow.primaryMoveUci, 'e2e4');
  assert.equal(resultBelow.isAntiStreakPrimary, false);
});

/**
 * Validates resolveCompanionPrimaryHint defaults anti-streak threshold to 5.
 */
test('resolveCompanionPrimaryHint defaults anti-streak threshold to 5 and promotes safe runner-up', () => {
  const result = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    scoreText: '+0.4',
    secondBestMoveUci: 'd2d4',
    secondBestScoreText: '+0.3',
    bestEval: { cp: 40, mate: null },
    secondBestEval: { cp: 30, mate: null },
    streak: 5,
    antiStreakActive: true,
    moverColor: 'w',
    lang: 'vi',
  });
  assert.equal(result.primaryMoveUci, 'd2d4');
  assert.equal(result.isAntiStreakPrimary, true);
});

/**
 * Validates formatAntiStreakButtonText formats button text and titles across active/triggered states in vi and en.
 */
test('formatAntiStreakButtonText renders toggle button states correctly', () => {
  const offVi = formatAntiStreakButtonText(false, 0, 10, 'vi');
  assert.ok(offVi.buttonText.includes('TẮT'));
  assert.equal(offVi.isTriggered, false);

  const onVi = formatAntiStreakButtonText(true, 4, 10, 'vi');
  assert.ok(onVi.buttonText.includes('4/10'));
  assert.equal(onVi.isTriggered, false);

  const triggeredVi = formatAntiStreakButtonText(true, 10, 10, 'vi');
  assert.ok(triggeredVi.buttonText.includes('10/10'));
  assert.equal(triggeredVi.isTriggered, true);

  const triggeredEn = formatAntiStreakButtonText(true, 12, 10, 'en');
  assert.ok(triggeredEn.buttonText.includes('TRIGGERED'));
  assert.equal(triggeredEn.isTriggered, true);
});

/**
 * Validates formatContinuousAttackButtonText formats button labels and titles in vi and en.
 */
test('formatContinuousAttackButtonText renders toggle button states correctly', () => {
  const offVi = formatContinuousAttackButtonText(false, 'vi');
  assert.ok(offVi.buttonText.includes('TẮT'));
  assert.ok(offVi.buttonText.includes('Tấn công thí quân'));

  const onVi = formatContinuousAttackButtonText(true, 'vi');
  assert.ok(onVi.buttonText.includes('ĐANG BẬT'));

  const offEn = formatContinuousAttackButtonText(false, 'en');
  assert.ok(offEn.buttonText.includes('OFF'));

  const onEn = formatContinuousAttackButtonText(true, 'en');
  assert.ok(onEn.buttonText.includes('ACTIVE'));
});

/**
 * Validates resolveCompanionPrimaryHint prioritizes king hunt sacrifices when continuous attack mode is active.
 */
test('resolveCompanionPrimaryHint elevates king hunt sacrifice moves when continuousAttackActive is true', () => {
  const kingSacrifice = {
    id: 'king_hunt_sacrifice',
    name: { vi: '🔥 Thí Tượng xé toang thành Vua', en: '🔥 Bishop King Hunt Sacrifice' },
    suggestedMoveUci: 'd3h7',
    sequence: [
      { move: 'd3h7', san: 'Bxh7+' },
      { move: 'g8h7', san: 'Kxh7' },
    ],
  };

  // Case 1: Attack mode active and king sacrifice is found -> elevated to primary
  const resultVi = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    continuousAttackActive: true,
    kingSacrifice,
    lang: 'vi',
  });
  assert.equal(resultVi.primaryMoveUci, 'd3h7');
  assert.equal(resultVi.isAttackSacrificePrimary, true);
  assert.ok(resultVi.label.includes('Thí quân'));
  assert.ok(resultVi.label.includes('d3h7'));
  assert.equal(resultVi.primaryColor, 'rgba(239, 68, 68, 0.98)');

  // Case 2: Attack mode active in English
  const resultEn = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    continuousAttackActive: true,
    kingSacrifice,
    lang: 'en',
  });
  assert.equal(resultEn.primaryMoveUci, 'd3h7');
  assert.equal(resultEn.isAttackSacrificePrimary, true);
  assert.ok(resultEn.label.includes('King Hunt Sacrifice'));

  // Case 3: Attack mode active but no sacrifice available -> reports status clearly
  const resultNone = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    continuousAttackActive: true,
    kingSacrifice: null,
    lang: 'vi',
  });
  assert.equal(resultNone.primaryMoveUci, 'e2e4');
  assert.equal(resultNone.isAttackSacrificePrimary, false);
  assert.ok(resultNone.label.includes('Chưa có cơ hội thí quân'));
});



/**
 * Validates resolveCompanionPrimaryHint respects selectedMoveUci overrides from interactive trap selection.
 */
test('resolveCompanionPrimaryHint respects user-selected move override from trap cards or pills', () => {
  const result = resolveCompanionPrimaryHint({
    bestMoveUci: 'g1f3',
    selectedMoveUci: 'f3e5',
    trap: {
      suggestedMoveUci: 'f3e5',
      name: { vi: 'Bẫy Blackburne', en: 'Blackburne Shilling Trap' },
      type: 'offensive',
    },
    lang: 'vi',
  });

  assert.equal(result.primaryMoveUci, 'f3e5');
  assert.equal(result.primaryColor, 'rgba(239, 68, 68, 0.95)');
  assert.ok(result.label.includes('f3e5'));
});

/**
 * Validates resolveCompanionPrimaryHint prioritizes active combo punishment moves even when trapModeActive is false.
 */
test('resolveCompanionPrimaryHint prioritizes active combo trap moves even when trapModeActive is false', () => {
  const comboTrap = {
    id: 'fishing_pole',
    name: { vi: 'Bẫy Cần Câu (Fishing Pole)', en: 'Fishing Pole Trap' },
    type: 'offensive',
    suggestedMoveUci: 'd8h4',
    sequence: [
      { move: 'g4h2', san: 'hxg4', label: { vi: '1. Mở cột h', en: '1. Open h-file' } },
      { move: 'd8h4', san: 'Qh4', label: { vi: '2. Hậu lao vào trừng phạt', en: '2. Queen punishes' } },
    ],
  };

  const result = resolveCompanionPrimaryHint({
    bestMoveUci: 'f8e7',
    scoreText: '+3.5',
    trap: comboTrap,
    trapModeActive: false, // User has not explicitly toggled Trap Mode button ON
    isComboActive: true,   // Active combo chain in progress
    lang: 'vi',
  });

  // Verify that active combo punishment takes priority over engine move
  assert.equal(result.primaryMoveUci, 'd8h4');
  assert.equal(result.primaryColor, 'rgba(239, 68, 68, 0.95)');
  assert.equal(result.isTrapPrimary, true);
  assert.ok(result.label.includes('d8h4'));
});

/**
 * Validates resolveCompanionPrimaryHint prioritizes combo traps over continuous attack and anti-streak.
 */
test('resolveCompanionPrimaryHint prioritizes combo trap over continuous attack and anti-streak', () => {
  const comboTrap = {
    id: 'legal_trap',
    name: { vi: 'Bẫy Légal', en: "Légal's Trap" },
    type: 'offensive',
    suggestedMoveUci: 'd1h5',
    sequence: [{ move: 'd1h5', san: 'Qh5#' }],
  };

  const kingSacrificeAttack = {
    name: { vi: 'Thí Xe phá thành', en: 'Rook Sacrifice' },
    suggestedMoveUci: 'h1h7',
    sequence: [{ move: 'h1h7', san: 'Rxh7+' }],
  };

  // Both combo trap, continuous attack and high streak are active simultaneously
  const result = resolveCompanionPrimaryHint({
    bestMoveUci: 'e2e4',
    trap: comboTrap,
    isComboActive: true,
    continuousAttackActive: true,
    kingSacrifice: kingSacrificeAttack,
    antiStreakActive: true,
    streak: 12,
    threshold: 5,
    secondBestMoveUci: 'd2d4',
    secondBestEval: { cp: 50, mate: null },
    bestEval: { cp: 60, mate: null },
    moverColor: 'w',
    lang: 'vi',
  });

  // Combo trap MUST win over continuous attack and anti-streak
  assert.equal(result.primaryMoveUci, 'd1h5');
  assert.equal(result.isTrapPrimary, true);
  assert.equal(result.isAttackSacrificePrimary, false);
  assert.equal(result.isAntiStreakPrimary, false);
  assert.ok(result.label.includes('d1h5'));
});




