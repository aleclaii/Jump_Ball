import type { Sport } from "../types";
import { Shootout } from "./engine";
import { SoccerGame } from "./game";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./pitch";

export const soccer: Sport = {
  id: "soccer",
  name: "Soccer",
  nameInSentence: "soccer",
  category: "sport",
  aspect: VIEW_WIDTH / VIEW_HEIGHT,
  lengths: { quick: "3 penalties each", full: "5 penalties each" },
  create: (sides, rules, hooks) => new SoccerGame(sides, rules, hooks),
  simulate(sides, rules) {
    const shootout = new Shootout([sides[0].players.map((p) => p.sheets.soccer), sides[1].players.map((p) => p.sheets.soccer)], rules.full ? 5 : 3);
    shootout.playOut();
    return { winner: shootout.winner, carry: 0 };
  },
};
