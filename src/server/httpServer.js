import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { listBotProfiles } from '../domain/botProfiles.js';
import { listTimeControls } from '../domain/timeControls.js';
import {
  GameNotFoundError,
  GameOverError,
  InvalidGameStateError,
  InvalidMoveError,
  UnauthorizedActionError,
} from '../service/gameService.js';
import {
  validateCreateGameInput,
  validateDrawActionInput,
  validateJoinGameInput,
  validateMoveInput,
  validateRematchActionInput,
  validateTakebackActionInput,
  ValidationError,
} from './validators.js';

const MAX_BODY_BYTES = 16 * 1024;
const SSE_HEARTBEAT_MS = 25 * 1000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Sends a JSON response with explicit status code and UTF-8 content header.
 *
 * @param {http.ServerResponse} res - HTTP response stream.
 * @param {number} statusCode - HTTP status code.
 * @param {unknown} payload - Serializable JSON body.
 * @returns {void}
 */
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Reads and parses a JSON request body while enforcing a strict byte limit.
 *
 * @param {http.IncomingMessage} req - Incoming HTTP request stream.
 * @returns {Promise<unknown>} Parsed JSON value (defaults to empty object when body is empty).
 * @throws {ValidationError} When body exceeds byte limit or contains invalid JSON.
 */
async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new ValidationError('Request payload exceeds 16KB limit');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('Invalid JSON request body');
  }
}

/**
 * Extracts the optional seat token from the X-Player-Token request header.
 *
 * @param {http.IncomingMessage} req - Incoming HTTP request stream.
 * @returns {string | undefined} Trimmed seat token or undefined.
 */
function extractPlayerToken(req) {
  const raw = req.headers['x-player-token'];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Maps domain, service, and validation errors to appropriate HTTP status responses.
 *
 * @param {http.ServerResponse} res - HTTP response stream.
 * @param {unknown} err - Caught error instance.
 * @returns {void}
 */
function handleErrorResponse(res, err) {
  if (err instanceof ValidationError || err instanceof InvalidMoveError || err instanceof URIError) {
    sendJson(res, 400, { error: err.message });
    return;
  }
  if (err instanceof UnauthorizedActionError) {
    sendJson(res, 403, { error: err.message });
    return;
  }
  if (err instanceof GameNotFoundError) {
    sendJson(res, 404, { error: err.message });
    return;
  }
  if (err instanceof GameOverError || err instanceof InvalidGameStateError) {
    sendJson(res, 409, { error: err.message });
    return;
  }

  sendJson(res, 500, { error: 'Internal server error' });
}

/**
 * Safely resolves and serves a static asset from publicDir while blocking path traversal.
 *
 * @param {http.ServerResponse} res - HTTP response stream.
 * @param {string} publicDir - Resolved root directory for static web assets.
 * @param {string} pathname - Decoded URL pathname.
 * @returns {Promise<void>}
 */
async function serveStaticFile(res, publicDir, pathname) {
  const relativeRequest = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolvedRoot = path.resolve(publicDir);
  const candidatePath = path.resolve(resolvedRoot, relativeRequest);
  const rel = path.relative(resolvedRoot, candidatePath);

  // Reject any path escaping publicDir (including encoded '..' segments).
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stat = await fs.stat(candidatePath);
    if (!stat.isFile()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const content = await fs.readFile(candidatePath);
    const ext = path.extname(candidatePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.byteLength,
    });
    res.end(content);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    throw err;
  }
}

/**
 * Opens an SSE stream pushing real-time public snapshots for a chess room until closed.
 *
 * @param {http.IncomingMessage} req - Incoming HTTP request stream.
 * @param {http.ServerResponse} res - HTTP response stream kept open for SSE.
 * @param {object} gameService - Game service dependency.
 * @param {string} gameId - Target game identifier.
 * @param {Set<() => void>} activeCleanups - Active stream cleanup callbacks tracked for server shutdown.
 * @returns {void}
 */
function openSseStream(req, res, gameService, gameId, activeCleanups) {
  const initialSnapshot = gameService.getGame(gameId);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const writeSnapshot = (snapshot) => {
    if (!res.writableEnded) {
      res.write(`event: game\ndata: ${JSON.stringify(snapshot)}\n\n`);
    }
  };

  writeSnapshot(initialSnapshot);
  const unsubscribe = gameService.subscribeGame(gameId, writeSnapshot);
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': ping\n\n');
    }
  }, SSE_HEARTBEAT_MS);
  heartbeat.unref?.();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    clearInterval(heartbeat);
    unsubscribe();
    activeCleanups.delete(cleanup);
    if (!res.writableEnded) {
      res.end();
    }
  };

  activeCleanups.add(cleanup);
  req.on('close', cleanup);
  res.on('close', cleanup);
}

/**
 * Creates the Node.js HTTP server handling chess REST endpoints and static assets.
 *
 * @param {{ gameService: object, publicDir: string }} deps - Server dependencies.
 * @returns {http.Server} Configured Node.js HTTP server instance.
 */
export function createHttpServer({ gameService, publicDir }) {
  const activeSseCleanups = new Set();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);

      if (req.method === 'GET' && pathname === '/api/meta') {
        sendJson(res, 200, {
          bots: listBotProfiles(),
          timeControls: listTimeControls(),
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/games') {
        const body = await readJsonBody(req);
        const input = validateCreateGameInput(body);
        const game = gameService.createGame(input);
        sendJson(res, 201, game);
        return;
      }

      const playerToken = extractPlayerToken(req);

      const getMatch = pathname.match(/^\/api\/games\/([^/]+)$/);
      if (req.method === 'GET' && getMatch) {
        const game = gameService.getGame(getMatch[1], playerToken);
        sendJson(res, 200, game);
        return;
      }

      const eventsMatch = pathname.match(/^\/api\/games\/([^/]+)\/events$/);
      if (req.method === 'GET' && eventsMatch) {
        openSseStream(req, res, gameService, eventsMatch[1], activeSseCleanups);
        return;
      }

      const joinMatch = pathname.match(/^\/api\/games\/([^/]+)\/join$/);
      if (req.method === 'POST' && joinMatch) {
        const body = await readJsonBody(req);
        const joinInput = validateJoinGameInput(body);
        const joined = gameService.joinGame(joinMatch[1], { ...joinInput, playerToken });
        sendJson(res, 200, joined);
        return;
      }

      const moveMatch = pathname.match(/^\/api\/games\/([^/]+)\/move$/);
      if (req.method === 'POST' && moveMatch) {
        const body = await readJsonBody(req);
        const moveInput = validateMoveInput(body);
        const result = gameService.applyPlayerMove(moveMatch[1], moveInput, playerToken);
        sendJson(res, 200, result);
        return;
      }

      const undoMatch = pathname.match(/^\/api\/games\/([^/]+)\/undo$/);
      if (req.method === 'POST' && undoMatch) {
        const game = gameService.undoLastTurn(undoMatch[1]);
        sendJson(res, 200, game);
        return;
      }

      const resignMatch = pathname.match(/^\/api\/games\/([^/]+)\/resign$/);
      if (req.method === 'POST' && resignMatch) {
        const game = gameService.resignGame(resignMatch[1], playerToken);
        sendJson(res, 200, game);
        return;
      }

      const drawMatch = pathname.match(/^\/api\/games\/([^/]+)\/draw$/);
      if (req.method === 'POST' && drawMatch) {
        const body = await readJsonBody(req);
        const { action } = validateDrawActionInput(body);
        const game = gameService.handleDrawAction(drawMatch[1], playerToken, action);
        sendJson(res, 200, game);
        return;
      }

      const takebackMatch = pathname.match(/^\/api\/games\/([^/]+)\/takeback$/);
      if (req.method === 'POST' && takebackMatch) {
        const body = await readJsonBody(req);
        const { action } = validateTakebackActionInput(body);
        const game = gameService.handleTakebackAction(takebackMatch[1], playerToken, action);
        sendJson(res, 200, game);
        return;
      }

      const rematchMatch = pathname.match(/^\/api\/games\/([^/]+)\/rematch$/);
      if (req.method === 'POST' && rematchMatch) {
        const body = await readJsonBody(req);
        const { action } = validateRematchActionInput(body);
        const game = gameService.handleRematchAction(rematchMatch[1], playerToken, action);
        sendJson(res, 200, game);
        return;
      }

      const timeoutMatch = pathname.match(/^\/api\/games\/([^/]+)\/timeout$/);
      if (req.method === 'POST' && timeoutMatch) {
        const game = gameService.syncClock(timeoutMatch[1]);
        sendJson(res, 200, game);
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: 'API route not found' });
        return;
      }

      if (req.method === 'GET') {
        await serveStaticFile(res, publicDir, pathname);
        return;
      }

      sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      handleErrorResponse(res, err);
    }
  });

  // Terminate open SSE streams before closing so shutdown and tests never hang on keep-alive sockets.
  const originalClose = server.close.bind(server);
  server.close = (callback) => {
    for (const cleanup of [...activeSseCleanups]) {
      cleanup();
    }
    return originalClose(callback);
  };

  return server;
}
