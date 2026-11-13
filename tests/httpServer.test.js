import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameService } from '../src/service/gameService.js';
import { createHttpServer } from '../src/server/httpServer.js';

const REAL_PUBLIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public'
);

const REAL_STOCKFISH_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  'stockfish',
  'bin'
);

/**
 * Starts an ephemeral HTTP server for integration testing and returns its base URL and cleanup helper.
 *
 * @param {object} [options] - Optional gameService and publicDir overrides.
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void> }>} Active server handle.
 */
async function startTestServer(options = {}) {
  const ownsPublicDir = !options.publicDir;
  const publicDir =
    options.publicDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'chess-public-'));
  const gameService =
    options.gameService ??
    createGameService({
      chooseMove: () => ({ from: 'e7', to: 'e5' }),
    });

  const server = createHttpServer({
    gameService,
    publicDir,
    ...(options.stockfishDir !== undefined ? { stockfishDir: options.stockfishDir } : {}),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    publicDir,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          if (ownsPublicDir) {
            fs.rmSync(publicDir, { recursive: true, force: true });
          }
          resolve();
        });
      }),
  };
}

/**
 * Verifies POST /api/games creates a game (201) and GET /api/games/:id retrieves it (200).
 * Expected: status 201 on create, status 200 on get with matching id and turn.
 */
async function testCreateAndGetGameEndpoint() {
  const ctx = await startTestServer();
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', difficulty: 'medium' }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.id);
    assert.equal(created.turn, 'w');

    const getRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}`);
    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.id, created.id);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies POST /api/games rejects invalid options and malformed JSON with status 400.
 * Expected: invalid difficulty, invalid playerColor, and broken JSON all return HTTP 400.
 */
async function testCreateGameRejectsInvalidPayload() {
  const ctx = await startTestServer();
  try {
    const badColorRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'green', difficulty: 'medium' }),
    });
    assert.equal(badColorRes.status, 400);

    const badDifficultyRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', difficulty: 'godmode' }),
    });
    assert.equal(badDifficultyRes.status, 400);

    const malformedRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-valid-json',
    });
    assert.equal(malformedRes.status, 400);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies GET /api/games/:id returns 404 when the requested game does not exist.
 * Expected: status 404 with JSON error payload.
 */
async function testGetMissingGameReturns404() {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/games/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies POST /api/games/:id/move executes a valid move and returns the AI reply.
 * Expected: status 200 with playerMove e4, aiMove e5, and history length 2.
 */
async function testPostMoveExecutesTurn() {
  const ctx = await startTestServer();
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', difficulty: 'medium' }),
    });
    const created = await createRes.json();

    const moveRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });
    assert.equal(moveRes.status, 200);
    const body = await moveRes.json();
    assert.equal(body.playerMove.san, 'e4');
    assert.equal(body.aiMove.san, 'e5');
    assert.equal(body.game.history.length, 2);
    assert.equal(
      body.game.initialFen,
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
    assert.equal(
      body.game.history[0].fen,
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    );
    assert.equal(body.game.history[0].inCheck, false);
    assert.equal(
      body.game.history[1].fen,
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    );
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies POST /api/games/:id/move validates square syntax, promotion piece, legality, and game existence.
 * Expected: bad square/promotion/illegal move return 400; missing game returns 404.
 */
async function testPostMoveValidationAndErrors() {
  const ctx = await startTestServer();
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', difficulty: 'easy' }),
    });
    const created = await createRes.json();

    const badSquareRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'z9', to: 'e4' }),
    });
    assert.equal(badSquareRes.status, 400);

    const badPromoRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4', promotion: 'k' }),
    });
    assert.equal(badPromoRes.status, 400);

    const illegalMoveRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e5' }),
    });
    assert.equal(illegalMoveRes.status, 400);

    const missingGameRes = await fetch(`${ctx.baseUrl}/api/games/missing-id/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });
    assert.equal(missingGameRes.status, 404);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies POST /api/games/:id/undo reverts the turn and handles unknown IDs.
 * Expected: returns 200 with history length 0 on valid undo and 404 on unknown game.
 */
async function testPostUndoEndpoint() {
  const ctx = await startTestServer();
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', difficulty: 'medium' }),
    });
    const created = await createRes.json();

    await fetch(`${ctx.baseUrl}/api/games/${created.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });

    const undoRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/undo`, {
      method: 'POST',
    });
    assert.equal(undoRes.status, 200);
    const undone = await undoRes.json();
    assert.equal(undone.history.length, 0);
    assert.equal(undone.turn, 'w');

    const missingUndoRes = await fetch(`${ctx.baseUrl}/api/games/missing-id/undo`, {
      method: 'POST',
    });
    assert.equal(missingUndoRes.status, 404);
  } finally {
    await ctx.close();
  }
}

/**
 * Performs a raw HTTP GET request without normalizing '..' path segments.
 *
 * @param {string} baseUrl - Base server URL.
 * @param {string} rawPath - Unnormalized request path.
 * @returns {Promise<{ statusCode: number, body: string }>} Status and text body.
 */
function rawHttpGet(baseUrl, rawPath) {
  const parsed = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: rawPath,
        method: 'GET',
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Verifies static file serving for index.html, CSS, JS, and blocks path traversal attempts.
 * Expected: valid assets return 200 with matching MIME types; traversal paths return 403 or 404.
 */
async function testStaticServingAndTraversalProtection() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chess-static-'));
  const publicDir = path.join(rootDir, 'public');
  fs.mkdirSync(publicDir);
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<h1>Chess</h1>');
  fs.writeFileSync(path.join(publicDir, 'styles.css'), 'body {}');
  fs.writeFileSync(path.join(publicDir, 'app.js'), 'console.log(1);');
  fs.writeFileSync(path.join(rootDir, 'secret.txt'), 'TOP_SECRET');

  const ctx = await startTestServer({ publicDir });
  try {
    const indexRes = await fetch(`${ctx.baseUrl}/`);
    assert.equal(indexRes.status, 200);
    assert.match(indexRes.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(await indexRes.text(), '<h1>Chess</h1>');

    const cssRes = await fetch(`${ctx.baseUrl}/styles.css`);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get('content-type') ?? '', /text\/css/);

    const jsRes = await fetch(`${ctx.baseUrl}/app.js`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type') ?? '', /javascript/);

    const encodedTraversal = await rawHttpGet(ctx.baseUrl, '/%2e%2e/secret.txt');
    assert.ok(encodedTraversal.statusCode === 403 || encodedTraversal.statusCode === 404);
    assert.doesNotMatch(encodedTraversal.body, /TOP_SECRET/);

    const rawTraversal = await rawHttpGet(ctx.baseUrl, '/../secret.txt');
    assert.ok(rawTraversal.statusCode === 403 || rawTraversal.statusCode === 404);
    assert.doesNotMatch(rawTraversal.body, /TOP_SECRET/);
  } finally {
    await ctx.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

/**
 * Verifies the real public/favicon.svg asset is served over HTTP with the SVG MIME type.
 * Expected: GET /favicon.svg returns 200, image/svg+xml content-type, and valid <svg> markup.
 */
async function testRealPublicFaviconSvgServed() {
  const ctx = await startTestServer({ publicDir: REAL_PUBLIC_DIR });
  try {
    const res = await fetch(`${ctx.baseUrl}/favicon.svg`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /image\/svg\+xml/);
    const svg = await res.text();
    assert.match(svg, /<svg[\s>]/);
    assert.match(svg, /<\/svg>/);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies the real public/index.html declares an SVG favicon link in its head element.
 * Expected: GET / returns 200 HTML whose <head> references /favicon.svg as image/svg+xml icon.
 */
async function testRealPublicIndexDeclaresFavicon() {
  const ctx = await startTestServer({ publicDir: REAL_PUBLIC_DIR });
  try {
    const res = await fetch(`${ctx.baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    assert.ok(headMatch, 'Expected index.html to contain a <head> element');
    assert.match(
      headMatch[1],
      /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"\s*\/?>/i
    );
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies GET /api/meta exposes bot profiles and time control presets with HTTP 200.
 * Expected: JSON response contains bots array and timeControls array matching domain catalogs.
 */
async function testGetMetaEndpoint() {
  const ctx = await startTestServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/meta`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(
      body.bots.map((b) => b.id),
      ['martin', 'elani', 'antonio']
    );
    assert.deepEqual(
      body.timeControls.map((tc) => tc.id),
      ['untimed', '1+0', '3+0', '3+2', '10+0']
    );
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies POST /api/games validates botId and timeControl fields and returns 400 on invalid inputs.
 * Expected: valid botId/timeControl create a timed game (201); unknown botId or timeControl returns 400.
 */
async function testCreateGameWithBotAndTimeControl() {
  const ctx = await startTestServer();
  try {
    const okRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerColor: 'w',
        botId: 'antonio',
        timeControl: '3+2',
      }),
    });
    assert.equal(okRes.status, 201);
    const created = await okRes.json();
    assert.equal(created.bot.id, 'antonio');
    assert.equal(created.clock.timeControl, '3+2');

    const badBotRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', botId: 'unknown-bot' }),
    });
    assert.equal(badBotRes.status, 400);

    const badTimeRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', timeControl: '99+0' }),
    });
    assert.equal(badTimeRes.status, 400);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies POST /api/games/:id/resign ends an active game (200), blocks duplicate resign (409), and returns 404 on missing ID.
 * Expected: first resign returns status 'resigned' and winner 'b'; second returns 409; unknown ID returns 404.
 */
async function testPostResignEndpoint() {
  const ctx = await startTestServer();
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerColor: 'w', botId: 'elani' }),
    });
    const created = await createRes.json();

    const resignRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/resign`, {
      method: 'POST',
    });
    assert.equal(resignRes.status, 200);
    const resigned = await resignRes.json();
    assert.equal(resigned.status, 'resigned');
    assert.equal(resigned.winner, 'b');

    const repeatRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/resign`, {
      method: 'POST',
    });
    assert.equal(repeatRes.status, 409);

    const missingRes = await fetch(`${ctx.baseUrl}/api/games/missing-id/resign`, {
      method: 'POST',
    });
    assert.equal(missingRes.status, 404);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies POST /api/games/:id/timeout syncs the server clock and transitions expired games to 'timeout'.
 * Expected: returns 200 with status 'timeout' once clock expires and 404 for unknown game IDs.
 */
async function testPostTimeoutEndpoint() {
  let fakeNow = 10000;
  const gameService = createGameService({
    now: () => fakeNow,
    chooseMove: () => ({ from: 'e7', to: 'e5' }),
  });
  const ctx = await startTestServer({ gameService });
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerColor: 'w',
        botId: 'martin',
        timeControl: '1+0',
      }),
    });
    const created = await createRes.json();

    await fetch(`${ctx.baseUrl}/api/games/${created.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });

    fakeNow += 65000;
    const timeoutRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/timeout`, {
      method: 'POST',
    });
    assert.equal(timeoutRes.status, 200);
    const timedOut = await timeoutRes.json();
    assert.equal(timedOut.status, 'timeout');
    assert.equal(timedOut.winner, 'b');

    const missingRes = await fetch(`${ctx.baseUrl}/api/games/missing-id/timeout`, {
      method: 'POST',
    });
    assert.equal(missingRes.status, 404);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies real public/ assets serve the English Chess.com shell and new ES module helpers.
 * Expected: index.html includes Chess.com layout hooks in English; chessAssets.js and chessUiHelper.js return 200 JS.
 */
async function testRealPublicChessComAssetsServed() {
  const ctx = await startTestServer({ publicDir: REAL_PUBLIC_DIR });
  try {
    const htmlRes = await fetch(`${ctx.baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /<html\s+lang="en"/i);
    assert.match(html, /id="chess-board"/);
    assert.match(html, /id="top-player-card"/);
    assert.match(html, /id="bottom-player-card"/);
    assert.match(html, /id="resign-btn"/);
    assert.match(html, /id="mode-friend-btn"/);
    assert.match(html, /id="friend-name-input"/);
    assert.match(html, /id="invite-link-box"/);
    assert.match(html, /id="join-match-box"/);
    assert.match(html, /id="draw-btn"/);
    assert.match(html, /id="eval-bar"/);
    assert.match(html, /id="modal-review-btn"/);
    assert.match(html, /id="review-analyze-btn"/);
    assert.match(html, /id="analysis-panel"/);
    assert.match(html, /id="eval-graph"/);
    assert.match(html, /id="nav-fullscreen-btn"/);
    assert.match(html, /id="board-fullscreen-btn"/);
    assert.match(html, /id="fullscreen-exit-btn"/);
    assert.match(html, /id="mobile-chat-fab"/);
    assert.match(html, /id="mobile-chat-popup"/);

    const assetsRes = await fetch(`${ctx.baseUrl}/chessAssets.js`);
    assert.equal(assetsRes.status, 200);
    assert.match(assetsRes.headers.get('content-type') ?? '', /javascript/);

    const helperRes = await fetch(`${ctx.baseUrl}/chessUiHelper.js`);
    assert.equal(helperRes.status, 200);
    assert.match(helperRes.headers.get('content-type') ?? '', /javascript/);

    const analysisHelperRes = await fetch(`${ctx.baseUrl}/analysisHelper.js`);
    assert.equal(analysisHelperRes.status, 200);
    assert.match(analysisHelperRes.headers.get('content-type') ?? '', /javascript/);

    const stockfishClientRes = await fetch(`${ctx.baseUrl}/stockfishClient.js`);
    assert.equal(stockfishClientRes.status, 200);
    assert.match(stockfishClientRes.headers.get('content-type') ?? '', /javascript/);

    const realCssRes = await fetch(`${ctx.baseUrl}/styles.css`);
    assert.equal(realCssRes.status, 200);
    const realCss = await realCssRes.text();
    assert.match(realCss, /\.app-layout\.is-fullscreen/);
    assert.match(realCss, /\.fullscreen-exit-btn/);
    assert.match(realCss, /\.board-fullscreen-btn/);
  } finally {
    await ctx.close();
  }
}

/**
 * Verifies friend-mode HTTP endpoints for creating a room, joining via invite ID, authenticating with X-Player-Token, and rejecting invalid inputs.
 * Expected: POST /api/games returns 201 waiting room with seatToken; GET hides seatToken; POST /join returns 200 playing and 409 when full; bad fields return 400.
 */
async function testFriendCreateAndJoinEndpoints() {
  const ctx = await startTestServer();
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'friend',
        playerColor: 'w',
        playerName: '  HostOne  ',
        timeControl: '3+0',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.mode, 'friend');
    assert.equal(created.status, 'waiting');
    assert.equal(created.viewerColor, 'w');
    assert.equal(created.players.w.name, 'HostOne');
    assert.ok(created.seatToken);

    // Public GET must omit seatToken and report spectator role.
    const specGetRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}`);
    assert.equal(specGetRes.status, 200);
    const specGame = await specGetRes.json();
    assert.equal(specGame.seatToken, undefined);
    assert.equal(specGame.viewerRole, 'spectator');

    // Host GET with X-Player-Token recognizes host seat.
    const hostGetRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}`, {
      headers: { 'X-Player-Token': created.seatToken },
    });
    assert.equal(hostGetRes.status, 200);
    const hostGame = await hostGetRes.json();
    assert.equal(hostGame.viewerRole, 'player');
    assert.equal(hostGame.viewerColor, 'w');

    // Host cannot join second seat using own token.
    const selfJoinRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': created.seatToken,
      },
      body: JSON.stringify({ playerName: 'Self' }),
    });
    assert.equal(selfJoinRes.status, 409);

    // Friend joins open Black seat.
    const joinRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'FriendTwo' }),
    });
    assert.equal(joinRes.status, 200);
    const joined = await joinRes.json();
    assert.equal(joined.status, 'playing');
    assert.equal(joined.viewerColor, 'b');
    assert.equal(joined.players.b.name, 'FriendTwo');
    assert.ok(joined.seatToken);

    // Third user cannot join full room.
    const fullRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Intruder' }),
    });
    assert.equal(fullRes.status, 409);

    // Reject invalid mode, overly long name, or random color in bot mode.
    const badModeRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'tournament', playerColor: 'w' }),
    });
    assert.equal(badModeRes.status, 400);

    const botRandomRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'bot', playerColor: 'random' }),
    });
    assert.equal(botRandomRes.status, 400);

    const longNameRes = await fetch(`${ctx.baseUrl}/api/games/${created.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'A'.repeat(25) }),
    });
    assert.equal(longNameRes.status, 400);
  } finally {
    await ctx.close();
  }
}

test('POST /api/games and GET /api/games/:id succeed', testCreateAndGetGameEndpoint);
test('POST /api/games returns 400 on invalid payload or malformed JSON', testCreateGameRejectsInvalidPayload);
test('GET /api/games/:id returns 404 for unknown game', testGetMissingGameReturns404);
test('POST /api/games/:id/move executes move and AI reply', testPostMoveExecutesTurn);
test('POST /api/games/:id/move returns 400/404 on invalid or missing game', testPostMoveValidationAndErrors);
test('POST /api/games/:id/undo reverts turn and returns 404 for unknown game', testPostUndoEndpoint);
test('serves static assets safely and blocks path traversal', testStaticServingAndTraversalProtection);
test('serves real public/favicon.svg with SVG MIME type', testRealPublicFaviconSvgServed);
test('serves real public/index.html with SVG favicon link', testRealPublicIndexDeclaresFavicon);
test('GET /api/meta returns bot profiles and time controls', testGetMetaEndpoint);
test('POST /api/games validates botId and timeControl presets', testCreateGameWithBotAndTimeControl);
test('POST /api/games/:id/resign handles active, finished, and missing games', testPostResignEndpoint);
test('POST /api/games/:id/timeout syncs clock and flags expired games', testPostTimeoutEndpoint);
test('serves real public/ Chess.com English shell and helper modules', testRealPublicChessComAssetsServed);
/**
 * Verifies friend-mode HTTP endpoints enforce X-Player-Token for moves/resign, block waiting/out-of-turn/undo, and resolve turn outcomes.
 * Expected: waiting move returns 409; missing/bad token returns 403; out-of-turn returns 400; undo returns 409; valid moves & resign return 200.
 */
async function testFriendMoveAndResignEndpoints() {
  const ctx = await startTestServer();
  try {
    const createRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'friend', playerColor: 'w', timeControl: '3+2' }),
    });
    const host = await createRes.json();

    // Moving while waiting for friend returns 409.
    const waitingMoveRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': host.seatToken,
      },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });
    assert.equal(waitingMoveRes.status, 409);

    const joinRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Guest' }),
    });
    const guest = await joinRes.json();

    // Missing token returns 403.
    const unauthMoveRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });
    assert.equal(unauthMoveRes.status, 403);

    // Guest moving on White's turn returns 400.
    const wrongTurnRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': guest.seatToken,
      },
      body: JSON.stringify({ from: 'e7', to: 'e5' }),
    });
    assert.equal(wrongTurnRes.status, 400);

    // Host moves e2-e4, then Guest moves e7-e5.
    const wMoveRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': host.seatToken,
      },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });
    assert.equal(wMoveRes.status, 200);
    const wMove = await wMoveRes.json();
    assert.equal(wMove.aiMove, null);
    assert.equal(wMove.game.turn, 'b');

    const bMoveRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': guest.seatToken,
      },
      body: JSON.stringify({ from: 'e7', to: 'e5' }),
    });
    assert.equal(bMoveRes.status, 200);
    const bMove = await bMoveRes.json();
    assert.equal(bMove.game.turn, 'w');
    assert.equal(bMove.game.history.length, 2);

    // Unilateral undo returns 409 in friend mode.
    const undoRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/undo`, {
      method: 'POST',
    });
    assert.equal(undoRes.status, 409);

    // Missing token on resign returns 403; Guest resigns returns 200 with White winner.
    const unauthResignRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/resign`, {
      method: 'POST',
    });
    assert.equal(unauthResignRes.status, 403);

    const resignRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/resign`, {
      method: 'POST',
      headers: { 'X-Player-Token': guest.seatToken },
    });
    assert.equal(resignRes.status, 200);
    const resigned = await resignRes.json();
    assert.equal(resigned.status, 'resigned');
    assert.equal(resigned.winner, 'w');
  } finally {
    await ctx.close();
  }
}

test('friend mode create, join, token lookup, and validation endpoints', testFriendCreateAndJoinEndpoints);
/**
 * Verifies friend-mode HTTP endpoints for draw offers, takeback requests, rematch pairing, and boundary validation.
 * Expected: /draw, /takeback, and /rematch validate actions (400), enforce tokens (403) and turn/state rules (409), and update snapshots cleanly (200).
 */
async function testFriendDrawTakebackAndRematchEndpoints() {
  const ctx = await startTestServer();
  try {
    const hostRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'friend', playerColor: 'w', timeControl: '1+0' }),
    });
    const host = await hostRes.json();

    const guestRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Guest' }),
    });
    const guest = await guestRes.json();

    // Invalid action returns 400; missing token returns 403.
    const badActionRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': host.seatToken,
      },
      body: JSON.stringify({ action: 'cancel' }),
    });
    assert.equal(badActionRes.status, 400);

    const noTokenRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'offer' }),
    });
    assert.equal(noTokenRes.status, 403);

    // Move e4, request takeback, accept -> back to 0 moves.
    await fetch(`${ctx.baseUrl}/api/games/${host.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': host.seatToken },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });
    const tbReqRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/takeback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': host.seatToken },
      body: JSON.stringify({ action: 'request' }),
    });
    assert.equal(tbReqRes.status, 200);
    assert.equal((await tbReqRes.json()).pendingTakebackBy, 'w');

    const tbAccRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/takeback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': guest.seatToken },
      body: JSON.stringify({ action: 'accept' }),
    });
    assert.equal(tbAccRes.status, 200);
    assert.equal((await tbAccRes.json()).history.length, 0);

    // Offer and accept draw -> game ends as draw.
    await fetch(`${ctx.baseUrl}/api/games/${host.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': host.seatToken },
      body: JSON.stringify({ action: 'offer' }),
    });
    const drawAccRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': guest.seatToken },
      body: JSON.stringify({ action: 'accept' }),
    });
    assert.equal(drawAccRes.status, 200);
    assert.equal((await drawAccRes.json()).status, 'draw');

    // Mutual rematch requests start round 2 with swapped colors.
    const rem1Res = await fetch(`${ctx.baseUrl}/api/games/${host.id}/rematch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': host.seatToken },
      body: JSON.stringify({ action: 'request' }),
    });
    assert.equal(rem1Res.status, 200);
    assert.equal((await rem1Res.json()).pendingRematchBy, 'w');

    const rem2Res = await fetch(`${ctx.baseUrl}/api/games/${host.id}/rematch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': guest.seatToken },
      body: JSON.stringify({ action: 'request' }),
    });
    assert.equal(rem2Res.status, 200);
    const r2 = await rem2Res.json();
    assert.equal(r2.round, 2);
    assert.equal(r2.status, 'playing');
    assert.equal(r2.viewerColor, 'w');
  } finally {
    await ctx.close();
  }
}

test('friend mode move, clock, undo rejection, and resign endpoints enforce seat tokens', testFriendMoveAndResignEndpoints);
/**
 * Opens an SSE stream using fetch and reads incremental `event: game` JSON payloads until closed or aborted.
 *
 * @param {string} url - Full SSE endpoint URL.
 * @returns {Promise<{ status: number, contentType: string, nextEvent: () => Promise<{ event: string, data: any }>, close: () => void }>} Stream reader handle.
 */
async function openSseClient(url) {
  const controller = new AbortController();
  const res = await fetch(url, { signal: controller.signal });
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !res.body) {
    return {
      status: res.status,
      contentType,
      nextEvent: async () => null,
      close: () => controller.abort(),
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const queue = [];

  /**
   * Reads chunks from the SSE stream until at least one complete SSE frame is buffered.
   *
   * @returns {Promise<{ event: string, data: any } | null>} Next parsed SSE message or null when ended.
   */
  async function nextEvent() {
    while (queue.length === 0) {
      const { value, done } = await reader.read();
      if (done) {
        return null;
      }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const lines = frame.split('\n').filter((line) => line && !line.startsWith(':'));
        if (lines.length === 0) {
          continue;
        }
        let eventName = 'message';
        let rawData = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            rawData += line.slice(5).trim();
          }
        }
        if (rawData) {
          queue.push({ event: eventName, data: JSON.parse(rawData) });
        }
      }
    }
    return queue.shift();
  }

  return {
    status: res.status,
    contentType,
    nextEvent,
    close: () => {
      controller.abort();
      reader.cancel().catch(() => {});
    },
  };
}

/**
 * Verifies GET /api/games/:id/events streams initial and real-time game updates without exposing seat tokens, and closes cleanly.
 * Expected: missing ID returns 404; valid ID streams initial waiting state, join transition, and move updates immediately.
 */
async function testFriendSseRealtimeUpdates() {
  const ctx = await startTestServer();
  let sse = null;
  try {
    const missingRes = await fetch(`${ctx.baseUrl}/api/games/missing-id/events`);
    assert.equal(missingRes.status, 404);

    const hostRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'friend', playerColor: 'w' }),
    });
    const host = await hostRes.json();

    sse = await openSseClient(`${ctx.baseUrl}/api/games/${host.id}/events`);
    assert.equal(sse.status, 200);
    assert.match(sse.contentType, /text\/event-stream/);

    const initialEvt = await sse.nextEvent();
    assert.equal(initialEvt.event, 'game');
    assert.equal(initialEvt.data.status, 'waiting');
    assert.equal(initialEvt.data.seatToken, undefined);

    const guestRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Guest' }),
    });
    const guest = await guestRes.json();

    const joinedEvt = await sse.nextEvent();
    assert.equal(joinedEvt.data.status, 'playing');
    assert.equal(joinedEvt.data.players.b.name, 'Guest');
    assert.equal(joinedEvt.data.seatToken, undefined);

    await fetch(`${ctx.baseUrl}/api/games/${host.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Player-Token': host.seatToken },
      body: JSON.stringify({ from: 'e2', to: 'e4' }),
    });

    const movedEvt = await sse.nextEvent();
    assert.equal(movedEvt.data.history.length, 1);
    assert.equal(movedEvt.data.lastMove.san, 'e4');
    assert.equal(movedEvt.data.turn, 'b');

    await fetch(`${ctx.baseUrl}/api/games/${host.id}/resign`, {
      method: 'POST',
      headers: { 'X-Player-Token': guest.seatToken },
    });

    const resignedEvt = await sse.nextEvent();
    assert.equal(resignedEvt.data.status, 'resigned');
    assert.equal(resignedEvt.data.winner, 'w');
  } finally {
    sse?.close();
    await ctx.close();
  }
}

test('friend mode draw, takeback, and rematch endpoints handle agreements and errors', testFriendDrawTakebackAndRematchEndpoints);
test('GET /api/games/:id/events streams real-time SSE snapshots and handles 404/cleanup', testFriendSseRealtimeUpdates);

/**
 * Verifies /api/meta advertises the Stockfish lite-single script URL, /vendor/stockfish/ serves JS/WASM with correct MIME types, and blocks traversal.
 * Expected: meta exposes analysisEngine.scriptUrl; JS returns javascript MIME; WASM returns application/wasm; traversal attempts return 403 or 404.
 */
async function testStockfishVendorServingAndMeta() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chess-stockfish-'));
  const stockfishDir = path.join(rootDir, 'bin');
  fs.mkdirSync(stockfishDir);
  fs.writeFileSync(path.join(stockfishDir, 'stockfish-19-lite-single.js'), '// mock worker');
  fs.writeFileSync(path.join(stockfishDir, 'stockfish-19-lite-single.wasm'), 'wasm-bytes');
  fs.writeFileSync(path.join(rootDir, 'secret.txt'), 'TOP_SECRET');

  const ctx = await startTestServer({ stockfishDir });
  try {
    const metaRes = await fetch(`${ctx.baseUrl}/api/meta`);
    assert.equal(metaRes.status, 200);
    const meta = await metaRes.json();
    assert.equal(meta.analysisEngine?.scriptUrl, '/vendor/stockfish/stockfish-19-lite-single.js');

    const jsRes = await fetch(`${ctx.baseUrl}${meta.analysisEngine.scriptUrl}`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type') ?? '', /javascript/);

    const wasmRes = await fetch(`${ctx.baseUrl}/vendor/stockfish/stockfish-19-lite-single.wasm`);
    assert.equal(wasmRes.status, 200);
    assert.match(wasmRes.headers.get('content-type') ?? '', /application\/wasm/);

    const encodedTraversal = await rawHttpGet(ctx.baseUrl, '/vendor/stockfish/%2e%2e/secret.txt');
    assert.ok(encodedTraversal.statusCode === 403 || encodedTraversal.statusCode === 404);
    assert.doesNotMatch(encodedTraversal.body, /TOP_SECRET/);
  } finally {
    await ctx.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('serves Stockfish vendor JS/WASM assets safely and advertises scriptUrl in /api/meta', testStockfishVendorServingAndMeta);

/**
 * Verifies the real installed stockfish npm package assets in node_modules/stockfish/bin are served cleanly over HTTP.
 * Expected: /api/meta returns a non-null lite-single scriptUrl; fetching the JS and matching .wasm returns 200 with valid MIME types.
 */
async function testRealInstalledStockfishAssetsServed() {
  const ctx = await startTestServer({
    publicDir: REAL_PUBLIC_DIR,
    stockfishDir: REAL_STOCKFISH_DIR,
  });
  try {
    const metaRes = await fetch(`${ctx.baseUrl}/api/meta`);
    assert.equal(metaRes.status, 200);
    const meta = await metaRes.json();
    const scriptUrl = meta.analysisEngine?.scriptUrl;
    assert.match(scriptUrl ?? '', /^\/vendor\/stockfish\/stockfish-.*-lite-single\.js$/);

    const jsRes = await fetch(`${ctx.baseUrl}${scriptUrl}`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type') ?? '', /javascript/);

    const wasmUrl = scriptUrl.replace(/\.js$/, '.wasm');
    const wasmRes = await fetch(`${ctx.baseUrl}${wasmUrl}`);
    assert.equal(wasmRes.status, 200);
    assert.match(wasmRes.headers.get('content-type') ?? '', /application\/wasm/);
    const wasmBytes = new Uint8Array(await wasmRes.arrayBuffer());
    // WebAssembly binary magic header: \0asm (0x00 0x61 0x73 0x6d).
    assert.deepEqual(Array.from(wasmBytes.slice(0, 4)), [0x00, 0x61, 0x73, 0x6d]);
  } finally {
    await ctx.close();
  }
}

test('serves real installed Stockfish lite-single JS and WASM binary', testRealInstalledStockfishAssetsServed);

/**
 * Opens a WebSocket client connection and buffers incoming JSON frames for sequential assertions.
 *
 * @param {string} wsUrl - Target ws:// URL.
 * @returns {Promise<{ sendJson: (payload: object) => void, nextMessage: (timeoutMs?: number) => Promise<object>, close: () => void }>} Connected client helper.
 */
function openWsClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const queue = [];
    const waiters = [];

    ws.addEventListener('message', (event) => {
      const parsed = JSON.parse(String(event.data));
      if (waiters.length > 0) {
        waiters.shift().resolve(parsed);
      } else {
        queue.push(parsed);
      }
    });

    ws.addEventListener('open', () => {
      resolve({
        sendJson(payload) {
          ws.send(JSON.stringify(payload));
        },
        nextMessage(timeoutMs = 2000) {
          if (queue.length > 0) {
            return Promise.resolve(queue.shift());
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const idx = waiters.findIndex((w) => w.resolve === wrappedResolve);
              if (idx >= 0) {
                waiters.splice(idx, 1);
              }
              rej(new Error('Timed out waiting for WebSocket message'));
            }, timeoutMs);
            const wrappedResolve = (value) => {
              clearTimeout(timer);
              res(value);
            };
            waiters.push({ resolve: wrappedResolve });
          });
        },
        close() {
          ws.close();
        },
      });
    });

    ws.addEventListener('error', () => {
      reject(new Error(`WebSocket connection failed: ${wsUrl}`));
    });
  });
}

/**
 * Verifies WebSocket /api/games/:id/chat-ws delivers history, authenticates players, broadcasts real-time chat, blocks spectators from sending, and closes cleanly.
 * Expected: missing/bot rooms reject upgrade; players exchange authenticated chat; spectators only read; server closes without hanging.
 */
async function testFriendChatWebSocketServer() {
  const ctx = await startTestServer();
  const wsBase = ctx.baseUrl.replace(/^http:/, 'ws:');
  const clients = [];
  try {
    const botRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'bot', playerColor: 'w', difficulty: 'easy' }),
    });
    const botGame = await botRes.json();

    await assert.rejects(() => openWsClient(`${wsBase}/api/games/missing-id/chat-ws`));
    await assert.rejects(() => openWsClient(`${wsBase}/api/games/${botGame.id}/chat-ws`));

    const hostRes = await fetch(`${ctx.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'friend', playerColor: 'w', playerName: 'Alice' }),
    });
    const host = await hostRes.json();

    const guestRes = await fetch(`${ctx.baseUrl}/api/games/${host.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Bob' }),
    });
    const guest = await guestRes.json();

    const wsUrl = `${wsBase}/api/games/${host.id}/chat-ws`;
    const hostWs = await openWsClient(wsUrl);
    const guestWs = await openWsClient(wsUrl);
    const specWs = await openWsClient(wsUrl);
    clients.push(hostWs, guestWs, specWs);

    const hostHist = await hostWs.nextMessage();
    const guestHist = await guestWs.nextMessage();
    const specHist = await specWs.nextMessage();
    assert.equal(hostHist.type, 'history');
    assert.equal(hostHist.messages.length, 1);
    assert.equal(guestHist.messages.length, 1);
    assert.equal(specHist.messages.length, 1);

    hostWs.sendJson({ type: 'auth', playerToken: host.seatToken });
    const authOk = await hostWs.nextMessage();
    assert.equal(authOk.type, 'auth_ok');

    // Spectators cannot send chat messages.
    specWs.sendJson({ type: 'chat', text: 'Let me chat' });
    const specErr = await specWs.nextMessage();
    assert.equal(specErr.type, 'error');

    // Empty chat triggers validation error without dropping the authenticated socket.
    hostWs.sendJson({ type: 'chat', text: '   ' });
    const valErr = await hostWs.nextMessage();
    assert.equal(valErr.type, 'error');

    // Valid player chat broadcasts to both players and spectators.
    hostWs.sendJson({ type: 'chat', text: 'Good luck!' });
    const [mHost, mGuest, mSpec] = await Promise.all([
      hostWs.nextMessage(),
      guestWs.nextMessage(),
      specWs.nextMessage(),
    ]);
    assert.equal(mHost.type, 'chat');
    assert.equal(mHost.message.senderName, 'Alice');
    assert.equal(mHost.message.text, 'Good luck!');
    assert.equal(mGuest.message.text, 'Good luck!');
    assert.equal(mSpec.message.text, 'Good luck!');

    guestWs.sendJson({ type: 'auth', playerToken: guest.seatToken });
    await guestWs.nextMessage();
    guestWs.sendJson({ type: 'chat', text: 'You too!' });
    const replyHost = await hostWs.nextMessage();
    assert.equal(replyHost.message.senderName, 'Bob');
    assert.equal(replyHost.message.text, 'You too!');
  } finally {
    for (const c of clients) {
      c.close();
    }
    await ctx.close();
  }
}

test('WS /api/games/:id/chat-ws streams history, authenticates players, and enforces spectator read-only', testFriendChatWebSocketServer);
