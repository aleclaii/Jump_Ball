/* Every sport's and strategy game's stat sheet, and the set of sheets every player carries (one per sport). */

import { BASKETBALL_KEYS, BASKETBALL_SHEET, type BasketballStats } from "../sports/basketball/stats";
import { CHESS_KEYS, CHESS_SHEET, type ChessStats } from "../sports/chess/stats";
import { CONQUEST_KEYS, CONQUEST_SHEET, type ConquestStats } from "../sports/conquest/stats";
import { FOOTBALL_KEYS, FOOTBALL_SHEET, type FootballStats } from "../sports/football/stats";
import { MMA_KEYS, MMA_SHEET, type MmaStats } from "../sports/mma/stats";
import { SOCCER_KEYS, SOCCER_SHEET, type SoccerStats } from "../sports/soccer/stats";
import { TRADING_KEYS, TRADING_SHEET, type TradingStats } from "../sports/trading/stats";
import type { SportId } from "../sports/types";
import { evenValues, isValidValues, type StatSheetDef, type StatValues } from "./statSheet";

export interface StatSheets {
  basketball: BasketballStats;
  mma: MmaStats;
  soccer: SoccerStats;
  football: FootballStats;
  chess: ChessStats;
  conquest: ConquestStats;
  trading: TradingStats;
}

export const SHEETS: Record<SportId, StatSheetDef> = {
  basketball: BASKETBALL_SHEET,
  mma: MMA_SHEET,
  soccer: SOCCER_SHEET,
  football: FOOTBALL_SHEET,
  chess: CHESS_SHEET,
  conquest: CONQUEST_SHEET,
  trading: TRADING_SHEET,
};

export const SHEET_ORDER: SportId[] = ["basketball", "mma", "soccer", "football", "chess", "conquest", "trading"];

/** A copy of one of a sheet's builds. */
export function buildValues(sport: SportId, buildId: string): StatValues {
  const build = SHEETS[sport].builds.find((b) => b.id === buildId);
  if (!build) throw new Error(`Unknown ${sport} build: ${buildId}`);
  return { ...build.stats };
}

/** Every stat in every sport set to one value. Creative turns its 40-99 rating into this (1-10). */
export function evenSheets(value: number): StatSheets {
  return {
    basketball: evenValues(BASKETBALL_KEYS, value),
    mma: evenValues(MMA_KEYS, value),
    soccer: evenValues(SOCCER_KEYS, value),
    football: evenValues(FOOTBALL_KEYS, value),
    chess: evenValues(CHESS_KEYS, value),
    conquest: evenValues(CONQUEST_KEYS, value),
    trading: evenValues(TRADING_KEYS, value),
  };
}

export const ratingToStat = (rating: number): number => 1 + (rating - 40) / 59 * 9;

/** Starting sheets from one build per sport. */
export function sheetsFromBuilds(builds: Record<SportId, string>): StatSheets {
  return {
    basketball: buildValues("basketball", builds.basketball) as BasketballStats,
    mma: buildValues("mma", builds.mma) as MmaStats,
    soccer: buildValues("soccer", builds.soccer) as SoccerStats,
    football: buildValues("football", builds.football) as FootballStats,
    chess: buildValues("chess", builds.chess) as ChessStats,
    conquest: buildValues("conquest", builds.conquest) as ConquestStats,
    trading: buildValues("trading", builds.trading) as TradingStats,
  };
}

/**
 * Reads a saved player's sheets, keeping every valid sheet and filling the rest with Balanced.
 * Players saved before per-sport stats only had basketball `stats`.
 */
export function restoreSheets(saved: { sheets?: unknown; stats?: unknown }): StatSheets {
  const raw = (saved.sheets && typeof saved.sheets === "object" ? saved.sheets : {}) as Record<string, unknown>;
  if (!raw.basketball && saved.stats) raw.basketball = saved.stats;
  const pick = (sport: SportId): StatValues => (isValidValues(SHEETS[sport], raw[sport]) ? { ...(raw[sport] as StatValues) } : buildValues(sport, "balanced"));
  return {
    basketball: pick("basketball") as BasketballStats,
    mma: pick("mma") as MmaStats,
    soccer: pick("soccer") as SoccerStats,
    football: pick("football") as FootballStats,
    chess: pick("chess") as ChessStats,
    conquest: pick("conquest") as ConquestStats,
    trading: pick("trading") as TradingStats,
  };
}

/** A copy of `sheets` with one sport's sheet replaced. */
export const withSheet = (sheets: StatSheets, sport: SportId, values: StatValues): StatSheets =>
  ({ ...sheets, [sport]: { ...values } }) as StatSheets;

export const copySheets = (sheets: StatSheets): StatSheets => ({
  basketball: { ...sheets.basketball },
  mma: { ...sheets.mma },
  soccer: { ...sheets.soccer },
  football: { ...sheets.football },
  chess: { ...sheets.chess },
  conquest: { ...sheets.conquest },
  trading: { ...sheets.trading },
});
