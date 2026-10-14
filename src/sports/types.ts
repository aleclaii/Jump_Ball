import type { StatSheets } from "../data/sheets";
import type { TraderStyle } from "./trading/trader";

export type SportId = "basketball" | "mma" | "soccer" | "football" | "chess" | "conquest" | "trading";
export type SideIndex = 0 | 1;

/** Someone on the field: a player in Competition, or the option itself in Quick and Creative. */
export interface Competitor {
  name: string;
  color: string;
  logo: string | null;
  /** One stat sheet per sport. */
  sheets: StatSheets;
  /** Bull/bear lean and contrarian switch for the trading game (neutral when missing). */
  tradingStyle?: TraderStyle;
}

/** One side of a matchup: the option it plays for and who plays. */
export interface Side {
  choiceId: string;
  choiceName: string;
  color: string;
  logo: string | null;
  players: Competitor[];
}

export interface MatchRules {
  /** Quick (false) or Full (true). Each sport decides what that means. */
  full: boolean;
  /** Real seconds per timed period (basketball quarters, MMA rounds). */
  periodSeconds: number;
  /** Games in the series: 1 or 3. */
  bestOf: number;
}

/** Ways a running game talks to the screen around it. */
export interface GameHooks {
  /** Adds a line to the play-by-play. `side` colors it. */
  say(text: string, side: SideIndex | null): void;
  /** Pauses the game behind a banner (end of a quarter, a round, ...). */
  banner(title: string, subtitle: string, seconds: number): void;
}

export interface BoardState {
  scores: [string, string];
  period: string;
  clock: string;
  /** Who has the ball, if anyone. */
  holder: SideIndex | null;
  /** 0-1 health bars (MMA). */
  health?: [number, number];
  /** Small line under each name, e.g. yards gained. */
  notes?: [string, string];
}

export interface GameResult {
  winner: SideIndex;
  /** How it was won, finishing "Papa John's won ___", e.g. "by KO in round 2". */
  how: string;
  /** The final score, e.g. "18–14" or "68 health to 41". */
  score: string;
  /** Optional HTML with this game's details (box score, strike counts, ...). */
  detailsHtml?: string;
}

/** A single game in progress. Owns its own rules, animation, and commentary. */
export interface SportGame {
  readonly done: boolean;
  /** Advances the game by `dt` seconds of game time. */
  step(dt: number): void;
  /** Draws the whole field. `width`/`height` are canvas pixels. */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  board(): BoardState;
  /** A short time stamp for the play-by-play, e.g. "Q2 8:41" or "R1". */
  stamp(): string;
  /** Plays out the rest of the game instantly. */
  finishNow(): void;
  result(): GameResult;
  /** Carry-over into the next game of a series (basketball uses it for fatigue). */
  carry(): number;
}

export interface Sport {
  id: SportId;
  name: string;
  /** Sports join the random rotation; strategy games are only played from the Strategy tab. */
  category: "sport" | "strategy";
  /** The name as it reads mid-sentence, e.g. "beat Subway at ___". */
  nameInSentence: string;
  /** Field width divided by height, for sizing the canvas. */
  aspect: number;
  /** For a field whose shape changes with the screen: its width divided by height at a CSS width. */
  aspectFor?(cssWidth: number): number;
  /** What Quick and Full mean in this sport, e.g. "1 round" / "3 rounds". */
  lengths: { quick: string; full: string };
  /** Practice games for the win-chance estimate, if fewer than the usual 800 (slow games). */
  oddsRuns?: number;
  create(sides: Side[], rules: MatchRules, hooks: GameHooks, carryIn: number): SportGame;
  /** Plays a whole game with no animation, for projected odds and tests. */
  simulate(sides: Side[], rules: MatchRules, carryIn: number): { winner: SideIndex; carry: number };
}
