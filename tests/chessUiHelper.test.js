import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOptimisticMove,
  canInteractWithBoard,
  canSendMatchChat,
  computeCapturedMaterial,
  formatClockMs,
  resolveActiveAvatarBubbles,
  resolveAvatarChatBubble,
  resolveChatWsUrl,
  resolveFullscreenButtonMetadata,
  resolveFullscreenDimensions,
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

/**
 * Builds an empty 8x8 board matrix with optional piece placements for helper tests.
 *
 * @param {Array<{ row: number, col: number, square: string, type: string, color: 'w' | 'b' }>} pieces - Pieces to place.
 * @returns {Array<Array<{ square: string, type: string, color: 'w' | 'b' } | null>>} 8x8 board grid.
 */
function buildTestBoard(pieces) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const piece of pieces) {
    board[piece.row][piece.col] = {
      square: piece.square,
      type: piece.type,
      color: piece.color,
    };
  }
  return board;
}

/**
 * Verifies applyOptimisticMove updates board, turn, clock, history, castling, en passant, and promotion immutably.
 * Expected: standard moves, O-O, en passant, and promotion update target squares cleanly without mutating the source snapshot.
 */
function testApplyOptimisticMove() {
  const baseGame = {
    id: 'g1',
    status: 'playing',
    turn: 'w',
    inCheck: true,
    legalMoves: [{ from: 'e2', to: 'e4', san: 'e4' }],
    history: [],
    clock: {
      isRunning: true,
      activeColor: 'w',
      remainingMs: { w: 60000, b: 60000 },
    },
    board: buildTestBoard([
      { row: 6, col: 4, square: 'e2', type: 'p', color: 'w' },
      { row: 7, col: 4, square: 'e1', type: 'k', color: 'w' },
      { row: 7, col: 7, square: 'h1', type: 'r', color: 'w' },
    ]),
  };

  const afterPush = applyOptimisticMove(baseGame, { from: 'e2', to: 'e4' });
  assert.equal(afterPush.isOptimistic, true);
  assert.equal(afterPush.turn, 'b');
  assert.equal(afterPush.inCheck, false);
  assert.deepEqual(afterPush.legalMoves, []);
  assert.deepEqual(afterPush.lastMove, { from: 'e2', to: 'e4' });
  assert.equal(afterPush.clock.activeColor, 'b');
  assert.equal(afterPush.board[6][4], null);
  assert.deepEqual(afterPush.board[4][4], { square: 'e4', type: 'p', color: 'w' });
  assert.equal(afterPush.history.length, 1);
  assert.equal(afterPush.history[0].san, 'e4');
  // Source board and legalMoves must remain untouched for error rollback.
  assert.equal(baseGame.turn, 'w');
  assert.equal(baseGame.board[6][4].type, 'p');
  assert.equal(baseGame.legalMoves.length, 1);

  // Kingside castling moves both King (e1->g1) and Rook (h1->f1).
  const afterCastle = applyOptimisticMove(baseGame, { from: 'e1', to: 'g1' });
  assert.equal(afterCastle.board[7][4], null);
  assert.equal(afterCastle.board[7][7], null);
  assert.deepEqual(afterCastle.board[7][6], { square: 'g1', type: 'k', color: 'w' });
  assert.deepEqual(afterCastle.board[7][5], { square: 'f1', type: 'r', color: 'w' });
  assert.equal(afterCastle.history[0].san, 'O-O');

  // Diagonal pawn move onto an empty square clears the en-passant victim on the origin rank.
  const enPassantGame = {
    status: 'playing',
    turn: 'w',
    legalMoves: [],
    history: [],
    board: buildTestBoard([
      { row: 3, col: 4, square: 'e5', type: 'p', color: 'w' },
      { row: 3, col: 3, square: 'd5', type: 'p', color: 'b' },
    ]),
  };
  const afterEnPassant = applyOptimisticMove(enPassantGame, { from: 'e5', to: 'd6' });
  assert.equal(afterEnPassant.board[3][4], null);
  assert.equal(afterEnPassant.board[3][3], null);
  assert.deepEqual(afterEnPassant.board[2][3], { square: 'd6', type: 'p', color: 'w' });
  assert.equal(afterEnPassant.history[0].captured, 'p');

  // Pawn promotion replaces the piece type on the destination square.
  const promoGame = {
    status: 'playing',
    turn: 'w',
    legalMoves: [],
    history: [],
    board: buildTestBoard([{ row: 1, col: 0, square: 'a7', type: 'p', color: 'w' }]),
  };
  const afterPromo = applyOptimisticMove(promoGame, { from: 'a7', to: 'a8', promotion: 'q' });
  assert.deepEqual(afterPromo.board[0][0], { square: 'a8', type: 'q', color: 'w' });
  assert.equal(afterPromo.history[0].promotion, 'q');

  // Unknown origin piece leaves snapshot untouched.
  assert.equal(applyOptimisticMove(baseGame, { from: 'a3', to: 'a4' }), baseGame);
}

test('formatClockMs formats standard and low-time clocks accurately', testFormatClockMs);
test('computeCapturedMaterial tracks sorted captures, promotions, and ply slicing', testComputeCapturedMaterial);
test('resolveSquareFromPoint maps board coordinates in both orientations', testResolveSquareFromPoint);
test('resolveViewerColor resolves bot, friend slot, and spectator color', testResolveViewerColor);
test('resolveInviteUrl constructs clean shareable invite links', testResolveInviteUrl);
test('canInteractWithBoard gates board input to active turn owner', testCanInteractWithBoard);
test('applyOptimisticMove updates board state immutably for regular and special moves', testApplyOptimisticMove);

/**
 * Verifies resolveChatWsUrl builds ws:// or wss:// URLs and canSendMatchChat gates chat input to seated friend players.
 * Expected: http -> ws, https -> wss, encoded gameId; only friend mode with non-null viewerColor returns true.
 */
function testChatUiHelpers() {
  assert.equal(
    resolveChatWsUrl({ protocol: 'http:', host: 'localhost:3000' }, 'room-1'),
    'ws://localhost:3000/api/games/room-1/chat-ws'
  );
  assert.equal(
    resolveChatWsUrl({ protocol: 'https:', host: 'chess.example.com' }, 'room 2'),
    'wss://chess.example.com/api/games/room%202/chat-ws'
  );

  assert.equal(canSendMatchChat({ mode: 'friend', status: 'playing' }, 'w'), true);
  assert.equal(canSendMatchChat({ mode: 'friend', status: 'waiting' }, 'b'), true);
  assert.equal(canSendMatchChat({ mode: 'friend', status: 'playing' }, null), false);
  assert.equal(canSendMatchChat({ mode: 'bot', status: 'playing' }, 'w'), false);
  assert.equal(canSendMatchChat(null, 'w'), false);
}

test('resolveChatWsUrl and canSendMatchChat handle protocols and spectator gating', testChatUiHelpers);

/**
 * Verifies resolveActiveAvatarBubbles and resolveAvatarChatBubble map live bubbles by slot across color swaps and expire cleanly.
 * Expected: active bubbles resolve to the seat holding matching slot; expired bubbles, missing seats, and bot mode return null.
 */
function testAvatarChatBubbleHelpers() {
  const bubbles = {
    p1: { text: 'Good luck!', expiresAt: 5500 },
    p2: { text: 'Thanks!', expiresAt: 4000 },
  };

  // At t=4500, p2 has expired while p1 remains active.
  const activeAt4500 = resolveActiveAvatarBubbles(bubbles, 4500);
  assert.deepEqual(Object.keys(activeAt4500), ['p1']);
  assert.equal(activeAt4500.p1.text, 'Good luck!');

  const round2FriendGame = {
    mode: 'friend',
    players: {
      w: { name: 'Bob', joined: true, slot: 'p2' },
      b: { name: 'Alice', joined: true, slot: 'p1' },
    },
  };

  assert.deepEqual(resolveAvatarChatBubble(round2FriendGame, 'b', bubbles, 4500), {
    text: 'Good luck!',
  });
  assert.equal(resolveAvatarChatBubble(round2FriendGame, 'w', bubbles, 4500), null);
  assert.equal(resolveAvatarChatBubble(round2FriendGame, 'b', bubbles, 5500), null);
  assert.equal(resolveAvatarChatBubble({ mode: 'bot' }, 'w', bubbles, 3000), null);
  assert.equal(resolveAvatarChatBubble(null, 'w', bubbles, 3000), null);
}

test('resolveActiveAvatarBubbles and resolveAvatarChatBubble track slot bubbles and expiry', testAvatarChatBubbleHelpers);

/**
 * Verifies resolveFullscreenButtonMetadata formats button labels and accessible state,
 * and resolveFullscreenDimensions computes bounded square board dimensions across viewports.
 * Expected: correct metadata for enter/exit states, responsive board sizes fitting portrait and landscape bounds.
 */
function testFullscreenHelpers() {
  const enterMeta = resolveFullscreenButtonMetadata(false);
  assert.equal(enterMeta.label, 'Full Screen');
  assert.equal(enterMeta.title, 'Enter Full Screen (F)');
  assert.equal(enterMeta.glyph, '⛶');
  assert.equal(enterMeta.ariaPressed, false);

  const exitMeta = resolveFullscreenButtonMetadata(true);
  assert.equal(exitMeta.label, 'Exit Full Screen');
  assert.equal(exitMeta.title, 'Exit Full Screen (Esc)');
  assert.equal(exitMeta.glyph, '✕');
  assert.equal(exitMeta.ariaPressed, true);

  // Desktop standard (1200 x 800, no eval bar)
  const desktopDim = resolveFullscreenDimensions({
    viewportWidth: 1200,
    viewportHeight: 800,
    isMobile: false,
    isLandscape: false,
    hasEvalBar: false,
  });
  assert.equal(typeof desktopDim.boardSizePx, 'number');
  assert.ok(desktopDim.boardSizePx > 0 && desktopDim.boardSizePx <= 690);
  assert.equal(desktopDim.isCompactLayout, false);

  // Mobile portrait (390 x 844)
  const mobilePortraitDim = resolveFullscreenDimensions({
    viewportWidth: 390,
    viewportHeight: 844,
    isMobile: true,
    isLandscape: false,
    hasEvalBar: false,
  });
  assert.ok(mobilePortraitDim.boardSizePx > 0 && mobilePortraitDim.boardSizePx <= 374);
  assert.equal(mobilePortraitDim.isCompactLayout, false);

  // Mobile landscape (844 x 390)
  const mobileLandscapeDim = resolveFullscreenDimensions({
    viewportWidth: 844,
    viewportHeight: 390,
    isMobile: true,
    isLandscape: true,
    hasEvalBar: false,
  });
  assert.ok(mobileLandscapeDim.boardSizePx > 0 && mobileLandscapeDim.boardSizePx <= 340);
  assert.equal(mobileLandscapeDim.isCompactLayout, true);

  // Fallbacks on invalid or zero values
  const fallbackDim = resolveFullscreenDimensions(null);
  assert.ok(fallbackDim.boardSizePx >= 280);
}

test('resolveFullscreenButtonMetadata and resolveFullscreenDimensions compute fullscreen state and geometry', testFullscreenHelpers);


