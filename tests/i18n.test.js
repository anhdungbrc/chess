import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  getLanguage,
  initI18n,
  setLanguage,
  t,
} from '../public/i18n.js';

/**
 * Creates an in-memory storage mock conforming to the Web Storage API (localStorage).
 *
 * @param {Record<string, string>} [initialState] - Initial key-value storage entries.
 * @returns {Storage} In-memory mock storage object.
 */
function createStorageMock(initialState = {}) {
  const store = new Map(Object.entries(initialState));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
  };
}

/**
 * Verifies that the default language is Vietnamese ('vi') and supported languages include 'vi' and 'en'.
 * Expected: DEFAULT_LANGUAGE === 'vi', SUPPORTED_LANGUAGES contains 'vi' and 'en'.
 */
test('default language is Vietnamese and supported languages are vi and en', () => {
  assert.equal(DEFAULT_LANGUAGE, 'vi');
  assert.deepEqual(SUPPORTED_LANGUAGES, ['vi', 'en']);
});

/**
 * Verifies initI18n falls back to Vietnamese when storage is empty or contains an invalid language code.
 * Expected: empty storage yields 'vi'; invalid code yields 'vi'; valid code 'en' is preserved.
 */
test('initI18n initializes language from storage with safe fallback to vi', () => {
  const emptyStorage = createStorageMock();
  assert.equal(initI18n(emptyStorage), 'vi');
  assert.equal(getLanguage(), 'vi');

  const invalidStorage = createStorageMock({ chess_language: 'fr' });
  assert.equal(initI18n(invalidStorage), 'vi');
  assert.equal(getLanguage(), 'vi');

  const enStorage = createStorageMock({ chess_language: 'en' });
  assert.equal(initI18n(enStorage), 'en');
  assert.equal(getLanguage(), 'en');

  // Reset back to default vi for subsequent tests.
  setLanguage('vi', emptyStorage);
});

/**
 * Verifies setLanguage switches the active language and persists the choice to storage.
 * Expected: setLanguage('en') changes getLanguage() to 'en' and updates storage.
 */
test('setLanguage updates active language and persists to storage', () => {
  const storage = createStorageMock();
  initI18n(storage);
  assert.equal(getLanguage(), 'vi');

  const updated = setLanguage('en', storage);
  assert.equal(updated, 'en');
  assert.equal(getLanguage(), 'en');
  assert.equal(storage.getItem('chess_language'), 'en');

  // Reject unsupported language code and keep existing active language.
  const rejected = setLanguage('invalid_lang', storage);
  assert.equal(rejected, 'en');
  assert.equal(getLanguage(), 'en');

  // Switch back to vi.
  setLanguage('vi', storage);
  assert.equal(getLanguage(), 'vi');
  assert.equal(storage.getItem('chess_language'), 'vi');
});

/**
 * Verifies t() translates basic UI keys correctly in both Vietnamese and English.
 * Expected: key lookup matches expected translation string for active language.
 */
test('t() translates UI strings accurately for active language', () => {
  const storage = createStorageMock();
  initI18n(storage);
  setLanguage('vi', storage);

  assert.equal(t('nav.play'), 'Chơi');
  assert.equal(t('nav.bots'), 'Chọn Bot');
  assert.equal(t('nav.settings'), 'Cài đặt');
  assert.equal(t('modal.settings.title'), 'Cài đặt');
  assert.equal(t('modal.settings.language'), 'Ngôn ngữ');
  assert.equal(t('modal.settings.sound'), 'Âm thanh');

  setLanguage('en', storage);
  assert.equal(t('nav.play'), 'Play');
  assert.equal(t('nav.bots'), 'Bots');
  assert.equal(t('nav.settings'), 'Settings');
  assert.equal(t('modal.settings.title'), 'Settings');
  assert.equal(t('modal.settings.language'), 'Language');
  assert.equal(t('modal.settings.sound'), 'Sound');

  // Reset to vi.
  setLanguage('vi', storage);
});

/**
 * Verifies t() interpolates template parameters properly.
 * Expected: placeholder {name} is replaced by the supplied value.
 */
test('t() interpolates placeholder parameters into translated strings', () => {
  const storage = createStorageMock();
  initI18n(storage);

  setLanguage('vi', storage);
  assert.equal(t('status.botThinking', { name: 'Martin' }), 'Martin đang suy nghĩ...');
  assert.equal(t('gameover.winnerWon', { name: 'Martin' }), 'Martin đã thắng');

  setLanguage('en', storage);
  assert.equal(t('status.botThinking', { name: 'Martin' }), 'Martin is thinking...');
  assert.equal(t('gameover.winnerWon', { name: 'Martin' }), 'Martin Won');

  setLanguage('vi', storage);
});

/**
 * Verifies t() falls back to key when translation is missing or language is unknown.
 * Expected: missing key returns the raw key.
 */
test('t() returns raw key when translation is missing', () => {
  const storage = createStorageMock();
  initI18n(storage);

  assert.equal(t('nonexistent.key.test'), 'nonexistent.key.test');
});

/**
 * Verifies parity between Vietnamese and English translation dictionaries.
 * Expected: all keys present in 'vi' exist in 'en', and vice versa.
 */
test('translation dictionaries have matching keys between vi and en', () => {
  const viKeys = Object.keys(TRANSLATIONS.vi).sort();
  const enKeys = Object.keys(TRANSLATIONS.en).sort();

  const missingInEn = viKeys.filter((k) => !(k in TRANSLATIONS.en));
  const missingInVi = enKeys.filter((k) => !(k in TRANSLATIONS.vi));

  assert.deepEqual(missingInEn, [], `Keys missing in English: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInVi, [], `Keys missing in Vietnamese: ${missingInVi.join(', ')}`);
});

