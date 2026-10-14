import type { Sport } from "../types";
import { teamStats } from "../sides";
import { ChessMatch } from "./engine";
import { ChessGame, MOVES_EACH } from "./game";

export const chess: Sport = {
  id: "chess",
  name: "Speed Chess",
  nameInSentence: "speed chess",
  category: "strategy",
  aspect: 1,
  lengths: { quick: `${MOVES_EACH.quick} moves each`, full: `${MOVES_EACH.full} moves each` },
  oddsRuns: 40,
  create: (sides, rules, hooks) => new ChessGame(sides, rules, hooks),
  simulate(sides, rules) {
    const match = new ChessMatch([teamStats(sides[0], "chess"), teamStats(sides[1], "chess")], rules.full ? MOVES_EACH.full : MOVES_EACH.quick);
    match.playOut();
    return { winner: match.winner, carry: 0 };
  },
};
