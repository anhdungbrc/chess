const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_CLASS_REGEX = /\b([wb])([pnbrqk])\b/;
const SQUARE_CLASS_REGEX = /\bsquare-([1-8])([1-8])\b/;

/**
 * Parses piece type, color, and algebraic square from Chess.com element class string.
 * Class pattern: `piece [w|b][p|n|b|r|q|k] square-[col][row]` (e.g. `piece wp square-52` -> White Pawn on e2).
 *
 * @param {string} className - Class attribute string of a candidate piece element.
 * @returns {{ piece: string, color: 'w' | 'b', square: string } | null} Extracted piece placement or null.
 */
export function parseChessComPieceClass(className) {
  if (typeof className !== 'string' || !className.includes('piece')) {
    return null;
  }

  const pieceMatch = className.match(PIECE_CLASS_REGEX);
  const squareMatch = className.match(SQUARE_CLASS_REGEX);

  if (!pieceMatch || !squareMatch) {
    return null;
  }

  const color = /** @type {'w' | 'b'} */ (pieceMatch[1]);
  const piece = pieceMatch[2];
  const colIndex = Number(squareMatch[1]) - 1; // 1 -> 'a', 8 -> 'h'
  const rank = squareMatch[2]; // '1'..'8'

  const file = FILES[colIndex];
  if (!file) {
    return null;
  }

  return {
    piece,
    color,
    square: `${file}${rank}`,
  };
}

/**
 * Constructs a standard 6-field FEN string from a list of piece placements.
 *
 * @param {Array<{ piece: string, color: 'w' | 'b', square: string }>} placements - List of piece coordinates.
 * @param {{
 *   turn?: 'w' | 'b',
 *   castling?: string,
 *   enPassant?: string,
 *   halfmove?: number,
 *   fullmove?: number,
 * }} [options] - Optional game state parameters.
 * @returns {string} Standard FEN string.
 */
export function buildFenFromPiecePlacements(placements, options = {}) {
  // Construct 8x8 grid indexed by rank (8 down to 1) and file ('a' through 'h')
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  for (const item of placements) {
    if (!item?.square || item.square.length !== 2) {
      continue;
    }
    const fileChar = item.square[0];
    const rankChar = item.square[1];
    const fileIdx = FILES.indexOf(fileChar);
    const rankIdx = 8 - Number(rankChar); // rank 8 -> index 0, rank 1 -> index 7

    if (fileIdx >= 0 && fileIdx < 8 && rankIdx >= 0 && rankIdx < 8) {
      // White pieces uppercase, Black pieces lowercase
      const fenChar = item.color === 'w' ? item.piece.toUpperCase() : item.piece.toLowerCase();
      board[rankIdx][fileIdx] = fenChar;
    }
  }

  const rankStrings = board.map((row) => {
    let emptyCount = 0;
    let rowFen = '';

    for (let c = 0; c < 8; c += 1) {
      const piece = row[c];
      if (!piece) {
        emptyCount += 1;
      } else {
        if (emptyCount > 0) {
          rowFen += String(emptyCount);
          emptyCount = 0;
        }
        rowFen += piece;
      }
    }

    if (emptyCount > 0) {
      rowFen += String(emptyCount);
    }
    return rowFen;
  });

  const piecePlacement = rankStrings.join('/');
  const turn = options.turn ?? 'w';

  // Determine castling rights heuristic if not explicitly passed
  let castling = options.castling;
  if (!castling) {
    // If standard starting positions of kings and rooks are intact, allow full castling; otherwise none
    const hasWhiteKing = board[7][4] === 'K';
    const hasWhiteRookA = board[7][0] === 'R';
    const hasWhiteRookH = board[7][7] === 'R';
    const hasBlackKing = board[0][4] === 'k';
    const hasBlackRookA = board[0][0] === 'r';
    const hasBlackRookH = board[0][7] === 'r';

    let rights = '';
    if (hasWhiteKing && hasWhiteRookH) rights += 'K';
    if (hasWhiteKing && hasWhiteRookA) rights += 'Q';
    if (hasBlackKing && hasBlackRookH) rights += 'k';
    if (hasBlackKing && hasBlackRookA) rights += 'q';
    castling = rights || '-';
  }

  const enPassant = options.enPassant ?? '-';
  const halfmove = options.halfmove ?? 0;
  const fullmove = options.fullmove ?? 1;

  return `${piecePlacement} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

/**
 * Extracts all pieces from Chess.com DOM elements and constructs a standard FEN string.
 *
 * @param {Array<{ className: string }>} pieceElements - Collection of piece DOM elements.
 * @param {{ turn?: 'w' | 'b' }} [options] - Optional active side to move.
 * @returns {string} Standard FEN string.
 */
export function parseChessComBoardPieces(pieceElements, options = {}) {
  const placements = [];
  const safeElements = Array.isArray(pieceElements) ? pieceElements : [];

  for (const el of safeElements) {
    const parsed = parseChessComPieceClass(el?.className ?? '');
    if (parsed) {
      placements.push(parsed);
    }
  }

  return buildFenFromPiecePlacements(placements, options);
}

/**
 * Compares two FEN strings by board piece placement and active turn, ignoring clock/ply metadata.
 *
 * @param {string} fenA - First candidate FEN string.
 * @param {string} fenB - Second candidate FEN string.
 * @returns {boolean} True when board position and turn match identically.
 */
export function isSamePosition(fenA, fenB) {
  if (typeof fenA !== 'string' || typeof fenB !== 'string') {
    return false;
  }
  const partsA = fenA.trim().split(/\s+/);
  const partsB = fenB.trim().split(/\s+/);

  if (partsA.length < 2 || partsB.length < 2) {
    return false;
  }

  // Compare position (part 0) and active turn (part 1)
  return partsA[0] === partsB[0] && partsA[1] === partsB[1];
}

/**
 * Generates an optimized, standalone JavaScript relay snippet for Chess.com live boards.
 *
 * @param {string} [serverUrl='http://localhost:3000'] - Companion server base URL.
 * @returns {string} Standalone JavaScript source code.
 */
export function generateRelayScript(serverUrl = 'http://localhost:3000') {
  const cleanUrl = serverUrl.replace(/\/+$/, '');
  return `(function() {
  const SERVER_URL = '${cleanUrl}';
  const SYNC_URL = '${cleanUrl}/api/companion/sync';
  const FILES = ['a','b','c','d','e','f','g','h'];
  let lastSentFen = null;
  let syncTimer = null;

  function extractBoardFen() {
    const board = document.querySelector('wc-chess-board, chess-board');
    if (!board) return null;
    const pieces = board.querySelectorAll('.piece');
    if (!pieces || pieces.length === 0) return null;

    const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
    pieces.forEach(p => {
      const pMatch = p.className.match(/\\b([wb])([pnbrqk])\\b/);
      const sMatch = p.className.match(/\\bsquare-([1-8])([1-8])\\b/);
      if (pMatch && sMatch) {
        const fileIdx = Number(sMatch[1]) - 1;
        const rankIdx = 8 - Number(sMatch[2]);
        const fenChar = pMatch[1] === 'w' ? pMatch[2].toUpperCase() : pMatch[2].toLowerCase();
        if (fileIdx >= 0 && fileIdx < 8 && rankIdx >= 0 && rankIdx < 8) {
          grid[rankIdx][fileIdx] = fenChar;
        }
      }
    });

    const rows = grid.map(r => {
      let empty = 0, rowStr = '';
      for (let c = 0; c < 8; c++) {
        if (!r[c]) empty++;
        else {
          if (empty > 0) { rowStr += empty; empty = 0; }
          rowStr += r[c];
        }
      }
      if (empty > 0) rowStr += empty;
      return rowStr;
    });

    // Detect orientation
    const isFlipped = board.classList.contains('flipped');
    const orientation = isFlipped ? 'black' : 'white';

    // Highlighted squares indicating last move
    const highlights = board.querySelectorAll('.highlight');
    let lastMove = null;
    if (highlights.length >= 2) {
      const squares = [];
      highlights.forEach(h => {
        const sm = h.className.match(/\\bsquare-([1-8])([1-8])\\b/);
        if (sm) squares.push(FILES[Number(sm[1])-1] + sm[2]);
      });
      if (squares.length >= 2) {
        lastMove = { from: squares[0], to: squares[1] };
      }
    }

    return {
      fen: rows.join('/') + ' w - - 0 1',
      orientation,
      lastMove,
      timestamp: Date.now()
    };
  }

  function syncNow() {
    const data = extractBoardFen();
    if (!data || data.fen === lastSentFen) return;
    lastSentFen = data.fen;

    fetch(SYNC_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => console.debug('[Chess Companion] Sync error:', err));
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 150);
  }

  const observer = new MutationObserver(scheduleSync);
  const target = document.querySelector('wc-chess-board, chess-board, body');
  if (target) {
    observer.observe(target, { childList: true, subtree: true, attributes: true });
    scheduleSync();
    console.log('[Chess Companion] Connected to ' + SERVER_URL);
  }
})();`;
}

/**
 * Generates an executable bookmarklet URL for 1-click execution in browser bookmarks bar.
 *
 * @param {string} [serverUrl='http://localhost:3000'] - Companion server base URL.
 * @returns {string} URL string starting with 'javascript:'.
 */
export function generateBookmarklet(serverUrl = 'http://localhost:3000') {
  const code = generateRelayScript(serverUrl);
  return `javascript:${encodeURIComponent(code)}`;
}
