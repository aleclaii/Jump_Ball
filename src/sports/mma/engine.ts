/* MMA rules with no drawing. Each side has a health bar; win by knocking the other out,
   or by having more health left when the last round ends. */

import { chance, clamp, rand, weightedIndex } from "../../util/math";
import type { SideIndex } from "../types";
import type { MmaStats } from "./stats";

export type Move = "jab" | "kick" | "takedown";

interface MoveInfo {
  weight: number;
  landChance: number;
  damage: [number, number];
  /** Seconds the move takes on screen. */
  duration: number;
}

export const MOVES: Record<Move, MoveInfo> = {
  jab: { weight: .4, landChance: .62, damage: [4, 8], duration: 1.1 },
  kick: { weight: .22, landChance: .45, damage: [9, 15], duration: 1.3 },
  takedown: { weight: .12, landChance: .4, damage: [10, 18], duration: 2.1 },
};
const MOVE_ORDER: Move[] = ["jab", "kick", "takedown"];
/** A knockdown or a big shot takes this share of a full health bar. */
const BIG_SHOT_SHARE = .3;
/** Health grows with fight length, but slower than damage does, so long fights end in knockouts more often. */
const HEALTH_PER_SECOND = 2.3;
const EXTRA_ROUND_HEALTH = .85;
/** Game-clock seconds in a real MMA round, for the scoreboard. */
const ROUND_GAME_SECONDS = 300;

export interface Exchange {
  attacker: SideIndex;
  move: Move;
  landed: boolean;
  damage: number;
  knockdown: boolean;
  /** Damage the defender lands back after a miss. */
  counter: number;
  /** Circling before the attack, in seconds. */
  feel: number;
  duration: number;
}

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

/**
 * One attack. `fighters` are both sides' stats; `tired` is 0 (fresh) to 1 (spent), already reduced by Cardio.
 * Each step uses the matching stats: who attacks (Striking + Grappling), which move (style), whether it lands
 * (Striking or Grappling vs. Defense), how much it hurts (Power or Grappling vs. Chin), and counters (Defense).
 */
export function rollExchange(fighters: [MmaStats, MmaStats], maxHealth: number, tired: (side: SideIndex) => number): Exchange {
  const offense = (f: MmaStats) => f.str + f.grp;
  const attacker: SideIndex = chance(clamp(.5 + (offense(fighters[0]) - offense(fighters[1])) * .012, .35, .65)) ? 0 : 1;
  const a = fighters[attacker], d = fighters[other(attacker)];
  // Fighters lean on what they're good at: strikers throw, grapplers shoot.
  const move = MOVE_ORDER[weightedIndex([
    Math.max(.03, MOVES.jab.weight + (a.str - 5) * .02),
    Math.max(.03, MOVES.kick.weight + (a.str - 5) * .015 + (a.pow - 5) * .01),
    Math.max(.03, MOVES.takedown.weight + (a.grp - 5) * .03),
  ])];
  const info = MOVES[move];
  const takedown = move === "takedown";
  const skill = takedown ? a.grp : a.str;
  const landed = chance(clamp(info.landChance + (skill - d.def) * (takedown ? .025 : .02) - .06 * tired(attacker), .12, .88));
  const hitPower = takedown ? (a.grp - d.chin) * .03 : (a.pow - d.chin) * .04;
  let damage = landed ? rand(info.damage[0], info.damage[1]) * (1 + hitPower) : 0;
  // Big swings keep fights unpredictable: any landed strike can rock the other fighter. Chin resists it.
  const knockdown = landed && !takedown && chance(clamp(.035 + (a.pow - d.chin) * .006, .01, .09));
  if (knockdown) damage += maxHealth * BIG_SHOT_SHARE;
  const countered = !landed && chance(clamp(.3 + (d.def - 5) * .03, .1, .55));
  const counter = countered ? rand(3, 7) * (1 + (d.pow - a.chin) * .04) : 0;
  const feel = rand(.3, .8);
  return { attacker, move, landed, damage, knockdown, counter, feel, duration: feel + info.duration };
}

export type FightEvent = "endRound" | "suddenDeath" | "final" | null;
export type Method = "ko" | "decision" | "suddenDeath";

export class MmaFight {
  readonly fighters: [MmaStats, MmaStats];
  readonly rounds: number;
  readonly roundSeconds: number;
  readonly maxHealth: number;
  health: [number, number];
  round = 1;
  /** Seconds used in the current round. */
  t = 0;
  landed: [number, number] = [0, 0];
  knockdowns: [number, number] = [0, 0];
  takedowns: [number, number] = [0, 0];
  suddenDeath = false;
  done = false;
  winner: SideIndex = 0;
  method: Method = "decision";
  lastEvent: FightEvent = null;

  constructor(fighters: [MmaStats, MmaStats], rounds: number, roundSeconds: number) {
    this.fighters = fighters;
    this.rounds = rounds;
    this.roundSeconds = roundSeconds;
    this.maxHealth = roundSeconds * HEALTH_PER_SECOND * (1 + (rounds - 1) * EXTRA_ROUND_HEALTH);
    this.health = [this.maxHealth, this.maxHealth];
  }

  /** 0 (fresh) to 1 (spent): grows over a 3-round fight, and Cardio slows it. */
  tiredness(side: SideIndex): number {
    const roundsDone = this.round - 1 + this.t / this.roundSeconds;
    return Math.min(1, roundsDone / 3) * (10 - this.fighters[side].card) / 9;
  }

  next(): Exchange {
    return rollExchange(this.fighters, this.maxHealth, (side) => this.tiredness(side));
  }

  apply(e: Exchange): void {
    this.lastEvent = null;
    const defender = other(e.attacker);
    if (e.landed) {
      this.health[defender] = Math.max(0, this.health[defender] - e.damage);
      this.landed[e.attacker]++;
      if (e.knockdown) this.knockdowns[e.attacker]++;
      if (e.move === "takedown") this.takedowns[e.attacker]++;
    }
    if (e.counter) {
      this.health[e.attacker] = Math.max(0, this.health[e.attacker] - e.counter);
      this.landed[defender]++;
    }
    if (this.health[defender] <= 0) return this.end(e.attacker, "ko");
    if (this.health[e.attacker] <= 0) return this.end(defender, "ko");
    if (this.suddenDeath) {
      if (this.health[0] !== this.health[1]) this.end(this.health[0] > this.health[1] ? 0 : 1, "suddenDeath");
      return;
    }
    this.t += e.duration;
    if (this.t < this.roundSeconds) return;
    this.t = this.roundSeconds;
    if (this.round < this.rounds) {
      this.round++;
      this.t = 0;
      this.lastEvent = "endRound";
    } else if (this.health[0] !== this.health[1]) {
      this.end(this.health[0] > this.health[1] ? 0 : 1, "decision");
    } else {
      this.suddenDeath = true;
      this.lastEvent = "suddenDeath";
    }
  }

  private end(winner: SideIndex, method: Method): void {
    this.done = true;
    this.winner = winner;
    this.method = method;
    this.lastEvent = "final";
  }

  /** Scoreboard clock for the round, given extra seconds into the exchange in progress. */
  clockText(extra: number): string {
    if (this.suddenDeath) return "NEXT HIT";
    const left = Math.max(0, this.roundSeconds - (this.t + extra));
    const gameSeconds = Math.ceil(left / this.roundSeconds * ROUND_GAME_SECONDS);
    return `${Math.floor(gameSeconds / 60)}:${String(gameSeconds % 60).padStart(2, "0")}`;
  }

  periodLabel(): string {
    return this.suddenDeath ? "SUDDEN DEATH" : `ROUND ${this.round}`;
  }

  playOut(): void {
    while (!this.done) this.apply(this.next());
  }
}
