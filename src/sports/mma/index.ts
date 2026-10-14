import { teamStats } from "../sides";
import type { Sport } from "../types";
import { MmaFight } from "./engine";
import { MmaGame } from "./game";

export const mma: Sport = {
  id: "mma",
  name: "MMA",
  nameInSentence: "MMA",
  category: "sport",
  aspect: 1,
  lengths: { quick: "1 round", full: "3 rounds" },
  create: (sides, rules, hooks) => new MmaGame(sides, rules, hooks),
  simulate(sides, rules) {
    const fight = new MmaFight([teamStats(sides[0], "mma"), teamStats(sides[1], "mma")], rules.full ? 3 : 1, rules.periodSeconds);
    fight.playOut();
    return { winner: fight.winner, carry: 0 };
  },
};
