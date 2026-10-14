/* Everything the app remembers between visits: saved options, players, settings, and rivalry records. */

import { NEUTRAL_STYLE, type TraderStyle } from "../sports/trading/trader";
import type { MatchRules, Side, SportId } from "../sports/types";
import { loadJson, saveJson } from "./storage";
import { copySheets, evenSheets, ratingToStat, restoreSheets, sheetsFromBuilds, type StatSheets } from "./sheets";

export interface Choice {
  id: string;
  name: string;
  color: string;
  /** Ability 40-99, used in Creative's weighted mode. */
  ovr: number;
  logo: string | null;
}

export interface Person {
  id: string;
  name: string;
  color: string;
  logo: string | null;
  /** One stat sheet per sport, each spending the same budget. */
  sheets: StatSheets;
  /** Outside the budget: how bullish or bearish they trade, and whether they bet against the crowd. */
  tradingStyle: TraderStyle;
}

export type Tab = "quick" | "creative" | "competition" | "strategy";
export type SportPick = SportId | "random";

interface CompetitionSide {
  choice: string;
  players: (string | null)[];
}

export interface Settings {
  tab: Tab;
  homeId: string;
  awayId: string;
  mode: "fair" | "weighted";
  length: "quick" | "full";
  series: 1 | 3;
  periodSeconds: 30 | 45 | 60;
  speed: 1 | 2 | 4;
  format: "1v1" | "2v2";
  sport: SportPick;
  /** Strategy tab: the options play themselves (with ratings), or Competition players play for them. */
  strategyBy: "options" | "players";
  /** Which strategy game the Strategy tab plays. */
  strategyGame: SportId;
  strategyPlayers: [string | null, string | null];
  comp: { home: CompetitionSide; away: CompetitionSide };
}

/** Wins per option id, keyed by the pair of option ids. */
type RivalryRecords = Record<string, Record<string, number>>;

const DEFAULT_CHOICES: Choice[] = [
  { id: "papajohns", name: "Papa John's", color: "#E5173F", ovr: 74, logo: null },
  { id: "subway", name: "Subway", color: "#0FA958", ovr: 70, logo: null },
  { id: "panda", name: "Panda Express", color: "#FF4D2E", ovr: 82, logo: null },
  { id: "chipotle", name: "Chipotle", color: "#B4521D", ovr: 78, logo: null },
];

/** The muted example colors from earlier versions, and their brighter replacements. Colors people chose stay as they are. */
const UPGRADED_COLORS: Record<string, string> = {
  "#9E1B2F": "#E5173F", "#1E7F3A": "#0FA958", "#D0402A": "#FF4D2E", "#C8312A": "#FF4D2E", "#6E3420": "#B4521D",
  "#2F5AA8": "#2D6BFF", "#2E6FD8": "#2D6BFF", "#D9822B": "#FF9F1C", "#8E44AD": "#9B3DFF", "#138A72": "#00B8A9",
};
const upgradeColor = (color: string): string => UPGRADED_COLORS[color.toUpperCase()] ?? color;

const defaultPeople = (): Person[] => [
  { id: "john", name: "John", color: "#2D6BFF", logo: null, sheets: sheetsFromBuilds({ basketball: "sharp", mma: "wrestler", soccer: "sniper", football: "airraid", chess: "tactician", conquest: "scholar", trading: "analyst" }), tradingStyle: { ...NEUTRAL_STYLE } },
  { id: "joe", name: "Joe", color: "#FF9F1C", logo: null, sheets: sheetsFromBuilds({ basketball: "lockdown", mma: "brawler", soccer: "stopper", football: "blitz", chess: "grinder", conquest: "warlord", trading: "macro" }), tradingStyle: { lean: .6, contrarian: false } },
  { id: "maya", name: "Maya", color: "#9B3DFF", logo: null, sheets: sheetsFromBuilds({ basketball: "general", mma: "counter", soccer: "trickster", football: "steady", chess: "bookworm", conquest: "economist", trading: "quant" }), tradingStyle: { ...NEUTRAL_STYLE } },
  { id: "sam", name: "Sam", color: "#00B8A9", logo: null, sheets: sheetsFromBuilds({ basketball: "big", mma: "tank", soccer: "cannon", football: "ground", chess: "calculator", conquest: "turtle", trading: "steady" }), tradingStyle: { lean: -.3, contrarian: true } },
];

const DEFAULT_SETTINGS: Settings = {
  tab: "quick", homeId: "panda", awayId: "subway", mode: "fair",
  length: "quick", series: 1, periodSeconds: 45, speed: 1, format: "1v1", sport: "random",
  strategyBy: "options", strategyPlayers: ["john", "joe"], strategyGame: "chess",
  comp: { home: { choice: "papajohns", players: ["john", "sam"] }, away: { choice: "subway", players: ["joe", "maya"] } },
};

export const NEW_COLORS = ["#9B3DFF", "#00B8D9", "#FF9F1C", "#FF3D8B", "#12B886", "#2D6BFF", "#FF4D2E", "#E5B300"];
export const FAIR_RATING = 70;
export const MIN_RATING = 40;
export const MAX_RATING = 99;

const KEYS = { choices: "jb.roster", people: "jb.players", settings: "jb.settings", rivalry: "jb.rivalry" };

function loadChoices(): Choice[] {
  const saved = loadJson<unknown>(KEYS.choices, null);
  const valid = Array.isArray(saved) && saved.length >= 2 &&
    saved.every((c) => c && typeof c.id === "string" && typeof c.name === "string" && typeof c.ovr === "number");
  return valid ? (saved as Choice[]).map((c) => ({ ...c, color: upgradeColor(c.color) })) : DEFAULT_CHOICES.map((c) => ({ ...c }));
}

function loadPeople(): Person[] {
  const saved = loadJson<unknown>(KEYS.people, null);
  const valid = Array.isArray(saved) && saved.length >= 2 &&
    saved.every((p) => p && typeof p.id === "string" && typeof p.name === "string");
  if (!valid) return defaultPeople();
  // Keeps every valid sheet; players saved before per-sport stats get Balanced in the new sports.
  return (saved as (Person & { stats?: unknown })[]).map(({ stats, ...p }) => ({
    ...p,
    color: upgradeColor(p.color),
    sheets: restoreSheets({ sheets: p.sheets, stats }),
    tradingStyle: restoreTradingStyle(p.tradingStyle),
  }));
}

/** A saved trading style if it's valid, otherwise neutral (players saved before the trading game had none). */
function restoreTradingStyle(saved: unknown): TraderStyle {
  const style = saved as Partial<TraderStyle> | null;
  const validLean = typeof style?.lean === "number" && Number.isFinite(style.lean) && Math.abs(style.lean) <= 1;
  return validLean ? { lean: style!.lean!, contrarian: style!.contrarian === true } : { ...NEUTRAL_STYLE };
}

function loadSettings(): Settings {
  const saved = loadJson<Partial<Settings> & { qtrSec?: number }>(KEYS.settings, {});
  const merged: Settings = { ...DEFAULT_SETTINGS, ...saved, comp: { ...DEFAULT_SETTINGS.comp, ...saved.comp } };
  // The prototype stored this as `qtrSec`.
  if (saved.qtrSec && !saved.periodSeconds) merged.periodSeconds = saved.qtrSec as Settings["periodSeconds"];
  return merged;
}

export const state = {
  choices: loadChoices(),
  people: loadPeople(),
  settings: loadSettings(),
  rivalry: loadJson<RivalryRecords>(KEYS.rivalry, {}),
};

export const saveChoices = (): boolean => saveJson(KEYS.choices, state.choices);
export const savePeople = (): boolean => saveJson(KEYS.people, state.people);
export const saveSettings = (): boolean => saveJson(KEYS.settings, state.settings);

export const choiceById = (id: string): Choice | undefined => state.choices.find((c) => c.id === id);
export const choiceByName = (name: string): Choice | undefined =>
  state.choices.find((c) => c.name.toLowerCase() === name.toLowerCase());
export const personById = (id: string | null): Person | undefined => state.people.find((p) => p.id === id);
export const playersPerSide = (): number => (state.settings.format === "2v2" ? 2 : 1);
export const cleanName = (raw: string): string => raw.trim().replace(/\s+/g, " ");
export const newId = (prefix: string): string => prefix + Date.now().toString(36) + Math.floor(Math.random() * 1000);

/** Saves a new option with the next unused color. */
export function addChoice(name: string): Choice {
  const choice: Choice = { id: newId("c"), name, color: NEW_COLORS[state.choices.length % NEW_COLORS.length], ovr: FAIR_RATING, logo: null };
  state.choices.push(choice);
  saveChoices();
  return choice;
}

/** Makes sure Quick and Creative point at two different saved options. */
export function ensureMatchup(): void {
  const s = state.settings;
  if (!choiceById(s.homeId)) s.homeId = state.choices[0].id;
  if (!choiceById(s.awayId) || s.awayId === s.homeId) {
    s.awayId = state.choices.find((c) => c.id !== s.homeId)!.id;
  }
}

/** Makes sure every Competition slot holds a different person, filling gaps with whoever is free. */
export function ensureCompetition(): void {
  const c = state.settings.comp;
  for (const side of [c.home, c.away]) if (!Array.isArray(side.players)) side.players = [];
  if (!choiceById(c.home.choice)) c.home.choice = state.choices[0].id;
  if (!choiceById(c.away.choice) || c.away.choice === c.home.choice) {
    c.away.choice = state.choices.find((r) => r.id !== c.home.choice)!.id;
  }
  const used = new Set<string>();
  const slots: [CompetitionSide, number][] = [[c.home, 0], [c.away, 0], [c.home, 1], [c.away, 1]];
  for (const [side, slot] of slots) {
    let id = side.players[slot] ?? null;
    if (!personById(id) || (id && used.has(id))) id = state.people.find((p) => !used.has(p.id))?.id ?? null;
    side.players[slot] = id;
    if (id) used.add(id);
  }
}

export const competitionReady = (): boolean => {
  const c = state.settings.comp, n = playersPerSide();
  return [c.home, c.away].every((side) => side.players.slice(0, n).every(Boolean));
};

/** The two option ids for the current tab. */
export function matchupChoiceIds(): [string, string] {
  const s = state.settings;
  return s.tab === "competition" ? [s.comp.home.choice, s.comp.away.choice] : [s.homeId, s.awayId];
}

/** Quick always plays one fair, short game of a random sport, so its screen has nothing to set. */
/** Whether the options themselves play, rated by the Creative sliders (Creative, or Strategy played by options). */
export const optionsPlay = (): boolean =>
  state.settings.tab === "creative" || (state.settings.tab === "strategy" && state.settings.strategyBy === "options");

/** Makes sure the Strategy tab's two players are two different people. */
export function ensureStrategyPlayers(): void {
  const chosen = state.settings.strategyPlayers;
  const used = new Set<string>();
  chosen.forEach((id, i) => {
    let pickId = id;
    if (!personById(pickId) || (pickId && used.has(pickId))) pickId = state.people.find((p) => !used.has(p.id))?.id ?? null;
    chosen[i] = pickId;
    if (pickId) used.add(pickId);
  });
}

export function matchRules(): MatchRules & { fair: boolean; sport: SportPick } {
  const s = state.settings;
  if (s.tab === "quick") return { full: false, periodSeconds: 45, bestOf: 1, fair: true, sport: "random" };
  return {
    full: s.length === "full",
    periodSeconds: s.periodSeconds,
    bestOf: s.series,
    fair: optionsPlay() && s.mode === "fair",
    sport: s.tab === "strategy" ? s.strategyGame : s.sport,
  };
}

/** The two sides as the sports see them. */
export function buildSides(): Side[] {
  const s = state.settings;
  if (s.tab === "strategy" && s.strategyBy === "players") {
    ensureMatchup();
    ensureStrategyPlayers();
    return [s.homeId, s.awayId].map((id, i) => {
      const c = choiceById(id)!, p = personById(s.strategyPlayers[i])!;
      return {
        choiceId: c.id, choiceName: c.name, color: c.color, logo: c.logo,
        players: [{ name: p.name, color: p.color, logo: p.logo, sheets: copySheets(p.sheets), tradingStyle: { ...p.tradingStyle } }],
      };
    });
  }
  if (s.tab !== "competition") {
    ensureMatchup();
    const fair = matchRules().fair;
    return [s.homeId, s.awayId].map((id) => {
      const c = choiceById(id)!;
      const rating = fair ? FAIR_RATING : c.ovr;
      return {
        choiceId: c.id, choiceName: c.name, color: c.color, logo: c.logo,
        players: [{ name: c.name, color: c.color, logo: c.logo, sheets: evenSheets(ratingToStat(rating)) }],
      };
    });
  }
  ensureCompetition();
  const n = playersPerSide();
  return [s.comp.home, s.comp.away].map((side) => {
    const c = choiceById(side.choice)!;
    const players = side.players.slice(0, n).map((id) => personById(id)!);
    return {
      choiceId: c.id, choiceName: c.name, color: c.color, logo: c.logo,
      players: players.map((p) => ({ name: p.name, color: p.color, logo: p.logo, sheets: copySheets(p.sheets), tradingStyle: { ...p.tradingStyle } })),
    };
  });
}

const pairKey = (a: string, b: string): string => [a, b].sort().join("|");

export function rivalryRecord(aId: string, bId: string): [number, number] | null {
  const record = state.rivalry[pairKey(aId, bId)];
  return record ? [record[aId] ?? 0, record[bId] ?? 0] : null;
}

export function recordWin(winnerId: string, loserId: string): void {
  const key = pairKey(winnerId, loserId);
  const record = state.rivalry[key] ?? {};
  record[winnerId] = (record[winnerId] ?? 0) + 1;
  state.rivalry[key] = record;
  saveJson(KEYS.rivalry, state.rivalry);
}
