const WHITE_FILL = '#ffffff';
const WHITE_STROKE = '#23211f';
const BLACK_FILL = '#2f2d2a';
const BLACK_STROKE = '#141311';
const BLACK_DETAIL = '#ece8df';

/**
 * Generates clean Neo-style SVG markup for a chess piece of a given color and type.
 *
 * @param {'w' | 'b'} color - Piece color ('w' for White, 'b' for Black).
 * @param {'p' | 'n' | 'b' | 'r' | 'q' | 'k'} type - Piece type code.
 * @returns {string} Standalone SVG markup scaled to 45x45 viewBox.
 */
export function getPieceSvg(color, type) {
  const isWhite = color === 'w';
  const fill = isWhite ? WHITE_FILL : BLACK_FILL;
  const stroke = isWhite ? WHITE_STROKE : BLACK_STROKE;
  const detail = isWhite ? WHITE_STROKE : BLACK_DETAIL;

  switch (type) {
    case 'p':
      return `<svg viewBox="0 0 45 45" aria-hidden="true">
        <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
          fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    case 'r':
      return `<svg viewBox="0 0 45 45" aria-hidden="true">
        <g fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"/>
          <path d="M34 14l-3 3H14l-3-3"/>
          <path d="M31 17v12.5H14V17"/>
          <path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/>
          <path d="M11 14h23" fill="none" stroke="${detail}" stroke-width="1.4"/>
          <path d="M14 17h17M14 29.5h17" fill="none" stroke="${detail}" stroke-width="1.3"/>
        </g>
      </svg>`;
    case 'n':
      return `<svg viewBox="0 0 45 45" aria-hidden="true">
        <g fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/>
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/>
          <circle cx="15" cy="15.5" r="1.2" fill="${detail}" stroke="none"/>
          <path d="M9.5 25.5a0.7 0.7 0 1 1-1.4 0 .7.7 0 1 1 1.4 0z" fill="${detail}" stroke="none"/>
        </g>
      </svg>`;
    case 'b':
      return `<svg viewBox="0 0 45 45" aria-hidden="true">
        <g fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
          <circle cx="22.5" cy="8" r="2.5"/>
          <path d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5" fill="none" stroke="${detail}" stroke-width="1.5"/>
        </g>
      </svg>`;
    case 'q':
      return `<svg viewBox="0 0 45 45" aria-hidden="true">
        <g fill="${fill}" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="12" r="2.6"/>
          <circle cx="14" cy="9" r="2.6"/>
          <circle cx="22.5" cy="8" r="2.6"/>
          <circle cx="31" cy="9" r="2.6"/>
          <circle cx="39" cy="12" r="2.6"/>
          <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z"/>
          <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/>
          <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none" stroke="${detail}" stroke-width="1.4"/>
        </g>
      </svg>`;
    case 'k':
      return `<svg viewBox="0 0 45 45" aria-hidden="true">
        <g fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22.5 11.63V6M20 8h5" fill="none" stroke="${stroke}" stroke-width="2"/>
          <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/>
          <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z"/>
          <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" fill="none" stroke="${detail}" stroke-width="1.4"/>
        </g>
      </svg>`;
    default:
      return '';
  }
}

/**
 * Generates an inline SVG avatar badge for a bot persona or the human player.
 *
 * @param {string} avatarId - Avatar identifier ('martin', 'elani', 'antonio', or 'player').
 * @returns {string} SVG avatar markup.
 */
export function getAvatarSvg(avatarId) {
  switch (avatarId) {
    case 'martin':
      return `<svg viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#3a6b35"/>
        <circle cx="24" cy="20" r="9" fill="#f4c7a1"/>
        <path d="M10 46c1.5-8 7-12 14-12s12.5 4 14 12" fill="#2b4c7e"/>
        <path d="M16 20c1.5-6 14.5-6 16 0" fill="#6e472b"/>
        <path d="M19 23.5c2 1.2 8 1.2 10 0" stroke="#5b371e" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        <circle cx="20.5" cy="19.5" r="1.2" fill="#241c18"/>
        <circle cx="27.5" cy="19.5" r="1.2" fill="#241c18"/>
      </svg>`;
    case 'elani':
      return `<svg viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#52467a"/>
        <circle cx="24" cy="20" r="9" fill="#eec09a"/>
        <path d="M11 46c1.5-8 6.5-12 13-12s11.5 4 13 12" fill="#2f857a"/>
        <path d="M14 21c0-7 4.5-11 10-11s10 4 10 11c-2-3-5-4-10-4s-8 1-10 4z" fill="#261c33"/>
        <rect x="17" y="17.5" width="5.5" height="4" rx="1.2" fill="none" stroke="#1f1f24" stroke-width="1.5"/>
        <rect x="25.5" y="17.5" width="5.5" height="4" rx="1.2" fill="none" stroke="#1f1f24" stroke-width="1.5"/>
        <line x1="22.5" y1="19.5" x2="25.5" y2="19.5" stroke="#1f1f24" stroke-width="1.5"/>
      </svg>`;
    case 'antonio':
      return `<svg viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#7a3232"/>
        <circle cx="24" cy="20" r="9" fill="#eac19c"/>
        <path d="M10 46c1.5-8.5 7-12.5 14-12.5S36.5 37.5 38 46" fill="#1e1e22"/>
        <path d="M15 17c1.5-5.5 16.5-5.5 18 0l-2-3.5H17z" fill="#1c1917"/>
        <path d="M21 34l3 5 3-5" fill="#d97706"/>
        <circle cx="20.5" cy="19.5" r="1.2" fill="#1f1916"/>
        <circle cx="27.5" cy="19.5" r="1.2" fill="#1f1916"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#4b4844"/>
        <circle cx="24" cy="18" r="7.5" fill="#9e9b95"/>
        <path d="M11 45c1.5-8 6.5-12.5 13-12.5S35.5 37 37 45" fill="#9e9b95"/>
      </svg>`;
  }
}

let sharedAudioContext = null;

/**
 * Lazily creates or resumes the browser Web Audio context for subtle move sound synthesis.
 *
 * @returns {AudioContext | null} Active AudioContext or null when unsupported.
 */
function getAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

const CLASSIFICATION_BADGES = {
  best: { symbol: '★', label: 'Best', color: '#81b64c' },
  excellent: { symbol: '!', label: 'Excellent', color: '#96bc4b' },
  good: { symbol: '✓', label: 'Good', color: '#8ea885' },
  inaccuracy: { symbol: '?!', label: 'Inaccuracy', color: '#f7c631' },
  mistake: { symbol: '?', label: 'Mistake', color: '#e6912c' },
  blunder: { symbol: '??', label: 'Blunder', color: '#ca3431' },
};

/**
 * Returns Chess.com-style badge symbol, display label, and accent color for a move classification.
 *
 * @param {string} classification - Move category ('best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder').
 * @returns {{ symbol: string, label: string, color: string }} Badge presentation metadata.
 */
export function getClassificationBadgeInfo(classification) {
  return CLASSIFICATION_BADGES[classification] ?? CLASSIFICATION_BADGES.good;
}

/**
 * Plays a short synthesized chess sound effect matching Chess.com feedback cues.
 *
 * @param {'move' | 'capture' | 'check' | 'castle' | 'gameOver' | 'illegal'} kind - Sound cue category.
 * @param {boolean} isMuted - Skips playback when sound is muted.
 * @returns {void}
 */
export function playChessSound(kind, isMuted) {
  if (isMuted) {
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;
  const playTone = (freq, startOffset, duration, type = 'triangle', gainPeak = 0.14) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.01);
  };

  if (kind === 'capture') {
    playTone(230, 0, 0.08, 'sawtooth', 0.12);
    playTone(130, 0.02, 0.07, 'triangle', 0.16);
    return;
  }
  if (kind === 'check') {
    playTone(540, 0, 0.11, 'sine', 0.15);
    playTone(720, 0.05, 0.12, 'triangle', 0.12);
    return;
  }
  if (kind === 'castle') {
    playTone(190, 0, 0.06, 'triangle', 0.14);
    playTone(240, 0.07, 0.06, 'triangle', 0.14);
    return;
  }
  if (kind === 'gameOver') {
    playTone(392, 0, 0.12, 'triangle', 0.14);
    playTone(523.25, 0.1, 0.18, 'triangle', 0.15);
    return;
  }
  if (kind === 'illegal') {
    playTone(140, 0, 0.09, 'sine', 0.09);
    return;
  }
  playTone(180, 0, 0.065, 'triangle', 0.14);
}

