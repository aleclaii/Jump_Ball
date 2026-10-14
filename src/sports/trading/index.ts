import type { Sport } from "../types";
import { TradingMatch } from "./engine";
import { DAYS, sideSpecs, TradingGame } from "./game";
import { aspectFor } from "./view";

export const trading: Sport = {
  id: "trading",
  name: "Trading",
  nameInSentence: "trading",
  category: "strategy",
  aspect: aspectFor(600),
  aspectFor,
  lengths: { quick: "1 quarter (60 trading days)", full: "1 year (250 trading days)" },
  oddsRuns: 400,
  create: (sides, rules, hooks) => new TradingGame(sides, rules, hooks),
  simulate(sides, rules) {
    const match = new TradingMatch(sideSpecs(sides), rules.full ? DAYS.full : DAYS.quick);
    match.playOut();
    return { winner: match.winner, carry: 0 };
  },
};
