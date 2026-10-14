/* Penalty shootout rules with no drawing. Sides take turns: one shoots, the other keeps goal. */

import { chance, clamp, pick, weightedIndex } from "../../util/math";
import type { SideIndex } from "../types";
import type { SoccerStats } from "./stats";

/** Left, center, or right of the goal, from the shooter's view. */
export type Column = -1 | 0 | 1;
export type Height = "low" | "high";
export type KickOutcome = "goal" | "save" | "miss";
export type MissKind = "over" | "wide" | "post";

export interface Kick {
  shooter: SideIndex;
  /** Which player on each side took or faced the kick (teammates take turns in 2v2). */
  shooterSlot: number;
  keeperSlot: number;
  column: Column;
  height: Height;
  /** Where the keeper dives. */
  dive: Column;
  outcome: KickOutcome;
  missKind?: MissKind;
}

const COLUMNS: Column[] = [-1, 0, 1];

/**
 * One penalty. Reading vs. Deception decides whether the keeper dives the right way, Accuracy decides
 * whether the shot is on target, and Reflexes vs. Power decides the save when the keeper guessed right.
 */
export function rollKick(shooter: SideIndex, kicker: SoccerStats, keeper: SoccerStats): Omit<Kick, "shooterSlot" | "keeperSlot"> {
  const column = COLUMNS[weightedIndex([.4, .2, .4])];
  const height: Height = chance(.35) ? "high" : "low";
  const guessedRight = chance(clamp(.36 + (keeper.rea - kicker.dec) * .03, .15, .6));
  const dive = guessedRight ? column : pick(COLUMNS.filter((c) => c !== column));
  const kick: Omit<Kick, "shooterSlot" | "keeperSlot"> = { shooter, column, height, dive, outcome: "goal" };
  if (chance(clamp((height === "high" ? .12 : .05) - (kicker.acc - 5) * .012, .01, .22))) {
    kick.outcome = "miss";
    kick.missKind = height === "high" ? (chance(.7) ? "over" : "post") : (chance(.6) ? "wide" : "post");
    // A ball down the middle can only hit the bar or go over.
    if (column === 0) kick.missKind = "over";
  } else if (dive === column && chance(clamp((height === "high" ? .45 : .7) + (keeper.ref - kicker.pow) * .04, .15, .92))) {
    kick.outcome = "save";
  }
  return kick;
}

export type ShootoutEvent = "suddenDeath" | "final" | null;

export class Shootout {
  /** Each side's players' stats. */
  readonly teams: [SoccerStats[], SoccerStats[]];
  readonly kicksEach: number;
  readonly first: SideIndex = Math.random() < .5 ? 0 : 1;
  taken: [number, number] = [0, 0];
  goals: [number, number] = [0, 0];
  kicks: Kick[] = [];
  suddenDeath = false;
  done = false;
  winner: SideIndex = 0;
  lastEvent: ShootoutEvent = null;

  constructor(teams: [SoccerStats[], SoccerStats[]], kicksEach: number) {
    this.teams = teams;
    this.kicksEach = kicksEach;
  }

  /** Sides alternate, starting with whoever won the coin toss. */
  nextShooter(): SideIndex {
    const second: SideIndex = this.first === 0 ? 1 : 0;
    return this.kicks.length % 2 === 0 ? this.first : second;
  }

  /** Who takes the next kick and who faces it. Teammates rotate, both shooting and in goal. */
  nextSlots(): { shooterSlot: number; keeperSlot: number } {
    const shooter = this.nextShooter(), keeperSide: SideIndex = shooter === 0 ? 1 : 0;
    return {
      shooterSlot: this.taken[shooter] % this.teams[shooter].length,
      keeperSlot: this.taken[shooter] % this.teams[keeperSide].length,
    };
  }

  next(): Kick {
    const shooter = this.nextShooter(), keeperSide: SideIndex = shooter === 0 ? 1 : 0;
    const slots = this.nextSlots();
    const kick = rollKick(shooter, this.teams[shooter][slots.shooterSlot], this.teams[keeperSide][slots.keeperSlot]);
    return { ...kick, ...slots };
  }

  apply(kick: Kick): void {
    this.lastEvent = null;
    this.kicks.push(kick);
    this.taken[kick.shooter]++;
    if (kick.outcome === "goal") this.goals[kick.shooter]++;
    const [g0, g1] = this.goals;
    if (!this.suddenDeath) {
      // Over early once one side can't catch up even if they score every kick left.
      const left0 = this.kicksEach - this.taken[0], left1 = this.kicksEach - this.taken[1];
      if (g0 + left0 < g1) return this.end(1);
      if (g1 + left1 < g0) return this.end(0);
      if (left0 === 0 && left1 === 0) {
        this.suddenDeath = true;
        this.lastEvent = "suddenDeath";
      }
      return;
    }
    // Sudden death: after each pair of kicks, a difference ends it.
    if (this.taken[0] === this.taken[1] && g0 !== g1) this.end(g0 > g1 ? 0 : 1);
  }

  private end(winner: SideIndex): void {
    this.done = true;
    this.winner = winner;
    this.lastEvent = "final";
  }

  playOut(): void {
    while (!this.done) this.apply(this.next());
  }
}
