/**
 * Default fallback language when none is stored or recognized.
 */
export const DEFAULT_LANGUAGE = 'vi';

/**
 * Supported language codes.
 */
export const SUPPORTED_LANGUAGES = Object.freeze(['vi', 'en']);

/**
 * Storage key used to persist user language preference.
 */
export const STORAGE_KEY = 'chess_language';

/**
 * Complete translation dictionaries for Vietnamese (vi) and English (en).
 */
export const TRANSLATIONS = Object.freeze({
  vi: Object.freeze({
    'app.title': 'Chơi Cờ Vua với Máy — Phong cách Chess.com',
    'brand.tag': 'Chess.play',
    'nav.play': 'Chơi',
    'nav.bots': 'Chọn Bot',
    'nav.flip': 'Xoay bàn cờ',
    'nav.soundOn': 'Bật âm thanh',
    'nav.soundOff': 'Tắt âm thanh',
    'nav.fullscreen': 'Toàn màn hình',
    'nav.exitFullscreen': 'Thoát toàn màn hình',
    'nav.fullscreenTitle': 'Bật toàn màn hình (F)',
    'nav.exitFullscreenTitle': 'Thoát toàn màn hình (Esc)',
    'nav.settings': 'Cài đặt',
    'nav.toggleExpand': 'Mở rộng menu',
    'nav.toggleCollapse': 'Thu gọn menu',
    'player.you': 'Bạn',
    'player.opponent': 'Đối thủ',
    'board.label': 'Bàn cờ 8x8',
    'modal.promotion.title': 'Phong cấp tốt',
    'modal.promotion.cancel': 'Hủy',
    'modal.promotion.queen': 'Hậu',
    'modal.promotion.rook': 'Xe',
    'modal.promotion.bishop': 'Tượng',
    'modal.promotion.knight': 'Mã',
    'modal.gameover.title': 'Ván đấu kết thúc',
    'modal.gameover.close': 'Đóng kết quả ván đấu',
    'modal.gameover.review': 'Xem lại ván đấu',
    'modal.gameover.rematch': 'Đấu lại',
    'modal.gameover.newBot': 'Chọn Bot mới',
    'modal.settings.title': 'Cài đặt',
    'modal.settings.language': 'Ngôn ngữ',
    'modal.settings.sound': 'Âm thanh',
    'modal.settings.langVi': 'Tiếng Việt',
    'modal.settings.langEn': 'English',
    'modal.settings.close': 'Đóng',
    'tab.play': 'Chơi',
    'tab.setup': 'Ván mới',
    'status.starting': 'Đang bắt đầu ván đấu...',
    'status.live': 'Trực tiếp',
    'status.botReady': 'Sẵn sàng thi đấu!',
    'status.syncing': 'Đang đồng bộ ván đấu...',
    'status.botThinking': '{name} đang suy nghĩ...',
    'status.reviewing': 'Xem lại {label} ({ply}/{total}){check}',
    'status.startingPosition': 'Thế cờ ban đầu',
    'status.checkSuffix': ' (Chiếu)',
    'status.checkPrefix': 'Chiếu! ',
    'status.waitingFriend': 'Đang đợi bạn bè tham gia...',
    'status.openSeat': 'Còn chỗ trống — bấm Tham gia để đấu',
    'status.spectatingTurn': 'Khán giả • Lượt của {name} ({side})',
    'status.yourTurn': 'Lượt của bạn ({side})',
    'status.playerTurn': 'Lượt của {name} ({side})',
    'status.white': 'Trắng',
    'status.black': 'Đen',
    'gameover.youWon': 'Bạn đã thắng!',
    'gameover.winnerWon': '{name} đã thắng',
    'gameover.draw': 'Hòa',
    'gameover.reason.checkmate': 'bằng chiếu hết',
    'gameover.reason.timeout': 'hết giờ',
    'gameover.reason.resigned': 'do đầu hàng',
    'gameover.reason.stalemate': 'bằng hòa pat (hết nước đi)',
    'gameover.reason.threefold_repetition': 'do lặp lại 3 lần',
    'gameover.reason.insufficient_material': 'do thiếu lực lượng',
    'gameover.reason.fifty_move_rule': 'theo luật 50 nước',
    'gameover.reason.draw': 'do đồng ý hòa',
    'gameover.reason.victory': 'chiến thắng',
    'friend.inviteLabel': 'Mời bạn bè (không cần đăng nhập)',
    'friend.copy': 'Sao chép',
    'friend.copied': 'Đã sao chép!',
    'friend.joinLabel': 'Tham gia ván đấu này',
    'friend.joinPlaceholder': 'Tên của bạn (không bắt buộc)',
    'friend.joinBtn': 'Tham gia',
    'friend.drawOffer': '{name} xin hòa ván đấu',
    'friend.takebackOffer': '{name} xin đi lại một nước',
    'friend.accept': 'Đồng ý',
    'friend.decline': 'Từ chối',
    'analysis.title': 'Đánh giá ván cờ',
    'analysis.cancel': 'Hủy',
    'analysis.analyzing': 'Đang phân tích nước đi {current}/{total} ({percent}%)',
    'analysis.white': 'Trắng',
    'analysis.black': 'Đen',
    'analysis.class.brilliant': 'Nước cờ xuất sắc',
    'analysis.class.great': 'Nước cờ tuyệt hay',
    'analysis.class.best': 'Nước cờ tốt nhất',
    'analysis.class.excellent': 'Nước cờ tuyệt vời',
    'analysis.class.good': 'Nước cờ tốt',
    'analysis.class.book': 'Nước cờ bài bản (Book)',
    'analysis.class.inaccuracy': 'Không chuẩn xác',
    'analysis.class.mistake': 'Sai lầm',
    'analysis.class.blunder': 'Sai lầm nghiêm trọng (Blunder)',
    'analysis.class.miss': 'Bỏ lỡ cơ hội',
    'subtab.moves': 'Nước đi',
    'subtab.chat': 'Trò chuyện',
    'moves.label': 'Nước đi',
    'moves.first': 'Nước đầu tiên',
    'moves.prev': 'Nước trước (Mũi tên trái)',
    'moves.next': 'Nước sau (Mũi tên phải)',
    'moves.live': 'Nước mới nhất',
    'chat.quickGoodLuck': 'Chúc may mắn!',
    'chat.quickWellPlayed': 'Chơi hay lắm!',
    'chat.quickGoodGame': 'Ván đấu rất hay!',
    'chat.quickThanks': 'Cảm ơn!',
    'chat.placeholder': 'Nhập tin nhắn...',
    'chat.send': 'Gửi',
    'chat.readonly': 'Khán giả chỉ có thể xem trò chuyện.',
    'chat.mobileTitle': 'Trò chuyện ván đấu',
    'chat.openChat': 'Mở trò chuyện',
    'chat.closeChat': 'Đóng trò chuyện',
    'action.review': 'Xem lại ván đấu',
    'action.flip': 'Xoay',
    'action.takeback': 'Đi lại',
    'action.draw': 'Xin hòa',
    'action.resign': 'Đầu hàng',
    'action.rematch': 'Đấu lại',
    'setup.gameMode': 'Chế độ chơi',
    'setup.vsBot': 'Đấu với Bot',
    'setup.vsFriend': 'Đấu với Bạn',
    'setup.chooseBot': 'Chọn Bot',
    'setup.yourName': 'Tên của bạn',
    'setup.namePlaceholder': 'Tên của bạn (không bắt buộc)',
    'setup.playAs': 'Chọn quân',
    'setup.white': 'Trắng',
    'setup.black': 'Đen',
    'setup.random': 'Ngẫu nhiên',
    'setup.timeControl': 'Thời gian ván đấu',
    'setup.playBtn': 'Bắt đầu chơi',
    'bot.martin.tagline': 'Người chơi mới thân thiện, chơi cởi mở và dễ tha thứ sai sót.',
    'bot.elani.tagline': 'Kỳ thủ câu lạc bộ nắm chắc chiến thuật cơ bản và tránh sơ hở.',
    'bot.antonio.tagline': 'Bậc thầy tính toán sắc bén, săn tìm đòn phối hợp và chiếu hết.',
    'tc.untimed': 'Không giới hạn',
    'tc.1m': '1 phút',
    'tc.3m': '3 phút',
    'tc.3p2': '3 | 2',
    'tc.10m': '10 phút',
  }),
  en: Object.freeze({
    'app.title': 'Play Chess vs Bots — Chess.com Style',
    'brand.tag': 'Chess.play',
    'nav.play': 'Play',
    'nav.bots': 'Bots',
    'nav.flip': 'Flip Board',
    'nav.soundOn': 'Sound On',
    'nav.soundOff': 'Sound Off',
    'nav.fullscreen': 'Full Screen',
    'nav.exitFullscreen': 'Exit Full Screen',
    'nav.fullscreenTitle': 'Enter Full Screen (F)',
    'nav.exitFullscreenTitle': 'Exit Full Screen (Esc)',
    'nav.settings': 'Settings',
    'nav.toggleExpand': 'Expand Menu',
    'nav.toggleCollapse': 'Collapse Menu',
    'player.you': 'You',
    'player.opponent': 'Opponent',
    'board.label': '8x8 Chess Board',
    'modal.promotion.title': 'Promote Pawn',
    'modal.promotion.cancel': 'Cancel',
    'modal.promotion.queen': 'Queen',
    'modal.promotion.rook': 'Rook',
    'modal.promotion.bishop': 'Bishop',
    'modal.promotion.knight': 'Knight',
    'modal.gameover.title': 'Game Over',
    'modal.gameover.close': 'Close game result',
    'modal.gameover.review': 'Game Review',
    'modal.gameover.rematch': 'Rematch',
    'modal.gameover.newBot': 'New Bot',
    'modal.settings.title': 'Settings',
    'modal.settings.language': 'Language',
    'modal.settings.sound': 'Sound',
    'modal.settings.langVi': 'Tiếng Việt',
    'modal.settings.langEn': 'English',
    'modal.settings.close': 'Close',
    'tab.play': 'Play',
    'tab.setup': 'New Game',
    'status.starting': 'Starting game...',
    'status.live': 'Live',
    'status.botReady': 'Ready for a match!',
    'status.syncing': 'Syncing match...',
    'status.botThinking': '{name} is thinking...',
    'status.reviewing': 'Reviewing {label} ({ply}/{total}){check}',
    'status.startingPosition': 'Starting Position',
    'status.checkSuffix': ' (Check)',
    'status.checkPrefix': 'Check! ',
    'status.waitingFriend': 'Waiting for friend to join...',
    'status.openSeat': 'Open seat ready — click Join to play',
    'status.spectatingTurn': "Spectating • {name}'s Turn ({side})",
    'status.yourTurn': 'Your Turn ({side})',
    'status.playerTurn': "{name}'s Turn ({side})",
    'status.white': 'White',
    'status.black': 'Black',
    'gameover.youWon': 'You Won!',
    'gameover.winnerWon': '{name} Won',
    'gameover.draw': 'Draw',
    'gameover.reason.checkmate': 'by checkmate',
    'gameover.reason.timeout': 'on time',
    'gameover.reason.resigned': 'by resignation',
    'gameover.reason.stalemate': 'by stalemate',
    'gameover.reason.threefold_repetition': 'by threefold repetition',
    'gameover.reason.insufficient_material': 'by insufficient material',
    'gameover.reason.fifty_move_rule': 'by 50-move rule',
    'gameover.reason.draw': 'by agreement',
    'gameover.reason.victory': 'victory',
    'friend.inviteLabel': 'Invite a friend (no login required)',
    'friend.copy': 'Copy',
    'friend.copied': 'Copied!',
    'friend.joinLabel': 'Join this match',
    'friend.joinPlaceholder': 'Your name (optional)',
    'friend.joinBtn': 'Join',
    'friend.drawOffer': '{name} offered a draw',
    'friend.takebackOffer': '{name} requested a takeback',
    'friend.accept': 'Accept',
    'friend.decline': 'Decline',
    'analysis.title': 'Game Review',
    'analysis.cancel': 'Cancel',
    'analysis.analyzing': 'Analyzing move {current}/{total} ({percent}%)',
    'analysis.white': 'White',
    'analysis.black': 'Black',
    'analysis.class.brilliant': 'Brilliant',
    'analysis.class.great': 'Great',
    'analysis.class.best': 'Best',
    'analysis.class.excellent': 'Excellent',
    'analysis.class.good': 'Good',
    'analysis.class.book': 'Book',
    'analysis.class.inaccuracy': 'Inaccuracy',
    'analysis.class.mistake': 'Mistake',
    'analysis.class.blunder': 'Blunder',
    'analysis.class.miss': 'Miss',
    'subtab.moves': 'Moves',
    'subtab.chat': 'Chat',
    'moves.label': 'Moves',
    'moves.first': 'First move',
    'moves.prev': 'Previous move (Left Arrow)',
    'moves.next': 'Next move (Right Arrow)',
    'moves.live': 'Latest move',
    'chat.quickGoodLuck': 'Good luck!',
    'chat.quickWellPlayed': 'Well played!',
    'chat.quickGoodGame': 'Good game!',
    'chat.quickThanks': 'Thanks!',
    'chat.placeholder': 'Send a message...',
    'chat.send': 'Send',
    'chat.readonly': 'Spectators can view chat only.',
    'chat.mobileTitle': 'Match Chat',
    'chat.openChat': 'Open match chat',
    'chat.closeChat': 'Close chat',
    'action.review': 'Game Review',
    'action.flip': 'Flip',
    'action.takeback': 'Takeback',
    'action.draw': 'Draw',
    'action.resign': 'Resign',
    'action.rematch': 'Rematch',
    'setup.gameMode': 'Game Mode',
    'setup.vsBot': 'vs Bot',
    'setup.vsFriend': 'vs Friend',
    'setup.chooseBot': 'Choose Bot',
    'setup.yourName': 'Your Name',
    'setup.namePlaceholder': 'Your name (optional)',
    'setup.playAs': 'Play As',
    'setup.white': 'White',
    'setup.black': 'Black',
    'setup.random': 'Random',
    'setup.timeControl': 'Time Control',
    'setup.playBtn': 'Play',
    'bot.martin.tagline': 'Friendly beginner who plays casual, forgiving moves.',
    'bot.elani.tagline': 'Club player who spots basic tactics and avoids hanging pieces.',
    'bot.antonio.tagline': 'Calculating master looking for tactical combos and checkmates.',
    'tc.untimed': 'Untimed',
    'tc.1m': '1 min',
    'tc.3m': '3 min',
    'tc.3p2': '3 | 2',
    'tc.10m': '10 min',
  }),
});

let currentLanguage = DEFAULT_LANGUAGE;

/**
 * Resolves the browser or mock Storage instance safely.
 *
 * @param {Storage} [customStorage] - Optional explicit storage instance (e.g. for testing).
 * @returns {Storage | null} Accessible storage or null in headless environments.
 */
function resolveStorage(customStorage) {
  if (customStorage) {
    return customStorage;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore access exceptions in restricted or test runtimes.
  }
  return null;
}

/**
 * Returns the currently active language code ('vi' or 'en').
 *
 * @returns {'vi' | 'en'} Current language code.
 */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Initializes the active language from storage with fallback to Vietnamese.
 *
 * @param {Storage} [storage] - Optional storage instance.
 * @returns {'vi' | 'en'} Initialized active language code.
 */
export function initI18n(storage) {
  const targetStorage = resolveStorage(storage);
  const stored = targetStorage?.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    currentLanguage = stored;
  } else {
    currentLanguage = DEFAULT_LANGUAGE;
  }
  return currentLanguage;
}

/**
 * Sets the active language, updates persisted storage, and returns the active language code.
 *
 * @param {string} lang - Requested language code ('vi' or 'en').
 * @param {Storage} [storage] - Optional storage instance.
 * @returns {'vi' | 'en'} Resulting active language code.
 */
export function setLanguage(lang, storage) {
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    currentLanguage = lang;
    const targetStorage = resolveStorage(storage);
    try {
      targetStorage?.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore write errors (quota exceeded or sandboxed privacy mode).
    }
  }
  return currentLanguage;
}

/**
 * Translates a key for the current or specified language with optional parameter interpolation.
 *
 * @param {string} key - Translation key defined in TRANSLATIONS.
 * @param {Record<string, string | number>} [params] - Optional named values to interpolate into {placeholder}.
 * @param {'vi' | 'en'} [lang] - Optional explicit language override; defaults to active language.
 * @returns {string} Translated and interpolated string or raw key if missing.
 */
export function t(key, params, lang) {
  const targetLang = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : currentLanguage;
  const dictionary = TRANSLATIONS[targetLang] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
  const template = dictionary?.[key];

  if (typeof template !== 'string') {
    return key;
  }

  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    return paramName in params ? String(params[paramName]) : match;
  });
}

