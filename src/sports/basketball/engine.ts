/* Basketball rules with no drawing: possessions, scoring, fatigue, and the box score. */

import type { BasketballStatKey, BasketballStats } from "./stats";
import { chance, clamp, rand, weightedIndex } from "../../util/math";
import type { SideIndex } from "../types";

export type ShotKind = "rim" | "mid" | "three";
export type PossessionKind = "turnover" | "block" | "shot";

export interface Possession {
  off: SideIndex;
  kind: PossessionKind;
  handler: number;
  /** Who shot (the handler, or the teammate after a pass). On a turnover, the handler. */
  shooter: number;
  /** Defender slot that stole the ball. */
  stealer?: number;
  /** Rebounder slot, on the team that got the board. */
  rebounder?: number;
  shot?: ShotKind;
  passed: boolean;
  intercepted: boolean;
  contested: boolean;
  made: boolean;
  oreb: boolean;
  fouled: boolean;
  /** Free throw results, in order. */
  fts: boolean[];
  pts: number;
  ftPts: number;
  /** Animation phase lengths, in seconds. */
  reset: number;
  drive: number;
  flight: number;
  after: number;
  ftTime: number;
  dur: number;
}

export const SHOTS: Record<ShotKind, { pts: number; base: number; per: number; flight: number; stat: BasketballStatKey; guard: BasketballStatKey }> = {
  rim: { pts: 2, base: .55, per: .035, flight: .55, stat: "fin", guard: "int" },
  mid: { pts: 2, base: .40, per: .03, flight: .8, stat: "mid", guard: "per" },
  three: { pts: 3, base: .33, per: .03, flight: .95, stat: "thr", guard: "per" },
};
export const FT_TIME = .95;
export const FT_WALK = .5;
/** Game-clock seconds in a real NBA quarter, for the scoreboard. */
const QUARTER_GAME_SECONDS = 720;

/** Players take more of the shots they're good at. */
function pickShotFor(s: BasketballStats): ShotKind {
  const kinds: ShotKind[] = ["rim", "mid", "three"];
  return kinds[weightedIndex([.25 + .03 * s.fin, .2 + .025 * s.mid, .15 + .03 * s.thr])];
}

const average = (team: BasketballStats[], key: BasketballStatKey): number => team.reduce((sum, p) => sum + p[key], 0) / team.length;

type Tiredness = (slot: number) => number;

/**
 * One trip down the floor. `off`/`def` are the players' stats; defender slot i guards offense slot i.
 * `tiredOff`/`tiredDef` give 0 (fresh) to 1 (exhausted), already reduced by each player's Stamina.
 */
export function rollPossession(off: BasketballStats[], def: BasketballStats[], tiredOff: Tiredness, tiredDef: Tiredness): Omit<Possession, "off"> {
  const p: Omit<Possession, "off"> = {
    kind: "shot", handler: Math.floor(Math.random() * off.length), shooter: 0,
    passed: false, intercepted: false, contested: false, made: false, oreb: false, fouled: false,
    fts: [], pts: 0, ftPts: 0,
    reset: .5, drive: rand(.9, 1.6), flight: 0, after: .75, ftTime: 0, dur: 0,
  };
  p.shooter = p.handler;
  const turnover = (stealer: number, intercepted: boolean) => {
    p.kind = "turnover";
    p.stealer = stealer;
    p.intercepted = intercepted;
    p.drive *= .65;
    p.dur = p.reset + p.drive + p.after;
    return p;
  };
  const h = off[p.handler], hd = def[p.handler];
  // Ball Handling vs. Perimeter Defense: steal off the dribble.
  if (chance(clamp(.07 + (hd.per - h.han) * .012 + .03 * tiredOff(p.handler), .02, .22))) return turnover(p.handler, false);
  // Passing (2v2): pass to the teammate, unless the teammate's defender jumps the lane.
  if (off.length > 1 && chance(clamp(.3 + (h.pas - 5) * .05, .1, .7))) {
    const receiver = 1 - p.handler;
    if (chance(clamp(.05 + (def[receiver].per - h.pas) * .01, .01, .15))) return turnover(receiver, true);
    p.passed = true;
    p.shooter = receiver;
    p.drive += .35;
  }
  const s = off[p.shooter], sd = def[p.shooter];
  const kind = pickShotFor(s);
  const shot = SHOTS[kind];
  p.shot = kind;
  p.flight = shot.flight;
  const guardStat = sd[shot.guard];
  // Getting open: a good pass, or (on your own) Ball Handling, beats the defender's contest.
  const creation = p.passed ? .12 + (h.pas - 5) * .03 : (s.han - 5) * .03;
  p.contested = chance(clamp(.45 + (guardStat - 5) * .06 * (1 - .3 * tiredDef(p.shooter)) - creation, .08, .88));
  // Interior Defense vs. Finishing: blocks only happen at the rim.
  if (kind === "rim" && p.contested && chance(clamp(.06 + (sd.int - 5) * .03 - (s.fin - 5) * .01, .01, .22))) {
    p.kind = "block";
    p.flight = .7;
  } else {
    let make = shot.base + (s[shot.stat] - 5) * shot.per;
    if (p.contested) make -= .09 + (guardStat - 5) * .012;
    if (p.passed) make += .03;
    make -= .07 * tiredOff(p.shooter);
    if (kind === "rim" && chance(p.contested ? .18 : .1)) {
      p.fouled = true;
      make -= .12;
    }
    p.made = chance(clamp(make, .06, .9));
    p.pts = p.made ? shot.pts : 0;
    if (p.fouled) {
      const ftChance = clamp(.62 + (s.ft - 5) * .035 - .05 * tiredOff(p.shooter), .3, .95);
      p.fts = Array.from({ length: p.made ? 1 : 2 }, () => chance(ftChance));
      p.ftPts = p.fts.filter(Boolean).length;
      p.ftTime = FT_WALK + p.fts.length * FT_TIME;
    } else if (!p.made) {
      p.oreb = chance(clamp(.25 + (average(off, "reb") - average(def, "reb")) * .035, .08, .55));
      p.rebounder = weightedIndex((p.oreb ? off : def).map((pl) => pl.reb + 1));
    }
  }
  p.dur = p.reset + p.drive + p.flight + p.after + p.ftTime;
  return p;
}

export interface PlayerLine {
  pts: number;
  ast: number;
  reb: number;
  stl: number;
  blk: number;
}

export type MatchEvent = "endQuarter" | "suddenDeath" | "final" | null;

/** One game. `playedBefore` is how many quarters these players already played earlier in the series. */
export class BasketballMatch {
  readonly teams: BasketballStats[][];
  readonly quarters: number;
  readonly quarterSeconds: number;
  readonly playedBefore: number;
  elapsed = 0;
  quarter = 1;
  /** Seconds used in the current quarter. */
  t = 0;
  score: [number, number] = [0, 0];
  byQuarter: [number, number][] = [[0, 0]];
  box: PlayerLine[][];
  shots = [{ att: 0, contested: 0 }, { att: 0, contested: 0 }];
  readonly first: SideIndex = Math.random() < .5 ? 0 : 1;
  ball: SideIndex;
  suddenDeath = false;
  done = false;
  winner: SideIndex = 0;
  lastEvent: MatchEvent = null;

  constructor(teams: BasketballStats[][], quarters: number, quarterSeconds: number, playedBefore = 0) {
    this.teams = teams;
    this.quarters = quarters;
    this.quarterSeconds = quarterSeconds;
    this.playedBefore = playedBefore;
    this.ball = this.first;
    this.box = teams.map((team) => team.map(() => ({ pts: 0, ast: 0, reb: 0, stl: 0, blk: 0 })));
  }

  /** Quarters played so far, counting earlier games of the series. Two full games = fully tired. */
  quartersPlayed(): number {
    return this.playedBefore + this.elapsed / this.quarterSeconds;
  }

  tiredness(team: SideIndex, slot: number): number {
    return Math.min(1, this.quartersPlayed() / 8) * (10 - this.teams[team][slot].sta) / 9;
  }

  next(): Possession {
    const o = this.ball, d: SideIndex = o === 0 ? 1 : 0;
    const p = rollPossession(this.teams[o], this.teams[d], (s) => this.tiredness(o, s), (s) => this.tiredness(d, s));
    return { ...p, off: o };
  }

  private record(p: Possession): void {
    const o = p.off, d = 1 - o;
    if (p.kind === "turnover") {
      this.box[d][p.stealer ?? 0].stl++;
      return;
    }
    this.shots[o].att++;
    if (p.contested || p.kind === "block") this.shots[o].contested++;
    if (p.kind === "block") {
      this.box[d][p.shooter].blk++;
      return;
    }
    this.box[o][p.shooter].pts += p.pts + p.ftPts;
    if (p.made && p.passed) this.box[o][p.handler].ast++;
    if (!p.made && !p.fouled) this.box[p.oreb ? o : d][p.rebounder ?? 0].reb++;
  }

  apply(p: Possession): void {
    this.lastEvent = null;
    this.record(p);
    this.elapsed += p.dur;
    const pts = p.pts + p.ftPts;
    if (pts) {
      this.score[p.off] += pts;
      this.byQuarter[this.byQuarter.length - 1][p.off] += pts;
    }
    const keepsBall = p.kind === "shot" && !p.made && !p.fouled && p.oreb;
    this.ball = keepsBall ? p.off : (p.off === 0 ? 1 : 0);
    if (this.suddenDeath) {
      if (this.score[0] !== this.score[1]) this.end();
      return;
    }
    this.t += p.dur;
    if (this.t < this.quarterSeconds) return;
    this.t = this.quarterSeconds;
    if (this.quarter < this.quarters) {
      this.lastEvent = "endQuarter";
      this.quarter += 1;
      this.t = 0;
      this.byQuarter.push([0, 0]);
      this.ball = this.quarter % 2 === 0 ? (this.first === 0 ? 1 : 0) : this.first;
    } else if (this.score[0] !== this.score[1]) {
      this.end();
    } else {
      this.suddenDeath = true;
      this.byQuarter.push([0, 0]);
      this.ball = Math.random() < .5 ? 0 : 1;
      this.lastEvent = "suddenDeath";
    }
  }

  private end(): void {
    this.done = true;
    this.winner = this.score[0] > this.score[1] ? 0 : 1;
    this.lastEvent = "final";
  }

  /** Scoreboard clock for the current quarter, given extra seconds into the possession in progress. */
  clockText(extra: number): string {
    if (this.suddenDeath) return "0:00";
    const left = Math.max(0, this.quarterSeconds - (this.t + extra));
    const gameSeconds = Math.ceil(left / this.quarterSeconds * QUARTER_GAME_SECONDS);
    return `${Math.floor(gameSeconds / 60)}:${String(gameSeconds % 60).padStart(2, "0")}`;
  }

  periodLabel(): string {
    if (this.suddenDeath) return "SUDDEN DEATH";
    return this.quarters === 1 ? "QUICK" : `Q${this.quarter}`;
  }

  playOut(): void {
    while (!this.done) this.apply(this.next());
  }
}
