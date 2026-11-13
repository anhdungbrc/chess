import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCompanionSnapshot,
  normalizeLastMove,
  CompanionValidationError,
} from '../src/domain/companionDomain.js';
import { validateCompanionSyncInput, ValidationError } from '../src/server/validators.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK_TURN_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

/**
 * Validates parseCompanionSnapshot with standard and fallback inputs.
 */
test('parseCompanionSnapshot normalizes valid snapshot inputs', () => {
  const result = parseCompanionSnapshot({
    fen: START_FEN,
    orientation: 'black',
    lastMove: { from: 'e2', to: 'e4' },
    timestamp: 1731479800000,
  });

  assert.equal(result.fen, START_FEN);
  assert.equal(result.orientation, 'black');
  assert.equal(result.turn, 'w');
  assert.deepEqual(result.lastMove, { from: 'e2', to: 'e4' });
  assert.equal(result.timestamp, 1731479800000);
});

/**
 * Validates default fallbacks for orientation, turn extraction, and timestamp.
 */
test('parseCompanionSnapshot applies safe fallbacks when optional fields are omitted', () => {
  const before = Date.now();
  const result = parseCompanionSnapshot({
    fen: BLACK_TURN_FEN,
  });
  const after = Date.now();

  assert.equal(result.fen, BLACK_TURN_FEN);
  assert.equal(result.orientation, 'white');
  assert.equal(result.turn, 'b');
  assert.equal(result.lastMove, null);
  assert.ok(result.timestamp >= before && result.timestamp <= after);
});

/**
 * Validates rejection of malformed FEN strings.
 */
test('parseCompanionSnapshot throws CompanionValidationError on invalid FEN', () => {
  assert.throws(
    () => parseCompanionSnapshot({ fen: 'not a valid fen' }),
    (err) => err instanceof CompanionValidationError && err.message.includes('Invalid FEN')
  );
  assert.throws(
    () => parseCompanionSnapshot({ fen: '' }),
    (err) => err instanceof CompanionValidationError && err.message.includes('fen is required')
  );
  assert.throws(
    () => parseCompanionSnapshot(null),
    (err) => err instanceof CompanionValidationError
  );
});

/**
 * Validates rejection of invalid orientation.
 */
test('parseCompanionSnapshot throws CompanionValidationError on invalid orientation', () => {
  assert.throws(
    () => parseCompanionSnapshot({ fen: START_FEN, orientation: 'random' }),
    (err) => err instanceof CompanionValidationError && err.message.includes('orientation')
  );
});

/**
 * Validates normalizeLastMove square validation.
 */
test('normalizeLastMove validates algebraic squares and rejects invalid coordinates', () => {
  assert.deepEqual(normalizeLastMove({ from: 'e2', to: 'e4' }), { from: 'e2', to: 'e4' });
  assert.equal(normalizeLastMove(undefined), null);
  assert.equal(normalizeLastMove(null), null);

  assert.throws(
    () => normalizeLastMove({ from: 'e9', to: 'e4' }),
    (err) => err instanceof CompanionValidationError && err.message.includes('lastMove.from')
  );
  assert.throws(
    () => normalizeLastMove({ from: 'e2', to: 'z4' }),
    (err) => err instanceof CompanionValidationError && err.message.includes('lastMove.to')
  );
});

/**
 * Validates HTTP validator validateCompanionSyncInput.
 */
test('validateCompanionSyncInput validates request payloads and maps to ValidationError', () => {
  const parsed = validateCompanionSyncInput({
    fen: START_FEN,
    lastMove: { from: 'd2', to: 'd4' },
  });

  assert.equal(parsed.fen, START_FEN);
  assert.deepEqual(parsed.lastMove, { from: 'd2', to: 'd4' });
  assert.equal(parsed.orientation, 'white');
  assert.equal(parsed.turn, 'w');

  assert.throws(
    () => validateCompanionSyncInput({ fen: 'bad-fen' }),
    (err) => err instanceof ValidationError && err.message.includes('Invalid FEN')
  );
});
