import { WebSocket, WebSocketServer } from 'ws';
import { validateChatMessageInput } from './validators.js';

const CHAT_WS_MAX_PAYLOAD_BYTES = 4 * 1024;

/**
 * Sends a serialized JSON control or chat frame if the socket is open.
 *
 * @param {import('ws').WebSocket} ws - Target WebSocket connection.
 * @param {object} payload - Serializable frame object.
 * @returns {void}
 */
function sendWsFrame(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Rejects an HTTP WebSocket upgrade handshake before completing socket negotiation.
 *
 * @param {import('node:stream').Duplex} socket - Underlying TCP socket.
 * @param {number} statusCode - HTTP status code (e.g., 404 or 409).
 * @param {string} reason - Short HTTP status reason text.
 * @returns {void}
 */
function rejectUpgrade(socket, statusCode, reason) {
  socket.write(`HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/**
 * Attaches a WebSocket chat server on /api/games/:id/chat-ws to an existing HTTP server.
 *
 * @param {{ server: import('node:http').Server, gameService: object }} deps - HTTP server and game service.
 * @returns {{ close: () => void }} Cleanup handle that terminates active chat sockets on server shutdown.
 */
export function attachChatWebSocketServer({ server, gameService }) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: CHAT_WS_MAX_PAYLOAD_BYTES,
  });
  const activeSockets = new Set();

  /**
   * Handles incoming JSON frames on an active friend-room chat connection.
   *
   * @param {import('ws').WebSocket} ws - Connected WebSocket instance.
   * @param {string} gameId - Target friend room identifier.
   * @returns {void}
   */
  function handleConnection(ws, gameId) {
    activeSockets.add(ws);
    let playerToken;

    let initialMessages = [];
    try {
      initialMessages = gameService.listChatMessages(gameId);
    } catch {
      ws.close();
      activeSockets.delete(ws);
      return;
    }

    sendWsFrame(ws, { type: 'history', messages: initialMessages });
    const unsubscribe = gameService.subscribeChat(gameId, (message) => {
      sendWsFrame(ws, { type: 'chat', message });
    });

    ws.on('message', (rawData) => {
      let frame;
      try {
        frame = JSON.parse(String(rawData));
      } catch {
        sendWsFrame(ws, { type: 'error', message: 'Invalid JSON chat frame' });
        return;
      }

      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
        sendWsFrame(ws, { type: 'error', message: 'Chat frame must be a JSON object' });
        return;
      }

      if (frame.type === 'auth') {
        const candidate = typeof frame.playerToken === 'string' ? frame.playerToken.trim() : '';
        try {
          const snapshot = gameService.getGame(gameId, candidate || undefined);
          if (snapshot.viewerRole === 'player') {
            playerToken = candidate;
            sendWsFrame(ws, { type: 'auth_ok', viewerSlot: snapshot.viewerSlot });
          } else {
            playerToken = undefined;
            sendWsFrame(ws, {
              type: 'error',
              message: 'Valid player token is required to send chat messages',
            });
          }
        } catch (err) {
          sendWsFrame(ws, { type: 'error', message: err?.message ?? 'Authentication failed' });
        }
        return;
      }

      if (frame.type === 'chat') {
        try {
          const { text } = validateChatMessageInput(frame);
          gameService.sendChatMessage(gameId, playerToken, text);
        } catch (err) {
          sendWsFrame(ws, { type: 'error', message: err?.message ?? 'Failed to send chat' });
        }
        return;
      }

      sendWsFrame(ws, { type: 'error', message: 'Unsupported chat frame type' });
    });

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      unsubscribe();
      activeSockets.delete(ws);
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  }

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      const match = pathname.match(/^\/api\/games\/([^/]+)\/chat-ws$/);
      if (!match) {
        rejectUpgrade(socket, 404, 'Not Found');
        return;
      }

      const gameId = match[1];
      // Verify the room exists and supports friend chat before completing the WebSocket handshake.
      gameService.listChatMessages(gameId);
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleConnection(ws, gameId);
      });
    } catch {
      rejectUpgrade(socket, 404, 'Not Found');
    }
  });

  return {
    /**
     * Terminates all active WebSocket chat clients and closes the underlying WebSocketServer.
     *
     * @returns {void}
     */
    close() {
      for (const ws of [...activeSockets]) {
        try {
          ws.terminate();
        } catch {
          // Ignore sockets already in teardown.
        }
      }
      activeSockets.clear();
      wss.close();
    },
  };
}

