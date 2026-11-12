import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { chooseAiMove } from '../src/domain/aiEngine.js';

/**
 * Verifies that chooseAiMove returns null when the game is already over by stalemate.
 * Expected: returns null on a legal stalemate FEN.
 */
function testReturnsNullOnStalemate() {
  const stalemateFen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
  const move = chooseAiMove(stalemateFen, 'medium');
  assert.equal(move, null);
}

/**
 * Verifies that chooseAiMove finds a forced mate-in-1 move for White.
 * Expected: chooses Re8# from the back-rank mate position.
 */
function testFindsMateInOneForWhite() {
  const fen = '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1';
  const move = chooseAiMove(fen, 'medium');
  assert.ok(move);
  assert.equal(move.from, 'e1');
  assert.equal(move.to, 'e8');
  const verify = new Chess(fen);
  verify.move(move);
  assert.equal(verify.isCheckmate(), true);
}

/**
 * Verifies that chooseAiMove finds a forced mate-in-1 move for Black.
 * Expected: chooses Rd1# from the back-rank mate position.
 */
function testFindsMateInOneForBlack() {
  const fen = '3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1';
  const move = chooseAiMove(fen, 'hard');
  assert.ok(move);
  assert.equal(move.from, 'd8');
  assert.equal(move.to, 'd1');
  const verify = new Chess(fen);
  verify.move(move);
  assert.equal(verify.isCheckmate(), true);
}

/**
 * Verifies that chooseAiMove rejects unsupported difficulty values.
 * Expected: throws an Error when difficulty is outside easy/medium/hard.
 */
function testThrowsOnInvalidDifficulty() {
  const startFen = new Chess().fen();
  assert.throws(() => chooseAiMove(startFen, 'impossible'), /difficulty/i);
}

/**
 * Verifies that medium AI avoids capturing a defended pawn with the Queen.
 * Expected: does not play Qxd5 because Black immediately recaptures exd5.
 */
function testMediumAvoidsQueenBlunder() {
  const fen = '4k3/8/4p3/3p4/8/8/8/3Q3K w - - 0 1';
  const move = chooseAiMove(fen, 'medium');
  assert.ok(move);
  assert.notEqual(`${move.from}${move.to}`, 'd1d5');
}

/**
 * Verifies that hard AI finds a forced mate-in-2 sacrifice instead of grabbing a free knight.
 * Expected: plays Re8+ or Qe8+ which forces checkmate on the next move.
 */
function testHardFindsMateInTwoSacrifice() {
  const fen = 'r5k1/5ppp/8/8/1n6/8/4R3/4Q1K1 w - - 0 1';
  const move = chooseAiMove(fen, 'hard');
  assert.ok(move);
  assert.ok(
    move.san === 'Re8+' || move.san === 'Qe8+',
    `Expected Re8+ or Qe8+, got ${move.san}`
  );
}

/**
 * Verifies that easy AI returns a legal move from the initial position.
 * Expected: returned move is legal in chess.js.
 */
function testEasyReturnsLegalMove() {
  const startFen = new Chess().fen();
  const move = chooseAiMove(startFen, 'easy');
  assert.ok(move);
  const verify = new Chess(startFen);
  const played = verify.move(move);
  assert.ok(played);
}

test('returns null on stalemate position', testReturnsNullOnStalemate);
test('finds mate-in-1 for White', testFindsMateInOneForWhite);
test('finds mate-in-1 for Black', testFindsMateInOneForBlack);
test('throws on invalid difficulty', testThrowsOnInvalidDifficulty);
test('medium AI avoids Queen blunder into pawn recapture', testMediumAvoidsQueenBlunder);
test('hard AI finds forced mate-in-2 sacrifice', testHardFindsMateInTwoSacrifice);
test('easy AI returns a legal move from start position', testEasyReturnsLegalMove);
