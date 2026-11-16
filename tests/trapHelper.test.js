import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENING_TRAPS,
  normalizeFenPlacement,
  matchOpeningTrap,
  detectTacticalTrap,
  detectSacrificialTrap,
  detectKingSacrificeAttack,
  resolveContinuousTrapChain,
  resolveTrapSuggestion,
  findProactiveTraps,
} from '../public/trapHelper.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const LEGAL_OFFENSIVE_FEN = 'rn1qkbnr/ppp2pp1/3p3p/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5';
const LEGAL_DEFENSIVE_FEN = 'rn1qkbnr/ppp2pp1/3p3p/4N3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R b KQkq - 0 5';
const BLACKBURNE_OFFENSIVE_FEN = 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const ELEPHANT_WARNING_FEN = 'r1bqkb1r/pppn1ppp/5n2/3N2B1/3P4/8/PP2PPPP/R2QKBNR b KQkq - 0 6';

/**
 * Validates normalizeFenPlacement normalizes board pieces and active turn, dropping move counters.
 */
test('normalizeFenPlacement extracts canonical board placement and turn', () => {
  const norm1 = normalizeFenPlacement(START_FEN);
  assert.equal(norm1, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w');

  const norm2 = normalizeFenPlacement('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 3 14');
  assert.equal(norm2, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b');

  assert.equal(normalizeFenPlacement(''), '');
  assert.equal(normalizeFenPlacement(null), '');
});

/**
 * Validates OPENING_TRAPS catalog contains expected classic traps with bilingual descriptions.
 */
test('OPENING_TRAPS catalog exposes well-formed classic trap definitions', () => {
  assert.ok(Array.isArray(OPENING_TRAPS));
  assert.ok(OPENING_TRAPS.length >= 25);

  for (const trap of OPENING_TRAPS) {
    assert.ok(typeof trap.id === 'string' && trap.id.length > 0);
    assert.ok(trap.name?.vi && trap.name?.en);
    assert.ok(trap.side === 'w' || trap.side === 'b');
    assert.ok(typeof trap.description?.vi === 'string');
    assert.ok(typeof trap.description?.en === 'string');
    assert.ok(trap.triggerPlacement);
    assert.ok(trap.suggestedMoveUci);
    assert.ok(Array.isArray(trap.sequence) && trap.sequence.length >= 1);
  }
});

/**
 * Validates matchOpeningTrap detects offensive trap opportunities and defensive trap warnings.
 */
test('matchOpeningTrap detects offensive trap setups and defensive trap alerts', () => {
  // 1. Offensive Légal trap
  const legalOffensive = matchOpeningTrap(LEGAL_OFFENSIVE_FEN);
  assert.ok(legalOffensive);
  assert.equal(legalOffensive.id, 'legal_trap');
  assert.equal(legalOffensive.type, 'offensive');
  assert.equal(legalOffensive.suggestedMoveUci, 'f3e5');
  assert.ok(legalOffensive.name.vi.includes('Légal'));

  // 2. Defensive Légal trap warning (opponent just played Nxe5)
  const legalDefensive = matchOpeningTrap(LEGAL_DEFENSIVE_FEN);
  assert.ok(legalDefensive);
  assert.equal(legalDefensive.id, 'legal_trap');
  assert.equal(legalDefensive.type, 'defensive');
  assert.equal(legalDefensive.punishAvoidUci, 'g4d1');

  // 3. Elephant trap defensive warning
  const elephantDefensive = matchOpeningTrap(ELEPHANT_WARNING_FEN);
  assert.ok(elephantDefensive);
  assert.equal(elephantDefensive.id, 'elephant_trap');
  assert.equal(elephantDefensive.type, 'defensive');
  assert.equal(elephantDefensive.suggestedMoveUci, 'f6d5');

  // 4. Starting position has no traps
  const startMatch = matchOpeningTrap(START_FEN);
  assert.equal(startMatch, null);
});

/**
 * Validates detectTacticalTrap recognizes piece sacrifices that lead to decisive advantage.
 */
test('detectTacticalTrap identifies tactical sacrifice and coordination traps', () => {
  const tacticalOpportunity = detectTacticalTrap({
    fen: 'r1bqk2r/pppp1ppp/2n5/4p3/1bB1P1n1/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 0 6',
    bestMoveUci: 'c4f7',
    evalScore: { cp: 280, mate: null },
    secondBestEval: { cp: 40, mate: null },
    replyUci: 'e8f7',
  });

  assert.ok(tacticalOpportunity);
  assert.equal(tacticalOpportunity.type, 'tactical');
  assert.equal(tacticalOpportunity.suggestedMoveUci, 'c4f7');
  assert.ok(tacticalOpportunity.name.vi.length > 0);

  // Position without gap or sacrifice should return null
  const quietPosition = detectTacticalTrap({
    fen: START_FEN,
    bestMoveUci: 'e2e4',
    evalScore: { cp: 20, mate: null },
    secondBestEval: { cp: 15, mate: null },
    replyUci: 'e7e5',
  });
  assert.equal(quietPosition, null);

  // Risky trap / gambit sacrifice with moverBestWin < 52 should be accepted as a risky trap
  const riskyTrap = detectTacticalTrap({
    fen: 'r1bqk2r/pppp1ppp/2n5/4p3/1bB1P1n1/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 0 6',
    bestMoveUci: 'g4h2',
    evalScore: { cp: 80, mate: null }, // Evaluated from White's view, so Black win rate is ~39% (< 52%)
    secondBestEval: { cp: 300, mate: null }, // Huge cp gap of 220cp
    replyUci: 'g1h2',
  });
  assert.ok(riskyTrap, 'Should accept risky trap move even when engine evaluates it as dubious/risky');
  assert.equal(riskyTrap.type, 'tactical');
  assert.equal(riskyTrap.isRisky, true);
  assert.ok(riskyTrap.name.vi.includes('Mạo hiểm') || riskyTrap.name.vi.includes('mạo hiểm'));
});

/**
 * Validates resolveTrapSuggestion prioritizes opening catalog before engine heuristics.
 */
test('resolveTrapSuggestion coordinates catalog matches and tactical fallbacks', () => {
  // Should match Légal trap from catalog first
  const catalogMatch = resolveTrapSuggestion({
    fen: LEGAL_OFFENSIVE_FEN,
    analysis: {
      bestMoveUci: 'f3e5',
      eval: { cp: 150, mate: null },
      secondBestEval: { cp: 20, mate: null },
    },
  });
  assert.ok(catalogMatch);
  assert.equal(catalogMatch.id, 'legal_trap');
  assert.equal(catalogMatch.type, 'offensive');

  // Should return null for non-trap standard position
  const nonTrap = resolveTrapSuggestion({
    fen: START_FEN,
    analysis: {
      bestMoveUci: 'e2e4',
      eval: { cp: 20, mate: null },
      secondBestEval: { cp: 15, mate: null },
    },
  });
  assert.equal(nonTrap, null);
});

/**
 * Validates findProactiveTraps discovers achievable traps and next setup moves from early positions.
 */
test('findProactiveTraps discovers achievable traps and next setup moves from early positions', () => {
  // After 1. e4 e5 (White to move at move 2)
  const fen1e4e5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
  const candidatesWhite = findProactiveTraps(fen1e4e5, { currentSide: 'w' });
  assert.ok(Array.isArray(candidatesWhite));
  assert.ok(candidatesWhite.length >= 2);
  assert.ok(candidatesWhite.some((c) => c.trap.id === 'legal_trap' && c.nextSetupMove === 'g1f3'));

  // Invalid or empty FEN returns empty array
  assert.deepEqual(findProactiveTraps(''), []);
  assert.deepEqual(findProactiveTraps(null), []);
});

/**
 * Validates that catalog traps tag extreme sacrifices (Queen, Rook, Minor piece) properly.
 */
test('OPENING_TRAPS tags extreme sacrifice traps with isExtremeSacrifice and sacrificeLevel', () => {
  // Légal trap sacrifices Queen with Nxe5
  const legal = OPENING_TRAPS.find((t) => t.id === 'legal_trap' && t.type === 'offensive');
  assert.ok(legal);
  assert.equal(legal.isExtremeSacrifice, true);
  assert.equal(legal.sacrificeLevel, 'queen');

  // Fried Liver sacrifices Knight on f7
  const friedLiver = OPENING_TRAPS.find((t) => t.id === 'fried_liver' && t.type === 'offensive');
  assert.ok(friedLiver);
  assert.equal(friedLiver.isExtremeSacrifice, true);
  assert.equal(friedLiver.sacrificeLevel, 'minor');

  // Damiano trap sacrifices Knight with Nxe5
  const damiano = OPENING_TRAPS.find((t) => t.id === 'damiano_trap' && t.type === 'offensive');
  assert.ok(damiano, 'Damiano trap should exist in catalog');
  assert.equal(damiano.isExtremeSacrifice, true);
  assert.equal(damiano.sacrificeLevel, 'minor');

  // Greek Gift sacrifice Bxh7+
  const greekGift = OPENING_TRAPS.find((t) => t.id === 'greek_gift_trap' && t.type === 'offensive');
  assert.ok(greekGift, 'Greek gift trap should exist in catalog');
  assert.equal(greekGift.isExtremeSacrifice, true);
  assert.equal(greekGift.sacrificeLevel, 'minor');

  // Boden's Mate sacrifices Queen
  const boden = OPENING_TRAPS.find((t) => t.id === 'boden_mate_trap' && t.type === 'offensive');
  assert.ok(boden, 'Boden mate trap should exist in catalog');
  assert.equal(boden.isExtremeSacrifice, true);
  assert.equal(boden.sacrificeLevel, 'queen');
});

/**
 * Validates detectSacrificialTrap accurately identifies dynamic tactical piece sacrifices.
 */
test('detectSacrificialTrap identifies dynamic tactical piece sacrifices leading to attack', () => {
  // Position with Bishop sacrifice on f7
  const sacrificeOpportunity = detectSacrificialTrap({
    fen: 'r1bqk2r/pppp1ppp/2n5/4p3/1bB1P1n1/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 0 6',
    bestMoveUci: 'c4f7',
    evalScore: { cp: 280, mate: null },
    secondBestEval: { cp: 40, mate: null },
    pv: ['c4f7', 'e8f7', 'f3g5', 'f7g8', 'd1g4'],
  });

  assert.ok(sacrificeOpportunity);
  assert.equal(sacrificeOpportunity.isExtremeSacrifice, true);
  assert.equal(sacrificeOpportunity.sacrificeLevel, 'minor');
  assert.equal(sacrificeOpportunity.suggestedMoveUci, 'c4f7');
  assert.ok(sacrificeOpportunity.name.vi.toLowerCase().includes('thí'));

  // Non-sacrifice quiet move should return null
  const quietMove = detectSacrificialTrap({
    fen: START_FEN,
    bestMoveUci: 'e2e4',
    evalScore: { cp: 20, mate: null },
    secondBestEval: { cp: 15, mate: null },
    pv: ['e2e4', 'e7e5'],
  });
  assert.equal(quietMove, null);
});

/**
 * Validates resolveContinuousTrapChain manages multi-step combo progression, opponent traps, and dynamic pivots.
 */
test('resolveContinuousTrapChain progresses punishments or smoothly pivots when opponent evades', () => {
  const legalTrap = OPENING_TRAPS.find((t) => t.id === 'legal_trap' && t.type === 'offensive');
  assert.ok(legalTrap);

  // 1. Opponent takes bait (step 1 -> step 2 in sequence: plays g4d1)
  const punishmentStep = resolveContinuousTrapChain({
    currentTrap: legalTrap,
    currentStep: 1,
    lastOpponentMoveUci: 'g4d1',
    currentFen: 'rn1qkbnr/ppp2pp1/3p3p/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6',
  });
  assert.equal(punishmentStep.status, 'punishing');
  assert.equal(punishmentStep.isPivot, false);
  assert.equal(punishmentStep.nextMoveUci, 'c4f7');
  assert.equal(punishmentStep.step, 3); // next player strike

  // 2. Opponent evades bait (e.g. plays safe dxe5 instead of taking Queen)
  const pivotStep = resolveContinuousTrapChain({
    currentTrap: legalTrap,
    currentStep: 1,
    lastOpponentMoveUci: 'd6e5',
    currentFen: 'rn1qkbnr/ppp2pp1/7p/4p3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R w KQkq - 0 6',
  });
  // System should pivot to another trap or strategic continuation instead of dying
  assert.ok(pivotStep.status === 'pivoting' || pivotStep.status === 'punishing');
  assert.equal(pivotStep.isPivot, true);
  assert.ok(pivotStep.nextMoveUci);

  // 3. Completed sequence reaches end
  const completedStep = resolveContinuousTrapChain({
    currentTrap: legalTrap,
    currentStep: 5,
    lastOpponentMoveUci: 'e8e7',
    currentFen: 'rn1q1bnr/ppp1kBp1/3p3p/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7',
  });
  assert.equal(completedStep.status, 'completed');
});

/**
 * Validates detectKingSacrificeAttack detects piece sacrifices that blast open the enemy king's shield.
 */
test('detectKingSacrificeAttack identifies aggressive piece sacrifices targeting the king', () => {
  // Greek Gift position: Bishop sacrifices on h7 with check, shattering Black's castled king shelter
  const greekGiftFen = 'r1bq1rk1/ppp2ppp/2n1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 7';
  const greekGiftAttack = detectKingSacrificeAttack({
    fen: greekGiftFen,
    bestMoveUci: 'd3h7',
    pv: ['d3h7', 'g8h7', 'f3g5', 'h7g8', 'd1h5'],
    evalScore: { cp: 120, mate: null },
  });

  assert.ok(greekGiftAttack, 'Greek gift sacrifice should be detected');
  assert.equal(greekGiftAttack.isKingSacrifice, true);
  assert.equal(greekGiftAttack.isExtremeSacrifice, true);
  assert.equal(greekGiftAttack.suggestedMoveUci, 'd3h7');
  assert.equal(greekGiftAttack.sacrificeLevel, 'minor');
  assert.equal(greekGiftAttack.kingTargetSquare, 'g8');
  assert.ok(greekGiftAttack.name.vi.includes('Vua'));
  assert.ok(greekGiftAttack.description.vi.includes('Vua'));
  assert.ok(Array.isArray(greekGiftAttack.sequence));
  assert.equal(greekGiftAttack.sequence.length, 5);

  // Quiet opening move with no sacrifice or attack against the king returns null
  const quietPosition = detectKingSacrificeAttack({
    fen: START_FEN,
    bestMoveUci: 'e2e4',
    pv: ['e2e4', 'e7e5'],
    evalScore: { cp: 20, mate: null },
  });
  assert.equal(quietPosition, null);
});


