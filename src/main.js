import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameService } from './service/gameService.js';
import { createHttpServer } from './server/httpServer.js';

const DEFAULT_PORT = 3000;

/**
 * Boots the chess web application HTTP server on the configured port.
 *
 * @returns {import('node:http').Server} Running HTTP server instance.
 */
export function startServer() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(currentDir, '..', 'public');
  const stockfishDir = path.resolve(currentDir, '..', 'node_modules', 'stockfish', 'bin');
  const gameService = createGameService();
  const server = createHttpServer({ gameService, publicDir, stockfishDir });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  server.listen(port, () => {
    console.log(`Chess AI server running at http://localhost:${port}`);
  });
  return server;
}

startServer();

