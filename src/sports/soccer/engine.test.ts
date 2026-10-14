import { describe, expect, it } from "vitest";
import { buildValues, ratingToStat } from "../../data/sheets";
import { evenValues } from "../../data/statSheet";
import { rollKick, Shootout } from "./engine";
import { SOCCER_KEYS, type SoccerStats } from "./stats";

const player = (rating: number): SoccerStats => evenValues(SOCCER_KEYS, ratingToStat(rating));
const build = (id: string) => buildValues("soccer", id) as SoccerStats;

function winRate(teams: [SoccerStats[], SoccerStats[]], shootouts: number): number {
  let firstWins = 0;
  for (let i = 0; i < shootouts; i++) {
    const shootout = new Shootout(teams, 5);
    shootout.playOut();
    if (shootout.winner === 0) firstWins++;
  }
  return firstWins / shootouts;
}

describe("penalty shootout engine", () => {
  it("scores roughly three penalties out of four between equal players", () => {
    let goals = 0;
    for (let i = 0; i < 4000; i++) if (rollKick(0, player(70), player(70)).outcome === "goal") goals++;
    expect(goals / 4000).toBeGreaterThan(.62);
    expect(goals / 4000).toBeLessThan(.82);
  });

  it("only saves when the keeper dives the right way", () => {
    for (let i = 0; i < 2000; i++) {
      const kick = rollKick(0, player(70), player(70));
      if (kick.outcome === "save") expect(kick.dive).toBe(kick.column);
    }
  });

  it("always ends with the winner ahead, out of reach of the kicks the loser has left", () => {
    for (let i = 0; i < 500; i++) {
      const shootout = new Shootout([[player(70)], [player(70)]], 3);
      shootout.playOut();
      const w = shootout.winner, l = w === 0 ? 1 : 0;
      const loserKicksLeft = shootout.suddenDeath ? 0 : shootout.kicksEach - shootout.taken[l];
      expect(shootout.goals[w]).toBeGreaterThan(shootout.goals[l] + loserKicksLeft);
    }
  });

  it("alternates sides, and rotates teammates as shooters and keepers in 2v2", () => {
    const shootout = new Shootout([[player(70), player(70)], [player(70), player(70)]], 5);
    shootout.playOut();
    shootout.kicks.forEach((kick, i) => {
      expect(kick.shooter).toBe(i % 2 === 0 ? shootout.first : 1 - shootout.first);
      expect(kick.shooterSlot).toBe(Math.floor(i / 2) % 2);
      expect(kick.keeperSlot).toBe(Math.floor(i / 2) % 2);
    });
  });

  it("is close to a coin flip between equal players, and favors the better-rated side", () => {
    const even = winRate([[player(70)], [player(70)]], 2000);
    expect(even).toBeGreaterThan(.44);
    expect(even).toBeLessThan(.56);
    expect(winRate([[player(85)], [player(60)]], 2000)).toBeGreaterThan(.6);
  });

  it("makes a Mind Reader keeper guess right more often against a low-Deception shooter", () => {
    const guessRate = (kicker: SoccerStats) => {
      let right = 0;
      for (let i = 0; i < 4000; i++) {
        const kick = rollKick(0, kicker, build("reader"));
        if (kick.dive === kick.column) right++;
      }
      return right / 4000;
    };
    expect(guessRate(build("stopper"))).toBeGreaterThan(guessRate(build("trickster")) + .1);
  });

  it("makes an accurate Sniper miss the target less than a Cannon", () => {
    const missRate = (kicker: SoccerStats) => {
      let misses = 0;
      for (let i = 0; i < 4000; i++) if (rollKick(0, kicker, player(70)).outcome === "miss") misses++;
      return misses / 4000;
    };
    expect(missRate(build("sniper"))).toBeLessThan(missRate(build("cannon")));
  });
});
