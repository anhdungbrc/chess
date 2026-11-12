import {
  classifyMove,
  evalToWinPercent,
  parseUciInfoLine,
  summarizeGameAnalysis,
} from './analysisHelper.js';

const DEFAULT_ANALYSIS_DEPTH = 10;

/**
 * Creates a standardized AbortError instance compatible with browser and Node.js runtimes.
 *
 * @returns {Error} Error named 'AbortError'.
 */
function createAbortError() {
  const err = new Error('Game analysis was cancelled');
  err.name = 'AbortError';
  return err;
}

/**
 * Creates a Stockfish Web Worker analyzer communicating via the UCI protocol.
 *
 * @param {{ scriptUrl: string, createWorker?: (url: string) => Worker, depth?: number }} options - Worker configuration.
 * @returns {{ analyzePosition: Function, analyzeGame: Function, dispose: Function }} Analyzer API.
 * @throws {Error} When scriptUrl is missing or blank.
 */
export function createStockfishAnalyzer({
  scriptUrl,
  createWorker = (url) => new Worker(url),
  depth = DEFAULT_ANALYSIS_DEPTH,
}) {
  if (typeof scriptUrl !== 'string' || !scriptUrl.trim()) {
    throw new Error('Stockfish scriptUrl is required');
  }

  let worker = null;
  let readyPromise = null;
  let activeLineHandler = null;
  let activeErrorHandler = null;

  /**
   * Terminates the active Stockfish Web Worker and resets initialization state.
   *
   * @returns {void}
   */
  function dispose() {
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      worker = null;
    }
    readyPromise = null;
    activeLineHandler = null;
    activeErrorHandler = null;
  }

  /**
   * Ensures the Web Worker is spawned and has completed the `uci` / `isready` handshake.
   *
   * @param {AbortSignal | undefined} signal - Optional cancellation signal.
   * @returns {Promise<Worker>} Ready worker instance.
   */
  function ensureReady(signal) {
    if (signal?.aborted) {
      dispose();
      return Promise.reject(createAbortError());
    }
    if (readyPromise) {
      return readyPromise;
    }

    worker = createWorker(scriptUrl);
    worker.onmessage = (event) => {
      const text = typeof event?.data === 'string' ? event.data : String(event?.data ?? '');
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) {
          activeLineHandler?.(trimmed);
        }
      }
    };
    worker.onerror = (err) => {
      activeErrorHandler?.(new Error(err?.message || 'Stockfish worker error'));
    };

    readyPromise = new Promise((resolve, reject) => {
      let sawUciOk = false;

      const onAbort = () => {
        cleanup();
        dispose();
        reject(createAbortError());
      };

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
        activeLineHandler = null;
        activeErrorHandler = null;
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      activeErrorHandler = (err) => {
        cleanup();
        dispose();
        reject(err);
      };

      activeLineHandler = (line) => {
        if (line === 'uciok') {
          sawUciOk = true;
          worker.postMessage('isready');
        } else if (line === 'readyok' && sawUciOk) {
          cleanup();
          resolve(worker);
        }
      };

      worker.postMessage('uci');
    });

    return readyPromise;
  }

  /**
   * Evaluates a single FEN position at the requested search depth.
   *
   * @param {string} fen - Valid FEN position string.
   * @param {{ depth?: number, signal?: AbortSignal }} [options] - Search depth and abort signal.
   * @returns {Promise<{ eval: { cp: number | null, mate: number | null }, bestMoveUci: string | null, pv: string[], depth: number }>} Evaluation snapshot.
   */
  async function analyzePosition(fen, options = {}) {
    const targetDepth = options.depth ?? depth;
    const signal = options.signal;
    const activeWorker = await ensureReady(signal);
    if (signal?.aborted) {
      dispose();
      throw createAbortError();
    }

    const turnColor = fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';

    return new Promise((resolve, reject) => {
      let latestInfo = null;

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
        activeLineHandler = null;
        activeErrorHandler = null;
      };

      const onAbort = () => {
        cleanup();
        dispose();
        reject(createAbortError());
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      activeErrorHandler = (err) => {
        cleanup();
        dispose();
        reject(err);
      };

      activeLineHandler = (line) => {
        if (line.startsWith('info ')) {
          const parsed = parseUciInfoLine(line, turnColor);
          if (parsed && (!latestInfo || parsed.depth >= latestInfo.depth)) {
            latestInfo = parsed;
          }
          return;
        }

        if (line.startsWith('bestmove ')) {
          const rawBest = line.slice('bestmove '.length).trim().split(/\s+/)[0];
          const bestMoveUci = rawBest && rawBest !== '(none)' ? rawBest : latestInfo?.bestMoveUci ?? null;
          cleanup();
          resolve({
            eval: latestInfo
              ? { cp: latestInfo.cp, mate: latestInfo.mate }
              : { cp: null, mate: null },
            bestMoveUci,
            pv: latestInfo?.pv ?? [],
            depth: latestInfo?.depth ?? 0,
          });
        }
      };

      activeWorker.postMessage(`position fen ${fen}`);
      activeWorker.postMessage(`go depth ${targetDepth}`);
    });
  }

  /**
   * Analyzes an entire game's move history sequentially and computes classifications and accuracy metrics.
   *
   * @param {{ initialFen: string, status?: string, history: Array<{ color: 'w' | 'b', from: string, to: string, promotion?: string, san: string, fen: string }> }} game - Game snapshot.
   * @param {{ depth?: number, onProgress?: (progress: { completed: number, total: number }) => void, signal?: AbortSignal }} [options] - Analysis options.
   * @returns {Promise<{ depth: number, positions: Array<object>, moves: Array<object>, summary: object }>} Complete game review report.
   */
  async function analyzeGame(game, options = {}) {
    const history = game?.history ?? [];
    const targetDepth = options.depth ?? depth;
    const totalPositions = history.length + 1;
    const fens = [game.initialFen, ...history.map((move) => move.fen)];
    const positions = [];

    for (let ply = 0; ply < totalPositions; ply += 1) {
      if (options.signal?.aborted) {
        dispose();
        throw createAbortError();
      }

      const result = await analyzePosition(fens[ply], {
        depth: targetDepth,
        signal: options.signal,
      });

      // Terminal positions emit `bestmove (none)` without a score line; infer 100%/0% on checkmate or 50% on draw.
      let resolvedEval = result.eval;
      if (resolvedEval.cp === null && resolvedEval.mate === null) {
        const lastMove = ply > 0 ? history[ply - 1] : null;
        if (lastMove?.san?.endsWith('#') || (ply === totalPositions - 1 && game.status === 'checkmate')) {
          resolvedEval = { cp: null, mate: lastMove?.color === 'w' ? 1 : -1 };
        } else {
          resolvedEval = { cp: 0, mate: null };
        }
      }

      positions.push({
        ply,
        eval: resolvedEval,
        bestMoveUci: result.bestMoveUci,
        pv: result.pv,
        winPercent: evalToWinPercent(resolvedEval),
      });

      options.onProgress?.({ completed: ply + 1, total: totalPositions });
    }

    const moves = history.map((move, index) => {
      const prevPos = positions[index];
      const nextPos = positions[index + 1];
      const playedUci = `${move.from}${move.to}${move.promotion ?? ''}`;
      const graded = classifyMove({
        prevEval: prevPos.eval,
        nextEval: nextPos.eval,
        moverColor: move.color,
        playedUci,
        bestMoveUci: prevPos.bestMoveUci,
        isCheckmate: Boolean(move.san?.endsWith('#')),
      });

      return {
        ply: index + 1,
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        playedUci,
        bestMoveUci: prevPos.bestMoveUci,
        evalBefore: prevPos.eval,
        evalAfter: nextPos.eval,
        ...graded,
      };
    });

    return {
      depth: targetDepth,
      positions,
      moves,
      summary: summarizeGameAnalysis(moves),
    };
  }

  return {
    analyzePosition,
    analyzeGame,
    dispose,
  };
}

