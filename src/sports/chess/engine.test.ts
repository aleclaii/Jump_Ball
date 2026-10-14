import { describe, expect, it } from "vitest";
import { evenValues } from "../../data/statSheet";
import { BLACK } from "./board";
import { ChessMatch } from "./engine";
import { CHESS_KEYS, type ChessStats } from "./stats";

const even = (value: number): ChessStats => evenValues(CHESS_KEYS, value);
const withStat = (key: keyof ChessStats, value: number): ChessStats => ({ ...even(5), [key]: value });

describe("speed chess games", () => {
  it("always end by checkmate, on material, or by the Armageddon rule, and within the move cap", () => {
    for (let i = 0; i < 25; i++) {
      const match = new ChessMatch([even(5), even(5)], 12);
      match.playOut();
      const w = match.winner, l = w === 0 ? 1 : 0;
      expect(match.played.length).toBeLessThanOrEqual(24);
      if (match.end === "checkmate") {
        expect(match.board.inCheck()).toBe(true);
        expect(match.board.legalMoves()).toHaveLength(0);
        expect(match.played[match.played.length - 1].side).toBe(w);
      } else if (match.end === "material") {
        expect(match.material(w)).toBeGreaterThan(match.material(l));
      } else {
        expect(match.material(w)).toBe(match.material(l));
        expect(match.colorOf(w)).toBe(BLACK);
      }
    }
  });

  it("only plays legal moves, with the sides taking turns", () => {
    const match = new ChessMatch([even(5), even(5)], 10);
    match.playOut();
    match.played.forEach((p, i) => expect(p.side).toBe(i % 2 === 0 ? match.whiteSide : 1 - match.whiteSide));
  });

  it("never blunders with full Composure, and does when nervous", () => {
    let calm = 0, nervous = 0;
    for (let i = 0; i < 12; i++) {
      const match = new ChessMatch([withStat("comp", 10), withStat("comp", 1)], 15);
      match.playOut();
      calm += match.played.filter((p) => p.side === 0 && p.blunder).length;
      nervous += match.played.filter((p) => p.side === 1 && p.blunder).length;
    }
    expect(calm).toBe(0);
    expect(nervous).toBeGreaterThan(0);
  });
});

/* Balance, measured on 160 games each (10 vs. 1 in one stat, everything else 5): Composure 76%,
   Tactics 69%, Calculation 69%, Endgame 65%, Opening 56%, equal players 51%; all 8s vs. all 3s 93%. The bounds below sit
   far enough from those numbers that chance can't fail them. These games are slow, so the counts are small. */
describe("speed chess balance", () => {
  const winRate = (a: ChessStats, b: ChessStats, games: number) => {
    let firstWins = 0;
    for (let i = 0; i < games; i++) {
      const match = new ChessMatch([a, b], 20);
      match.playOut();
      if (match.winner === 0) firstWins++;
    }
    return firstWins / games;
  };

  it("lets a much stronger player win most games", () => {
    const rate = winRate(even(8), even(3), 30);
    expect(rate).toBeGreaterThan(.65);
  }, 30000);

  it("makes Tactics alone a real advantage", () => {
    expect(winRate(withStat("tac", 10), withStat("tac", 1), 60)).toBeGreaterThan(.52);
  }, 40000);
});
