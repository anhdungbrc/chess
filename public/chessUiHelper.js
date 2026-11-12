const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const CAPTURE_SORT_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
const PIECE_POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const LOW_TIME_THRESHOLD_MS = 20 * 1000;

/**
 * Formats a remaining clock budget in milliseconds using Chess.com display rules.
 * Shows tenths of a second below 20 seconds and mm:ss at or above 20 seconds.
 *
 * @param {number} ms - Remaining clock time in milliseconds.
 * @returns {string} Formatted clock text such as '10:00' or '0:19.4'.
 */
export function formatClockMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00.0';
  }

  if (ms < LOW_TIME_THRESHOLD_MS) {
    const totalTenths = Math.floor(ms / 100);
    const seconds = Math.floor(totalTenths / 10);
    const tenth = totalTenths % 10;
    return `0:${String(seconds).padStart(2, '0')}.${tenth}`;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Computes captured pieces and net material advantage up to a target ply index.
 *
 * @param {Array<{ color: 'w' | 'b', captured?: string, promotion?: string }>} history - Full game move history.
 * @param {number} [plyCount] - Number of plies to include (defaults to full history length).
 * @returns {{
 *   capturedByWhite: string[],
 *   capturedByBlack: string[],
 *   advantageSide: 'w' | 'b' | null,
 *   advantagePoints: number,
 * }} Sorted captured pieces per side and material advantage summary.
 */
export function computeCapturedMaterial(history, plyCount) {
  const safeHistory = Array.isArray(history) ? history : [];
  const limit =
    typeof plyCount === 'number' && Number.isFinite(plyCount)
      ? Math.max(0, Math.min(safeHistory.length, Math.trunc(plyCount)))
      : safeHistory.length;

  const capturedByWhite = [];
  const capturedByBlack = [];
  let whiteMaterialDelta = 0;
  let blackMaterialDelta = 0;

  for (let i = 0; i < limit; i += 1) {
    const move = safeHistory[i];
    if (!move) {
      continue;
    }

    if (move.captured) {
      const capturedValue = PIECE_POINTS[move.captured] ?? 0;
      if (move.color === 'w') {
        capturedByWhite.push(move.captured);
        whiteMaterialDelta += capturedValue;
      } else {
        capturedByBlack.push(move.captured);
        blackMaterialDelta += capturedValue;
      }
    }

    // Account for promoted piece value minus the sacrificed pawn so +N matches board material.
    if (move.promotion) {
      const promoNet = (PIECE_POINTS[move.promotion] ?? 0) - PIECE_POINTS.p;
      if (move.color === 'w') {
        whiteMaterialDelta += promoNet;
      } else {
        blackMaterialDelta += promoNet;
      }
    }
  }

  const sortCaptures = (a, b) => (CAPTURE_SORT_ORDER[a] ?? 9) - (CAPTURE_SORT_ORDER[b] ?? 9);
  capturedByWhite.sort(sortCaptures);
  capturedByBlack.sort(sortCaptures);

  const diff = whiteMaterialDelta - blackMaterialDelta;
  return {
    capturedByWhite,
    capturedByBlack,
    advantageSide: diff > 0 ? 'w' : diff < 0 ? 'b' : null,
    advantagePoints: Math.abs(diff),
  };
}

/**
 * Maps viewport pointer coordinates onto an algebraic board square for the active orientation.
 *
 * @param {number} clientX - Pointer X coordinate in viewport space.
 * @param {number} clientY - Pointer Y coordinate in viewport space.
 * @param {{ left: number, top: number, width: number, height: number }} rect - Board element bounds.
 * @param {boolean} isFlipped - True when viewed from Black's perspective.
 * @returns {string | null} Algebraic square ('a1'..'h8') or null if outside board bounds.
 */
export function resolveSquareFromPoint(clientX, clientY, rect, isFlipped) {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) {
    return null;
  }

  const visualCol = Math.min(7, Math.floor((relX / rect.width) * 8));
  const visualRow = Math.min(7, Math.floor((relY / rect.height) * 8));
  const col = isFlipped ? 7 - visualCol : visualCol;
  const row = isFlipped ? 7 - visualRow : visualRow;

  return `${FILES[col]}${8 - row}`;
}

/**
 * Resolves the active viewer's piece color ('w' or 'b') for bot or friend snapshots, or null for spectators.
 *
 * @param {object | null} game - Game snapshot returned by backend API or SSE stream.
 * @param {'p1' | 'p2' | null} viewerSlot - Authenticated slot assigned to this browser tab.
 * @returns {'w' | 'b' | null} Controlled piece color or null when spectating.
 */
export function resolveViewerColor(game, viewerSlot) {
  if (!game) {
    return null;
  }
  if (game.mode !== 'friend') {
    return game.playerColor ?? null;
  }
  if (!viewerSlot || !game.players) {
    return null;
  }
  if (game.players.w?.slot === viewerSlot) {
    return 'w';
  }
  if (game.players.b?.slot === viewerSlot) {
    return 'b';
  }
  return null;
}

/**
 * Builds a shareable invite URL for a friend match from window origin and gameId.
 *
 * @param {string} origin - Browser window origin (e.g. 'http://localhost:3000').
 * @param {string} gameId - Friend room identifier.
 * @returns {string} Shareable URL containing the game query parameter.
 */
export function resolveInviteUrl(origin, gameId) {
  const cleanOrigin = String(origin ?? '').replace(/\/+$/, '');
  return `${cleanOrigin}/?game=${encodeURIComponent(gameId)}`;
}

/**
 * Determines whether the current viewer can select and move pieces on the board.
 *
 * @param {object | null} game - Current game snapshot.
 * @param {'w' | 'b' | null} viewerColor - Piece color controlled by this viewer.
 * @param {boolean} isReviewing - True when browsing historical plies.
 * @returns {boolean} True only on the viewer's live active turn.
 */
export function canInteractWithBoard(game, viewerColor, isReviewing) {
  if (!game || isReviewing || !viewerColor) {
    return false;
  }
  return game.status === 'playing' && game.turn === viewerColor;
}

