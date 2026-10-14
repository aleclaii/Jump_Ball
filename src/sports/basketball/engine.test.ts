import { describe, expect, it } from "vitest";
import { buildValues, ratingToStat } from "../../data/sheets";
import { evenValues } from "../../data/statSheet";
import { BasketballMatch } from "./engine";
import { BASKETBALL_KEYS, type BasketballStats } from "./stats";

const evenStats = (value: number): BasketballStats => evenValues(BASKETBALL_KEYS, value);
const build = (id: string) => buildValues("basketball", id) as BasketballStats;

interface Totals {
  firstWins: number;
  contested: [number, number];
  attempts: [number, number];
  steals: [number, number];
  blocks: [number, number];
  assists: [number, number];
}

/** Plays many full games and adds up what happened to each side. */
function playMany(teams: BasketballStats[][], games: number, quarters = 4): Totals {
  const totals: Totals = { firstWins: 0, contested: [0, 0], attempts: [0, 0], steals: [0, 0], blocks: [0, 0], assists: [0, 0] };
  for (let i = 0; i < games; i++) {
    const match = new BasketballMatch(teams, quarters, 45);
    match.playOut();
    if (match.winner === 0) totals.firstWins++;
    for (const side of [0, 1] as const) {
      totals.contested[side] += match.shots[side].contested;
      totals.attempts[side] += match.shots[side].att;
      totals.steals[side] += match.box[side].reduce((sum, p) => sum + p.stl, 0);
      totals.blocks[side] += match.box[side].reduce((sum, p) => sum + p.blk, 0);
      totals.assists[side] += match.box[side].reduce((sum, p) => sum + p.ast, 0);
    }
  }
  return totals;
}

describe("basketball engine", () => {
  it("always finishes with a winner and a higher score for that side", () => {
    for (let i = 0; i < 200; i++) {
      const match = new BasketballMatch([[evenStats(5)], [evenStats(5)]], 1, 30);
      match.playOut();
      expect(match.done).toBe(true);
      expect(match.score[match.winner]).toBeGreaterThan(match.score[1 - match.winner]);
    }
  });

  it("is close to a coin flip between identical players", () => {
    const { firstWins } = playMany([[evenStats(5)], [evenStats(5)]], 2000);
    expect(firstWins / 2000).toBeGreaterThan(.44);
    expect(firstWins / 2000).toBeLessThan(.56);
  });

  // A realistic slider gap in a quick game wins about 72% of the time. (A 90 vs. 55 full game wins
  // 99.8%, so "upsets still happen" can't be checked there without the test failing by chance.)
  it("lets a higher rating win more often, but not every time", () => {
    const { firstWins } = playMany([[evenStats(ratingToStat(82))], [evenStats(ratingToStat(70))]], 1000, 1);
    expect(firstWins / 1000).toBeGreaterThan(.6);
    expect(firstWins / 1000).toBeLessThan(.85);
  });

  it("makes a Lockdown defender contest more shots and steal more than a Sharpshooter", () => {
    const totals = playMany([[build("sharp")], [build("lockdown")]], 800);
    const sharpContested = totals.contested[0] / totals.attempts[0];
    const lockdownContested = totals.contested[1] / totals.attempts[1];
    expect(sharpContested).toBeGreaterThan(lockdownContested);
    expect(totals.steals[1]).toBeGreaterThan(totals.steals[0]);
  });

  it("gives a Big Man more blocks than a Slasher", () => {
    const totals = playMany([[build("slasher")], [build("big")]], 800);
    expect(totals.blocks[1]).toBeGreaterThan(totals.blocks[0] * 3);
  });

  it("only produces assists in 2v2", () => {
    const solo = playMany([[evenStats(5)], [evenStats(5)]], 200);
    expect(solo.assists).toEqual([0, 0]);
    const duo = playMany([[build("general"), evenStats(5)], [evenStats(5), evenStats(5)]], 200);
    expect(duo.assists[0]).toBeGreaterThan(duo.assists[1]);
  });

  it("carries fatigue into the next game of a series", () => {
    const fresh = new BasketballMatch([[evenStats(5)], [evenStats(5)]], 4, 45, 0);
    const tired = new BasketballMatch([[evenStats(5)], [evenStats(5)]], 4, 45, 8);
    expect(fresh.tiredness(0, 0)).toBe(0);
    expect(tired.tiredness(0, 0)).toBeGreaterThan(0);
  });
});
