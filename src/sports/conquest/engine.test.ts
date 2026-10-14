import { describe, expect, it } from "vitest";
import { evenValues } from "../../data/statSheet";
import { ConquestMatch } from "./engine";
import { generateMap } from "./map";
import { CONQUEST_KEYS, type ConquestStats } from "./stats";

const even = (value: number): ConquestStats => evenValues(CONQUEST_KEYS, value);
const withStat = (key: keyof ConquestStats, value: number): ConquestStats => ({ ...even(5), [key]: value });

function playMany(a: ConquestStats, b: ConquestStats, games: number, turns = 20) {
  const totals = { firstWins: 0, founded: [0, 0], captures: [0, 0], tech: [0, 0], pop: [0, 0] };
  for (let i = 0; i < games; i++) {
    const match = new ConquestMatch([a, b], turns);
    match.playOut();
    if (match.winner === 0) totals.firstWins++;
    for (const side of [0, 1] as const) {
      totals.founded[side] += match.cities.filter((c) => c.founder === side && !c.capital).length;
      totals.captures[side] += match.captures[side];
      totals.tech[side] += match.techLevel[side];
      totals.pop[side] += match.population(side);
    }
  }
  return { ...totals, firstWinRate: totals.firstWins / games };
}

describe("Mini 4X map", () => {
  it("is point-symmetric, so both capitals start with the same land", () => {
    for (let i = 0; i < 50; i++) {
      const map = generateMap();
      map.tiles.forEach((tile) => {
        const mirror = map.tiles[tile.mirror];
        // `0 - x` rather than `-x`, so a 0 coordinate stays 0 instead of becoming -0.
        expect([mirror.q, mirror.r]).toEqual([0 - tile.q, 0 - tile.r]);
        expect(mirror.terrain).toBe(tile.terrain);
      });
      expect(map.tiles[map.capitals[1]].mirror).toBe(map.capitals[0]);
    }
  });

  it("puts both capitals on plains, with no water next to them", () => {
    const map = generateMap();
    for (const capital of map.capitals) {
      expect(map.tiles[capital].terrain).toBe("plains");
      map.neighbors[capital].forEach((n) => expect(map.tiles[n].terrain).not.toBe("water"));
    }
  });
});

describe("Mini 4X games", () => {
  it("always end with a winner: the capital taken, or more territory, within the turn limit", () => {
    for (let i = 0; i < 300; i++) {
      const match = new ConquestMatch([even(5), even(5)], 20);
      match.playOut();
      const w = match.winner, l = w === 0 ? 1 : 0;
      expect(match.turn).toBeLessThanOrEqual(20);
      if (match.end === "capital") {
        const lostCapital = match.cities.find((c) => c.capital && c.founder === l)!;
        expect(lostCapital.owner).toBe(w);
      } else if (match.end === "territory") {
        expect(match.territory(w)).toBeGreaterThan(match.territory(l));
      } else {
        expect(match.territory(w)).toBe(match.territory(l));
      }
    }
  });

  it("is a coin flip between equal empires", () => {
    const { firstWinRate } = playMany(even(5), even(5), 3000);
    expect(firstWinRate).toBeGreaterThan(.46);
    expect(firstWinRate).toBeLessThan(.54);
  });

  /* Balance, measured on 1,500 games each (10 vs. 1 in one stat, everything else 5): Economy 77%,
     Military 75%, Defense 72%, Science 71%, Expansion 70%; all 8s vs. all 3s 96%. */
  it("makes every stat an advantage without any one deciding the game", () => {
    for (const key of CONQUEST_KEYS) {
      const { firstWinRate } = playMany(withStat(key, 10), withStat(key, 1), 1500);
      expect(firstWinRate, key).toBeGreaterThan(.62);
      expect(firstWinRate, key).toBeLessThan(.86);
    }
  });

  it("gives each stat its own effect", () => {
    expect(playMany(withStat("exp", 10), withStat("exp", 1), 400).founded).toSatisfy(([a, b]: number[]) => a > b * 1.3);
    expect(playMany(withStat("sci", 10), withStat("sci", 1), 400).tech).toSatisfy(([a, b]: number[]) => a > b * 1.5);
    expect(playMany(withStat("mil", 10), withStat("mil", 1), 400).captures).toSatisfy(([a, b]: number[]) => a > b * 1.3);
    expect(playMany(withStat("econ", 10), withStat("econ", 1), 400).pop).toSatisfy(([a, b]: number[]) => a > b);
  });
});
