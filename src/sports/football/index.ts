import { teamStats } from "../sides";
import type { Sport } from "../types";
import { DriveContest } from "./engine";
import { FIELD_HEIGHT, FIELD_WIDTH } from "./field";
import { FootballGame } from "./game";

export const football: Sport = {
  id: "football",
  name: "Football",
  nameInSentence: "football",
  category: "sport",
  aspect: FIELD_WIDTH / FIELD_HEIGHT,
  lengths: { quick: "1 drive each", full: "2 drives each" },
  create: (sides, rules, hooks) => new FootballGame(sides, rules, hooks),
  simulate(sides, rules) {
    const contest = new DriveContest([teamStats(sides[0], "football"), teamStats(sides[1], "football")], rules.full ? 2 : 1);
    contest.playOut();
    return { winner: contest.winner, carry: 0 };
  },
};
