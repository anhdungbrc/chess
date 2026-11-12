import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatReviewMoveLabel,
  parseFenBoard,
  resolveReviewViewState,
} from '../public/reviewHelper.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Builds a minimal test game snapshot with deterministic board and move history.
 *
 * @param {object} [overrides] - Optional fields to override on the base snapshot.
 * @returns {object} Game snapshot fixture.
 */
function createSnapshotFixture(overrides = {}) {
  const startBoard = parseFenBoard(START_FEN);
  return {
    id: 'game-1',
    initialFen: START_FEN,
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    board: startBoard,
    turn: 'w',
    playerColor: 'w',
    aiColor: 'b',
    difficulty: 'medium',
    status: 'playing',
    winner: null,
    inCheck: false,
    legalMoves: [],
    history: [
      {
        color: 'w',
        from: 'e2',
        to: 'e4',
        san: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        inCheck: false,
      },
      {
        color: 'b',
        from: 'e7',
        to: 'e5',
        san: 'e5',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        inCheck: false,
      },
    ],
    lastMove: { color: 'b', from: 'e7', to: 'e5', san: 'e5' },
    ...overrides,
  };
}

/**
 * Verifies parseFenBoard decodes standard starting FEN and mid-game FENs into an 8x8 board matrix.
 * Expected: piece types, colors, square names, and empty cells match exact algebraic coordinates.
 */
function testParseFenBoardValidPositions() {
  const startBoard = parseFenBoard(START_FEN);
  assert.equal(startBoard.length, 8);
  assert.equal(startBoard[0].length, 8);
  assert.deepEqual(startBoard[0][0], { square: 'a8', type: 'r', color: 'b' });
  assert.deepEqual(startBoard[0][4], { square: 'e8', type: 'k', color: 'b' });
  assert.equal(startBoard[4][4], null);
  assert.deepEqual(startBoard[7][3], { square: 'd1', type: 'q', color: 'w' });
  assert.deepEqual(startBoard[7][7], { square: 'h1', type: 'r', color: 'w' });

  const midGameBoard = parseFenBoard('1Q4k1/8/8/4p3/4P3/8/5PPP/4R1K1 b - - 0 1');
  assert.equal(midGameBoard[0][0], null);
  assert.deepEqual(midGameBoard[0][1], { square: 'b8', type: 'q', color: 'w' });
  assert.deepEqual(midGameBoard[0][6], { square: 'g8', type: 'k', color: 'b' });
  assert.deepEqual(midGameBoard[3][4], { square: 'e5', type: 'p', color: 'b' });
  assert.deepEqual(midGameBoard[4][4], { square: 'e4', type: 'p', color: 'w' });
  assert.deepEqual(midGameBoard[7][4], { square: 'e1', type: 'r', color: 'w' });
}

/**
 * Verifies parseFenBoard rejects malformed FEN strings with an Error.
 * Expected: empty strings, bad rank counts, bad column widths, and unknown symbols throw.
 */
function testParseFenBoardRejectsMalformedFen() {
  assert.throws(() => parseFenBoard(''), Error);
  assert.throws(() => parseFenBoard('8/8/8 w - - 0 1'), Error);
  assert.throws(() => parseFenBoard('9/8/8/8/8/8/8/8 w - - 0 1'), Error);
  assert.throws(() => parseFenBoard('8/8/8/8/8/8/8/7X w - - 0 1'), Error);
}

/**
 * Verifies resolveReviewViewState handles null games and live mode snapshots properly.
 * Expected: live mode mirrors game state and disables stepping forward; empty history disables backward.
 */
function testResolveReviewViewStateNullAndLive() {
  const noGame = resolveReviewViewState(null, null);
  assert.equal(noGame.isReviewing, false);
  assert.equal(noGame.board, null);
  assert.equal(noGame.canStepBackward, false);
  assert.equal(noGame.canStepForward, false);

  const emptyGame = createSnapshotFixture({
    fen: START_FEN,
    history: [],
    lastMove: null,
  });
  const liveEmpty = resolveReviewViewState(emptyGame, null);
  assert.equal(liveEmpty.isReviewing, false);
  assert.equal(liveEmpty.effectivePly, 0);
  assert.equal(liveEmpty.activeHistoryIndex, -1);
  assert.equal(liveEmpty.canStepBackward, false);
  assert.equal(liveEmpty.canStepForward, false);

  const activeGame = createSnapshotFixture();
  const liveActive = resolveReviewViewState(activeGame, null);
  assert.equal(liveActive.isReviewing, false);
  assert.equal(liveActive.effectivePly, 2);
  assert.equal(liveActive.activeHistoryIndex, 1);
  assert.equal(liveActive.board, activeGame.board);
  assert.equal(liveActive.lastMove, activeGame.lastMove);
  assert.equal(liveActive.canStepBackward, true);
  assert.equal(liveActive.canStepForward, false);
}

/**
 * Verifies resolveReviewViewState reconstructs initial ply 0 and historical check positions accurately.
 * Expected: ply 0 clears lastMove and disables backward; historical check move surfaces inCheck=true and side to move.
 */
function testResolveReviewViewStateHistoricalPliesAndBoundaries() {
  const game = createSnapshotFixture({
    history: [
      {
        color: 'w',
        from: 'e2',
        to: 'e4',
        san: 'e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        inCheck: false,
      },
      {
        color: 'b',
        from: 'f7',
        to: 'f6',
        san: 'f6',
        fen: 'rnbqkbnr/ppppp1pp/5p2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        inCheck: false,
      },
      {
        color: 'w',
        from: 'd1',
        to: 'h5',
        san: 'Qh5+',
        fen: 'rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
        inCheck: true,
      },
      {
        color: 'b',
        from: 'g7',
        to: 'g6',
        san: 'g6',
        fen: 'rnbqkbnr/ppppp2p/5pp1/7Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3',
        inCheck: false,
      },
    ],
  });

  const plyZero = resolveReviewViewState(game, 0);
  assert.equal(plyZero.isReviewing, true);
  assert.equal(plyZero.effectivePly, 0);
  assert.equal(plyZero.turn, 'w');
  assert.equal(plyZero.inCheck, false);
  assert.equal(plyZero.lastMove, null);
  assert.equal(plyZero.activeHistoryIndex, -1);
  assert.equal(plyZero.canStepBackward, false);
  assert.equal(plyZero.canStepForward, true);
  assert.deepEqual(plyZero.board[6][4], { square: 'e2', type: 'p', color: 'w' });

  const plyThree = resolveReviewViewState(game, 3);
  assert.equal(plyThree.isReviewing, true);
  assert.equal(plyThree.effectivePly, 3);
  assert.equal(plyThree.turn, 'b');
  assert.equal(plyThree.inCheck, true);
  assert.deepEqual(plyThree.lastMove, { from: 'd1', to: 'h5' });
  assert.equal(plyThree.activeHistoryIndex, 2);
  assert.equal(plyThree.canStepBackward, true);
  assert.equal(plyThree.canStepForward, true);
  assert.deepEqual(plyThree.board[3][7], { square: 'h5', type: 'q', color: 'w' });

  const clampedNegative = resolveReviewViewState(game, -5);
  assert.equal(clampedNegative.isReviewing, true);
  assert.equal(clampedNegative.effectivePly, 0);

  const clampedToLive = resolveReviewViewState(game, 4);
  assert.equal(clampedToLive.isReviewing, false);
  assert.equal(clampedToLive.effectivePly, 4);
  assert.equal(clampedToLive.canStepForward, false);
}

/**
 * Verifies formatReviewMoveLabel formats White and Black plies using standard move numbers.
 * Expected: odd plies use 'N. san' and even plies use 'N... san'.
 */
function testFormatReviewMoveLabel() {
  const history = [
    { color: 'w', san: 'e4' },
    { color: 'b', san: 'e5' },
    { color: 'w', san: 'Nf3' },
    { color: 'b', san: 'Nc6' },
  ];
  assert.equal(formatReviewMoveLabel(history, 1), '1. e4');
  assert.equal(formatReviewMoveLabel(history, 2), '1... e5');
  assert.equal(formatReviewMoveLabel(history, 3), '2. Nf3');
  assert.equal(formatReviewMoveLabel(history, 4), '2... Nc6');
}

test('parseFenBoard parses valid FEN positions accurately', testParseFenBoardValidPositions);
test('parseFenBoard rejects malformed FEN strings', testParseFenBoardRejectsMalformedFen);
test('resolveReviewViewState handles null and live mode snapshots', testResolveReviewViewStateNullAndLive);
test('resolveReviewViewState handles historical plies and boundary clamping', testResolveReviewViewStateHistoricalPliesAndBoundaries);
test('formatReviewMoveLabel formats move numbers for White and Black', testFormatReviewMoveLabel);

