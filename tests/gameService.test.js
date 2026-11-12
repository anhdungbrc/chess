import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameService,
  GameNotFoundError,
  InvalidMoveError,
  GameOverError,
  InvalidGameStateError,
  UnauthorizedActionError,
} from '../src/service/gameService.js';

/**
 * Creates a deterministic stub AI move selector from a fixed list of moves.
 *
 * @param {Array<{ from: string, to: string, promotion?: string }>} plannedMoves - Sequence of moves to return.
 * @returns {(fen: string, difficulty: string) => { from: string, to: string, promotion?: string } | null} Stub selector.
 */
function createStubChooseMove(plannedMoves) {
  let index = 0;
  return () => {
    const move = plannedMoves[index] ?? null;
    index += 1;
    return move;
  };
}

/**
 * Verifies that creating a game as White starts at move 0 with White to move.
 * Expected: playerColor is 'w', turn is 'w', history is empty, and 20 legal moves exist.
 */
function testCreateGameAsWhite() {
  const service = createGameService({ chooseMove: createStubChooseMove([]) });
  const game = service.createGame({ playerColor: 'w', difficulty: 'medium' });

  assert.ok(game.id);
  assert.equal(game.playerColor, 'w');
  assert.equal(game.aiColor, 'b');
  assert.equal(game.difficulty, 'medium');
  assert.equal(game.turn, 'w');
  assert.equal(game.status, 'playing');
  assert.equal(game.winner, null);
  assert.equal(game.history.length, 0);
  assert.equal(game.board.length, 8);
  assert.equal(game.legalMoves.length, 20);
}

/**
 * Verifies that creating a game as Black causes the AI to immediately play White's first move.
 * Expected: turn becomes 'b', history contains the AI move, and lastMove matches it.
 */
function testCreateGameAsBlackTriggersAiOpening() {
  const service = createGameService({
    chooseMove: createStubChooseMove([{ from: 'e2', to: 'e4' }]),
  });
  const game = service.createGame({ playerColor: 'b', difficulty: 'easy' });

  assert.equal(game.playerColor, 'b');
  assert.equal(game.aiColor, 'w');
  assert.equal(game.turn, 'b');
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].san, 'e4');
  assert.equal(game.lastMove.from, 'e2');
  assert.equal(game.lastMove.to, 'e4');
}

/**
 * Verifies findGame returns null and getGame throws GameNotFoundError for unknown IDs.
 * Expected: findGame('missing') === null; getGame('missing') throws GameNotFoundError.
 */
function testMissingGameLookup() {
  const service = createGameService({ chooseMove: createStubChooseMove([]) });
  assert.equal(service.findGame('non-existent-id'), null);
  assert.throws(() => service.getGame('non-existent-id'), GameNotFoundError);
}

/**
 * Verifies applyPlayerMove executes the player move and immediately triggers an AI reply.
 * Expected: returns playerMove, aiMove, and updated snapshot with 2 moves in history.
 */
function testApplyPlayerMoveTriggersAiReply() {
  const service = createGameService({
    chooseMove: createStubChooseMove([{ from: 'e7', to: 'e5' }]),
  });
  const created = service.createGame({ playerColor: 'w', difficulty: 'medium' });

  const result = service.applyPlayerMove(created.id, { from: 'e2', to: 'e4' });
  assert.equal(result.playerMove.san, 'e4');
  assert.equal(result.aiMove.san, 'e5');
  assert.equal(result.game.turn, 'w');
  assert.equal(result.game.history.length, 2);
}

/**
 * Verifies applyPlayerMove rejects illegal moves and missing game IDs.
 * Expected: throws InvalidMoveError on illegal move and GameNotFoundError on unknown ID.
 */
function testApplyPlayerMoveRejectsIllegalAndMissing() {
  const service = createGameService({ chooseMove: createStubChooseMove([]) });
  const created = service.createGame({ playerColor: 'w', difficulty: 'easy' });

  assert.throws(
    () => service.applyPlayerMove(created.id, { from: 'e2', to: 'e5' }),
    InvalidMoveError
  );
  assert.throws(
    () => service.applyPlayerMove('missing', { from: 'e2', to: 'e4' }),
    GameNotFoundError
  );
}

/**
 * Verifies checkmate by the player ends the game without calling AI and blocks further moves.
 * Expected: status is 'checkmate', winner is 'b', aiMove is null, and next move throws GameOverError.
 */
function testCheckmateByPlayerStopsAiAndBlocksFurtherMoves() {
  let aiCallCount = 0;
  const planned = [
    { from: 'f2', to: 'f3' },
    { from: 'g2', to: 'g4' },
  ];
  const service = createGameService({
    chooseMove: () => {
      const move = planned[aiCallCount] ?? null;
      aiCallCount += 1;
      return move;
    },
  });

  const game = service.createGame({ playerColor: 'b', difficulty: 'medium' });
  service.applyPlayerMove(game.id, { from: 'e7', to: 'e5' });
  const finalResult = service.applyPlayerMove(game.id, { from: 'd8', to: 'h4' });

  assert.equal(finalResult.aiMove, null);
  assert.equal(finalResult.game.status, 'checkmate');
  assert.equal(finalResult.game.winner, 'b');
  assert.equal(aiCallCount, 2);
  assert.throws(
    () => service.applyPlayerMove(game.id, { from: 'a7', to: 'a6' }),
    GameOverError
  );
}

/**
 * Verifies pawn promotion move executes with the requested promotion piece.
 * Expected: playerMove reflects promotion 'q' and board cell b8 holds a White queen.
 */
function testPlayerPawnPromotion() {
  const service = createGameService({
    chooseMove: createStubChooseMove([
      { from: 'b7', to: 'b5' },
      { from: 'a7', to: 'a6' },
      { from: 'b8', to: 'c6' },
      { from: 'c6', to: 'b8' },
      { from: 'c7', to: 'c6' },
    ]),
  });

  const game = service.createGame({ playerColor: 'w', difficulty: 'easy' });
  service.applyPlayerMove(game.id, { from: 'a2', to: 'a4' });
  service.applyPlayerMove(game.id, { from: 'a4', to: 'b5' });
  service.applyPlayerMove(game.id, { from: 'b5', to: 'a6' });
  service.applyPlayerMove(game.id, { from: 'a6', to: 'a7' });
  const promoResult = service.applyPlayerMove(game.id, {
    from: 'a7',
    to: 'b8',
    promotion: 'q',
  });

  assert.equal(promoResult.playerMove.promotion, 'q');
  assert.equal(promoResult.game.board[0][1].type, 'q');
  assert.equal(promoResult.game.board[0][1].color, 'w');
}

/**
 * Verifies undoLastTurn reverts both the AI reply and player move during normal White play.
 * Expected: history returns to 0 and turn returns to 'w'.
 */
function testUndoRevertsFullTurnForWhite() {
  const service = createGameService({
    chooseMove: createStubChooseMove([{ from: 'e7', to: 'e5' }]),
  });
  const game = service.createGame({ playerColor: 'w', difficulty: 'medium' });
  service.applyPlayerMove(game.id, { from: 'e2', to: 'e4' });

  const undone = service.undoLastTurn(game.id);
  assert.equal(undone.history.length, 0);
  assert.equal(undone.turn, 'w');
}

/**
 * Verifies undoLastTurn reverts only 1 ply when the player ended the game before AI moved.
 * Expected: game resumes as 'playing' with Black to move and 3 plies remaining.
 */
function testUndoAfterPlayerCheckmateRevertsOnePly() {
  const service = createGameService({
    chooseMove: createStubChooseMove([
      { from: 'f2', to: 'f3' },
      { from: 'g2', to: 'g4' },
    ]),
  });
  const game = service.createGame({ playerColor: 'b', difficulty: 'medium' });
  service.applyPlayerMove(game.id, { from: 'e7', to: 'e5' });
  service.applyPlayerMove(game.id, { from: 'd8', to: 'h4' });

  const undone = service.undoLastTurn(game.id);
  assert.equal(undone.status, 'playing');
  assert.equal(undone.winner, null);
  assert.equal(undone.turn, 'b');
  assert.equal(undone.history.length, 3);
}

/**
 * Verifies undoLastTurn keeps AI's opening move when the player as Black has not moved yet.
 * Expected: history remains 1 and turn stays 'b'; unknown game throws GameNotFoundError.
 */
function testUndoPreservesAiOpeningMoveForBlack() {
  const service = createGameService({
    chooseMove: createStubChooseMove([{ from: 'e2', to: 'e4' }]),
  });
  const game = service.createGame({ playerColor: 'b', difficulty: 'easy' });

  const unchanged = service.undoLastTurn(game.id);
  assert.equal(unchanged.history.length, 1);
  assert.equal(unchanged.turn, 'b');
  assert.throws(() => service.undoLastTurn('missing'), GameNotFoundError);
}

/**
 * Verifies snapshots include initialFen and per-move post-FEN and check state across moves, checks, and undo.
 * Expected: initialFen matches starting position; history entries store exact post-move FEN and inCheck flags.
 */
function testSnapshotHistoryIncludesFenAndInCheck() {
  const service = createGameService({
    chooseMove: createStubChooseMove([
      { from: 'e7', to: 'e5' },
      { from: 'g7', to: 'g6' },
      { from: 'f8', to: 'e7' },
    ]),
  });
  const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const created = service.createGame({ playerColor: 'w', difficulty: 'medium' });
  assert.equal(created.initialFen, startingFen);

  service.applyPlayerMove(created.id, { from: 'e2', to: 'e4' });
  service.applyPlayerMove(created.id, { from: 'd1', to: 'h5' });
  const checkTurn = service.applyPlayerMove(created.id, { from: 'h5', to: 'e5' });

  assert.equal(checkTurn.game.initialFen, startingFen);
  assert.equal(checkTurn.game.history.length, 6);
  assert.equal(
    checkTurn.game.history[0].fen,
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  );
  assert.equal(checkTurn.game.history[0].inCheck, false);
  assert.equal(
    checkTurn.game.history[1].fen,
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  );
  assert.equal(
    checkTurn.game.history[4].fen,
    'rnbqkbnr/pppp1p1p/6p1/4Q3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 3'
  );
  assert.equal(checkTurn.game.history[4].inCheck, true);
  assert.equal(checkTurn.game.history[5].inCheck, false);

  const afterUndo = service.undoLastTurn(created.id);
  assert.equal(afterUndo.initialFen, startingFen);
  assert.equal(afterUndo.history.length, 4);
}

/**
 * Verifies checkmate moves in history carry inCheck=true and snapshots for Black games keep initialFen before AI move 1.
 * Expected: Black game initialFen is standard starting FEN and Qh4# has inCheck=true.
 */
function testHistoryCheckmateAndBlackInitialFen() {
  const service = createGameService({
    chooseMove: createStubChooseMove([
      { from: 'f2', to: 'f3' },
      { from: 'g2', to: 'g4' },
    ]),
  });
  const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const created = service.createGame({ playerColor: 'b', difficulty: 'medium' });
  assert.equal(created.initialFen, startingFen);

  service.applyPlayerMove(created.id, { from: 'e7', to: 'e5' });
  const mateResult = service.applyPlayerMove(created.id, { from: 'd8', to: 'h4' });
  assert.equal(mateResult.game.initialFen, startingFen);
  assert.equal(mateResult.game.history[3].san, 'Qh4#');
  assert.equal(mateResult.game.history[3].inCheck, true);
  assert.equal(
    mateResult.game.history[3].fen,
    'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
  );
}

/**
 * Verifies createGame resolves bot metadata, tracks captured pieces in history, and keeps untimed clock null.
 * Expected: snapshot exposes chosen bot profile, null clock for untimed games, and captured piece codes in history.
 */
function testBotMetadataAndCapturedHistory() {
  const service = createGameService({
    chooseMove: createStubChooseMove([
      { from: 'd7', to: 'd5' },
      { from: 'd8', to: 'd5' },
    ]),
  });

  const game = service.createGame({
    playerColor: 'w',
    botId: 'antonio',
    timeControl: 'untimed',
  });
  assert.equal(game.bot.id, 'antonio');
  assert.equal(game.bot.name, 'Antonio');
  assert.equal(game.bot.rating, 1500);
  assert.equal(game.difficulty, 'hard');
  assert.equal(game.clock, null);

  service.applyPlayerMove(game.id, { from: 'e2', to: 'e4' });
  const captureTurn = service.applyPlayerMove(game.id, { from: 'e4', to: 'd5' });
  assert.equal(captureTurn.game.history[2].captured, 'p');
  assert.equal(captureTurn.game.history[3].captured, 'p');
  assert.equal(captureTurn.game.history[0].captured, undefined);
}

/**
 * Verifies timed games deduct elapsed time, apply Fischer increments, and detect timeout deterministically.
 * Expected: clock pauses before move 1, deducts elapsed turn time plus increment, and flags timeout at 0ms.
 */
function testTimedClockDeductionIncrementAndTimeout() {
  let currentTime = 1000;
  const service = createGameService({
    now: () => currentTime,
    chooseMove: () => {
      // Simulate 500ms of AI thinking per move.
      currentTime += 500;
      return { from: 'e7', to: 'e5' };
    },
  });

  const created = service.createGame({
    playerColor: 'w',
    botId: 'elani',
    timeControl: '3+2',
  });
  assert.equal(created.clock.timeControl, '3+2');
  assert.equal(created.clock.remainingMs.w, 180000);
  assert.equal(created.clock.remainingMs.b, 180000);
  assert.equal(created.clock.isRunning, false);

  // Elapsed wait before move 1 does not drain White because the clock starts after move 1.
  currentTime += 10000;
  const turn1 = service.applyPlayerMove(created.id, { from: 'e2', to: 'e4' });
  assert.equal(turn1.game.clock.remainingMs.w, 182000);
  assert.equal(turn1.game.clock.remainingMs.b, 181500);
  assert.equal(turn1.game.clock.isRunning, true);
  assert.equal(turn1.game.clock.activeColor, 'w');

  // Advance clock past White's remaining budget and sync clock.
  currentTime += 182000;
  const flagged = service.syncClock(created.id);
  assert.equal(flagged.status, 'timeout');
  assert.equal(flagged.winner, 'b');
  assert.equal(flagged.clock.remainingMs.w, 0);
  assert.equal(flagged.clock.isRunning, false);
  assert.equal(flagged.legalMoves.length, 0);
  assert.throws(
    () => service.applyPlayerMove(created.id, { from: 'd2', to: 'd4' }),
    GameOverError
  );
}

/**
 * Verifies resignGame ends an active game in favor of the AI and rejects resigning an already finished game.
 * Expected: status becomes 'resigned', winner is aiColor, clock stops, and further moves or resignations throw GameOverError.
 */
function testResignGameEndsPlayAndBlocksFurtherActions() {
  let currentTime = 5000;
  const service = createGameService({
    now: () => currentTime,
    chooseMove: createStubChooseMove([{ from: 'e7', to: 'e5' }]),
  });

  const game = service.createGame({
    playerColor: 'w',
    botId: 'martin',
    timeControl: '1+0',
  });
  service.applyPlayerMove(game.id, { from: 'e2', to: 'e4' });
  currentTime += 2500;

  const resigned = service.resignGame(game.id);
  assert.equal(resigned.status, 'resigned');
  assert.equal(resigned.winner, 'b');
  assert.equal(resigned.clock.isRunning, false);
  assert.equal(resigned.legalMoves.length, 0);
  assert.throws(() => service.resignGame(game.id), GameOverError);
  assert.throws(
    () => service.applyPlayerMove(game.id, { from: 'd2', to: 'd4' }),
    GameOverError
  );
  assert.throws(() => service.resignGame('missing'), GameNotFoundError);
}

/**
 * Verifies undoLastTurn restores the pre-turn clock balance and clears resigned state.
 * Expected: reverting a turn in a timed game restores initial clock values and returns status to 'playing'.
 */
function testUndoRestoresClockAndClearsResign() {
  let currentTime = 1000;
  const service = createGameService({
    now: () => currentTime,
    chooseMove: () => {
      currentTime += 400;
      return { from: 'e7', to: 'e5' };
    },
  });

  const game = service.createGame({
    playerColor: 'w',
    botId: 'martin',
    timeControl: '1+0',
  });
  service.applyPlayerMove(game.id, { from: 'e2', to: 'e4' });
  currentTime += 3000;
  service.resignGame(game.id);

  const undone = service.undoLastTurn(game.id);
  assert.equal(undone.status, 'playing');
  assert.equal(undone.winner, null);
  assert.equal(undone.history.length, 0);
  assert.equal(undone.clock.remainingMs.w, 60000);
  assert.equal(undone.clock.remainingMs.b, 60000);
  assert.equal(undone.clock.isRunning, false);
}

/**
 * Verifies friend-game creation, random host color resolution, joining, duplicate/full-room guards, and spectator view without leaking seat tokens.
 * Expected: friend game starts in 'waiting', join transitions to 'playing' with p2 seatToken, and public/spectator snapshots never include seatToken.
 */
function testCreateAndJoinFriendGame() {
  const service = createGameService({
    chooseMove: createStubChooseMove([]),
    randomInt: () => 1,
  });

  const hostGame = service.createGame({
    mode: 'friend',
    playerColor: 'random',
    playerName: 'Alice',
    timeControl: '3+2',
  });

  assert.equal(hostGame.mode, 'friend');
  assert.equal(hostGame.status, 'waiting');
  assert.equal(hostGame.viewerRole, 'player');
  assert.equal(hostGame.viewerColor, 'b');
  assert.equal(hostGame.viewerSlot, 'p1');
  assert.ok(hostGame.seatToken);
  assert.equal(hostGame.players.b.name, 'Alice');
  assert.equal(hostGame.players.b.joined, true);
  assert.equal(hostGame.players.w.joined, false);
  assert.equal(hostGame.legalMoves.length, 0);
  assert.equal(hostGame.clock.isRunning, false);

  // Public lookup without token must never expose seatToken and reports spectator role.
  const publicView = service.getGame(hostGame.id);
  assert.equal(publicView.seatToken, undefined);
  assert.equal(publicView.viewerRole, 'spectator');
  assert.equal(publicView.viewerColor, null);

  // Host cannot claim the second seat using their existing seatToken.
  assert.throws(
    () => service.joinGame(hostGame.id, { playerName: 'Alice2', playerToken: hostGame.seatToken }),
    InvalidGameStateError
  );

  const guestGame = service.joinGame(hostGame.id, { playerName: 'Bob' });
  assert.equal(guestGame.status, 'playing');
  assert.equal(guestGame.viewerRole, 'player');
  assert.equal(guestGame.viewerColor, 'w');
  assert.equal(guestGame.viewerSlot, 'p2');
  assert.ok(guestGame.seatToken);
  assert.notEqual(guestGame.seatToken, hostGame.seatToken);
  assert.equal(guestGame.players.w.name, 'Bob');
  assert.equal(guestGame.players.b.name, 'Alice');
  assert.equal(guestGame.legalMoves.length, 20);

  // Authenticated getGame resolves the caller's seat and omits secret tokens.
  const hostRefresh = service.getGame(hostGame.id, hostGame.seatToken);
  assert.equal(hostRefresh.seatToken, undefined);
  assert.equal(hostRefresh.viewerRole, 'player');
  assert.equal(hostRefresh.viewerColor, 'b');
  assert.equal(hostRefresh.viewerSlot, 'p1');

  // Joining a full room or a bot game throws InvalidGameStateError; missing ID throws GameNotFoundError.
  assert.throws(() => service.joinGame(hostGame.id, { playerName: 'Charlie' }), InvalidGameStateError);
  assert.throws(() => service.joinGame('missing-id', { playerName: 'Charlie' }), GameNotFoundError);
  const botGame = service.createGame({ playerColor: 'w', difficulty: 'easy' });
  assert.throws(() => service.joinGame(botGame.id, { playerName: 'Charlie' }), InvalidGameStateError);
  assert.ok(UnauthorizedActionError);
}

test('createGame as White initializes starting board', testCreateGameAsWhite);
test('createGame as Black triggers immediate AI opening move', testCreateGameAsBlackTriggersAiOpening);
test('findGame and getGame handle unknown IDs cleanly', testMissingGameLookup);
test('applyPlayerMove triggers AI reply', testApplyPlayerMoveTriggersAiReply);
test('applyPlayerMove rejects illegal move and unknown game', testApplyPlayerMoveRejectsIllegalAndMissing);
test('checkmate by player skips AI and blocks further moves', testCheckmateByPlayerStopsAiAndBlocksFurtherMoves);
test('applyPlayerMove supports pawn promotion', testPlayerPawnPromotion);
test('undoLastTurn reverts player and AI move pair', testUndoRevertsFullTurnForWhite);
test('undoLastTurn reverts single ply after player checkmate', testUndoAfterPlayerCheckmateRevertsOnePly);
test('undoLastTurn preserves AI opening move when player is Black', testUndoPreservesAiOpeningMoveForBlack);
test('snapshot history includes initialFen, post-move FEN, and inCheck state', testSnapshotHistoryIncludesFenAndInCheck);
test('history preserves initialFen for Black and sets inCheck=true on checkmate', testHistoryCheckmateAndBlackInitialFen);
test('createGame resolves bot metadata and history records captured pieces', testBotMetadataAndCapturedHistory);
test('timed clock deducts elapsed time, applies increments, and flags timeout', testTimedClockDeductionIncrementAndTimeout);
test('resignGame ends active game and blocks further moves', testResignGameEndsPlayAndBlocksFurtherActions);
test('undoLastTurn restores timed clock and clears resignation', testUndoRestoresClockAndClearsResign);
/**
 * Verifies friend-game moves, turn-based clock deduction/increment, seat-token authorization, resignation, and unilateral undo rejection.
 * Expected: waiting rooms block moves; missing/wrong tokens throw UnauthorizedActionError; timed turns deduct accurately; resign awards opponent; undo throws InvalidGameStateError.
 */
function testFriendMovesClocksAndResign() {
  let currentTime = 10000;
  const service = createGameService({
    chooseMove: createStubChooseMove([]),
    now: () => currentTime,
  });

  const host = service.createGame({
    mode: 'friend',
    playerColor: 'w',
    timeControl: '3+2',
  });

  // Moving or resigning before friend joins must fail with InvalidGameStateError.
  assert.throws(
    () => service.applyPlayerMove(host.id, { from: 'e2', to: 'e4' }, host.seatToken),
    InvalidGameStateError
  );
  assert.throws(() => service.resignGame(host.id, host.seatToken), InvalidGameStateError);

  const guest = service.joinGame(host.id, { playerName: 'Guest' });

  // Missing or invalid token cannot move or resign.
  assert.throws(
    () => service.applyPlayerMove(host.id, { from: 'e2', to: 'e4' }),
    UnauthorizedActionError
  );
  assert.throws(
    () => service.applyPlayerMove(host.id, { from: 'e2', to: 'e4' }, 'bad-token'),
    UnauthorizedActionError
  );
  assert.throws(() => service.resignGame(host.id, 'bad-token'), UnauthorizedActionError);

  // Guest (Black) cannot move on White's turn.
  assert.throws(
    () => service.applyPlayerMove(host.id, { from: 'e7', to: 'e5' }, guest.seatToken),
    InvalidMoveError
  );

  // White plays move 1 after 10s idle (move 1 stays free of deduction, then Black clock starts).
  currentTime += 10000;
  const w1 = service.applyPlayerMove(host.id, { from: 'e2', to: 'e4' }, host.seatToken);
  assert.equal(w1.aiMove, null);
  assert.equal(w1.playerMove.san, 'e4');
  assert.equal(w1.game.turn, 'b');
  assert.equal(w1.game.clock.remainingMs.w, 182000);
  assert.equal(w1.game.clock.remainingMs.b, 180000);
  assert.equal(w1.game.clock.activeColor, 'b');

  // Black thinks 4000ms then plays e5, receiving +2000ms increment.
  currentTime += 4000;
  const b1 = service.applyPlayerMove(host.id, { from: 'e7', to: 'e5' }, guest.seatToken);
  assert.equal(b1.playerMove.san, 'e5');
  assert.equal(b1.game.turn, 'w');
  assert.equal(b1.game.clock.remainingMs.b, 178000);
  assert.equal(b1.game.clock.activeColor, 'w');

  // Unilateral undo is disabled in friend mode.
  assert.throws(() => service.undoLastTurn(host.id), InvalidGameStateError);

  // Guest (Black) resigns, awarding White the victory and halting the clock.
  const resigned = service.resignGame(host.id, guest.seatToken);
  assert.equal(resigned.status, 'resigned');
  assert.equal(resigned.winner, 'w');
  assert.equal(resigned.clock.isRunning, false);
  assert.throws(
    () => service.applyPlayerMove(host.id, { from: 'g1', to: 'f3' }, host.seatToken),
    GameOverError
  );
}

test('friend game supports waiting room, random color, join, and spectator isolation', testCreateAndJoinFriendGame);
/**
 * Verifies friend-mode draw offers, takeback requests (1-ply and 2-ply with clock restoration), and in-room color-swapping rematch.
 * Expected: offers require opponent response, moving cancels pending offers, takeback restores exact clock snapshots, and rematch swaps seats and increments round.
 */
function testFriendDrawTakebackAndRematch() {
  let currentTime = 10000;
  const service = createGameService({
    chooseMove: createStubChooseMove([]),
    now: () => currentTime,
  });

  const host = service.createGame({
    mode: 'friend',
    playerColor: 'w',
    timeControl: '3+2',
    playerName: 'Alice',
  });
  const guest = service.joinGame(host.id, { playerName: 'Bob' });

  // Cannot request takeback before moving, nor rematch while playing.
  assert.throws(
    () => service.handleTakebackAction(host.id, host.seatToken, 'request'),
    InvalidGameStateError
  );
  assert.throws(
    () => service.handleRematchAction(host.id, host.seatToken, 'request'),
    InvalidGameStateError
  );

  // White plays 1. e4, then offers draw; Black declines, plays 1...e5, and requests takeback? Wait: first test move clearing draw offer.
  service.applyPlayerMove(host.id, { from: 'e2', to: 'e4' }, host.seatToken);
  const offered = service.handleDrawAction(host.id, host.seatToken, 'offer');
  assert.equal(offered.pendingDrawBy, 'w');
  // Playing a move clears any pending draw offer.
  currentTime += 5000;
  const afterBlackMove = service.applyPlayerMove(host.id, { from: 'e7', to: 'e5' }, guest.seatToken);
  assert.equal(afterBlackMove.game.pendingDrawBy, null);
  assert.equal(afterBlackMove.game.clock.remainingMs.b, 177000);

  // White requests takeback while it is White's turn (Black already moved) -> accepting undoes 2 plies and restores clocks.
  const reqTb2 = service.handleTakebackAction(host.id, host.seatToken, 'request');
  assert.equal(reqTb2.pendingTakebackBy, 'w');
  const accTb2 = service.handleTakebackAction(host.id, guest.seatToken, 'accept');
  assert.equal(accTb2.pendingTakebackBy, null);
  assert.equal(accTb2.history.length, 0);
  assert.equal(accTb2.turn, 'w');
  assert.equal(accTb2.clock.remainingMs.w, 180000);
  assert.equal(accTb2.clock.remainingMs.b, 180000);
  assert.equal(accTb2.clock.isRunning, false);

  // White plays 1. e4 again and immediately requests takeback (Black hasn't moved yet) -> accepting undoes 1 ply.
  service.applyPlayerMove(host.id, { from: 'e2', to: 'e4' }, host.seatToken);
  service.handleTakebackAction(host.id, host.seatToken, 'request');
  const accTb1 = service.handleTakebackAction(host.id, guest.seatToken, 'accept');
  assert.equal(accTb1.history.length, 0);
  assert.equal(accTb1.turn, 'w');

  // Black offers draw, White accepts -> game ends as draw by agreement.
  service.applyPlayerMove(host.id, { from: 'e2', to: 'e4' }, host.seatToken);
  service.handleDrawAction(host.id, guest.seatToken, 'offer');
  const drawAccepted = service.handleDrawAction(host.id, host.seatToken, 'accept');
  assert.equal(drawAccepted.status, 'draw');
  assert.equal(drawAccepted.winner, null);
  assert.equal(drawAccepted.clock.isRunning, false);

  // Host requests rematch, Guest declines -> clears pendingRematchBy; Host requests again, Guest accepts -> round 2 with swapped colors.
  const remReq = service.handleRematchAction(host.id, host.seatToken, 'request');
  assert.equal(remReq.pendingRematchBy, 'w');
  const remDec = service.handleRematchAction(host.id, guest.seatToken, 'decline');
  assert.equal(remDec.pendingRematchBy, null);

  service.handleRematchAction(host.id, host.seatToken, 'request');
  const remAcc = service.handleRematchAction(host.id, guest.seatToken, 'accept');
  assert.equal(remAcc.round, 2);
  assert.equal(remAcc.status, 'playing');
  assert.equal(remAcc.history.length, 0);
  assert.equal(remAcc.viewerColor, 'w'); // Guest (p2) swapped from Black to White.
  assert.equal(remAcc.players.w.name, 'Bob');
  assert.equal(remAcc.players.b.name, 'Alice');
  assert.equal(remAcc.clock.remainingMs.w, 180000);

  // Existing tokens continue working with swapped colors in round 2.
  const r2Move = service.applyPlayerMove(host.id, { from: 'd2', to: 'd4' }, guest.seatToken);
  assert.equal(r2Move.playerMove.san, 'd4');
  assert.equal(r2Move.game.turn, 'b');
}

test('friend game enforces seat-authenticated moves, clocks, resign, and blocks unilateral undo', testFriendMovesClocksAndResign);
test('friend game supports draw offer/accept/decline, takeback 1-2 plies, and color-swapping rematch', testFriendDrawTakebackAndRematch);
