import { evalToWinPercent, isPieceSacrifice, uciToMoveSquares } from './analysisHelper.js';

/**
 * Normalizes a FEN string to extract only the board placement and side to move.
 * Strips castling rights, en passant, halfmove, and fullmove counters for robust pattern matching.
 *
 * @param {string | null | undefined} fen - Candidate FEN string.
 * @returns {string} Normalized "board turn" string, or empty string on invalid input.
 */
export function normalizeFenPlacement(fen) {
  if (typeof fen !== 'string' || !fen.trim()) {
    return '';
  }
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) {
    return parts[0] || '';
  }
  // Retain board placement (part 0) and active turn (part 1)
  return `${parts[0]} ${parts[1]}`;
}

/**
 * Catalog of 28 classic chess opening traps with proactive setup paths, triggers, suggested moves, and bilingual descriptions.
 * Each entry covers either offensive trap setup or defensive trap alert when opponent springs the trap.
 */
export const OPENING_TRAPS = Object.freeze([
  // 1. Légal Trap (Offensive: White plays 5. Nxe5!)
  {
    id: 'legal_trap',
    name: {
      vi: 'Bẫy Légal (Légal Trap)',
      en: "Légal's Trap",
    },
    side: 'w',
    opening: 'Philidor / Italian',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'queen',
    triggerPlacement: 'rn1qkbnr/ppp2pp1/3p3p/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w',
    suggestedMoveUci: 'f3e5',
    punishMoveUci: 'c4f7',
    description: {
      vi: 'Thí Hậu bằng Nxe5! Nếu Đen ham ăn Hậu (Bxd1), Trắng sẽ chiếu hết bằng Bxf7+ Ke7 Nd5#.',
      en: 'Queen sacrifice with Nxe5! If Black recaptures your Queen with Bxd1, White delivers checkmate with Bxf7+ Ke7 Nd5#.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w',
        nextMove: 'g1f3',
        remainingSteps: 4,
      },
      {
        placement: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w',
        nextMove: 'f1c4',
        remainingSteps: 3,
      },
      {
        placement: 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/5N2/PPPP1PPP/RNBQK2R w',
        nextMove: 'b1c3',
        remainingSteps: 2,
      },
    ],
    sequence: [
      { move: 'f3e5', san: 'Nxe5!', label: { vi: '1. Thí Hậu gài bẫy', en: '1. Queen sacrifice bait' } },
      { move: 'g4d1', san: 'Bxd1?', label: { vi: '2. Đen sập bẫy ăn Hậu', en: '2. Black takes Queen' } },
      { move: 'c4f7', san: 'Bxf7+', label: { vi: '3. Tượng c4 chiếu', en: '3. Bishop check' } },
      { move: 'e8e7', san: 'Ke7', label: { vi: '4. Vua Đen buộc chạy', en: '4. King forced' } },
      { move: 'c3d5', san: 'Nd5#', label: { vi: '5. Mã d5 chiếu hết!', en: '5. Knight checkmate!' } },
    ],
    branches: {
      'd6e5': {
        transitionMove: 'd1g4',
        label: {
          vi: 'Đen né bẫy! Chuyển sang ăn Tượng g4 (Qxg4) lãi quân áp đảo',
          en: 'Black avoided trap! Pivot to capture Bishop with Qxg4',
        },
      },
    },
  },
  // 2. Légal Trap (Defensive Warning: White just played Nxe5, Black must NOT take Queen)
  {
    id: 'legal_trap',
    name: {
      vi: 'Cảnh báo Bẫy Légal',
      en: "Légal's Trap Alert",
    },
    side: 'b',
    opening: 'Philidor / Italian',
    type: 'defensive',
    triggerPlacement: 'rn1qkbnr/ppp2pp1/3p3p/4N3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R b',
    suggestedMoveUci: 'd6e5',
    punishAvoidUci: 'g4d1',
    description: {
      vi: 'Đối thủ vừa thí Hậu để giăng bẫy Légal! Đừng ăn Hậu d1 (Bxd1) vì sẽ bị chiếu hết ngay. Hãy ăn Mã bằng dxe5 hoặc lùi Tượng về Be6.',
      en: "Opponent just played Nxe5 setting Légal's Trap! Do NOT capture the Queen with Bxd1 or you will be checkmated. Play dxe5 or Be6 instead.",
    },
    sequence: [
      { move: 'd6e5', san: 'dxe5', label: { vi: '1. Nước đúng: Ăn lại Mã an toàn', en: '1. Safe move: Take knight' } },
      { move: 'g4d1', san: 'Bxd1?', label: { vi: 'Tránh ăn: Bị chiếu hết sau 2 nước', en: 'Avoid: Mated in 2 plies' } },
      { move: 'c4f7', san: 'Bxf7+', label: { vi: 'Kịch bản sập bẫy: Bxf7+', en: 'Risk: Bxf7+ check' } },
      { move: 'c3d5', san: 'Nd5#', label: { vi: 'Nd5# Chiếu hết', en: 'Nd5# Checkmate' } },
    ],
  },
  // 3. Blackburne Shilling Gambit (Offensive for Black: 3... Nd4)
  {
    id: 'blackburne_shilling',
    name: {
      vi: 'Bẫy Blackburne Shilling',
      en: 'Blackburne Shilling Trap',
    },
    side: 'b',
    opening: 'Italian Game',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'rook',
    triggerPlacement: 'r1bqkbnr/pppp1ppp/8/4N3/2BnP3/8/PPPP1PPP/RNBQK2R b',
    suggestedMoveUci: 'd8g5',
    punishMoveUci: 'g5g2',
    description: {
      vi: 'Trắng vừa ăn tốt e5 ham hố (Nxe5?). Hãy đánh Qg5! Tấn công cùng lúc Mã e5 và tốt g2, chuẩn bị bắt Xe và chiếu hết.',
      en: 'White grabbed the e5 pawn greedily (Nxe5?). Strike with Qg5! Double attacking the e5 knight and g2 pawn to win the rook and mate.',
    },
    setupPositions: [
      {
        placement: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b',
        nextMove: 'c6d4',
        remainingSteps: 2,
      },
    ],
    sequence: [
      { move: 'd8g5', san: 'Qg5!', label: { vi: '1. Bắt đôi Mã e5 & tốt g2', en: '1. Double attack e5 & g2' } },
      { move: 'e5f7', san: 'Nxf7?', label: { vi: '2. Trắng tham ăn bắt đôi Hậu & Xe', en: '2. White greedy fork' } },
      { move: 'g5g2', san: 'Qxg2', label: { vi: '3. Ăn tốt g2 dọa bắt Xe', en: '3. Threaten h1 rook' } },
      { move: 'h1f1', san: 'Rf1', label: { vi: '4. Trắng cứu Xe', en: '4. White saves rook' } },
      { move: 'g2e4', san: 'Qxe4+', label: { vi: '5. Ăn e4 chiếu Vua', en: '5. Check on e4' } },
      { move: 'c4e2', san: 'Be2', label: { vi: '6. Tượng chắn', en: '6. Bishop blocks' } },
      { move: 'd4f3', san: 'Nf3#', label: { vi: '7. Mã f3 chiếu bí tuyệt đẹp!', en: '7. Smothered mate with Nf3#!' } },
    ],
  },
  // 4. Blackburne Shilling Defense (Warning for White)
  {
    id: 'blackburne_shilling',
    name: {
      vi: 'Cảnh báo Bẫy Blackburne Shilling',
      en: 'Blackburne Shilling Alert',
    },
    side: 'w',
    opening: 'Italian Game',
    type: 'defensive',
    triggerPlacement: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w',
    suggestedMoveUci: 'f3d4',
    punishAvoidUci: 'f3e5',
    description: {
      vi: 'Đen vừa giăng bẫy với Nd4! Tuyệt đối không ăn Nxe5? vì Đen sẽ Qg5 bắt Xe và chiếu hết. Hãy ăn Nxd4 hoặc nhập thành 0-0 an toàn.',
      en: 'Black just played Nd4 setting the trap! Do NOT play Nxe5? or Black will play Qg5 winning a rook and mating. Play Nxd4 or castle O-O.',
    },
    sequence: [
      { move: 'f3d4', san: 'Nxd4', label: { vi: '1. Nước chuẩn: Tiêu diệt Mã d4', en: '1. Safe move: Take d4 knight' } },
      { move: 'f3e5', san: 'Nxe5?', label: { vi: 'Tránh ăn e5: Sập bẫy Qg5', en: 'Avoid: Greedily taking e5' } },
    ],
  },
  // 5. Elephant Trap (Defensive Counter-Trap for Black in Queen\'s Gambit)
  {
    id: 'elephant_trap',
    name: {
      vi: 'Bẫy Voi (Elephant Trap)',
      en: 'Elephant Trap',
    },
    side: 'b',
    opening: "Queen's Gambit Declined",
    type: 'defensive',
    triggerPlacement: 'r1bqkb1r/pppn1ppp/5n2/3N2B1/3P4/8/PP2PPPP/R2QKBNR b',
    suggestedMoveUci: 'f6d5',
    punishAvoidUci: 'd7e5',
    description: {
      vi: 'Trắng tưởng ăn hơn tốt bằng Nxd5? Hãy ăn lại Mã bằng Nxd5! Nếu Trắng ham ăn Hậu (Bxd8), bạn sẽ chiếu Bb4+ bắt lại Hậu và lãi 1 quân nhẹ.',
      en: 'White thought they won a pawn with Nxd5? Take the knight with Nxd5! If White takes your queen with Bxd8, play Bb4+ to win back the queen and remain a piece ahead.',
    },
    sequence: [
      { move: 'f6d5', san: 'Nxd5!', label: { vi: '1. Ăn lại Mã d5', en: '1. Take d5 knight' } },
      { move: 'g5d8', san: 'Bxd8?', label: { vi: '2. Trắng sập bẫy ăn Hậu', en: '2. White takes Queen' } },
      { move: 'f8b4', san: 'Bb4+', label: { vi: '3. Tượng b4 chiếu Vua', en: '3. Bb4+ check' } },
      { move: 'd1d2', san: 'Qd2', label: { vi: '4. Hậu Trắng buộc chắn', en: '4. Queen blocks' } },
      { move: 'b4d2', san: 'Bxd2+', label: { vi: '5. Bắt lại Hậu Trắng', en: '5. Win back Queen' } },
      { move: 'e8d8', san: 'Kxd8', label: { vi: '6. Ăn lại Tượng, lãi 1 quân nhẹ (+3)', en: '6. Black +1 piece ahead (+3)' } },
    ],
  },
  // 6. Elephant Trap Warning (Defensive for White)
  {
    id: 'elephant_trap',
    name: {
      vi: 'Cảnh báo Bẫy Voi',
      en: 'Elephant Trap Alert',
    },
    side: 'w',
    opening: "Queen's Gambit Declined",
    type: 'defensive',
    triggerPlacement: 'r1bqkb1r/pppn1ppp/5n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR w',
    suggestedMoveUci: 'e2e3',
    punishAvoidUci: 'c3d5',
    description: {
      vi: 'Không được ăn Nxd5? vì Đen sẽ phản công bằng Nxd5! và Bb4+ bắt lại Hậu Trắng. Hãy chơi e3 củng cố trung tâm.',
      en: 'Do not play Nxd5? as Black responds with Nxd5! and Bb4+ winning back the Queen. Play e3 instead.',
    },
    sequence: [
      { move: 'e2e3', san: 'e3', label: { vi: '1. Nước an toàn: Giữ trung tâm', en: '1. Solid center move' } },
      { move: 'c3d5', san: 'Nxd5?', label: { vi: 'Tránh ăn: Sập bẫy Voi', en: 'Avoid: Springs Elephant Trap' } },
    ],
  },
  // 7. Fishing Pole Trap (Offensive: Black bait 5... h5)
  {
    id: 'fishing_pole',
    name: {
      vi: 'Bẫy Cần Câu (Fishing Pole Trap)',
      en: 'Fishing Pole Trap',
    },
    side: 'b',
    opening: 'Ruy Lopez / Berlin',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'minor',
    triggerPlacement: 'r1bqkb1r/pppp1pp1/2n5/1B2p2p/4P1P1/5N2/PPPP1PP1/RNBQ1RK1 b',
    suggestedMoveUci: 'h5g4',
    punishMoveUci: 'd8h4',
    description: {
      vi: 'Trắng đã sập bẫy khi ăn Mã g4 (hxg4?). Ăn lại bằng hxg4 mở toang cột h cho Xe, dọn đường đưa Hậu sang h4 chiếu hết không thể đỡ.',
      en: 'White fell into the trap by taking the knight (hxg4?). Recapture with hxg4 opening the h-file for your rook, leading to an unstoppable mating attack with Qh4.',
    },
    setupPositions: [
      {
        placement: 'r1bqkb1r/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b',
        nextMove: 'g8f6',
        remainingSteps: 3,
      },
      {
        placement: 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b',
        nextMove: 'f6g4',
        remainingSteps: 2,
      },
      {
        placement: 'r1bqkb1r/pppp1ppp/2n5/1B2p3/4P1n1/5N2/PPPP1PPP/RNBQ1RK1 w',
        nextMove: 'h2h3',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'h5g4', san: 'hxg4!', label: { vi: '1. Ăn lại tốt mở cột h', en: '1. Recapture opening h-file' } },
      { move: 'f3h2', san: 'Nh2', label: { vi: '2. Mã Trắng buộc lùi', en: '2. Knight retreats' } },
      { move: 'd8h4', san: 'Qh4', label: { vi: '3. Hậu vào h4 dọa chiếu hết', en: '3. Queen attacks h2/h1' } },
      { move: 'h4h2', san: 'Qxh2#', label: { vi: '4. Chiếu hết không thể đỡ!', en: '4. Unstoppable mate on h2!' } },
    ],
  },
  // 8. Fishing Pole Defense (Warning for White)
  {
    id: 'fishing_pole',
    name: {
      vi: 'Cảnh báo Bẫy Cần Câu',
      en: 'Fishing Pole Trap Alert',
    },
    side: 'w',
    opening: 'Ruy Lopez / Berlin',
    type: 'defensive',
    triggerPlacement: 'r1bqkb1r/pppp1pp1/2n5/1B2p2p/4P1n1/5N1P/PPPP1PP1/RNBQ1RK1 w',
    suggestedMoveUci: 'f1e1',
    punishAvoidUci: 'h3g4',
    description: {
      vi: 'Đen vừa giăng bẫy Cần câu với h5! Tuyệt đối không ăn hxg4? vì sẽ mở toang cột h cho Đen chiếu hết. Hãy chơi Re1 hoặc c3.',
      en: 'Black set the Fishing Pole trap with h5! Never play hxg4? opening the h-file to mate. Play Re1 or c3.',
    },
    sequence: [
      { move: 'f1e1', san: 'Re1', label: { vi: '1. Nước chuẩn: Giữ an toàn', en: '1. Safe move: Re1' } },
      { move: 'h3g4', san: 'hxg4?', label: { vi: 'Tránh ăn Mã: Sập bẫy mở cột h', en: 'Avoid: Mated along h-file' } },
    ],
  },
  // 9. Noah's Ark Trap (Ruy Lopez: Trapping White's light-squared Bishop on b3)
  {
    id: 'noahs_ark',
    name: {
      vi: "Bẫy Thuyền Noah (Noah's Ark Trap)",
      en: "Noah's Ark Trap",
    },
    side: 'b',
    opening: 'Ruy Lopez',
    type: 'offensive',
    triggerPlacement: 'r2qkbnr/3b1ppp/p2p4/1p1Q4/2p1P3/1B6/PPP2PPP/RNB1K2R w',
    suggestedMoveUci: 'c4b3',
    description: {
      vi: 'Tượng trắng ở b3 đã bị nhốt kín bởi các tốt b5 và c4. Tượng trắng chắc chắn sẽ bị bắt trong các nước tiếp theo.',
      en: "White's bishop on b3 is completely trapped by the pawns on b5 and c4. The bishop will inevitably fall.",
    },
    setupPositions: [
      {
        placement: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b',
        nextMove: 'a7a6',
        remainingSteps: 4,
      },
      {
        placement: 'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b',
        nextMove: 'd7d6',
        remainingSteps: 3,
      },
      {
        placement: 'r1bqkbnr/1ppp1ppp/p1np4/4p3/B2PP3/5N2/PPP2PPP/RNBQK2R b',
        nextMove: 'b7b5',
        remainingSteps: 2,
      },
    ],
    sequence: [
      { move: 'c4b3', san: 'cxb3!', label: { vi: '1. Bắt chết Tượng b3', en: '1. Trap and win bishop' } },
      { move: 'a2b3', san: 'axb3', label: { vi: '2. Trắng ăn lại', en: '2. White recaptures' } },
      { move: 'd7c6', san: 'Bc6', label: { vi: '3. Đen hơn 1 Tượng (+3)', en: '3. Black is up a bishop' } },
    ],
  },
  // 10. Noah's Ark Trap Warning (Defensive for White)
  {
    id: 'noahs_ark',
    name: {
      vi: "Cảnh báo Bẫy Thuyền Noah",
      en: "Noah's Ark Alert",
    },
    side: 'w',
    opening: 'Ruy Lopez',
    type: 'defensive',
    triggerPlacement: 'r1bqkb1r/2pp1ppp/p1n5/1p2p3/3PP3/1B3N2/PPP2PPP/RNBQK2R b',
    suggestedMoveUci: 'a2a4',
    description: {
      vi: 'Đen đang chuẩn bị dâng c5-c4 bắt sống Tượng b3. Hãy mở đường thoát cho Tượng bằng a4 hoặc c3 ngay lập tức.',
      en: 'Black is preparing c5-c4 to trap your b3 bishop. Create an escape square immediately with a4 or c3.',
    },
    sequence: [
      { move: 'a2a4', san: 'a4', label: { vi: '1. Mở lối thoát cho Tượng', en: '1. Escape route for bishop' } },
    ],
  },
  // 11. Fried Liver Attack Trap (Offensive: White plays 6. Nxf7!)
  {
    id: 'fried_liver',
    name: {
      vi: 'Bẫy Gan Chiên (Fried Liver Trap)',
      en: 'Fried Liver Attack',
    },
    side: 'w',
    opening: 'Two Knights Defense',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'minor',
    triggerPlacement: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w',
    suggestedMoveUci: 'g5f7',
    punishMoveUci: 'd1f3',
    description: {
      vi: 'Thí Mã vào f7 (Nxf7!) chĩa vào Hậu và Xe Đen, buộc Vua Đen phải ăn ra (Kxf7) rồi tung Qf3+ kéo Vua đối phương vào giữa tâm hỏa lực.',
      en: 'Sacrifice the knight on f7 (Nxf7!) attacking Queen and Rook, forcing the Black King out (Kxf7), followed by Qf3+ to dismantle the defense.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w',
        nextMove: 'g1f3',
        remainingSteps: 4,
      },
      {
        placement: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w',
        nextMove: 'f1c4',
        remainingSteps: 3,
      },
      {
        placement: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w',
        nextMove: 'f3g5',
        remainingSteps: 2,
      },
      {
        placement: 'r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R b',
        nextMove: 'f6d5',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'g5f7', san: 'Nxf7!', label: { vi: '1. Thí Mã bắt đôi Hậu & Xe', en: '1. Knight sacrifice fork' } },
      { move: 'e8f7', san: 'Kxf7', label: { vi: '2. Vua Đen buộc phải ăn ra', en: '2. King forced out' } },
      { move: 'd1f3', san: 'Qf3+', label: { vi: '3. Hậu chiếu kéo Vua vào bão lửa', en: '3. Qf3+ double attack' } },
      { move: 'f7e6', san: 'Ke6', label: { vi: '4. Vua Đen phải bò lên e6 giữ quân', en: '4. King forced to e6' } },
      { move: 'b1c3', san: 'Nc3', label: { vi: '5. Gia tăng sức ép hủy diệt', en: '5. Overwhelming pressure' } },
    ],
  },
  // 12. Fried Liver Attack Warning (Defensive for Black)
  {
    id: 'fried_liver',
    name: {
      vi: 'Cảnh báo Bẫy Gan Chiên',
      en: 'Fried Liver Defense Alert',
    },
    side: 'b',
    opening: 'Two Knights Defense',
    type: 'defensive',
    triggerPlacement: 'r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R b',
    suggestedMoveUci: 'c6a5',
    punishAvoidUci: 'f6d5',
    description: {
      vi: 'Tuyệt đối không ăn Nxd5? vì sẽ dính đòn Nxf7 tàn khốc! Hãy chơi Na5 phản công Tượng c4 theo biến Polerio chuẩn xác.',
      en: 'Never recapture with Nxd5? falling into the lethal Nxf7 sacrifice! Play Na5 counter-attacking the c4 bishop (Polerio defense).',
    },
    sequence: [
      { move: 'c6a5', san: 'Na5!', label: { vi: '1. Nước chuẩn: Đuổi Tượng c4', en: '1. Best move: Attack c4 bishop' } },
      { move: 'f6d5', san: 'Nxd5?', label: { vi: 'Tránh ăn d5: Sập bẫy Nxf7', en: 'Avoid: Leads to Nxf7 sacrifice' } },
    ],
  },
  // 13. Englund Gambit Trap (Offensive: Black attacks b2 & Bishop)
  {
    id: 'englund_trap',
    name: {
      vi: 'Bẫy Englund Gambit',
      en: 'Englund Gambit Trap',
    },
    side: 'b',
    opening: 'Englund Gambit',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'queen',
    triggerPlacement: 'r1b1kbnr/pppp1ppp/2n5/4P3/1q3B2/5N2/PPP1PPPP/RN1QKB1R w',
    suggestedMoveUci: 'b4b2',
    description: {
      vi: 'Đen tung đòn Qb4+ bắt đôi Tượng f4 và tốt b2. Sau khi Trắng cản chiếu (Bd2), hãy ăn tốt b2 (Qxb2) đe dọa ăn Xe a1 hoặc chiếu hết.',
      en: 'Black plays Qb4+ double attacking the f4 bishop and b2 pawn. When White parries with Bd2, capture Qxb2 threatening the a1 rook and mate.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b',
        nextMove: 'e7e5',
        remainingSteps: 3,
      },
      {
        placement: 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR b',
        nextMove: 'b8c6',
        remainingSteps: 2,
      },
      {
        placement: 'r1bqkbnr/pppp1ppp/2n5/4P3/8/5N2/PPP1PPPP/RNBQKB1R b',
        nextMove: 'd8e7',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'b4b2', san: 'Qxb2!', label: { vi: '1. Ăn tốt b2 dọa Xe a1', en: '1. Attack a1 rook' } },
      { move: 'f4d2', san: 'Bc3', label: { vi: '2. Trắng tìm cách phản công Hậu', en: '2. White counter-attacks' } },
      { move: 'f8b4', san: 'Bb4!', label: { vi: '3. Ghim Tượng c3', en: '3. Pin bishop' } },
      { move: 'd1d2', san: 'Qd2', label: { vi: '4. Trắng phòng thủ Hậu', en: '4. Queen defends' } },
      { move: 'b4c3', san: 'Bxc3', label: { vi: '5. Bắt Tượng hoặc chiếu hết c1', en: '5. Win piece or mate' } },
    ],
  },
  // 14. Englund Gambit Warning (Defensive for White)
  {
    id: 'englund_trap',
    name: {
      vi: 'Cảnh báo Bẫy Englund Gambit',
      en: 'Englund Gambit Alert',
    },
    side: 'w',
    opening: 'Englund Gambit',
    type: 'defensive',
    triggerPlacement: 'r1b1kbnr/pppp1ppp/2n5/4P3/8/5N2/PPP1PPPP/RNBQKB1R b',
    suggestedMoveUci: 'b1c3',
    description: {
      vi: 'Phòng thủ trước đòn Qb4+ của Đen bằng cách phát triển Nc3 kiểm soát trung tâm an toàn.',
      en: 'Defend against Black Qb4+ threats by developing Nc3 solidly.',
    },
    sequence: [
      { move: 'b1c3', san: 'Nc3', label: { vi: '1. Phát triển chắc chắn', en: '1. Solid development' } },
    ],
  },
  // 15. Stafford Gambit Trap (Offensive for Black: 6... Nxe4!)
  {
    id: 'stafford_gambit',
    name: {
      vi: 'Bẫy Stafford Gambit',
      en: 'Stafford Gambit Trap',
    },
    side: 'b',
    opening: 'Petrov Defense / Stafford',
    type: 'offensive',
    triggerPlacement: 'r1bqk2r/ppp2ppp/2p2n2/2b3B1/4P3/3P4/PPP2PPP/RN1QKB1R b',
    suggestedMoveUci: 'f6e4',
    punishMoveUci: 'c5f2',
    description: {
      vi: 'Thí Hậu bằng Nxe4! Nếu Trắng tham lam ăn Hậu (Bxd8), Đen sẽ chiếu hết chớp nhoáng với Bxf2+ Ke2 Bg4#.',
      en: 'Queen sacrifice with Nxe4! If White greedily captures your Queen with Bxd8, Black forces checkmate with Bxf2+ Ke2 Bg4#.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b',
        nextMove: 'g8f6',
        remainingSteps: 3,
      },
      {
        placement: 'rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b',
        nextMove: 'b8c6',
        remainingSteps: 2,
      },
      {
        placement: 'r1bqkb1r/ppp2ppp/2n2n2/4p3/4P3/8/PPP2PPP/RNBQKB1R w',
        nextMove: 'd2d3',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'f6e4', san: 'Nxe4!', label: { vi: '1. Thí Hậu gài bẫy', en: '1. Queen sacrifice bait' } },
      { move: 'g5d8', san: 'Bxd8?', label: { vi: '2. Trắng sập bẫy ăn Hậu', en: '2. White takes Queen' } },
      { move: 'c5f2', san: 'Bxf2+', label: { vi: '3. Tượng f2 chiếu Vua', en: '3. Bishop check' } },
      { move: 'e1e2', san: 'Ke2', label: { vi: '4. Vua Trắng buộc chạy lên e2', en: '4. King forced' } },
      { move: 'c8g4', san: 'Bg4#', label: { vi: '5. Tượng g4 chiếu hết!', en: '5. Bishop checkmate!' } },
    ],
  },
  // 16. Stafford Gambit Defense (Warning for White)
  {
    id: 'stafford_gambit',
    name: {
      vi: 'Cảnh báo Bẫy Stafford Gambit',
      en: 'Stafford Gambit Alert',
    },
    side: 'w',
    opening: 'Petrov Defense / Stafford',
    type: 'defensive',
    triggerPlacement: 'r1bqk2r/ppp2ppp/2p5/2b3B1/4n3/3P4/PPP2PPP/RN1QKB1R w',
    suggestedMoveUci: 'd3e4',
    punishAvoidUci: 'g5d8',
    description: {
      vi: 'Đen vừa thí Hậu với Nxe4! Tuyệt đối không ăn Bxd8? vì sẽ dính Bxf2+ và Bg4# chiếu hết ngay. Hãy ăn dxe4 bắt Mã an toàn.',
      en: 'Black just sacrificed Queen with Nxe4! Do NOT play Bxd8? leading to Bxf2+ and Bg4# mate. Play dxe4 capturing the knight.',
    },
    sequence: [
      { move: 'd3e4', san: 'dxe4', label: { vi: '1. Nước đúng: Ăn Mã dẹp tan đòn bẫy', en: '1. Safe move: Take knight' } },
      { move: 'g5d8', san: 'Bxd8?', label: { vi: 'Tránh ăn Hậu: Bị chiếu bí', en: 'Avoid: Checkmated in 2 moves' } },
    ],
  },
  // 17. Scholar's Mate Trap (Offensive: White plays Qxf7#)
  {
    id: 'scholars_mate',
    name: {
      vi: 'Bẫy Chiếu hết 4 nước (Scholar\'s Mate)',
      en: "Scholar's Mate",
    },
    side: 'w',
    opening: "Scholar's Attack",
    type: 'offensive',
    triggerPlacement: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w',
    suggestedMoveUci: 'h5f7',
    description: {
      vi: 'Đen sơ hở không phòng thủ tốt f7! Tung đòn Qxf7# chiếu hết chỉ sau 4 nước đi!',
      en: 'Black blundered leaving f7 undefended! Strike with Qxf7# delivering checkmate in 4 moves!',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w',
        nextMove: 'd1h5',
        remainingSteps: 2,
      },
      {
        placement: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w',
        nextMove: 'f1c4',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'h5f7', san: 'Qxf7#', label: { vi: '1. Hậu ăn f7 chiếu hết!', en: '1. Qxf7# checkmate!' } },
    ],
  },
  // 18. Scholar's Mate Defense (Warning for Black)
  {
    id: 'scholars_mate',
    name: {
      vi: 'Phòng thủ Chiếu hết 4 nước',
      en: "Scholar's Mate Defense",
    },
    side: 'b',
    opening: "Scholar's Attack",
    type: 'defensive',
    triggerPlacement: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b',
    suggestedMoveUci: 'g7g6',
    punishAvoidUci: 'g8f6',
    description: {
      vi: 'Trắng đang nhăm nhe ăn f7 chiếu hết! Tuyệt đối không đi Nf6? vì sẽ bị Qxf7# ngay. Hãy đi g6 đuổi Hậu.',
      en: 'White threatens Qxf7# mate! Do not play Nf6? losing on the spot. Play g6 kicking the Queen.',
    },
    sequence: [
      { move: 'g7g6', san: 'g6', label: { vi: '1. Nước chuẩn: Chặn đường Hậu', en: '1. Best move: Block Queen' } },
      { move: 'g8f6', san: 'Nf6?', label: { vi: 'Tránh đi: Bị Qxf7# chiếu hết', en: 'Avoid: Mated by Qxf7#' } },
    ],
  },
  // 19. Fool's Mate (Offensive for Black: 2... Qh4#)
  {
    id: 'fools_mate',
    name: {
      vi: 'Bẫy Kẻ Khờ (Fool\'s Mate)',
      en: "Fool's Mate",
    },
    side: 'b',
    opening: 'Flank blunder',
    type: 'offensive',
    triggerPlacement: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b',
    suggestedMoveUci: 'd8h4',
    description: {
      vi: 'Trắng mở toang đường chéo e1-h4 tự sát! Tung đòn Qh4# chiếu hết ngay lập tức sau 2 nước đi.',
      en: 'White blundered with f3 and g4 opening the e1-h4 diagonal! Play Qh4# delivering the fastest checkmate in chess.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b',
        nextMove: 'e7e5',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'd8h4', san: 'Qh4#', label: { vi: '1. Qh4# Chiếu hết chớp nhoáng!', en: '1. Qh4# Fast checkmate!' } },
    ],
  },
  // 20. Halosar Trap in Blackmar-Diemer Gambit (Offensive for White)
  {
    id: 'halosar_trap',
    name: {
      vi: 'Bẫy Halosar',
      en: 'Halosar Trap',
    },
    side: 'w',
    opening: 'Blackmar-Diemer Gambit',
    type: 'offensive',
    triggerPlacement: 'r3kbnr/ppp1pppp/8/1N6/1q4b1/4BQ2/PPP3PP/2KR1BNR w',
    suggestedMoveUci: 'b5c7',
    description: {
      vi: 'Đen dâng Hậu và Tượng gài bắt Hậu nhưng để hở ô c7. Tung đòn Nxc7# chiếu bí Vua Đen tuyệt hảo!',
      en: 'Black pinned your Queen but left c7 undefended. Strike with Nxc7# smothered mate on the black King!',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w',
        nextMove: 'e2e4',
        remainingSteps: 3,
      },
      {
        placement: 'rnbqkbnr/ppp1pppp/8/8/3Pp3/8/PPP1PPPP/RNBQKBNR w',
        nextMove: 'b1c3',
        remainingSteps: 2,
      },
      {
        placement: 'rnbqkbnr/ppp1pppp/8/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w',
        nextMove: 'f2f3',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'b5c7', san: 'Nxc7#', label: { vi: '1. Mã c7 chiếu hết!', en: '1. Nxc7# checkmate!' } },
    ],
  },
  // 21. Siberian Trap in Smith-Morra Gambit (Offensive for Black)
  {
    id: 'siberian_trap',
    name: {
      vi: 'Bẫy Siberia (Siberian Trap)',
      en: 'Siberian Trap',
    },
    side: 'b',
    opening: 'Smith-Morra Gambit',
    type: 'offensive',
    triggerPlacement: 'r1b1k2r/ppq2ppp/2n1pn2/8/2BN2n1/2N4P/PP2QPP1/R1B2RK1 b',
    suggestedMoveUci: 'c6d4',
    description: {
      vi: 'Trắng vừa chơi h3? Đen tung đòn Nd4! đe dọa ăn Hậu e2 và chiếu hết ở h2 (Qxh2#). Trắng không thể chống đỡ cả hai đe dọa.',
      en: 'White played h3? Black counter-strikes with Nd4! attacking the e2 Queen and threatening Qxh2# mate simultaneously.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w',
        nextMove: 'd2d4',
        remainingSteps: 4,
      },
      {
        placement: 'rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b',
        nextMove: 'd4c3',
        remainingSteps: 3,
      },
      {
        placement: 'r1bqkbnr/pp1ppppp/2n5/8/4P3/2N5/PP3PPP/R1BQKBNR b',
        nextMove: 'e7e6',
        remainingSteps: 2,
      },
      {
        placement: 'r1b1kbnr/pp1p1ppp/2n1p3/8/2B1P3/2N2N2/PP3PPP/R1BQK2R b',
        nextMove: 'd8c7',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'c6d4', san: 'Nd4!', label: { vi: '1. Nhảy Mã d4 bắt đôi Hậu & dọa Qxh2#', en: '1. Nd4! double threat on Queen & h2 mate' } },
      { move: 'e2d3', san: 'Qd3', label: { vi: '2. Hậu chạy', en: '2. Queen runs' } },
      { move: 'c7h2', san: 'Qxh2#', label: { vi: '3. Qxh2# Chiếu hết!', en: '3. Qxh2# Checkmate!' } },
    ],
  },
  // 22. Budapest Gambit Trap (Offensive for Black: Smothered Mate)
  {
    id: 'budapest_trap',
    name: {
      vi: 'Bẫy Budapest Gambit',
      en: 'Budapest Gambit Trap',
    },
    side: 'b',
    opening: 'Budapest Gambit',
    type: 'offensive',
    triggerPlacement: 'r1b1k2r/ppppqppp/2n5/4n3/1PP2B2/P4N2/3NPPPP/R2QKB1R b',
    suggestedMoveUci: 'e5d3',
    description: {
      vi: 'Trắng vừa tham lam chơi a3 hoặc axb4? Tung đòn Nd3# chiếu bí smothered mate vì tốt e2 bị ghim bởi Hậu e7!',
      en: 'White played a3 or axb4? Deliver smothered mate with Nd3#! The e2 pawn is pinned by the e7 Queen.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b',
        nextMove: 'g8f6',
        remainingSteps: 4,
      },
      {
        placement: 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b',
        nextMove: 'e7e5',
        remainingSteps: 3,
      },
      {
        placement: 'rnbqkb1r/pppp1ppp/8/4P3/2P3n1/8/PP2PPPP/RNBQKBNR b',
        nextMove: 'b8c6',
        remainingSteps: 2,
      },
      {
        placement: 'r1bqkb1r/pppp1ppp/2n5/4P3/2P2Bn1/5N2/PP2PPPP/RN1QKB1R b',
        nextMove: 'f8b4',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'e5d3', san: 'Nd3#', label: { vi: '1. Mã d3 chiếu bí ngọt ngào!', en: '1. Nd3# Smothered checkmate!' } },
    ],
  },
  // 23. Kadas / Mortimer Trap (Offensive for White)
  {
    id: 'kadas_trap',
    name: {
      vi: 'Bẫy Mortimer (Kadas Trap)',
      en: 'Mortimer Trap (White variant)',
    },
    side: 'w',
    opening: 'Ruy Lopez',
    type: 'offensive',
    triggerPlacement: 'r1bqkb1r/ppppnppp/2n5/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R w',
    suggestedMoveUci: 'f3e5',
    description: {
      vi: 'Đen vừa lùi Mã về e7 để gài bẫy. Trắng kiểm soát bằng cách đẩy d4 hoặc chiếm trung tâm.',
      en: 'Black played Ne7 aiming for tricky lines. White seizes advantage by striking in the center.',
    },
    setupPositions: [
      {
        placement: 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R b',
        nextMove: 'f6e7',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'f3e5', san: 'Nxe5', label: { vi: '1. Chiếm trung tâm', en: '1. Seize center' } },
    ],
  },
  // 24. Mortimer Trap (Offensive for Black in Ruy Lopez)
  {
    id: 'mortimer_trap',
    name: {
      vi: 'Bẫy Mortimer (Mortimer Trap for Black)',
      en: 'Mortimer Trap',
    },
    side: 'b',
    opening: 'Ruy Lopez',
    type: 'offensive',
    triggerPlacement: 'r1bqkb1r/pppp1ppp/2n5/1B2N3/4P3/3P4/PPP2PPP/RNBQK2R b',
    suggestedMoveUci: 'c7c6',
    description: {
      vi: 'Trắng sập bẫy ăn Nxe5? Đen phản công c6! Đe dọa Tượng b5 và chuẩn bị tung Qa5+ bắt sống Mã e5.',
      en: 'White took the bait with Nxe5? Black plays c6! Threatening the b5 bishop and setting up Qa5+ fork to win a piece.',
    },
    setupPositions: [
      {
        placement: 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R b',
        nextMove: 'f6e7',
        remainingSteps: 2,
      },
      {
        placement: 'r1bqkb1r/ppppnppp/2n5/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R w',
        nextMove: 'f3e5',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'c7c6', san: 'c6!', label: { vi: '1. Đuổi Tượng b5 & mở đường Qa5+', en: '1. Attack bishop & prepare Qa5+' } },
      { move: 'b5c4', san: 'Bc4', label: { vi: '2. Tượng Trắng chạy', en: '2. Bishop retreats' } },
      { move: 'd8a5', san: 'Qa5+', label: { vi: '3. Hậu a5 chiếu bắt đôi Mã e5', en: '3. Qa5+ fork winning knight' } },
    ],
  },
  // 25. Tennison Gambit Interceptor Trap (Offensive for White)
  {
    id: 'tennison_gambit',
    name: {
      vi: 'Bẫy Tennison Gambit',
      en: 'Tennison Gambit Trap',
    },
    side: 'w',
    opening: 'Scandinavian / Tennison',
    type: 'offensive',
    triggerPlacement: 'rnb1kbnr/ppp1pppp/8/8/3q4/2N3N1/PPP2PPP/R1BQKB1R w',
    suggestedMoveUci: 'f1b5',
    description: {
      vi: 'Đen ham ăn tốt đưa Hậu ra d4 sơ hở. Tung đòn Bb5+ chiếu Vua, sau đó ăn sống Hậu Đen bằng Qxd4!',
      en: 'Black queen is exposed on d4. Play Bb5+ checking the King and winning the queen with Qxd4 next move!',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b',
        nextMove: 'd7d5',
        remainingSteps: 2,
      },
      {
        placement: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R b',
        nextMove: 'd5e4',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'f1b5', san: 'Bb5+', label: { vi: '1. Tượng b5 chiếu phát giác', en: '1. Bb5+ discovery check' } },
      { move: 'c7c6', san: 'c6', label: { vi: '2. Đen cản chiếu', en: '2. Black blocks' } },
      { move: 'd1d4', san: 'Qxd4', label: { vi: '3. Bắt sống Hậu (+9)', en: '3. Win Queen (+9)' } },
    ],
  },
  // 26. Rubinstein Trap in French Defense (Offensive for White)
  {
    id: 'rubinstein_trap',
    name: {
      vi: 'Bẫy Rubinstein',
      en: 'Rubinstein Trap',
    },
    side: 'w',
    opening: 'French Defense',
    type: 'offensive',
    triggerPlacement: 'r1b2rk1/pp1nbppp/1q2pn2/2p3B1/3PN3/3B1N2/PPP1QPPP/2KR3R w',
    suggestedMoveUci: 'd4c5',
    description: {
      vi: 'Trắng khai thác việc Đen vội nhập thành khi chưa giải quyết xong cánh Vua. Chuẩn bị đòn thí Tượng kinh điển Bxh7+!',
      en: 'White exploits Black castling into kingside fire. Prepares the classic Bxh7+ Greek gift sacrifice.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w',
        nextMove: 'd2d4',
        remainingSteps: 3,
      },
      {
        placement: 'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w',
        nextMove: 'b1c3',
        remainingSteps: 2,
      },
      {
        placement: 'rnbqkbnr/ppp2ppp/4p3/8/3Pn3/2N5/PPP2PPP/R1BQKBNR w',
        nextMove: 'c3e4',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'd4c5', san: 'dxc5', label: { vi: '1. Phá vỡ cấu trúc tốt Đen', en: '1. Break pawn structure' } },
    ],
  },
  // 27. Tarrasch Trap in Ruy Lopez (Offensive for White)
  {
    id: 'tarrasch_trap',
    name: {
      vi: 'Bẫy Tarrasch (Tarrasch Trap)',
      en: 'Tarrasch Trap',
    },
    side: 'w',
    opening: 'Ruy Lopez Open',
    type: 'offensive',
    triggerPlacement: 'r1b1k2r/2q1bppp/p2p1n2/1p2p3/3BPP2/1BN5/PPP3PP/R2Q1RK1 w',
    suggestedMoveUci: 'f4e5',
    description: {
      vi: 'Mở toang cột f và trung tâm. Đen rơi vào thế bị ghim chéo và mất chất nặng nề.',
      en: 'Pries open the f-file and center. Black falls into severe pins and loses material.',
    },
    setupPositions: [
      {
        placement: 'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w',
        nextMove: 'e1g1',
        remainingSteps: 2,
      },
    ],
    sequence: [
      { move: 'f4e5', san: 'fxe5', label: { vi: '1. Mở toang cột f tấn công', en: '1. Open f-file attack' } },
    ],
  },
  // 28. Monticelli Trap in Bogo-Indian Defense (Offensive for White)
  {
    id: 'monticelli_trap',
    name: {
      vi: 'Bẫy Monticelli (Monticelli Trap)',
      en: 'Monticelli Trap',
    },
    side: 'w',
    opening: 'Bogo-Indian Defense',
    type: 'offensive',
    triggerPlacement: 'r1bqk2r/pp1p1ppp/2n1pn2/8/1bPP4/2N2N2/PP2BPPP/R1BQK2R w',
    suggestedMoveUci: 'e1g1',
    description: {
      vi: 'Nhập thành an toàn, chuẩn bị đòn d5 và Qa4+ bắt đôi Tượng b4 và Vua Đen nếu Đen mất cảnh giác.',
      en: 'Castle safely, preparing d5 and Qa4+ double attack against the b4 bishop if Black is careless.',
    },
    setupPositions: [
      {
        placement: 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b',
        nextMove: 'e7e6',
        remainingSteps: 2,
      },
      {
        placement: 'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R b',
        nextMove: 'f8b4',
        remainingSteps: 1,
      },
    ],
    sequence: [
      { move: 'e1g1', san: 'O-O', label: { vi: '1. Nhập thành an toàn', en: '1. Castle King to safety' } },
    ],
  },
  // 29. Damiano Defense Trap (Extreme Minor Sacrifice: 3. Nxe5!)
  {
    id: 'damiano_trap',
    name: {
      vi: 'Bẫy Thí Mã Damiano (Damiano Trap)',
      en: "Damiano's Trap",
    },
    side: 'w',
    opening: 'Damiano Defense',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'minor',
    triggerPlacement: 'rnbqkbnr/pppp2pp/5p2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w',
    suggestedMoveUci: 'f3e5',
    punishMoveUci: 'd1h5',
    description: {
      vi: 'Thí Mã Nxe5 cực mạnh! Nếu Đen sập bẫy ăn Mã (fxe5?), Trắng tung Qh5+ tàn phá Vua Đen và bắt Xe h8.',
      en: 'Audacious knight sacrifice with Nxe5! If Black recaptures (fxe5?), White unleashes Qh5+ devastating Black King and winning the rook.',
    },
    setupPositions: [
      {
        placement: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b',
        nextMove: 'e7e5',
        remainingSteps: 3,
      },
      {
        placement: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b',
        nextMove: 'f7f6',
        remainingSteps: 2,
      },
    ],
    sequence: [
      { move: 'f3e5', san: 'Nxe5!', label: { vi: '1. Thí Mã cực mạnh', en: '1. Extreme Knight sacrifice' } },
      { move: 'f6e5', san: 'fxe5?', label: { vi: '2. Đen sập bẫy ăn Mã', en: '2. Black greedily captures knight' } },
      { move: 'd1h5', san: 'Qh5+', label: { vi: '3. Hậu chiếu kéo Vua ra ngoài', en: '3. Queen checks' } },
      { move: 'e8e7', san: 'Ke7', label: { vi: '4. Vua Đen buộc chạy', en: '4. Black King forced' } },
      { move: 'h5e5', san: 'Qxe5+', label: { vi: '5. Ăn tốt e5 chiếu bắt Xe h8', en: '5. Fork King & Rook' } },
    ],
    branches: {
      'd8e7': {
        transitionMove: 'e5f3',
        label: {
          vi: 'Đen né bằng Qe7! Lùi Mã về f3 lãi trọn 1 tốt trung tâm',
          en: 'Black played Qe7! Retreat Knight to f3 winning a clean pawn',
        },
      },
    },
  },
  // 30. Greek Gift Bishop Sacrifice Trap (Extreme Minor Sacrifice: Bxh7+!)
  {
    id: 'greek_gift_trap',
    name: {
      vi: 'Bẫy Thí Tượng Hy Lạp (Greek Gift)',
      en: 'Greek Gift Sacrifice Trap',
    },
    side: 'w',
    opening: 'French / Classic Colle',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'minor',
    triggerPlacement: 'r1bq1rk1/ppp2ppp/2n1pn2/8/1bPP4/2NB1N2/PP3PPP/R1BQK2R w',
    suggestedMoveUci: 'd3h7',
    punishMoveUci: 'f3g5',
    description: {
      vi: 'Thí Tượng kinh điển Bxh7+! Xé toang hoàng thành Vua Đen, theo sau là Ng5+ và Qh5 chiếu hết không thể chống đỡ.',
      en: 'Classic Greek Gift Bishop sacrifice with Bxh7+! Rips open Black king fortress, followed by Ng5+ and Qh5 checkmate.',
    },
    sequence: [
      { move: 'd3h7', san: 'Bxh7+!', label: { vi: '1. Thí Tượng xé toang thành', en: '1. Bishop sacrifice on h7' } },
      { move: 'g8h7', san: 'Kxh7', label: { vi: '2. Vua Đen ăn Tượng', en: '2. Black King accepts' } },
      { move: 'f3g5', san: 'Ng5+', label: { vi: '3. Mã lao lên chiếu', en: '3. Knight checks' } },
      { move: 'h7g8', san: 'Kg8', label: { vi: '4. Vua Đen lùi về', en: '4. King retreats' } },
      { move: 'd1h5', san: 'Qh5', label: { vi: '5. Hậu lên dọa chiếu hết', en: '5. Qh5 mating attack' } },
    ],
  },
  // 31. Boden's Mate Queen Sacrifice Trap (Extreme Queen Sacrifice: Qxc6+!)
  {
    id: 'boden_mate_trap',
    name: {
      vi: "Bẫy Chiếu Hết Boden (Boden's Mate)",
      en: "Boden's Mate Trap",
    },
    side: 'w',
    opening: 'Caro-Kann / Philidor',
    type: 'offensive',
    isExtremeSacrifice: true,
    sacrificeLevel: 'queen',
    triggerPlacement: '2kr1b1r/pp1n1ppp/2p1pn2/8/8/2NP1Q2/PPPB1PPP/R4RK1 w',
    suggestedMoveUci: 'f3c6',
    punishMoveUci: 'd2a6',
    description: {
      vi: 'Tuyệt phẩm thí Hậu Qxc6+! Buộc tốt Đen phải ăn ra (bxc6), lập tức Tượng d2 đâm Ba6# chiếu hết chéo hình chữ X.',
      en: 'Legendary Queen sacrifice Qxc6+! Forces bxc6 recapture, allowing bishop Ba6# criss-cross checkmate.',
    },
    sequence: [
      { move: 'f3c6', san: 'Qxc6+!', label: { vi: '1. Thí Hậu cực đỉnh', en: '1. Extreme Queen sacrifice' } },
      { move: 'b7c6', san: 'bxc6', label: { vi: '2. Đen buộc ăn Hậu', en: '2. Black forced to take Queen' } },
      { move: 'd2a6', san: 'Ba6#', label: { vi: '3. Tượng a6 chiếu hết!', en: '3. Ba6# Criss-cross mate!' } },
    ],
  },
]);

/**
 * Matches a chess position against the classic opening traps catalog.
 *
 * @param {string} fen - Candidate FEN string.
 * @param {object} [options] - Additional match context.
 * @param {{ from: string, to: string }} [options.lastMove] - Coordinate pair of the last move.
 * @returns {object | null} Matched opening trap record or null when no pattern matches.
 */
export function matchOpeningTrap(fen, options = {}) {
  const normalized = normalizeFenPlacement(fen);
  if (!normalized) {
    return null;
  }

  // Exact trigger placement match
  const match = OPENING_TRAPS.find((trap) => trap.triggerPlacement === normalized);
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    name: match.name,
    side: match.side,
    opening: match.opening,
    type: match.type,
    suggestedMoveUci: match.suggestedMoveUci,
    punishMoveUci: match.punishMoveUci,
    punishAvoidUci: match.punishAvoidUci,
    description: match.description,
    sequence: match.sequence || [],
    isExtremeSacrifice: Boolean(match.isExtremeSacrifice),
    sacrificeLevel: match.sacrificeLevel || null,
    branches: match.branches || null,
    fallbackTrapId: match.fallbackTrapId || null,
  };
}

/**
 * Discovers achievable traps and required setup moves from current board state.
 *
 * @param {string | null | undefined} fen - Current board FEN string.
 * @param {{ currentSide?: 'w' | 'b' }} [options] - Search options including active perspective side.
 * @returns {Array<{ trap: object, nextSetupMove: string, remainingSteps: number }>} Sorted achievable traps.
 */
export function findProactiveTraps(fen, { currentSide } = {}) {
  const norm = normalizeFenPlacement(fen);
  if (!norm) {
    return [];
  }

  const turn = norm.split(' ')[1] || 'w';
  const targetSide = currentSide || turn;

  const results = [];

  for (const trap of OPENING_TRAPS) {
    // Only search traps that match the player's color
    if (trap.side !== targetSide) {
      continue;
    }

    // Culmination state check (1 step away from springing trap)
    if (trap.triggerPlacement === norm) {
      results.push({
        trap,
        nextSetupMove: trap.suggestedMoveUci,
        remainingSteps: 1,
      });
      continue;
    }

    // Early setup state check
    if (Array.isArray(trap.setupPositions)) {
      const match = trap.setupPositions.find((s) => s.placement === norm);
      if (match) {
        results.push({
          trap,
          nextSetupMove: match.nextMove,
          remainingSteps: match.remainingSteps || 2,
        });
      }
    }
  }

  // Sort by closest trap first (fewest remaining steps)
  return results.sort((a, b) => a.remainingSteps - b.remainingSteps);
}

const TACTICAL_GAP_MIN_WIN = 14;
const TACTICAL_GAP_MIN_CP = 140;
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Extracts the chess piece at a given algebraic square from a FEN string.
 *
 * @param {string} fen - FEN string.
 * @param {string} square - Algebraic square name like 'f7', 'e4'.
 * @returns {{ type: string, color: 'w' | 'b' } | null} Piece descriptor or null when empty/invalid.
 */
function getPieceAtSquare(fen, square) {
  if (typeof fen !== 'string' || typeof square !== 'string' || square.length < 2) {
    return null;
  }
  const placement = fen.trim().split(/\s+/)[0];
  const rows = placement.split('/');
  const fileIdx = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIdx = 8 - parseInt(square[1], 10);
  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) {
    return null;
  }
  const row = rows[rankIdx];
  if (!row) {
    return null;
  }
  let col = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) {
      col += parseInt(ch, 10);
    } else {
      if (col === fileIdx) {
        return {
          type: ch.toLowerCase(),
          color: ch === ch.toUpperCase() ? 'w' : 'b',
        };
      }
      col++;
    }
  }
  return null;
}

/**
 * Detects dynamic tactical piece sacrifices (Queen, Rook, Minor piece) that lead to decisive attack or mate.
 *
 * @param {{
 *   fen: string,
 *   bestMoveUci: string,
 *   evalScore: { cp: number | null, mate: number | null },
 *   secondBestEval?: { cp: number | null, mate: number | null } | null,
 *   pv?: string[],
 * }} params - Engine evaluation metrics and line data.
 * @returns {object | null} Extreme sacrificial trap descriptor or null.
 */
export function detectSacrificialTrap({ fen, bestMoveUci, evalScore, secondBestEval, pv }) {
  if (!bestMoveUci || !evalScore || !Array.isArray(pv) || pv.length === 0) {
    return null;
  }

  const squares = uciToMoveSquares(bestMoveUci);
  if (!squares?.from || !squares?.to) {
    return null;
  }

  const movedPiece = getPieceAtSquare(fen, squares.from);
  if (!movedPiece) {
    return null;
  }

  const capturedPiece = getPieceAtSquare(fen, squares.to);
  const replyUci = pv[1] ?? null;
  const replySquares = replyUci ? uciToMoveSquares(replyUci) : null;

  // A sacrifice requires the opponent's best reply to recapture on the destination square
  const isRecaptured = replySquares && replySquares.to === squares.to;
  const movedVal = PIECE_VALUES[movedPiece.type] ?? 0;
  const capturedVal = capturedPiece ? (PIECE_VALUES[capturedPiece.type] ?? 0) : 0;
  const netMaterialLoss = movedVal - capturedVal;

  // Sacrifice threshold: net loss >= 2 (e.g. Bishop for Pawn = 3-1 = 2, Knight for nothing = 3, Queen for Rook = 9-5 = 4)
  if (!isRecaptured || netMaterialLoss < 2) {
    return null;
  }

  let sacrificeLevel = 'minor';
  if (movedPiece.type === 'q') {
    sacrificeLevel = 'queen';
  } else if (movedPiece.type === 'r') {
    sacrificeLevel = 'rook';
  } else if (movedPiece.type === 'b' || movedPiece.type === 'n') {
    sacrificeLevel = 'minor';
  } else if (movedPiece.type === 'p') {
    sacrificeLevel = 'pawn';
  }

  const parts = typeof fen === 'string' ? fen.trim().split(/\s+/) : [];
  const side = parts[1] === 'b' ? 'b' : 'w';

  const sequence = pv.slice(0, 5).map((uci, idx) => ({
    move: uci,
    san: uci,
    stepNumber: idx + 1,
    label: {
      vi:
        idx === 0
          ? `1. Thí ${sacrificeLevel === 'queen' ? 'Hậu' : sacrificeLevel === 'rook' ? 'Xe' : 'Quân'} cực mạnh`
          : idx % 2 === 1
            ? `${idx + 1}. Đối thủ ăn mồi`
            : `${idx + 1}. Trừng phạt kết liễu`,
      en:
        idx === 0
          ? `1. Extreme ${sacrificeLevel} sacrifice`
          : idx % 2 === 1
            ? `${idx + 1}. Opponent takes bait`
            : `${idx + 1}. Crushing strike`,
    },
  }));

  return {
    id: 'dynamic_sacrifice_trap',
    name: {
      vi: `🔥 Thí ${sacrificeLevel === 'queen' ? 'Hậu' : sacrificeLevel === 'rook' ? 'Xe' : 'quân'} cực mạnh (Extreme Sacrifice)`,
      en: `🔥 Extreme ${sacrificeLevel.toUpperCase()} Sacrifice Trap`,
    },
    side,
    opening: 'Tactical Sacrifice Trap',
    type: 'tactical',
    isExtremeSacrifice: true,
    sacrificeLevel,
    suggestedMoveUci: bestMoveUci,
    description: {
      vi: `Đòn thí quân cực mạnh: ${bestMoveUci}. Chủ động đưa quân vào thế nguy hiểm làm mồi nhử để phá vỡ thế trận đối phương.`,
      en: `Extreme tactical piece sacrifice: ${bestMoveUci}. Offering material bait to decisively break open the opponent's position.`,
    },
    sequence,
  };
}

/**
 * Locates the algebraic square coordinates of a specified king from a FEN placement string.
 *
 * @param {string} fen - Standard FEN position string.
 * @param {'w' | 'b'} color - King color to find.
 * @returns {string | null} Square coordinate (e.g. 'e8', 'g8') or null when absent.
 */
function getKingSquare(fen, color) {
  if (typeof fen !== 'string') {
    return null;
  }
  const placement = fen.trim().split(/\s+/)[0];
  const targetChar = color === 'w' ? 'K' : 'k';
  const rows = placement.split('/');
  for (let rankIdx = 0; rankIdx < rows.length; rankIdx++) {
    const row = rows[rankIdx];
    let fileIdx = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        fileIdx += parseInt(ch, 10);
      } else {
        if (ch === targetChar) {
          const fileLetter = String.fromCharCode('a'.charCodeAt(0) + fileIdx);
          const rankNumber = 8 - rankIdx;
          return `${fileLetter}${rankNumber}`;
        }
        fileIdx++;
      }
    }
  }
  return null;
}

/**
 * Checks whether a destination square targets or lies within the enemy king's defensive zone.
 *
 * @param {string} square - Destination square like 'h7', 'f7'.
 * @param {string} kingSquare - Enemy king's square like 'g8', 'e8'.
 * @param {'w' | 'b'} enemyColor - Enemy king color ('w' or 'b').
 * @returns {boolean} True if the square is adjacent or part of the king's shelter.
 */
function isTargetingKingZone(square, kingSquare, enemyColor) {
  if (!square || !kingSquare || square.length < 2 || kingSquare.length < 2) {
    return false;
  }
  const fileDiff = Math.abs(square.charCodeAt(0) - kingSquare.charCodeAt(0));
  const rankDiff = Math.abs(parseInt(square[1], 10) - parseInt(kingSquare[1], 10));

  // Direct adjacency (within 1 file and 1 rank of the king)
  if (fileDiff <= 1 && rankDiff <= 1) {
    return true;
  }
  // King's shield pawns (files within 1-2 of king, ranks 2-3 for White or ranks 6-7 for Black)
  if (fileDiff <= 2) {
    const sqRank = parseInt(square[1], 10);
    const kRank = parseInt(kingSquare[1], 10);
    if (enemyColor === 'b' && kRank >= 7 && (sqRank === 7 || sqRank === 6)) {
      return true;
    }
    if (enemyColor === 'w' && kRank <= 2 && (sqRank === 2 || sqRank === 3)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects aggressive piece sacrifices that directly shatter the opponent's king shield and launch an attack.
 *
 * @param {{
 *   fen: string,
 *   bestMoveUci?: string,
 *   pv?: string[],
 *   evalScore?: { cp: number | null, mate: number | null },
 *   candidateLines?: Array<{ uci: string, pv: string[], eval: { cp: number | null, mate: number | null } }>,
 * }} params - Engine evaluation metrics and move candidates.
 * @returns {object | null} King hunt sacrifice attack descriptor or null.
 */
export function detectKingSacrificeAttack({
  fen,
  bestMoveUci,
  pv = [],
  evalScore = { cp: null, mate: null },
  candidateLines = [],
}) {
  if (typeof fen !== 'string' || !fen.trim()) {
    return null;
  }

  const parts = fen.trim().split(/\s+/);
  const side = parts[1] === 'b' ? 'b' : 'w';
  const enemyColor = side === 'w' ? 'b' : 'w';
  const enemyKingSquare = getKingSquare(fen, enemyColor);
  if (!enemyKingSquare) {
    return null;
  }

  // Combine primary line and multi-pv lines to search for sacrificial king attack opportunities
  const linesToExamine = [...candidateLines];
  if (bestMoveUci && !linesToExamine.some((l) => l.uci === bestMoveUci)) {
    linesToExamine.unshift({
      uci: bestMoveUci,
      pv: Array.isArray(pv) ? pv : [bestMoveUci],
      eval: evalScore,
    });
  }

  for (const line of linesToExamine) {
    const moveUci = line.uci;
    if (!moveUci) {
      continue;
    }

    const squares = uciToMoveSquares(moveUci);
    if (!squares?.from || !squares?.to) {
      continue;
    }

    const movedPiece = getPieceAtSquare(fen, squares.from);
    if (!movedPiece || movedPiece.color !== side) {
      continue;
    }

    const capturedPiece = getPieceAtSquare(fen, squares.to);
    const replyUci = line.pv?.[1] ?? null;
    const replySquares = replyUci ? uciToMoveSquares(replyUci) : null;

    // Check material sacrifice: net loss >= 2 for pieces, or net loss >= 1 for pawns on king shelter
    const movedVal = PIECE_VALUES[movedPiece.type] ?? 0;
    const capturedVal = capturedPiece ? (PIECE_VALUES[capturedPiece.type] ?? 0) : 0;
    const netMaterialLoss = movedVal - capturedVal;

    // A sacrifice requires the opponent to recapture the piece on destination or be in check
    const isRecaptured = replySquares && replySquares.to === squares.to;
    const isTargetingKing = isTargetingKingZone(squares.to, enemyKingSquare, enemyColor);

    // Minimum loss threshold: 2 points for pieces, 1 point if pawn sacrifice breaking king shield
    const meetsSacrificeThreshold =
      netMaterialLoss >= 2 || (movedPiece.type === 'p' && netMaterialLoss >= 1 && isTargetingKing);

    if (!meetsSacrificeThreshold) {
      continue;
    }

    // Must target the king's defensive perimeter or force king reaction
    if (!isTargetingKing && !isRecaptured) {
      continue;
    }

    // Reject blunder moves where our own king is mated in 1 or 2 plies
    const moverTurnMate = line.eval?.mate;
    if (typeof moverTurnMate === 'number') {
      const isLosingMate = side === 'w' ? moverTurnMate < 0 : moverTurnMate > 0;
      if (isLosingMate && Math.abs(moverTurnMate) <= 2) {
        continue;
      }
    }

    let sacrificeLevel = 'minor';
    let pieceNameVi = 'Quân';
    let pieceNameEn = 'Piece';
    if (movedPiece.type === 'q') {
      sacrificeLevel = 'queen';
      pieceNameVi = 'Hậu';
      pieceNameEn = 'Queen';
    } else if (movedPiece.type === 'r') {
      sacrificeLevel = 'rook';
      pieceNameVi = 'Xe';
      pieceNameEn = 'Rook';
    } else if (movedPiece.type === 'b') {
      sacrificeLevel = 'minor';
      pieceNameVi = 'Tượng';
      pieceNameEn = 'Bishop';
    } else if (movedPiece.type === 'n') {
      sacrificeLevel = 'minor';
      pieceNameVi = 'Mã';
      pieceNameEn = 'Knight';
    } else if (movedPiece.type === 'p') {
      sacrificeLevel = 'pawn';
      pieceNameVi = 'Tốt';
      pieceNameEn = 'Pawn';
    }

    const attackPv = Array.isArray(line.pv) && line.pv.length > 0 ? line.pv : [moveUci];
    const sequence = attackPv.slice(0, 5).map((uci, idx) => ({
      move: uci,
      san: uci,
      stepNumber: idx + 1,
      label: {
        vi:
          idx === 0
            ? `1. Thí ${pieceNameVi} xé toang thành Vua`
            : idx === 1
              ? '2. Vua đối thủ buộc ăn'
              : idx === 2
                ? '3. Đòn công phá tiếp diễn'
                : `${idx + 1}. Tấn công dồn dập kết liễu`,
        en:
          idx === 0
            ? `1. ${pieceNameEn} sacrifice rips open king`
            : idx === 1
              ? '2. King forced to take bait'
              : idx === 2
                ? '3. Follow-up assault'
                : `${idx + 1}. Relentless king hunt`,
      },
    }));

    return {
      id: 'king_hunt_sacrifice',
      name: {
        vi: `🔥 Thí ${pieceNameVi} xé toang thành Vua (King Hunt Attack)`,
        en: `🔥 Extreme ${pieceNameEn} King Hunt Sacrifice`,
      },
      side,
      opening: 'King Hunt Sacrifice',
      type: 'attack',
      isKingSacrifice: true,
      isExtremeSacrifice: true,
      sacrificeLevel,
      suggestedMoveUci: moveUci,
      kingTargetSquare: enemyKingSquare,
      description: {
        vi: `Đòn thí ${pieceNameVi} cực mạnh (${moveUci}) nhắm thẳng vào thành trì của Vua đối phương (${enemyKingSquare}), chấp nhận hy sinh quân để mở toang đường công thành quyết định!`,
        en: `Crushing ${pieceNameEn} sacrifice (${moveUci}) targeting the enemy king fortress at ${enemyKingSquare}, accepting material sacrifice to shatter the defense and hunt the king!`,
      },
      sequence,
    };
  }

  return null;
}

/**
 * Evaluates continuous trap progression across turns, supporting multi-step combo punishments and branch pivots.
 *
 * @param {{
 *   currentTrap: object | null,
 *   currentStep?: number,
 *   lastOpponentMoveUci?: string | null,
 *   currentFen?: string | null,
 * }} params - Continuous combo state and move information.
 * @returns {{
 *   status: 'punishing' | 'pivoting' | 'completed' | 'broken',
 *   step: number,
 *   nextMoveUci: string | null,
 *   trap: object | null,
 *   isPivot: boolean,
 *   label?: { vi: string, en: string },
 * }} Continuous combo evaluation result.
 */
export function resolveContinuousTrapChain({
  currentTrap,
  currentStep = 1,
  lastOpponentMoveUci = null,
  currentFen = null,
}) {
  if (!currentTrap) {
    return {
      status: 'broken',
      step: 0,
      nextMoveUci: null,
      trap: null,
      isPivot: false,
    };
  }

  const sequence = Array.isArray(currentTrap.sequence) ? currentTrap.sequence : [];

  // Check if current sequence is already at completion or has no moves left
  if (currentStep >= sequence.length) {
    return {
      status: 'completed',
      step: sequence.length,
      nextMoveUci: null,
      trap: currentTrap,
      isPivot: false,
    };
  }

  // Find the expected opponent move at currentStep
  const expectedOpponentMove = sequence[currentStep]?.move;

  // 1. If opponent played the expected trap move (took the bait)
  if (lastOpponentMoveUci && expectedOpponentMove && lastOpponentMoveUci === expectedOpponentMove) {
    const nextPlayerStepIndex = currentStep + 1;
    const nextPlayerMove = sequence[nextPlayerStepIndex]?.move ?? null;
    if (nextPlayerMove) {
      return {
        status: 'punishing',
        step: nextPlayerStepIndex + 1, // 1-based step counter
        nextMoveUci: nextPlayerMove,
        trap: currentTrap,
        isPivot: false,
        label: sequence[nextPlayerStepIndex]?.label,
      };
    }
    return {
      status: 'completed',
      step: sequence.length,
      nextMoveUci: null,
      trap: currentTrap,
      isPivot: false,
    };
  }

  // 2. If opponent deviated / evaded the trap, check branches in currentTrap
  if (lastOpponentMoveUci && currentTrap.branches?.[lastOpponentMoveUci]) {
    const branch = currentTrap.branches[lastOpponentMoveUci];
    return {
      status: 'pivoting',
      step: 1,
      nextMoveUci: branch.transitionMove,
      trap: currentTrap,
      isPivot: true,
      label: branch.label,
    };
  }

  // 3. Fallback: Check if current board position allows pivoting to another proactive trap
  if (currentFen) {
    const side = currentTrap.side || 'w';
    const candidates = findProactiveTraps(currentFen, { currentSide: side });
    const alternativeTrap = candidates.find((c) => c.trap.id !== currentTrap.id);
    if (alternativeTrap) {
      return {
        status: 'pivoting',
        step: 1,
        nextMoveUci: alternativeTrap.nextSetupMove,
        trap: alternativeTrap.trap,
        isPivot: true,
        label: {
          vi: `Chuyển nhánh sang ${alternativeTrap.trap.name?.vi || alternativeTrap.trap.id}`,
          en: `Pivoting to ${alternativeTrap.trap.name?.en || alternativeTrap.trap.id}`,
        },
      };
    }
  }

  return {
    status: 'broken',
    step: currentStep,
    nextMoveUci: null,
    trap: currentTrap,
    isPivot: false,
  };
}

/**
 * Detects tactical trap opportunities using Stockfish MultiPV analysis evaluations.
 *
 * @param {{
 *   fen: string,
 *   bestMoveUci: string,
 *   evalScore: { cp: number | null, mate: number | null },
 *   secondBestEval?: { cp: number | null, mate: number | null } | null,
 *   replyUci?: string,
 *   pv?: string[],
 * }} params - Engine evaluation metrics and line data.
 * @returns {object | null} Tactical trap descriptor or null.
 */
export function detectTacticalTrap({ fen, bestMoveUci, evalScore, secondBestEval, replyUci, pv }) {
  if (!bestMoveUci || !evalScore) {
    return null;
  }

  const parts = typeof fen === 'string' ? fen.trim().split(/\s+/) : [];
  const side = parts[1] === 'b' ? 'b' : 'w';

  // Check if there is a decisive gap between top line and runner-up line
  const bestWin = evalToWinPercent(evalScore);
  const runnerWin = secondBestEval ? evalToWinPercent(secondBestEval) : null;
  const moverBestWin = side === 'w' ? bestWin : 100 - bestWin;
  const moverRunnerWin = runnerWin !== null ? (side === 'w' ? runnerWin : 100 - runnerWin) : null;

  const winGap = moverRunnerWin !== null ? moverBestWin - moverRunnerWin : 0;
  const cpGap =
    typeof evalScore.cp === 'number' && typeof secondBestEval?.cp === 'number'
      ? Math.abs(evalScore.cp - secondBestEval.cp)
      : 0;

  // Accept tactical moves that either give decisive advantage (moverBestWin >= 52)
  // or represent risky gambit traps where the player accepts engine evaluation drops to set traps.
  const hasDecisiveTacticalGap = winGap >= TACTICAL_GAP_MIN_WIN || cpGap >= TACTICAL_GAP_MIN_CP;
  if (!hasDecisiveTacticalGap) {
    return null;
  }

  // A trap is risky when the engine views the player's win rate as lower than 50%
  const isRisky = moverBestWin < 50;

  const sequence =
    Array.isArray(pv) && pv.length > 0
      ? pv.slice(0, 5).map((uci, idx) => ({
          move: uci,
          san: uci,
          stepNumber: idx + 1,
          label: {
            vi:
              idx === 0
                ? isRisky
                  ? '1. Nước mạo hiểm giăng bẫy'
                  : '1. Nước mở màn'
                : idx % 2 === 1
                  ? `${idx + 1}. Đối thủ đáp trả`
                  : `${idx + 1}. Trừng phạt liên hoàn`,
            en:
              idx === 0
                ? isRisky
                  ? '1. Risky bait move'
                  : '1. Tactical strike'
                : idx % 2 === 1
                  ? `${idx + 1}. Opponent response`
                  : `${idx + 1}. Follow-up strike`,
          },
        }))
      : [
          {
            move: bestMoveUci,
            san: bestMoveUci,
            stepNumber: 1,
            label: {
              vi: isRisky ? '1. Nước mạo hiểm giăng bẫy' : '1. Nước chiến thuật',
              en: isRisky ? '1. Risky bait move' : '1. Tactical move',
            },
          },
        ];

  return {
    id: isRisky ? 'risky_trap' : 'tactical_trap',
    name: {
      vi: isRisky ? 'Đòn bẫy Mạo hiểm (Risky Trap)' : 'Đòn bẫy Chiến thuật (Tactical Trap)',
      en: isRisky ? 'Risky Trap & Gambit' : 'Tactical Trap & Coordination',
    },
    side,
    opening: isRisky ? 'Risky / Gambit Trap' : 'Tactical / Middlegame',
    type: 'tactical',
    isRisky,
    suggestedMoveUci: bestMoveUci,
    description: {
      vi: isRisky
        ? `Nước đi giăng bẫy mạo hiểm: ${bestMoveUci}. Chấp nhận rủi ro (có thể bị máy tính coi là ngớ ngẩn hoặc thí quân) để tạo cơ hội gài bẫy quyết định.`
        : `Nước đi chiến thuật quyết định: ${bestMoveUci}. Nước đi này tạo ra áp lực cực lớn hoặc đòn phối hợp trừng phạt sai lầm của đối phương.`,
      en: isRisky
        ? `Risky trap move: ${bestMoveUci}. Accepting engine-evaluated risk / sacrifice to spring a decisive trap.`
        : `Decisive tactical strike: ${bestMoveUci}. This move creates overwhelming tactical pressure, severely punishing any mistake.`,
    },
    sequence,
  };
}

/**
 * Coordinates trap suggestions by prioritizing the curated opening catalog first,
 * falling back to engine-driven tactical heuristics when no catalog pattern matches.
 *
 * @param {{
 *   fen: string,
 *   analysis?: {
 *     bestMoveUci: string | null,
 *     eval?: { cp: number | null, mate: number | null },
 *     secondBestEval?: { cp: number | null, mate: number | null } | null,
 *     pv?: string[],
 *   } | null,
 *   lastMove?: { from: string, to: string } | null,
 * }} params - Board state and engine analysis context.
 * @returns {object | null} Resolved trap recommendation or null.
 */
export function resolveTrapSuggestion({ fen, analysis, lastMove }) {
  if (!fen) {
    return null;
  }

  // 1. Check curated opening trap catalog first (instant O(1))
  const catalogMatch = matchOpeningTrap(fen, { lastMove });
  if (catalogMatch) {
    return catalogMatch;
  }

  // 2. Prioritize dynamic piece sacrifice traps if engine line includes sacrifice bait
  if (analysis?.bestMoveUci && analysis?.eval && Array.isArray(analysis?.pv)) {
    const sacrificialTrap = detectSacrificialTrap({
      fen,
      bestMoveUci: analysis.bestMoveUci,
      evalScore: analysis.eval,
      secondBestEval: analysis.secondBestEval,
      pv: analysis.pv,
    });
    if (sacrificialTrap) {
      return sacrificialTrap;
    }
  }

  // 3. Fall back to Stockfish tactical heuristic if engine analysis is present
  if (analysis?.bestMoveUci && analysis?.eval) {
    return detectTacticalTrap({
      fen,
      bestMoveUci: analysis.bestMoveUci,
      evalScore: analysis.eval,
      secondBestEval: analysis.secondBestEval,
      pv: analysis.pv,
    });
  }

  return null;
}
