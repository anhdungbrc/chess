import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canInteractWithBoard,
  computeCapturedMaterial,
  formatClockMs,
  resolveInviteUrl,
  resolveSquareFromPoint,
  resolveViewerColor,
} from '../public/chessUiHelper.js';

/**
 * Verifies formatClockMs renders mm:ss above 20 seconds, tenths under 20 seconds, and clamps zero/negative values.
 * Expected: 600000 -> '10:00', 20000 -> '0:20', 19450 -> '0:19.4', and <= 0 -> '0:00.0'.
 */
function testFormatClockMs() {
  assert.equal(formatClockMs(600000), '10:00');
  assert.equal(formatClockMs(185000), '3:05');
  assert.equal(formatClockMs(20000), '0:20');
  assert.equal(formatClockMs(19450), '0:19.4');
  assert.equal(formatClockMs(500), '0:00.5');
  assert.equal(formatClockMs(0), '0:00.0');
  assert.equal(formatClockMs(-250), '0:00.0');
}

/**
 * Verifies computeCapturedMaterial groups captured pieces by value order, accounts for promotions, and slices to plyCount.
 * Expected: captures are sorted q/r/b/n/p, promotion adjusts material advantage, and plyCount limits historical view.
 */
function testComputeCapturedMaterial() {
  const history = [
    { color: 'w', from: 'e2', to: 'e4', san: 'e4' },
    { color: 'b', from: 'd7', to: 'd5', san: 'd5' },
    { color: 'w', from: 'e4', to: 'd5', san: 'exd5', captured: 'p' },
    { color: 'b', from: 'd8', to: 'd5', san: 'Qxd5', captured: 'p' },
    { color: 'w', from: 'b1', to: 'c3', san: 'Nc3' },
    { color: 'b', from: 'd5', to: 'a5', san: 'Qa5' },
    { color: 'w', from: 'd2', to: 'd4', san: 'd4' },
    { color: 'b', from: 'c7', to: 'c6', san: 'c6' },
    { color: 'w', from: 'c1', to: 'd2', san: 'Bd2' },
    { color: 'b', from: 'g8', to: 'f6', san: 'Nf6' },
    { color: 'w', from: 'c3', to: 'b5', san: 'Nb5' },
    { color: 'b', from: 'c6', to: 'b5', san: 'cxb5', captured: 'n' },
    { color: 'w', from: 'd2', to: 'a5', san: 'Bxa5', captured: 'q' },
  ];

  // At ply 3 only White has captured a pawn (+1).
  const atPly3 = computeCapturedMaterial(history, 3);
  assert.deepEqual(atPly3.capturedByWhite, ['p']);
  assert.deepEqual(atPly3.capturedByBlack, []);
  assert.equal(atPly3.advantageSide, 'w');
  assert.equal(atPly3.advantagePoints, 1);

  // At full history White took Q+P (10) and Black took N+P (4) => White +6 with sorted pieces.
  const full = computeCapturedMaterial(history, history.length);
  assert.deepEqual(full.capturedByWhite, ['q', 'p']);
  assert.deepEqual(full.capturedByBlack, ['n', 'p']);
  assert.equal(full.advantageSide, 'w');
  assert.equal(full.advantagePoints, 6);

  // Pawn promotion to Queen without capture adds +8 material net.
  const promoHistory = [{ color: 'b', from: 'a2', to: 'a1', san: 'a1=Q', promotion: 'q' }];
  const promoState = computeCapturedMaterial(promoHistory, 1);
  assert.equal(promoState.advantageSide, 'b');
  assert.equal(promoState.advantagePoints, 8);
}

/**
 * Verifies resolveSquareFromPoint maps pointer coordinates to algebraic squares for both board orientations.
 * Expected: top-left maps to a8 (White) or h1 (Black flipped); out-of-bounds points return null.
 */
function testResolveSquareFromPoint() {
  const rect = { left: 100, top: 200, width: 400, height: 400 };
  assert.equal(resolveSquareFromPoint(110, 210, rect, false), 'a8');
  assert.equal(resolveSquareFromPoint(490, 590, rect, false), 'h1');
  assert.equal(resolveSquareFromPoint(325, 425, rect, false), 'e4');

  assert.equal(resolveSquareFromPoint(110, 210, rect, true), 'h1');
  assert.equal(resolveSquareFromPoint(490, 590, rect, true), 'a8');
  assert.equal(resolveSquareFromPoint(99, 210, rect, false), null);
  assert.equal(resolveSquareFromPoint(501, 210, rect, false), null);
}

/**
 * Verifies resolveViewerColor resolves bot playerColor, friend slot color (including post-rematch swaps), and spectator null.
 * Expected: bot returns playerColor; friend resolves from players[color].slot; spectator returns null.
 */
function testResolveViewerColor() {
  assert.equal(resolveViewerColor({ mode: 'bot', playerColor: 'b' }, null), 'b');
  const friendRound2 = {
    mode: 'friend',
    players: {
      w: { name: 'Bob', joined: true, slot: 'p2' },
      b: { name: 'Alice', joined: true, slot: 'p1' },
    },
  };
  assert.equal(resolveViewerColor(friendRound2, 'p1'), 'b');
  assert.equal(resolveViewerColor(friendRound2, 'p2'), 'w');
  assert.equal(resolveViewerColor(friendRound2, null), null);
  assert.equal(resolveViewerColor(null, 'p1'), null);
}

/**
 * Verifies resolveInviteUrl constructs a clean shareable query URL for a friend room.
 * Expected: normalizes trailing slashes on origin and encodes the gameId parameter.
 */
function testResolveInviteUrl() {
  assert.equal(
    resolveInviteUrl('http://localhost:3000/', 'abc-123'),
    'http://localhost:3000/?game=abc-123'
  );
  assert.equal(
    resolveInviteUrl('https://chess.example.com', 'room 1'),
    'https://chess.example.com/?game=room%201'
  );
}

/**
 * Verifies canInteractWithBoard permits moves only on live active turns matching viewerColor.
 * Expected: returns true on own live turn; false when waiting, reviewing, spectating, finished, or opponent turn.
 */
function testCanInteractWithBoard() {
  const playingWhite = { status: 'playing', turn: 'w' };
  assert.equal(canInteractWithBoard(playingWhite, 'w', false), true);
  assert.equal(canInteractWithBoard(playingWhite, 'b', false), false);
  assert.equal(canInteractWithBoard(playingWhite, null, false), false);
  assert.equal(canInteractWithBoard(playingWhite, 'w', true), false);
  assert.equal(canInteractWithBoard({ status: 'waiting', turn: 'w' }, 'w', false), false);
  assert.equal(canInteractWithBoard({ status: 'resigned', turn: 'w' }, 'w', false), false);
}

test('formatClockMs formats standard and low-time clocks accurately', testFormatClockMs);
test('computeCapturedMaterial tracks sorted captures, promotions, and ply slicing', testComputeCapturedMaterial);
test('resolveSquareFromPoint maps board coordinates in both orientations', testResolveSquareFromPoint);
test('resolveViewerColor resolves bot, friend slot, and spectator color', testResolveViewerColor);
test('resolveInviteUrl constructs clean shareable invite links', testResolveInviteUrl);
test('canInteractWithBoard gates board input to active turn owner', testCanInteractWithBoard);

