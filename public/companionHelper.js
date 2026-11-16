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
 * Infers the side to move from the highlighted squares of the last move.
 * The mover is the colour of the piece standing on a highlighted square (the destination is
 * occupied, the origin is empty), so the side to move is the opposite colour.
 * Must stay self-contained (no outer references): it is embedded into the relay script via toString().
 *
 * @param {Array<Array<string | null>>} grid - 8x8 FEN piece characters, row 0 = rank 8.
 * @param {string[]} highlightedSquares - Algebraic squares highlighted as the last move (e.g. ['e2', 'e4']).
 * @returns {'w' | 'b'} Side to move; 'w' when no highlighted square holds a piece (game start).
 */
export function inferTurnFromLastMove(grid, highlightedSquares) {
  for (const square of highlightedSquares) {
    const fileIdx = square.charCodeAt(0) - 97; // 'a' -> 0
    const rowIdx = 8 - Number(square[1]); // rank 8 -> row 0
    const fenChar = grid[rowIdx] && grid[rowIdx][fileIdx];
    if (fenChar) {
      // Uppercase FEN char = White piece just moved, so Black is to move
      return fenChar === fenChar.toUpperCase() ? 'b' : 'w';
    }
  }
  return 'w';
}

/**
 * Calculates the screen center coordinates of an algebraic square on a chess board.
 *
 * @param {string} square - Algebraic square coordinate (e.g. 'e4').
 * @param {{ left: number, top: number, width: number, height: number }} boardRect - Bounding client rectangle of board element.
 * @param {boolean} [isFlipped=false] - True when viewing from Black's perspective.
 * @returns {{ clientX: number, clientY: number } | null} Screen center coordinates or null if square/rect is invalid.
 */
export function calculateSquareCenter(square, boardRect, isFlipped = false) {
  if (typeof square !== 'string' || !/^[a-h][1-8]$/.test(square)) {
    return null;
  }
  if (!boardRect || typeof boardRect.left !== 'number' || typeof boardRect.top !== 'number') {
    return null;
  }

  const sqWidth = boardRect.width / 8;
  const sqHeight = boardRect.height / 8;
  const fileIdx = square.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const rankNum = Number(square[1]); // 1..8

  // When board is flipped (Black perspective), files run h->a and ranks run 1->8
  const col = isFlipped ? 7 - fileIdx : fileIdx;
  const row = isFlipped ? rankNum - 1 : 8 - rankNum;

  return {
    clientX: Math.round(boardRect.left + (col + 0.5) * sqWidth),
    clientY: Math.round(boardRect.top + (row + 0.5) * sqHeight),
  };
}

/**
 * Generates a randomized human-like delay between minMs and maxMs (defaulting to 3s-10s).
 * Simulates natural human hesitation before committing a chess move.
 *
 * @param {number} [minMs=3000] - Lower bound delay in milliseconds.
 * @param {number} [maxMs=10000] - Upper bound delay in milliseconds.
 * @returns {number} Integer delay in milliseconds.
 */
export function getRandomAutoMoveDelayMs(minMs = 3000, maxMs = 10000) {
  const safeMin = Math.max(0, Math.trunc(minMs));
  const safeMax = Math.max(safeMin, Math.trunc(maxMs));
  // Uniform discrete random distribution across [safeMin, safeMax]
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

/**
 * Dispatches simulated native user mouse and pointer clicks on Chess.com board to execute a move.
 * Simulates standard human interactions without mutating internal board state to preserve
 * WebSocket live connectivity and avoid server-side state desynchronization.
 *
 * @param {Element | any} board - Board DOM element (wc-chess-board or chess-board).
 * @param {string} moveUci - Move in UCI format (e.g. 'e2e4' or 'e7e8q').
 * @param {boolean} [isFlipped=false] - Whether board is currently flipped.
 * @param {'click' | 'drag'} [mode='click'] - Simulation interaction mode.
 * @returns {Promise<boolean>} True when move simulation completes successfully.
 */
export async function executeChessComMove(board, moveUci, isFlipped = false, mode = 'click') {
  if (!board || typeof moveUci !== 'string' || moveUci.length < 4) {
    return false;
  }
  const fromSquare = moveUci.slice(0, 2);
  const toSquare = moveUci.slice(2, 4);
  const promoPiece = moveUci.length >= 5 ? moveUci.slice(4, 5).toLowerCase() : null;

  const doc = typeof document !== 'undefined' ? document : null;
  const win = typeof window !== 'undefined' ? window : null;
  if (!doc) {
    return false;
  }

  const rect = typeof board.getBoundingClientRect === 'function'
    ? board.getBoundingClientRect()
    : { left: 0, top: 0, width: 800, height: 800 };

  const fromCoords = calculateSquareCenter(fromSquare, rect, isFlipped);
  const toCoords = calculateSquareCenter(toSquare, rect, isFlipped);
  if (!fromCoords || !toCoords) {
    return false;
  }

  // Directly target Chess.com piece DOM elements via class names (.piece.square-XY)
  // Chess.com CSS convention: square-11 = a1, square-52 = e2, square-88 = h8
  const fromCol = fromSquare.charCodeAt(0) - 96;
  const fromRank = fromSquare[1];
  const toCol = toSquare.charCodeAt(0) - 96;
  const toRank = toSquare[1];

  const fromPieceElem = typeof board.querySelector === 'function'
    ? board.querySelector(`.piece.square-${fromCol}${fromRank}`)
    : null;
  const toPieceElem = typeof board.querySelector === 'function'
    ? board.querySelector(`.piece.square-${toCol}${toRank}`)
    : null;

  const fromTarget =
    fromPieceElem ||
    (typeof doc.elementFromPoint === 'function'
      ? doc.elementFromPoint(fromCoords.clientX, fromCoords.clientY)
      : null) ||
    board;
  const toTarget =
    toPieceElem ||
    (typeof doc.elementFromPoint === 'function'
      ? doc.elementFromPoint(toCoords.clientX, toCoords.clientY)
      : null) ||
    board;

  const PointerEvt =
    typeof PointerEvent !== 'undefined'
      ? PointerEvent
      : typeof CustomEvent !== 'undefined'
        ? CustomEvent
        : Event;
  const MouseEvt =
    typeof MouseEvent !== 'undefined'
      ? MouseEvent
      : typeof CustomEvent !== 'undefined'
        ? CustomEvent
        : Event;

  function dispatchSequence(target, coords) {
    const opts = {
      bubbles: true,
      cancelable: true,
      view: win,
      clientX: coords.clientX,
      clientY: coords.clientY,
      screenX: coords.clientX,
      screenY: coords.clientY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      pressure: 0.5,
    };
    try {
      target.dispatchEvent(new PointerEvt('pointerdown', opts));
      target.dispatchEvent(new MouseEvt('mousedown', opts));
    } catch {}

    const releaseOpts = { ...opts, buttons: 0, pressure: 0 };
    try {
      target.dispatchEvent(new PointerEvt('pointerup', releaseOpts));
      target.dispatchEvent(new MouseEvt('mouseup', releaseOpts));
      target.dispatchEvent(new MouseEvt('click', releaseOpts));
    } catch {}
  }

  if (mode === 'drag') {
    // Isolated Drag-and-drop sequence for accounts set to "Drag pieces only"
    const downOpts = {
      bubbles: true,
      cancelable: true,
      view: win,
      clientX: fromCoords.clientX,
      clientY: fromCoords.clientY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      pressure: 0.5,
    };
    const moveOpts = {
      ...downOpts,
      clientX: toCoords.clientX,
      clientY: toCoords.clientY,
    };
    const upOpts = { ...moveOpts, buttons: 0, pressure: 0 };

    try {
      fromTarget.dispatchEvent(new PointerEvt('pointerdown', downOpts));
      fromTarget.dispatchEvent(new MouseEvt('mousedown', downOpts));
      doc.dispatchEvent(new PointerEvt('pointermove', moveOpts));
      doc.dispatchEvent(new MouseEvt('mousemove', moveOpts));
      toTarget.dispatchEvent(new PointerEvt('pointerup', upOpts));
      toTarget.dispatchEvent(new MouseEvt('mouseup', upOpts));
    } catch {}
  } else {
    // Standard Click-to-move sequence (clean, natural, triggers Chess.com WebSocket packet)
    dispatchSequence(fromTarget, fromCoords);
    // Natural human pause allowing Chess.com UI state machine to select origin square
    await new Promise((r) => setTimeout(r, 120));
    dispatchSequence(toTarget, toCoords);
  }

  // Handle pawn promotion dialog if applicable
  if (promoPiece || (fromRank === '7' && toRank === '8') || (fromRank === '2' && toRank === '1')) {
    await new Promise((r) => setTimeout(r, 150));
    const pieceChar = (promoPiece || 'q').toLowerCase();
    const promoElem =
      doc.querySelector(`.promotion-window .${pieceChar}`) ||
      doc.querySelector(`.promotion-window [class*="${pieceChar}"]`) ||
      doc.querySelector(`[data-piece*="${pieceChar}"]`) ||
      doc.querySelector(`.piece.w${pieceChar}, .piece.b${pieceChar}`);
    if (promoElem && typeof promoElem.click === 'function') {
      promoElem.click();
    }
  }

  return true;
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
  const COMMAND_URL = '${cleanUrl}/api/companion/command';
  const FILES = ['a','b','c','d','e','f','g','h'];
  let lastSentFen = null;
  let lastExecutedFen = null;
  let scheduledFen = null;
  let activeAutoMoveTimeout = null;
  let isExecutingMove = false;
  let syncTimer = null;
  let autoMoveEnabled = true;

  ${isSamePosition.toString()}
  ${inferTurnFromLastMove.toString()}
  ${calculateSquareCenter.toString()}
  ${getRandomAutoMoveDelayMs.toString()}
  ${executeChessComMove.toString()}

  function updateBadge() {
    let badge = document.getElementById('chess-companion-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'chess-companion-badge';
      badge.style.position = 'fixed';
      badge.style.top = '12px';
      badge.style.right = '12px';
      badge.style.zIndex = '999999';
      badge.style.background = 'rgba(20, 20, 20, 0.9)';
      badge.style.color = '#fff';
      badge.style.padding = '6px 12px';
      badge.style.borderRadius = '18px';
      badge.style.fontFamily = 'system-ui, sans-serif';
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '600';
      badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      badge.style.cursor = 'pointer';
      badge.style.userSelect = 'none';
      badge.style.transition = 'all 0.2s ease';
      badge.title = 'Click to toggle auto-move';
      badge.addEventListener('click', () => {
        autoMoveEnabled = !autoMoveEnabled;
        updateBadge();
      });
      document.body.appendChild(badge);
    }
    badge.innerHTML = '♟ Sync • <span style="color:' + (autoMoveEnabled ? '#81b64c' : '#ef4444') + '">⚡ Auto: ' + (autoMoveEnabled ? 'ON' : 'OFF') + '</span>';
  }

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
    const squares = [];
    let lastMove = null;
    if (highlights.length >= 2) {
      highlights.forEach(h => {
        const sm = h.className.match(/\\bsquare-([1-8])([1-8])\\b/);
        if (sm) squares.push(FILES[Number(sm[1])-1] + sm[2]);
      });
      if (squares.length >= 2) {
        lastMove = { from: squares[0], to: squares[1] };
      }
    }

    // Turn is derived from who just moved; a fixed 'w' made hints always target White
    const turn = inferTurnFromLastMove(grid, squares);

    return {
      fen: rows.join('/') + ' ' + turn + ' - - 0 1',
      orientation,
      lastMove,
      timestamp: Date.now()
    };
  }

  async function handleAutoMoveCommand(cmd) {
    if (!autoMoveEnabled || !cmd || !cmd.moveUci) return;
    const board = document.querySelector('wc-chess-board, chess-board');
    if (!board) return;

    // Detect player color strictly from board orientation (flipped -> black, normal -> white)
    const isFlipped = board.classList.contains('flipped');
    const playerColor = isFlipped ? 'b' : 'w';

    const currentData = extractBoardFen();
    if (!currentData) return;

    // Strict human turn check: Only proceed when it is the human player's turn
    const fenTurn = currentData.fen.split(' ')[1];
    if (fenTurn !== playerColor) {
      return;
    }

    // Check clock turn indicator if clock elements are rendered on Chess.com
    const topClock = document.querySelector('.clock-top');
    if (topClock && topClock.classList.contains('clock-player-turn')) {
      return;
    }

    // Prevent duplicate moves on already executed board positions
    if (lastExecutedFen && isSamePosition(currentData.fen, lastExecutedFen)) {
      return;
    }

    // If an auto-move is already scheduled for this exact FEN, avoid duplicate timer
    if (scheduledFen && isSamePosition(currentData.fen, scheduledFen)) {
      return;
    }

    // Clear any previous timer if board position has changed
    if (activeAutoMoveTimeout) {
      clearTimeout(activeAutoMoveTimeout);
      activeAutoMoveTimeout = null;
    }

    scheduledFen = currentData.fen;
    const delay = (typeof cmd.delayMs === 'number' && cmd.delayMs >= 3000)
      ? cmd.delayMs
      : getRandomAutoMoveDelayMs(3000, 10000);

    console.log('[Chess Companion] Scheduling auto-move ' + cmd.moveUci + ' with delay ' + delay + 'ms for color ' + playerColor);

    activeAutoMoveTimeout = setTimeout(async () => {
      activeAutoMoveTimeout = null;
      scheduledFen = null;

      if (!autoMoveEnabled || isExecutingMove) return;

      // Deferred re-verification 1: Re-check board state
      const latestData = extractBoardFen();
      if (!latestData) return;

      // Deferred re-verification 2: Abort if board changed during the 3-20s delay
      if (cmd.fen && !isSamePosition(latestData.fen, cmd.fen)) {
        console.log('[Chess Companion] Board position changed during delay, skipping stale auto-move');
        return;
      }

      // Deferred re-verification 3: Verify it is STILL the human player's turn
      const latestTurn = latestData.fen.split(' ')[1];
      if (latestTurn !== playerColor) {
        console.log('[Chess Companion] No longer player turn after delay, skipping auto-move');
        return;
      }

      isExecutingMove = true;
      const fenBefore = latestData.fen;
      const currentFlipped = board.classList.contains('flipped');

      // Primary attempt: Natural click-to-move (triggers native Chess.com WebSocket packet)
      await executeChessComMove(board, cmd.moveUci, currentFlipped, 'click');

      // Verify execution: wait 350ms and check whether board advanced
      await new Promise(r => setTimeout(r, 350));
      const verifyData = extractBoardFen();

      if (verifyData && !isSamePosition(verifyData.fen, fenBefore)) {
        lastExecutedFen = fenBefore;
        console.log('[Chess Companion] Auto-move successfully executed via click:', cmd.moveUci);
      } else {
        // Fallback attempt: Drag-and-drop sequence (for accounts with Drag pieces only setting)
        console.warn('[Chess Companion] Click did not advance board, retrying move via drag:', cmd.moveUci);
        await executeChessComMove(board, cmd.moveUci, currentFlipped, 'drag');
        await new Promise(r => setTimeout(r, 350));
        const retryData = extractBoardFen();
        if (retryData && !isSamePosition(retryData.fen, fenBefore)) {
          lastExecutedFen = fenBefore;
          console.log('[Chess Companion] Auto-move succeeded on drag retry:', cmd.moveUci);
        }
      }

      isExecutingMove = false;
    }, delay);
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

  // Periodic polling fallback for auto-move commands
  async function pollCommand() {
    try {
      const res = await fetch(COMMAND_URL, { mode: 'cors' });
      if (res.ok) {
        const body = await res.json();
        if (body && body.command) {
          handleAutoMoveCommand(body.command);
        }
      }
    } catch (err) {}
  }

  // SSE stream for instant auto-move delivery
  try {
    const sse = new EventSource(SERVER_URL + '/api/companion/events');
    sse.addEventListener('companion:auto-move', (event) => {
      try {
        const cmd = JSON.parse(event.data);
        handleAutoMoveCommand(cmd);
      } catch (err) {}
    });
  } catch (err) {}

  setInterval(pollCommand, 800);

  const observer = new MutationObserver(scheduleSync);
  const target = document.querySelector('wc-chess-board, chess-board, .board-layout') || document.body;
  if (target) {
    const isBoard = target !== document.body;
    observer.observe(
      target,
      isBoard
        ? { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }
        : { childList: true, subtree: true }
    );
    scheduleSync();
    updateBadge();
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
