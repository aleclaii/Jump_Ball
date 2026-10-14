/* What a stat sheet is, independent of any sport: stats grouped by role, a points budget,
   and one-tap builds. Each sport defines its own sheet in src/sports/<sport>/stats.ts. */

export const STAT_MIN = 1;
export const STAT_MAX = 10;
/** Every stat averages this many points, so a sheet's budget is this times its number of stats. */
export const POINTS_PER_STAT = 5;

export type StatValues<K extends string = string> = Record<K, number>;

export interface StatDef<K extends string = string> {
  key: K;
  name: string;
  abbr: string;
  /** One short line: what the stat does. */
  desc: string;
  /** What it beats or what beats it, shown in the "How these stats interact" section. */
  vs: string;
  tag?: string;
}

export interface StatGroup<K extends string = string> {
  name: string;
  stats: StatDef<K>[];
}

export interface Build<K extends string = string> {
  id: string;
  name: string;
  blurb: string;
  stats: StatValues<K>;
}

export interface StatSheetDef<K extends string = string> {
  groups: StatGroup<K>[];
  builds: Build<K>[];
}

export const statsOf = <K extends string>(sheet: StatSheetDef<K>): StatDef<K>[] => sheet.groups.flatMap((g) => g.stats);
export const budgetOf = (sheet: StatSheetDef): number => statsOf(sheet).length * POINTS_PER_STAT;
export const totalOf = (sheet: StatSheetDef, values: StatValues): number =>
  statsOf(sheet).reduce((sum, s) => sum + (values[s.key] ?? 0), 0);

/** Every stat set to the same value. Creative mode uses fractional values to turn one rating into a sheet. */
export const evenValues = <K extends string>(keys: readonly K[], value: number): StatValues<K> =>
  Object.fromEntries(keys.map((k) => [k, value])) as StatValues<K>;

export const sameValues = (sheet: StatSheetDef, a: StatValues, b: StatValues): boolean =>
  statsOf(sheet).every((s) => a[s.key] === b[s.key]);

export const buildNameOf = (sheet: StatSheetDef, values: StatValues): string =>
  sheet.builds.find((b) => sameValues(sheet, b.stats, values))?.name ?? "Custom build";

/** The highest stats, best first. */
export const topStatsOf = <K extends string>(sheet: StatSheetDef<K>, values: StatValues<K>, count: number): StatDef<K>[] =>
  [...statsOf(sheet)].sort((a, b) => values[b.key] - values[a.key]).slice(0, count);

/** Whole numbers from 1 to 10 that spend exactly the sheet's budget. */
export function isValidValues(sheet: StatSheetDef, value: unknown): value is StatValues {
  if (!value || typeof value !== "object") return false;
  const values = value as Record<string, unknown>;
  const allInRange = statsOf(sheet).every((s) => {
    const v = values[s.key];
    return typeof v === "number" && Number.isInteger(v) && v >= STAT_MIN && v <= STAT_MAX;
  });
  return allInRange && totalOf(sheet, values as StatValues) === budgetOf(sheet);
}

/** The mean of several players' sheets, for a team of two playing as one (MMA, football). */
export function averageValues<K extends string>(sheet: StatSheetDef<K>, all: StatValues<K>[]): StatValues<K> {
  return Object.fromEntries(statsOf(sheet).map((s) => [s.key, all.reduce((sum, v) => sum + v[s.key], 0) / all.length])) as StatValues<K>;
}
