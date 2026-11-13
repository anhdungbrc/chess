import test from 'node:test';
import assert from 'node:assert/strict';
import { createStockfishAnalyzer } from '../public/stockfishClient.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Creates a deterministic in-memory mock Web Worker implementing the Stockfish UCI handshake and scripted position responses.
 *
 * @param {Record<string, { scoreLine?: string, bestmove: string }>} responsesByFen - Scripted UCI responses keyed by FEN.
 * @param {{ onTerminate?: () => void, delayMs?: number }} [options] - Optional termination spy and async delay.
 * @returns {{ worker: object, commands: string[] }} Mock worker instance and command log.
 */
function createMockStockfishWorker(responsesByFen, options = {}) {
  const commands = [];
  let currentFen = START_FEN;
  let listener = null;
  let isTerminated = false;

  const emit = (message) => {
    if (isTerminated) {
      return;
    }
    const event = { data: message };
    listener?.(event);
  };

  const schedule = (fn) => {
    setTimeout(() => {
      if (!isTerminated) {
        fn();
      }
    }, options.delayMs ?? 0);
  };

  const worker = {
    set onmessage(fn) {
      listener = fn;
    },
    get onmessage() {
      return listener;
    },
    onerror: null,
    postMessage(cmd) {
      commands.push(cmd);
      if (cmd === 'uci') {
        schedule(() => emit('uciok'));
        return;
      }
      if (cmd === 'isready') {
        schedule(() => emit('readyok'));
        return;
      }
      if (cmd.startsWith('position fen ')) {
        currentFen = cmd.slice('position fen '.length);
        return;
      }
      if (cmd.startsWith('go ')) {
        const entry = responsesByFen[currentFen] ?? {
          scoreLine: 'info depth 10 score cp 0 pv a2a3',
          bestmove: 'bestmove a2a3',
        };
        schedule(() => {
          if (entry.scoreLine) {
            emit(entry.scoreLine);
          }
          emit(entry.bestmove);
        });
      }
    },
    terminate() {
      isTerminated = true;
      options.onTerminate?.();
    },
  };

  return { worker, commands };
}

/**
 * Verifies analyzeGame evaluates initialFen and each history ply, normalizes evaluations, classifies moves, and reports progress.
 * Expected: returns N+1 positions, N classified moves with bestMoveUci, accurate summary, and sequential progress callbacks.
 */
async function testAnalyzeGameProducesFullReportAndProgress() {
  const fenAfterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  const fenAfterG5 = 'rnbqkbnr/pppppp1p/8/6p1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const fenMate = 'rnb1kbnr/pppppp1p/8/6pQ/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2';

  const { worker } = createMockStockfishWorker({
    [START_FEN]: {
      scoreLine: 'info depth 10 score cp 20 pv e2e4 e7e5',
      bestmove: 'bestmove e2e4',
    },
    [fenAfterE4]: {
      scoreLine: 'info depth 10 score cp -20 pv e7e5 g1f3',
      bestmove: 'bestmove e7e5',
    },
    [fenAfterG5]: {
      scoreLine: 'info depth 10 score mate 1 pv d1h5',
      bestmove: 'bestmove d1h5',
    },
    [fenMate]: {
      bestmove: 'bestmove (none)',
    },
  });

  const analyzer = createStockfishAnalyzer({
    scriptUrl: '/vendor/stockfish/mock.js',
    createWorker: () => worker,
    depth: 10,
  });

  const progressUpdates = [];
  const report = await analyzer.analyzeGame(
    {
      initialFen: START_FEN,
      status: 'checkmate',
      history: [
        { color: 'w', from: 'e2', to: 'e4', san: 'e4', fen: fenAfterE4 },
        { color: 'b', from: 'g7', to: 'g5', san: 'g5', fen: fenAfterG5 },
        { color: 'w', from: 'd1', to: 'h5', san: 'Qh5#', fen: fenMate },
      ],
    },
    {
      onProgress: (info) => progressUpdates.push({ completed: info.completed, total: info.total }),
    }
  );

  assert.equal(report.positions.length, 4);
  assert.equal(report.moves.length, 3);
  assert.deepEqual(progressUpdates, [
    { completed: 1, total: 4 },
    { completed: 2, total: 4 },
    { completed: 3, total: 4 },
    { completed: 4, total: 4 },
  ]);

  assert.equal(report.moves[0].classification, 'best');
  assert.equal(report.moves[1].classification, 'blunder');
  assert.equal(report.moves[1].bestMoveUci, 'e7e5');
  assert.equal(report.moves[2].classification, 'best');
  assert.equal(report.positions[3].winPercent, 100);
  assert.equal(report.summary.whiteAccuracy, 100);
  assert.ok(report.summary.blackAccuracy < 10);

  analyzer.dispose();
}

/**
 * Verifies aborting an active analysis via AbortSignal rejects with AbortError and terminates the underlying worker.
 * Expected: analyzeGame rejects with AbortError and worker.terminate() is called.
 */
async function testAnalyzeGameAbortTerminatesWorker() {
  let terminated = false;
  const { worker } = createMockStockfishWorker({}, { delayMs: 25, onTerminate: () => (terminated = true) });

  const analyzer = createStockfishAnalyzer({
    scriptUrl: '/vendor/stockfish/mock.js',
    createWorker: () => worker,
  });

  const controller = new AbortController();
  const promise = analyzer.analyzeGame(
    {
      initialFen: START_FEN,
      status: 'playing',
      history: [
        {
          color: 'w',
          from: 'e2',
          to: 'e4',
          san: 'e4',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        },
      ],
    },
    { signal: controller.signal }
  );

  setTimeout(() => controller.abort(), 5);
  await assert.rejects(promise, (err) => err?.name === 'AbortError');
  assert.equal(terminated, true);
}

/**
 * Verifies createStockfishAnalyzer throws a descriptive error when scriptUrl is missing.
 * Expected: throws Error mentioning Stockfish scriptUrl.
 */
function testRequiresScriptUrl() {
  assert.throws(() => createStockfishAnalyzer({ scriptUrl: '' }), /scriptUrl/i);
}

test('analyzeGame evaluates full game, classifies moves, and reports progress', testAnalyzeGameProducesFullReportAndProgress);
test('analyzeGame aborts cleanly and terminates worker on AbortSignal', testAnalyzeGameAbortTerminatesWorker);
test('createStockfishAnalyzer validates required scriptUrl', testRequiresScriptUrl);


/**
 * Verifies analyzePosition with multiPv=2 configures the engine and returns the runner-up evaluation.
 * Expected: MultiPV option is sent once before search, primary eval comes from rank 1, secondBestEval from rank 2 (White perspective).
 */
async function testAnalyzePositionMultiPv() {
  const { worker, commands } = createMockStockfishWorker({
    [START_FEN]: {
      scoreLine:
        'info depth 10 multipv 1 score cp 80 pv e2e4\ninfo depth 10 multipv 2 score cp 20 pv d2d4',
      bestmove: 'bestmove e2e4',
    },
  });
  const analyzer = createStockfishAnalyzer({ scriptUrl: '/sf.js', createWorker: () => worker });
  const result = await analyzer.analyzePosition(START_FEN, { depth: 10, multiPv: 2 });
  assert.deepEqual(result.eval, { cp: 80, mate: null });
  assert.deepEqual(result.secondBestEval, { cp: 20, mate: null });
  assert.ok(commands.includes('setoption name MultiPV value 2'));
  analyzer.dispose();

  const plain = createMockStockfishWorker({});
  const plainAnalyzer = createStockfishAnalyzer({ scriptUrl: '/sf.js', createWorker: () => plain.worker });
  const plainResult = await plainAnalyzer.analyzePosition(START_FEN, { depth: 10 });
  assert.equal(plainResult.secondBestEval, null);
  assert.ok(!plain.commands.some((c) => c.startsWith('setoption')));
  plainAnalyzer.dispose();
}

test('analyzePosition supports MultiPV runner-up evaluation', testAnalyzePositionMultiPv);
