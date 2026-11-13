import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCompanionStatus,
  formatBestMoveHint,
  resolveCompanionBoardOrientation,
  fenToBoardMatrix,
  shouldTriggerAnalysis,
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

