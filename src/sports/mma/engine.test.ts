import { describe, expect, it } from "vitest";
import { buildValues, ratingToStat } from "../../data/sheets";
import { evenValues } from "../../data/statSheet";
import { MmaFight } from "./engine";
import { MMA_KEYS, type MmaStats } from "./stats";

const fighter = (rating: number): MmaStats => evenValues(MMA_KEYS, ratingToStat(rating));
const build = (id: string) => buildValues("mma", id) as MmaStats;

function fightMany(fighters: [MmaStats, MmaStats], rounds: number, fights: number) {
  let firstWins = 0, knockouts = 0;
  const takedowns = [0, 0], landed = [0, 0], rocked = [0, 0];
  for (let i = 0; i < fights; i++) {
    const fight = new MmaFight(fighters, rounds, 45);
    fight.playOut();
    if (fight.winner === 0) firstWins++;
    if (fight.method === "ko") knockouts++;
    for (const side of [0, 1]) {
      takedowns[side] += fight.takedowns[side];
      landed[side] += fight.landed[side];
      rocked[side] += fight.knockdowns[side];
    }
  }
  return { firstWinRate: firstWins / fights, knockoutRate: knockouts / fights, takedowns, landed, rocked };
}

describe("MMA engine", () => {
  it("ends every fight with a winner who has more health left", () => {
    for (let i = 0; i < 300; i++) {
      const fight = new MmaFight([fighter(70), fighter(70)], 1, 30);
      fight.playOut();
      expect(fight.done).toBe(true);
      const loser = fight.winner === 0 ? 1 : 0;
      expect(fight.health[fight.winner]).toBeGreaterThan(fight.health[loser]);
    }
  });

  it("ends a knockout with the loser at zero health", () => {
    let checked = 0;
    for (let i = 0; i < 300 && checked < 20; i++) {
      const fight = new MmaFight([fighter(70), fighter(70)], 3, 45);
      fight.playOut();
      if (fight.method !== "ko") continue;
      expect(fight.health[fight.winner === 0 ? 1 : 0]).toBe(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("is close to a coin flip between equal fighters", () => {
    const { firstWinRate } = fightMany([fighter(70), fighter(70)], 1, 2000);
    expect(firstWinRate).toBeGreaterThan(.44);
    expect(firstWinRate).toBeLessThan(.56);
  });

  it("lets the better-rated fighter win more often, but not every time", () => {
    const { firstWinRate } = fightMany([fighter(82), fighter(70)], 1, 2000);
    expect(firstWinRate).toBeGreaterThan(.6);
    expect(firstWinRate).toBeLessThan(.95);
  });

  it("has knockouts sometimes in a quick fight, and more often in a full fight", () => {
    const quick = fightMany([fighter(70), fighter(70)], 1, 1500).knockoutRate;
    const full = fightMany([fighter(70), fighter(70)], 3, 1500).knockoutRate;
    expect(quick).toBeGreaterThan(.08);
    expect(quick).toBeLessThan(.45);
    expect(full).toBeGreaterThan(quick);
  });

  it("makes a Wrestler land far more takedowns, and a Brawler more strikes and big shots", () => {
    const stats = fightMany([build("wrestler"), build("brawler")], 3, 800);
    expect(stats.takedowns[0]).toBeGreaterThan(stats.takedowns[1] * 3);
    expect(stats.rocked[1]).toBeGreaterThan(stats.rocked[0]);
  });

  it("keeps different builds competitive with each other", () => {
    const { firstWinRate } = fightMany([build("wrestler"), build("brawler")], 1, 1500);
    expect(firstWinRate).toBeGreaterThan(.3);
    expect(firstWinRate).toBeLessThan(.7);
  });

  it("lets a high-Cardio fighter fade less late in long fights", () => {
    const tank = build("tank"), marathoner = build("marathon");
    const fight = new MmaFight([tank, marathoner], 3, 45);
    fight.round = 3;
    expect(fight.tiredness(1)).toBeLessThan(fight.tiredness(0));
  });
});
