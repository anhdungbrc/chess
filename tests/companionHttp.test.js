import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpServer } from '../src/server/httpServer.js';
import { createGameService } from '../src/service/gameService.js';
import { createCompanionService } from '../src/service/companionService.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MOVE_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

/**
 * Helper to start ephemeral HTTP test server.
 *
 * @param {object} [options] - Optional custom companionService.
 * @returns {Promise<{ server: import('node:http').Server, baseUrl: string, companionService: object }>} Running test server details.
 */
async function startTestServer(options = {}) {
  const gameService = createGameService();
  const companionService = options.companionService ?? createCompanionService();
  const server = createHttpServer({
    gameService,
    companionService,
    publicDir: 'public',
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return { server, baseUrl, companionService };
}

/**
 * Validates CORS preflight OPTIONS request on /api/companion/sync.
 */
test('OPTIONS /api/companion/sync returns 204 and CORS preflight headers', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/companion/sync`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://www.chess.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.ok(res.headers.get('access-control-allow-methods')?.includes('POST'));
    assert.ok(res.headers.get('access-control-allow-headers')?.includes('Content-Type'));
  } finally {
    server.close();
  }
});

/**
 * Validates POST /api/companion/sync saves snapshot and responds with ok: true and CORS header.
 */
test('POST /api/companion/sync saves valid snapshot and returns CORS headers', async () => {
  const { server, baseUrl, companionService } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/companion/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://www.chess.com',
      },
      body: JSON.stringify({
        fen: MOVE_FEN,
        orientation: 'white',
        lastMove: { from: 'e2', to: 'e4' },
      }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(typeof data.timestamp, 'number');

    const latest = companionService.getLatestSnapshot();
    assert.equal(latest?.fen, MOVE_FEN);
    assert.deepEqual(latest?.lastMove, { from: 'e2', to: 'e4' });
    assert.equal(latest?.turn, 'b');
  } finally {
    server.close();
  }
});

/**
 * Validates POST /api/companion/sync rejects invalid FEN with 400.
 */
test('POST /api/companion/sync rejects invalid payload with 400 error', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/companion/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fen: 'invalid-fen-string',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error?.includes('Invalid FEN'));
  } finally {
    server.close();
  }
});

/**
 * Validates GET /api/companion/latest returns null initially and latest snapshot after sync.
 */
test('GET /api/companion/latest returns current snapshot or null', async () => {
  const { server, baseUrl, companionService } = await startTestServer();
  try {
    const resInitial = await fetch(`${baseUrl}/api/companion/latest`);
    assert.equal(resInitial.status, 200);
    const dataInitial = await resInitial.json();
    assert.equal(dataInitial.snapshot, null);

    // Sync a position
    await fetch(`${baseUrl}/api/companion/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen: START_FEN }),
    });

    const resUpdated = await fetch(`${baseUrl}/api/companion/latest`);
    assert.equal(resUpdated.status, 200);
    const dataUpdated = await resUpdated.json();
    assert.equal(dataUpdated.snapshot?.fen, START_FEN);
  } finally {
    server.close();
  }
});

/**
 * Validates GET /api/companion/events streams updates to client via SSE.
 */
test('GET /api/companion/events streams real-time updates via SSE', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/companion/events`, {
      signal: controller.signal,
    });

    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));

    const reader = res.body?.getReader();
    assert.ok(reader);

    // Read initial stream connection (could be empty or initial snapshot)
    const decoder = new TextDecoder();

    // Trigger sync
    await fetch(`${baseUrl}/api/companion/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen: MOVE_FEN,
        lastMove: { from: 'e2', to: 'e4' },
      }),
    });

    // Read SSE chunk
    let received = '';
    const startWait = Date.now();
    while (!received.includes('companion:update') && Date.now() - startWait < 3000) {
      const { value, done } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
    }

    assert.ok(received.includes('event: companion:update'));
    assert.ok(received.includes(MOVE_FEN));

    controller.abort();
    reader.cancel().catch(() => {});
  } finally {
    server.close();
  }
});

