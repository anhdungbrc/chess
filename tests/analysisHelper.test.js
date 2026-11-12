import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMove,
  computeMoveAccuracy,
  evalToWinPercent,
  formatEvalScore,
  parseUciInfoLine,
  summarizeGameAnalysis,
  uciToMoveSquares,
} from '../public/analysisHelper.js';
import { getClassificationBadgeInfo } from '../public/chessAssets.js';

/**
 * Verifies parseUciInfoLine extracts centipawn/mate scores, depth, and PV while normalizing to White's perspective.
 * Expected: White-to-move keeps sign; Black-to-move negates cp/mate; bound lines and non-score info lines return null.
 */
function testParseUciInfoLine() {
  const whiteLine = 'info depth 10 seldepth 14 multipv 1 score cp 125 nodes 9000 pv e2e4 e7e5';
  const parsedWhite = parseUciInfoLine(whiteLine, 'w');
  assert.deepEqual(parsedWhite, {
    depth: 10,
    cp: 125,
    mate: null,
    pv: ['e2e4', 'e7e5'],
    bestMoveUci: 'e2e4',
  });

  const blackMateLine = 'info depth 12 score mate 3 nodes 12000 pv d8h4 g2g3 h4e4';
  const parsedBlack = parseUciInfoLine(blackMateLine, 'b');
  assert.deepEqual(parsedBlack, {
    depth: 12,
    cp: null,
    mate: -3,
    pv: ['d8h4', 'g2g3', 'h4e4'],
    bestMoveUci: 'd8h4',
  });

  assert.equal(parseUciInfoLine('info depth 10 currmove e2e4 currmovenumber 1', 'w'), null);
  assert.equal(parseUciInfoLine('info depth 10 score cp 40 upperbound nodes 500 pv e2e4', 'w'), null);
}

/**
 * Verifies evalToWinPercent maps centipawn and mate evaluations onto the 0..100 White win-chance scale.
 * Expected: 0 cp equals 50%, positive cp > 50, negative cp < 50, positive mate = 100, negative mate = 0.
 */
function testEvalToWinPercent() {
  assert.equal(evalToWinPercent({ cp: 0, mate: null }), 50);
  const plusPawn = evalToWinPercent({ cp: 100, mate: null });
  const minusPawn = evalToWinPercent({ cp: -100, mate: null });
  assert.ok(plusPawn > 58 && plusPawn < 60, `Expected ~59.1, got ${plusPawn}`);
  assert.ok(Math.abs(plusPawn + minusPawn - 100) < 0.001);
  assert.equal(evalToWinPercent({ cp: null, mate: 2 }), 100);
  assert.equal(evalToWinPercent({ cp: null, mate: -1 }), 0);
}

/**
 * Verifies formatEvalScore formats centipawn pawns and mate distances cleanly.
 * Expected: +145 cp -> '+1.5', -4 cp -> '0.0', mate +3 -> 'M3', mate -2 -> '-M2'.
 */
function testFormatEvalScore() {
  assert.equal(formatEvalScore({ cp: 145, mate: null }), '+1.5');
  assert.equal(formatEvalScore({ cp: -80, mate: null }), '-0.8');
  assert.equal(formatEvalScore({ cp: -3, mate: null }), '0.0');
  assert.equal(formatEvalScore({ cp: null, mate: 3 }), 'M3');
  assert.equal(formatEvalScore({ cp: null, mate: -2 }), '-M2');
}

/**
 * Verifies classifyMove categorizes moves from best to blunder based on mover Win% drop and best-move match.
 * Expected: engine best move classifies as 'best' (100% accuracy); sharp drops classify as inaccuracy/mistake/blunder.
 */
function testClassifyMove() {
  const bestResult = classifyMove({
    prevEval: { cp: 30, mate: null },
    nextEval: { cp: 30, mate: null },
    moverColor: 'w',
    playedUci: 'e2e4',
    bestMoveUci: 'e2e4',
    isCheckmate: false,
  });
  assert.equal(bestResult.classification, 'best');
  assert.equal(bestResult.accuracy, 100);

  // Black loses ~200 cp (from ~50% to ~32.3% Black win%) -> Mistake (~17.7% loss).
  const mistakeResult = classifyMove({
    prevEval: { cp: 0, mate: null },
    nextEval: { cp: 200, mate: null },
    moverColor: 'b',
    playedUci: 'g8f6',
    bestMoveUci: 'e7e5',
    isCheckmate: false,
  });
  assert.equal(mistakeResult.classification, 'mistake');
  assert.ok(mistakeResult.winLoss > 15 && mistakeResult.winLoss <= 25);

  // White blunders mate from +300 cp to -M1 -> Blunder (> 25% loss).
  const blunderResult = classifyMove({
    prevEval: { cp: 300, mate: null },
    nextEval: { cp: null, mate: -1 },
    moverColor: 'w',
    playedUci: 'f2f3',
    bestMoveUci: 'd1h5',
    isCheckmate: false,
  });
  assert.equal(blunderResult.classification, 'blunder');
  assert.ok(blunderResult.accuracy < 10);
}

/**
 * Verifies computeMoveAccuracy and summarizeGameAnalysis aggregate per-side accuracy and classification counts.
 * Expected: zero winLoss yields 100 accuracy; summary averages per side and counts each category accurately.
 */
function testSummarizeGameAnalysis() {
  assert.equal(computeMoveAccuracy(0), 100);

  const summary = summarizeGameAnalysis([
    { color: 'w', classification: 'best', accuracy: 100 },
    { color: 'b', classification: 'inaccuracy', accuracy: 60 },
    { color: 'w', classification: 'good', accuracy: 80 },
    { color: 'b', classification: 'blunder', accuracy: 20 },
  ]);

  assert.equal(summary.whiteAccuracy, 90);
  assert.equal(summary.blackAccuracy, 40);
  assert.equal(summary.counts.w.best, 1);
  assert.equal(summary.counts.w.good, 1);
  assert.equal(summary.counts.b.inaccuracy, 1);
  assert.equal(summary.counts.b.blunder, 1);
  assert.equal(summary.counts.w.blunder, 0);
}

/**
 * Verifies uciToMoveSquares decodes standard and promotion UCI move strings and rejects '(none)'.
 * Expected: 'e2e4' -> { from: 'e2', to: 'e4' }; 'a7a8q' includes promotion; '(none)' -> null.
 */
function testUciToMoveSquares() {
  assert.deepEqual(uciToMoveSquares('e2e4'), { from: 'e2', to: 'e4' });
  assert.deepEqual(uciToMoveSquares('a7a8q'), { from: 'a7', to: 'a8', promotion: 'q' });
  assert.equal(uciToMoveSquares('(none)'), null);
  assert.equal(uciToMoveSquares(null), null);
}

test('parseUciInfoLine parses scores and normalizes Black perspective', testParseUciInfoLine);
test('evalToWinPercent maps cp and mate to White win probability', testEvalToWinPercent);
test('formatEvalScore formats pawn scores and mate indicators', testFormatEvalScore);
test('classifyMove assigns Chess.com-style categories from Win% loss', testClassifyMove);
test('summarizeGameAnalysis aggregates per-side accuracy and counts', testSummarizeGameAnalysis);
test('uciToMoveSquares parses UCI move coordinates and promotion', testUciToMoveSquares);

/**
 * Verifies getClassificationBadgeInfo returns Chess.com-style badge metadata for every move category.
 * Expected: each category returns non-empty symbol, label, and hex color; unknown categories fall back safely.
 */
function testClassificationBadgeMetadata() {
  for (const kind of ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']) {
    const info = getClassificationBadgeInfo(kind);
    assert.ok(info.symbol.length > 0);
    assert.ok(info.label.length > 0);
    assert.match(info.color, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(getClassificationBadgeInfo('blunder').symbol, '??');
  assert.equal(getClassificationBadgeInfo('mistake').symbol, '?');
  assert.equal(getClassificationBadgeInfo('inaccuracy').symbol, '?!');
}

test('getClassificationBadgeInfo returns Chess.com-style badge metadata', testClassificationBadgeMetadata);
