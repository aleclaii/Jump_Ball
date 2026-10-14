import type { Sport } from "../types";
import { COURT_DEPTH, COURT_WIDTH } from "./court";
import { BasketballMatch } from "./engine";
import { BasketballGame } from "./game";

export const basketball: Sport = {
  id: "basketball",
  name: "Basketball",
  nameInSentence: "basketball",
  category: "sport",
  aspect: COURT_WIDTH / COURT_DEPTH,
  lengths: { quick: "1 quarter", full: "4 quarters" },
  create: (sides, rules, hooks, carryIn) => new BasketballGame(sides, rules, hooks, carryIn),
  simulate(sides, rules, carryIn) {
    const match = new BasketballMatch(sides.map((s) => s.players.map((p) => p.sheets.basketball)), rules.full ? 4 : 1, rules.periodSeconds, carryIn);
    match.playOut();
    return { winner: match.winner, carry: match.quartersPlayed() };
  },
};
