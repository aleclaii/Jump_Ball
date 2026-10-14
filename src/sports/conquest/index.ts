import { teamStats } from "../sides";
import type { Sport } from "../types";
import { ConquestMatch } from "./engine";
import { ConquestGame, TURNS } from "./game";
import { generateMap } from "./map";
import { frameFor } from "./mapView";

/** Every map has the same shape (only the terrain changes), so its proportions are fixed. */
const shape = frameFor(generateMap());

export const conquest: Sport = {
  id: "conquest",
  name: "Mini 4X",
  nameInSentence: "Mini 4X",
  category: "strategy",
  aspect: shape.width / shape.height,
  lengths: { quick: `${TURNS.quick} turns`, full: `${TURNS.full} turns` },
  create: (sides, rules, hooks) => new ConquestGame(sides, rules, hooks),
  simulate(sides, rules) {
    const match = new ConquestMatch([teamStats(sides[0], "conquest"), teamStats(sides[1], "conquest")], rules.full ? TURNS.full : TURNS.quick);
    match.playOut();
    return { winner: match.winner, carry: 0 };
  },
};
