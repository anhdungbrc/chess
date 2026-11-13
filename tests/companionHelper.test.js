import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChessComPieceClass,
  buildFenFromPiecePlacements,
  parseChessComBoardPieces,
  isSamePosition,
  generateRelayScript,
  generateBookmarklet,
  inferTurnFromLastMove,
} from '../public/companionHelper.js';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Validates extraction of piece type, color, and algebraic square from Chess.com CSS classes.
 */
test('parseChessComPieceClass parses Chess.com piece and square classes correctly', () => {
  assert.deepEqual(parseChessComPieceClass('piece wp square-52'), {
    piece: 'p',
    color: 'w',
    square: 'e2',
  });

  assert.deepEqual(parseChessComPieceClass('piece bk square-58'), {
    piece: 'k',
    color: 'b',
    square: 'e8',
  });

  assert.deepEqual(parseChessComPieceClass('piece wr square-11'), {
    piece: 'r',
    color: 'w',
    square: 'a1',
  });

  assert.deepEqual(parseChessComPieceClass('piece bn square-88'), {
    piece: 'n',
    color: 'b',
    square: 'h8',
  });

  assert.equal(parseChessComPieceClass('not-a-piece square-12'), null);
  assert.equal(parseChessComPieceClass('piece wp invalid-square'), null);
  assert.equal(parseChessComPieceClass(''), null);
});

/**
 * Validates building standard 8-rank FEN string from piece placements.
 */
test('buildFenFromPiecePlacements constructs valid FEN string matching standard start position', () => {
  const placements = [
    // White pieces
    { piece: 'r', color: 'w', square: 'a1' },
    { piece: 'n', color: 'w', square: 'b1' },
    { piece: 'b', color: 'w', square: 'c1' },
    { piece: 'q', color: 'w', square: 'd1' },
    { piece: 'k', color: 'w', square: 'e1' },
    { piece: 'b', color: 'w', square: 'f1' },
    { piece: 'n', color: 'w', square: 'g1' },
    { piece: 'r', color: 'w', square: 'h1' },
    { piece: 'p', color: 'w', square: 'a2' },
    { piece: 'p', color: 'w', square: 'b2' },
    { piece: 'p', color: 'w', square: 'c2' },
    { piece: 'p', color: 'w', square: 'd2' },
    { piece: 'p', color: 'w', square: 'e2' },
    { piece: 'p', color: 'w', square: 'f2' },
    { piece: 'p', color: 'w', square: 'g2' },
    { piece: 'p', color: 'w', square: 'h2' },
    // Black pieces
    { piece: 'p', color: 'b', square: 'a7' },
    { piece: 'p', color: 'b', square: 'b7' },
    { piece: 'p', color: 'b', square: 'c7' },
    { piece: 'p', color: 'b', square: 'd7' },
    { piece: 'p', color: 'b', square: 'e7' },
    { piece: 'p', color: 'b', square: 'f7' },
    { piece: 'p', color: 'b', square: 'g7' },
    { piece: 'p', color: 'b', square: 'h7' },
    { piece: 'r', color: 'b', square: 'a8' },
    { piece: 'n', color: 'b', square: 'b8' },
    { piece: 'b', color: 'b', square: 'c8' },
    { piece: 'q', color: 'b', square: 'd8' },
    { piece: 'k', color: 'b', square: 'e8' },
    { piece: 'b', color: 'b', square: 'f8' },
    { piece: 'n', color: 'b', square: 'g8' },
    { piece: 'r', color: 'b', square: 'h8' },
  ];

  const fen = buildFenFromPiecePlacements(placements);
  assert.equal(fen, STARTING_FEN);
});

/**
 * Validates parseChessComBoardPieces directly transforms DOM element classes into standard FEN.
 */
test('parseChessComBoardPieces converts element classes to valid FEN', () => {
  const elements = [
    { className: 'piece wk square-51' },
    { className: 'piece bk square-58' },
    { className: 'piece wp square-52' },
  ];

  const fen = parseChessComBoardPieces(elements, { turn: 'b' });
  assert.equal(fen, '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1');
});

/**
 * Validates isSamePosition detects identical vs distinct positions.
 */
test('isSamePosition accurately detects matching board placements and turns', () => {
  const fen1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b - - 5 10';
  const fenDifferent = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  assert.equal(isSamePosition(fen1, fen2), true);
  assert.equal(isSamePosition(fen1, fenDifferent), false);
  assert.equal(isSamePosition('', fen1), false);
});

/**
 * Validates generateRelayScript and generateBookmarklet generate valid executable snippets.
 */
test('generateRelayScript and generateBookmarklet produce configured script strings', () => {
  const script = generateRelayScript('http://localhost:3000');
  assert.ok(script.includes('http://localhost:3000/api/companion/sync'));
  assert.ok(script.includes('MutationObserver'));
  assert.ok(script.includes('wc-chess-board'));

  const bookmarklet = generateBookmarklet('http://localhost:3000');
  assert.ok(bookmarklet.startsWith('javascript:'));
  assert.ok(decodeURIComponent(bookmarklet).includes('http://localhost:3000/api/companion/sync'));
});

/**
 * Builds an 8x8 grid (row 0 = rank 8) from a FEN piece-placement field for turn inference tests.
 *
 * @param {string} placement - FEN piece placement field.
 * @returns {Array<Array<string | null>>} Grid of FEN piece characters.
 */
function gridFromPlacement(placement) {
  return placement.split('/').map((rank) => {
    const row = [];
    for (const char of rank) {
      if (/[1-8]/.test(char)) {
        row.push(...Array(Number(char)).fill(null));
      } else {
        row.push(char);
      }
    }
    return row;
  });
}

/**
 * Validates that after White's 1.e4 (white pawn on highlighted e4) it is Black's turn,
 * regardless of the order in which the two highlighted squares are listed.
 */
test('inferTurnFromLastMove returns black after a White move', () => {
  const grid = gridFromPlacement('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  assert.equal(inferTurnFromLastMove(grid, ['e2', 'e4']), 'b');
  assert.equal(inferTurnFromLastMove(grid, ['e4', 'e2']), 'b');
});

/**
 * Validates that after Black's 1...e5 (black pawn on highlighted e5) it is White's turn,
 * and that a board with no highlighted squares (game start) defaults to White.
 */
test('inferTurnFromLastMove returns white after a Black move or with no highlights', () => {
  const grid = gridFromPlacement('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  assert.equal(inferTurnFromLastMove(grid, ['e7', 'e5']), 'w');
  assert.equal(inferTurnFromLastMove(grid, []), 'w');
});

/**
 * Validates that the relay script derives the side to move instead of hardcoding White,
 * which previously made best-move hints always target White.
 */
test('generateRelayScript does not hardcode White to move', () => {
  const script = generateRelayScript('http://localhost:3000');
  assert.ok(!script.includes("' w - - 0 1'"));
  assert.ok(script.includes('inferTurnFromLastMove'));
});
