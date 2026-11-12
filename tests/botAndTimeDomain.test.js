import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findBotProfile,
  listBotProfiles,
  resolveBotSelection,
} from '../src/domain/botProfiles.js';
import {
  findTimeControl,
  listTimeControls,
} from '../src/domain/timeControls.js';

/**
 * Verifies listBotProfiles exposes the expected Chess.com-style bot roster with ratings and AI difficulties.
 * Expected: returns martin (250, easy), elani (800, medium), and antonio (1500, hard) with non-empty metadata.
 */
function testListAndFindBotProfiles() {
  const bots = listBotProfiles();
  assert.equal(bots.length, 3);
  assert.deepEqual(
    bots.map((bot) => bot.id),
    ['martin', 'elani', 'antonio']
  );

  const martin = findBotProfile('martin');
  assert.ok(martin);
  assert.equal(martin.name, 'Martin');
  assert.equal(martin.rating, 250);
  assert.equal(martin.difficulty, 'easy');
  assert.ok(martin.tagline.length > 0);
  assert.equal(findBotProfile('unknown-bot'), null);
}

/**
 * Verifies resolveBotSelection supports explicit botId, backward-compatible difficulty fallback, and rejects invalid inputs.
 * Expected: botId overrides or matches difficulty; omitted botId maps from difficulty; unknown values throw Error.
 */
function testResolveBotSelection() {
  const byBotId = resolveBotSelection({ botId: 'antonio' });
  assert.equal(byBotId.bot.id, 'antonio');
  assert.equal(byBotId.difficulty, 'hard');

  // Preserve backward compatibility for callers sending only legacy difficulty.
  const byDifficulty = resolveBotSelection({ difficulty: 'easy' });
  assert.equal(byDifficulty.bot.id, 'martin');
  assert.equal(byDifficulty.difficulty, 'easy');

  const defaultSelection = resolveBotSelection({});
  assert.equal(defaultSelection.bot.id, 'elani');
  assert.equal(defaultSelection.difficulty, 'medium');

  assert.throws(() => resolveBotSelection({ botId: 'stockfish' }), /bot/i);
  assert.throws(() => resolveBotSelection({ difficulty: 'impossible' }), /difficulty/i);
}

/**
 * Verifies listTimeControls and findTimeControl return Chess.com-style presets with accurate millisecond budgets.
 * Expected: untimed has null initialMs; 3+2 has 180000ms initial and 2000ms increment; unknown returns null.
 */
function testListAndFindTimeControls() {
  const controls = listTimeControls();
  assert.deepEqual(
    controls.map((tc) => tc.id),
    ['untimed', '1+0', '3+0', '3+2', '10+0']
  );

  const untimed = findTimeControl('untimed');
  assert.ok(untimed);
  assert.equal(untimed.initialMs, null);
  assert.equal(untimed.incrementMs, 0);

  const blitz = findTimeControl('3+2');
  assert.ok(blitz);
  assert.equal(blitz.category, 'blitz');
  assert.equal(blitz.initialMs, 180000);
  assert.equal(blitz.incrementMs, 2000);

  assert.equal(findTimeControl('99+99'), null);
}

test('listBotProfiles and findBotProfile expose expected bots', testListAndFindBotProfiles);
test('resolveBotSelection resolves botId, difficulty fallback, and errors', testResolveBotSelection);
test('listTimeControls and findTimeControl expose time presets', testListAndFindTimeControls);

