const BOT_PROFILES = Object.freeze([
  Object.freeze({
    id: 'martin',
    name: 'Martin',
    rating: 250,
    difficulty: 'easy',
    tagline: 'Friendly beginner who plays casual, forgiving moves.',
    avatarId: 'martin',
  }),
  Object.freeze({
    id: 'elani',
    name: 'Elani',
    rating: 800,
    difficulty: 'medium',
    tagline: 'Club player who spots basic tactics and avoids hanging pieces.',
    avatarId: 'elani',
  }),
  Object.freeze({
    id: 'antonio',
    name: 'Antonio',
    rating: 1500,
    difficulty: 'hard',
    tagline: 'Calculating master looking for tactical combos and checkmates.',
    avatarId: 'antonio',
  }),
]);

const DIFFICULTY_DEFAULT_BOT = Object.freeze({
  easy: 'martin',
  medium: 'elani',
  hard: 'antonio',
});

/**
 * Returns the catalog of Chess.com-style bot personas available to play against.
 *
 * @returns {ReadonlyArray<{ id: string, name: string, rating: number, difficulty: 'easy' | 'medium' | 'hard', tagline: string, avatarId: string }>} Read-only list of bot profiles.
 */
export function listBotProfiles() {
  return BOT_PROFILES;
}

/**
 * Finds a bot profile by its unique identifier or returns null when absent.
 *
 * @param {string} botId - Bot identifier such as 'martin', 'elani', or 'antonio'.
 * @returns {{ id: string, name: string, rating: number, difficulty: 'easy' | 'medium' | 'hard', tagline: string, avatarId: string } | null} Matching bot profile or null.
 */
export function findBotProfile(botId) {
  if (typeof botId !== 'string') {
    return null;
  }
  return BOT_PROFILES.find((bot) => bot.id === botId) ?? null;
}

/**
 * Resolves a bot persona and AI engine difficulty from explicit botId or legacy difficulty fallback.
 *
 * @param {{ botId?: string, difficulty?: 'easy' | 'medium' | 'hard' }} [selection] - Requested bot or difficulty.
 * @returns {{ bot: { id: string, name: string, rating: number, difficulty: 'easy' | 'medium' | 'hard', tagline: string, avatarId: string }, difficulty: 'easy' | 'medium' | 'hard' }} Resolved bot and engine difficulty.
 * @throws {Error} When botId or difficulty is unknown.
 */
export function resolveBotSelection({ botId, difficulty } = {}) {
  if (botId !== undefined) {
    const bot = findBotProfile(botId);
    if (!bot) {
      throw new Error(`Unsupported bot profile: ${botId}`);
    }
    return { bot, difficulty: bot.difficulty };
  }

  // Default to medium/Elani and preserve legacy { difficulty } callers without requiring botId.
  const effectiveDifficulty = difficulty ?? 'medium';
  const mappedBotId = DIFFICULTY_DEFAULT_BOT[effectiveDifficulty];
  if (!mappedBotId) {
    throw new Error(`Unsupported AI difficulty: ${effectiveDifficulty}`);
  }
  const bot = findBotProfile(mappedBotId);
  return { bot, difficulty: effectiveDifficulty };
}

