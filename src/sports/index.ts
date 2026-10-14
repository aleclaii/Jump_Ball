import { pick } from "../util/math";
import { basketball } from "./basketball";
import { chess } from "./chess";
import { conquest } from "./conquest";
import { football } from "./football";
import { mma } from "./mma";
import { soccer } from "./soccer";
import { trading } from "./trading";
import type { Sport, SportId } from "./types";

export const SPORTS: Sport[] = [basketball, mma, soccer, football, chess, conquest, trading];
/** The sports a "random" pick chooses from. Strategy games are only played on purpose. */
export const ROTATION: Sport[] = SPORTS.filter((s) => s.category === "sport");
/** The games on the Strategy tab. */
export const STRATEGY_GAMES: Sport[] = SPORTS.filter((s) => s.category === "strategy");

export const sportById = (id: SportId): Sport => {
  const sport = SPORTS.find((s) => s.id === id);
  if (!sport) throw new Error(`Unknown sport: ${id}`);
  return sport;
};

/** The chosen sport, or a random one. */
export const resolveSport = (pickId: SportId | "random"): Sport => (pickId === "random" ? pick(ROTATION) : sportById(pickId));
