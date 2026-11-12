import { findBotProfile } from '../domain/botProfiles.js';
import { findTimeControl } from '../domain/timeControls.js';

const VALID_MODES = new Set(['bot', 'friend']);
const VALID_COLORS = new Set(['w', 'b']);
const VALID_FRIEND_COLORS = new Set(['w', 'b', 'random']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const VALID_PROMOTIONS = new Set(['q', 'r', 'b', 'n']);
const VALID_DRAW_ACTIONS = new Set(['offer', 'accept', 'decline']);
const VALID_REQUEST_ACTIONS = new Set(['request', 'accept', 'decline']);
const SQUARE_REGEX = /^[a-h][1-8]$/;
const MAX_PLAYER_NAME_LENGTH = 24;

/**
 * Error thrown when incoming HTTP request data fails boundary validation.
 */
export class ValidationError extends Error {
  /**
   * Creates a ValidationError instance.
   *
   * @param {string} message - Human-readable validation failure reason.
   */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and trims an optional display name field for friend games.
 *
 * @param {unknown} rawName - Candidate display name from request body.
 * @returns {string | undefined} Trimmed non-empty name or undefined when omitted/blank.
 * @throws {ValidationError} When rawName is non-string or exceeds max length.
 */
function normalizeOptionalPlayerName(rawName) {
  if (rawName === undefined || rawName === null) {
    return undefined;
  }
  if (typeof rawName !== 'string') {
    throw new ValidationError('playerName must be a string');
  }
  const trimmed = rawName.trim();
  if (trimmed.length > MAX_PLAYER_NAME_LENGTH) {
    throw new ValidationError(`playerName must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer`);
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validates and normalizes payload options for creating a new chess game.
 *
 * @param {unknown} payload - Parsed JSON request body.
 * @returns {{ mode: 'bot' | 'friend', playerColor: 'w' | 'b' | 'random', difficulty: 'easy' | 'medium' | 'hard', botId?: string, timeControl: string, playerName?: string }} Validated options.
 * @throws {ValidationError} When payload is not an object or contains invalid fields.
 */
export function validateCreateGameInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const mode = payload.mode ?? 'bot';
  if (!VALID_MODES.has(mode)) {
    throw new ValidationError("mode must be 'bot' or 'friend'");
  }

  const playerColor = payload.playerColor ?? 'w';
  const difficulty = payload.difficulty ?? 'medium';
  const botId = payload.botId;
  const timeControl = payload.timeControl ?? 'untimed';
  const playerName = normalizeOptionalPlayerName(payload.playerName);

  if (mode === 'bot' && !VALID_COLORS.has(playerColor)) {
    throw new ValidationError("playerColor must be 'w' or 'b'");
  }
  if (mode === 'friend' && !VALID_FRIEND_COLORS.has(playerColor)) {
    throw new ValidationError("playerColor must be 'w', 'b', or 'random'");
  }
  if (mode === 'bot') {
    if (payload.difficulty !== undefined && !VALID_DIFFICULTIES.has(difficulty)) {
      throw new ValidationError("difficulty must be 'easy', 'medium', or 'hard'");
    }
    if (botId !== undefined && !findBotProfile(botId)) {
      throw new ValidationError('botId must be a supported bot profile');
    }
  }
  if (!findTimeControl(timeControl)) {
    throw new ValidationError('timeControl must be a supported time control preset');
  }

  return {
    mode,
    playerColor,
    difficulty,
    ...(mode === 'bot' && botId !== undefined ? { botId } : {}),
    timeControl,
    ...(playerName !== undefined ? { playerName } : {}),
  };
}

/**
 * Validates and normalizes payload options for joining a friend chess game.
 *
 * @param {unknown} payload - Parsed JSON request body.
 * @returns {{ playerName?: string }} Validated join payload.
 * @throws {ValidationError} When payload is not an object or playerName is invalid.
 */
export function validateJoinGameInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const playerName = normalizeOptionalPlayerName(payload.playerName);
  return {
    ...(playerName !== undefined ? { playerName } : {}),
  };
}

/**
 * Validates and normalizes payload coordinates for a player move request.
 *
 * @param {unknown} payload - Parsed JSON request body.
 * @returns {{ from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n' }} Validated move input.
 * @throws {ValidationError} When square coordinates or promotion piece are invalid.
 */
export function validateMoveInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  const { from, to, promotion } = payload;
  if (typeof from !== 'string' || !SQUARE_REGEX.test(from)) {
    throw new ValidationError("from must be a valid algebraic square like 'e2'");
  }
  if (typeof to !== 'string' || !SQUARE_REGEX.test(to)) {
    throw new ValidationError("to must be a valid algebraic square like 'e4'");
  }
  if (promotion !== undefined && !VALID_PROMOTIONS.has(promotion)) {
    throw new ValidationError("promotion must be one of 'q', 'r', 'b', or 'n'");
  }

  return {
    from,
    to,
    ...(promotion !== undefined ? { promotion } : {}),
  };
}

/**
 * Validates a friend-game coordination action payload against a specific set of allowed action verbs.
 *
 * @param {unknown} payload - Parsed JSON request body.
 * @param {Set<string>} allowedActions - Permitted action strings for the endpoint.
 * @returns {{ action: string }} Validated action wrapper.
 * @throws {ValidationError} When payload is not an object or action is unsupported.
 */
function validateActionInput(payload, allowedActions) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const { action } = payload;
  if (typeof action !== 'string' || !allowedActions.has(action)) {
    throw new ValidationError(
      `action must be one of: ${Array.from(allowedActions).join(', ')}`
    );
  }
  return { action };
}

/**
 * Validates payload for friend draw offers and responses.
 *
 * @param {unknown} payload - Parsed JSON request body.
 * @returns {{ action: 'offer' | 'accept' | 'decline' }} Validated draw action.
 */
export function validateDrawActionInput(payload) {
  return validateActionInput(payload, VALID_DRAW_ACTIONS);
}

/**
 * Validates payload for friend takeback requests and responses.
 *
 * @param {unknown} payload - Parsed JSON request body.
 * @returns {{ action: 'request' | 'accept' | 'decline' }} Validated takeback action.
 */
export function validateTakebackActionInput(payload) {
  return validateActionInput(payload, VALID_REQUEST_ACTIONS);
}

/**
 * Validates payload for friend rematch requests and responses.
 *
 * @param {unknown} payload - Parsed JSON request body.
 * @returns {{ action: 'request' | 'accept' | 'decline' }} Validated rematch action.
 */
export function validateRematchActionInput(payload) {
  return validateActionInput(payload, VALID_REQUEST_ACTIONS);
}
