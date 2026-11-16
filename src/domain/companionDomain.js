import { validateFen } from 'chess.js';

const VALID_ORIENTATIONS = new Set(['white', 'black']);
const SQUARE_REGEX = /^[a-h][1-8]$/;

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

