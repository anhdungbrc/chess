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
