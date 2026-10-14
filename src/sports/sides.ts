import { SHEETS, type StatSheets } from "../data/sheets";
import { averageValues } from "../data/statSheet";
import { contrastingColor } from "../util/color";
import type { TokenLook } from "./drawing";
import type { Side } from "./types";

/**
 * How a side looks when it plays as one figure (a fighter, a kicker, a ball carrier):
 * the player in 1v1, or the option itself when a team of two plays as one.
 */
export const sideLook = (side: Side): TokenLook =>
  side.players.length === 1 ? side.players[0] : { name: side.choiceName, color: side.color, logo: side.logo };

export const sideName = (side: Side): string => sideLook(side).name;

/**
 * The two sides with colors that are easy to tell apart. If the options' colors are too similar
 * (say, two greens), the second side plays in a contrasting stand-in color for this match only.
 */
export function withDistinctColors(sides: Side[]): Side[] {
  const second = contrastingColor(sides[0].color, sides[1].color);
  const original = sides[1].color;
  if (second === original) return sides;
  // When the option itself plays (Quick, Creative), its token shares the option's color, so it changes too.
  const players = sides[1].players.map((p) => (p.color === original ? { ...p, color: second } : p));
  return [sides[0], { ...sides[1], color: second, players }];
}

/** A side's stats in one sport. A team of two playing as one figure gets the average of both players. */
export function teamStats<S extends keyof StatSheets>(side: Side, sport: S): StatSheets[S] {
  return averageValues(SHEETS[sport], side.players.map((p) => p.sheets[sport])) as StatSheets[S];
}
