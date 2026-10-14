/* Football rules with no drawing. Each side gets one 4-down possession (two in Full), starting at the
   opponent's 40. A touchdown wins; if neither side or both sides score, more yards gained wins. */

import { chance, clamp, rand, weightedIndex } from "../../util/math";
import type { SideIndex } from "../types";
import type { FootballStats } from "./stats";

export type PlayKind = "run" | "short" | "deep";
export type PlayOutcome = "gain" | "incomplete" | "sack" | "interception" | "fumble" | "touchdown";

export interface Play {
  offense: SideIndex;
  kind: PlayKind;
  outcome: PlayOutcome;
  /** Net yards gained (negative for a loss). */
  yards: number;
  /** A long run or catch, for commentary. */
  big: boolean;
}

export const START_YARDS = 40;
export const DOWNS = 4;
const TOUCHDOWN_POINTS = 7;
const PLAY_KINDS: PlayKind[] = ["run", "short", "deep"];

/**
 * One snap. Rushing and Passing tilt the play call; runs pit Rushing against Run Defense, passes face
 * Pass Rush (sacks), Passing vs. Coverage (completions), and Coverage vs. Ball Security (interceptions).
 */
export function rollPlay(offense: SideIndex, off: FootballStats, def: FootballStats, yardsToGoal: number): Play {
  const kind = PLAY_KINDS[weightedIndex([
    Math.max(.05, .45 + (off.rush - 5) * .03),
    Math.max(.05, .35 + (off.pass - 5) * .02),
    Math.max(.05, .2 + (off.pass - 5) * .02),
  ])];
  const play: Play = { offense, kind, outcome: "gain", yards: 0, big: false };
  if (kind === "run") {
    const runEdge = off.rush - def.rdef;
    if (chance(clamp(.02 + (5 - off.sec) * .004, .005, .05))) {
      play.outcome = "fumble";
      play.yards = Math.round(rand(0, 3));
    } else if (chance(clamp(.07 + runEdge * .012, .02, .18))) {
      play.big = true;
      play.yards = Math.round(rand(12, 35));
    } else {
      play.yards = Math.round(rand(-2, 7) + runEdge * .5);
    }
  } else {
    const deep = kind === "deep";
    if (chance(clamp((deep ? .07 : .05) + (def.prush - 5) * .01, .01, .15))) {
      play.outcome = "sack";
      play.yards = -Math.round(rand(4, 9));
    } else if (chance(clamp((deep ? .07 : .03) + (def.cov - off.sec) * .007, .005, .14))) {
      play.outcome = "interception";
    } else if (chance(clamp((deep ? .33 : .65) + (off.pass - def.cov) * .035, .12, .88))) {
      play.big = deep;
      play.yards = Math.round(deep ? rand(18, 40) : rand(4, 13) + (off.pass - def.cov) * .3);
    } else {
      play.outcome = "incomplete";
    }
  }
  if (play.yards >= yardsToGoal && (play.outcome === "gain" || play.outcome === "fumble")) {
    play.outcome = "touchdown";
    play.yards = yardsToGoal;
  }
  return play;
}

export type FootballEvent = "driveOver" | "overtime" | "final" | null;
export type DriveEnd = "touchdown" | "downs" | "interception" | "fumble";

export class DriveContest {
  readonly teams: [FootballStats, FootballStats];
  readonly drivesEach: number;
  readonly first: SideIndex = Math.random() < .5 ? 0 : 1;
  touchdowns: [number, number] = [0, 0];
  yards: [number, number] = [0, 0];
  drivesTaken: [number, number] = [0, 0];
  /** Yards from the ball to the goal line on the current drive. */
  yardsToGoal = START_YARDS;
  down = 1;
  overtime = false;
  done = false;
  winner: SideIndex = 0;
  lastEvent: FootballEvent = null;
  lastDriveEnd: DriveEnd | null = null;
  /** Total drives each side gets, growing by one in each overtime round. */
  private drivesAllowed: number;

  constructor(teams: [FootballStats, FootballStats], drivesEach: number) {
    this.teams = teams;
    this.drivesEach = drivesEach;
    this.drivesAllowed = drivesEach;
  }

  /** Sides alternate drives, starting with whoever won the coin toss. */
  get offense(): SideIndex {
    const second: SideIndex = this.first === 0 ? 1 : 0;
    return (this.drivesTaken[0] + this.drivesTaken[1]) % 2 === 0 ? this.first : second;
  }

  get points(): [number, number] {
    return [this.touchdowns[0] * TOUCHDOWN_POINTS, this.touchdowns[1] * TOUCHDOWN_POINTS];
  }

  next(): Play {
    const o = this.offense;
    return rollPlay(o, this.teams[o], this.teams[o === 0 ? 1 : 0], this.yardsToGoal);
  }

  apply(play: Play): void {
    this.lastEvent = null;
    const o = play.offense;
    this.yards[o] += play.yards;
    this.yardsToGoal -= play.yards;
    if (play.outcome === "touchdown") {
      this.touchdowns[o]++;
      return this.endDrive("touchdown");
    }
    if (play.outcome === "interception" || play.outcome === "fumble") return this.endDrive(play.outcome);
    this.down++;
    if (this.down > DOWNS) this.endDrive("downs");
  }

  private endDrive(how: DriveEnd): void {
    this.drivesTaken[this.offense]++;
    this.lastDriveEnd = how;
    this.yardsToGoal = START_YARDS;
    this.down = 1;
    this.lastEvent = "driveOver";
    if (this.drivesTaken[0] < this.drivesAllowed || this.drivesTaken[1] < this.drivesAllowed) return;
    const [t0, t1] = this.touchdowns, [y0, y1] = this.yards;
    if (t0 !== t1) return this.end(t0 > t1 ? 0 : 1);
    if (y0 !== y1) return this.end(y0 > y1 ? 0 : 1);
    // Dead even: one more drive each.
    this.overtime = true;
    this.drivesAllowed++;
    this.lastEvent = "overtime";
  }

  private end(winner: SideIndex): void {
    this.done = true;
    this.winner = winner;
    this.lastEvent = "final";
  }

  /** True when touchdowns decided it; false when it came down to yards. */
  wonByTouchdowns(): boolean {
    return this.touchdowns[0] !== this.touchdowns[1];
  }

  playOut(): void {
    while (!this.done) this.apply(this.next());
  }
}
