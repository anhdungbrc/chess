import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanionService } from '../src/service/companionService.js';

const SAMPLE_SNAPSHOT_1 = {
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  orientation: 'white',
  turn: 'b',
  lastMove: { from: 'e2', to: 'e4' },
  timestamp: 1731479800000,
};

const SAMPLE_SNAPSHOT_2 = {
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
  orientation: 'white',
  turn: 'w',
  lastMove: { from: 'e7', to: 'e5' },
  timestamp: 1731479805000,
};

/**
 * Validates initial state is empty.
 */
test('companionService starts with empty snapshot', () => {
  const service = createCompanionService();
  assert.equal(service.getLatestSnapshot(), null);
});

/**
 * Validates updating snapshot stores and retrieves the latest state.
 */
test('companionService updates and returns latest snapshot', () => {
  const service = createCompanionService();
  const updated = service.updateSnapshot(SAMPLE_SNAPSHOT_1);

  assert.deepEqual(updated, SAMPLE_SNAPSHOT_1);
  assert.deepEqual(service.getLatestSnapshot(), SAMPLE_SNAPSHOT_1);
});

/**
 * Validates subscriber notifications and unsubscribe cleanup.
 */
test('companionService notifies subscribers and respects unsubscribe cleanup', () => {
  const service = createCompanionService();
  const received = [];

  const unsubscribe = service.subscribe((snapshot) => {
    received.push(snapshot);
  });

  service.updateSnapshot(SAMPLE_SNAPSHOT_1);
  service.updateSnapshot(SAMPLE_SNAPSHOT_2);

  assert.equal(received.length, 2);
  assert.deepEqual(received[0], SAMPLE_SNAPSHOT_1);
  assert.deepEqual(received[1], SAMPLE_SNAPSHOT_2);

  // Unsubscribe should cease further notifications
  unsubscribe();
  service.updateSnapshot(SAMPLE_SNAPSHOT_1);
  assert.equal(received.length, 2);
});

/**
 * Validates subscriber errors do not prevent remaining listeners from receiving events.
 */
test('companionService isolates listener exceptions so other subscribers continue', () => {
  const service = createCompanionService();
  const received = [];

  service.subscribe(() => {
    throw new Error('Failing subscriber');
  });

  service.subscribe((snapshot) => {
    received.push(snapshot);
  });

  service.updateSnapshot(SAMPLE_SNAPSHOT_1);
  assert.equal(received.length, 1);
  assert.deepEqual(received[0], SAMPLE_SNAPSHOT_1);
});

/**
 * Validates reset clears the latest snapshot.
 */
test('companionService reset clears stored state', () => {
  const service = createCompanionService();
  service.updateSnapshot(SAMPLE_SNAPSHOT_1);
  assert.ok(service.getLatestSnapshot());

  service.reset();
  assert.equal(service.getLatestSnapshot(), null);
});

