import { validateFen } from 'chess.js';

const VALID_ORIENTATIONS = new Set(['white', 'black']);
const SQUARE_REGEX = /^[a-h][1-8]$/;
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const DEFAULT_AUTO_MOVE_DELAY_MS = 600;
export const MIN_RANDOM_AUTO_MOVE_DELAY_MS = 3000;
export const MAX_RANDOM_AUTO_MOVE_DELAY_MS = 10000;
export const MAX_AUTO_MOVE_DELAY_MS = 30000;

/**
 * Domain error indicating invalid companion data payload or FEN string.
 */
export class CompanionValidationError extends Error {
  /**
   * Creates a CompanionValidationError instance.
   *
   * @param {string} message - Validation error description.
   */
  constructor(message) {
    super(message);
    this.name = 'CompanionValidationError';
  }
}

/**
 * Validates and normalizes lastMove coordinate pair.
 *
 * @param {unknown} rawMove - Candidate move coordinates object.
 * @returns {{ from: string, to: string } | null} Validated move pair or null.
 * @throws {CompanionValidationError} When coordinates are not valid algebraic squares.
 */
export function normalizeLastMove(rawMove) {
  if (!rawMove || typeof rawMove !== 'object') {
    return null;
  }

  const { from, to } = /** @type {{ from?: unknown, to?: unknown }} */ (rawMove);
  if (typeof from !== 'string' || !SQUARE_REGEX.test(from.trim().toLowerCase())) {
    throw new CompanionValidationError(
      `lastMove.from must be a valid algebraic square (a1-h8), got: ${String(from)}`
    );
  }
  if (typeof to !== 'string' || !SQUARE_REGEX.test(to.trim().toLowerCase())) {
    throw new CompanionValidationError(
      `lastMove.to must be a valid algebraic square (a1-h8), got: ${String(to)}`
    );
  }

  // Canonical lowercase coordinate pair
  return {
    from: from.trim().toLowerCase(),
    to: to.trim().toLowerCase(),
  };
}

/**
 * Parses and normalizes incoming companion snapshot from Chess.com.
 *
 * @param {unknown} input - Raw snapshot payload.
 * @returns {{
 *   fen: string,
 *   orientation: 'white' | 'black',
 *   turn: 'w' | 'b',
 *   lastMove: { from: string, to: string } | null,
 *   timestamp: number,
 * }} Normalized companion snapshot.
 * @throws {CompanionValidationError} When payload or FEN fails validation.
 */
export function parseCompanionSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CompanionValidationError('Companion snapshot must be a JSON object');
  }

  const { fen, orientation, lastMove, timestamp } = /** @type {Record<string, unknown>} */ (input);

  if (typeof fen !== 'string' || !fen.trim()) {
    throw new CompanionValidationError('fen is required and must be a non-empty string');
  }

  const trimmedFen = fen.trim();
  const validation = validateFen(trimmedFen);
  if (!validation.ok) {
    throw new CompanionValidationError(`Invalid FEN string: ${validation.error}`);
  }

  // Determine active turn directly from the 2nd FEN component ('w' or 'b')
  const fenParts = trimmedFen.split(/\s+/);
  const turn = fenParts[1] === 'b' ? 'b' : 'w';

  // Orientation defaults to 'white' if not provided
  let normalizedOrientation = 'white';
  if (orientation !== undefined && orientation !== null) {
    if (typeof orientation !== 'string' || !VALID_ORIENTATIONS.has(orientation.toLowerCase())) {
      throw new CompanionValidationError("orientation must be either 'white' or 'black'");
    }
    normalizedOrientation = /** @type {'white' | 'black'} */ (orientation.toLowerCase());
  }

  const normalizedMove = normalizeLastMove(lastMove);

  const safeTimestamp =
    typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
      ? Math.trunc(timestamp)
      : Date.now();

  return {
    fen: trimmedFen,
    orientation: /** @type {'white' | 'black'} */ (normalizedOrientation),
    turn,
    lastMove: normalizedMove,
    timestamp: safeTimestamp,
  };
}

/**
 * Validates and normalizes an auto-move command payload dispatched to Chess.com.
 *
 * @param {unknown} input - Raw command payload object.
 * @returns {{
 *   moveUci: string,
 *   fen: string | null,
 *   delayMs: number,
 *   enabled: boolean,
 *   timestamp: number,
 * }} Normalized auto-move command.
 * @throws {CompanionValidationError} When payload is missing or moveUci is not valid UCI coordinate.
 */
export function parseAutoMoveCommand(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CompanionValidationError('Auto-move command payload must be a JSON object');
  }

  const { moveUci, fen, delayMs, enabled, timestamp } = /** @type {Record<string, unknown>} */ (input);

  if (typeof moveUci !== 'string' || !moveUci.trim()) {
    throw new CompanionValidationError('moveUci is required and must be a non-empty string');
  }

  const normalizedUci = moveUci.trim().toLowerCase();
  if (!UCI_MOVE_REGEX.test(normalizedUci)) {
    throw new CompanionValidationError(
      `moveUci must be a valid UCI move (e.g. e2e4, e7e8q), got: ${String(moveUci)}`
    );
  }

  let normalizedFen = null;
  if (fen !== undefined && fen !== null) {
    if (typeof fen !== 'string' || !fen.trim()) {
      throw new CompanionValidationError('fen must be a non-empty string when provided');
    }
    const trimmedFen = fen.trim();
    const validation = validateFen(trimmedFen);
    if (!validation.ok) {
      throw new CompanionValidationError(`Invalid FEN string for auto-move: ${validation.error}`);
    }
    normalizedFen = trimmedFen;
  }

  // Delay clamped within safe bounds [0, 10000ms] to avoid runaway timers
  let normalizedDelayMs = DEFAULT_AUTO_MOVE_DELAY_MS;
  if (delayMs !== undefined && delayMs !== null) {
    if (typeof delayMs !== 'number' || !Number.isFinite(delayMs) || delayMs < 0) {
      throw new CompanionValidationError('delayMs must be a non-negative number');
    }
    normalizedDelayMs = Math.min(MAX_AUTO_MOVE_DELAY_MS, Math.trunc(delayMs));
  }

  const isEnabled = typeof enabled === 'boolean' ? enabled : true;
  const safeTimestamp =
    typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
      ? Math.trunc(timestamp)
      : Date.now();

  return {
    moveUci: normalizedUci,
    fen: normalizedFen,
    delayMs: normalizedDelayMs,
    enabled: isEnabled,
    timestamp: safeTimestamp,
  };
}

