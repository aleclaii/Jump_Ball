import { describe, expect, it } from "vitest";
import { evenValues } from "../../data/statSheet";
import { sharpeRatio, TradingMatch } from "./engine";
import { FED_STEP, Market } from "./market";
import { TRADING_KEYS, type TradingStats } from "./stats";
import { NEUTRAL_STYLE, type TraderSpec } from "./trader";

const even = (): TradingStats => evenValues(TRADING_KEYS, 5);
const trader = (stats: Partial<TradingStats> = {}): TraderSpec => ({ stats: { ...even(), ...stats }, style: NEUTRAL_STYLE });

/** How often `a` beats `b`, swapping sides every other game so neither gets the first seat. */
function winRate(a: TraderSpec, b: TraderSpec, games: number, days = 60): number {
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const aFirst = i % 2 === 0;
    const match = new TradingMatch(aFirst ? [a, b] : [b, a], days);
    match.playOut();
    if ((match.winner === 0) === aFirst) wins++;
  }
  return wins / games;
}

const correlation = (a: number[], b: number[]): number => {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let cov = 0, va = 0, vb = 0;
  a.forEach((x, k) => {
    cov += (x - ma) * (b[k] - mb);
    va += (x - ma) ** 2;
    vb += (b[k] - mb) ** 2;
  });
  return cov / Math.sqrt(va * vb);
};

describe("Sharpe ratio", () => {
  it("is the average excess return over its standard deviation, scaled to a year", () => {
    // Daily excess returns of +2% and 0%: mean 1%, standard deviation 1%, so 1 per day, √252 per year.
    expect(sharpeRatio([.02, 0, .02, 0])).toBeCloseTo(Math.sqrt(252), 6);
    expect(sharpeRatio([-.02, 0, -.02, 0])).toBeCloseTo(-Math.sqrt(252), 6);
  });

  it("scores a trader who took no risk at all as 0", () => {
    expect(sharpeRatio([0, 0, 0])).toBe(0);
  });

  it("does not change when every bet is twice as big", () => {
    const returns = [.01, -.004, .006, .002, -.003];
    expect(sharpeRatio(returns.map((r) => r * 2))).toBeCloseTo(sharpeRatio(returns), 9);
  });
});

describe("Simulated market", () => {
  it("keeps prices near true value", () => {
    const gaps: number[] = [];
    for (let g = 0; g < 50; g++) {
      const market = new Market(250);
      while (!market.done) {
        market.advance([]);
        market.stocks.forEach((s) => gaps.push(Math.log(s.price / s.value)));
      }
    }
    const spread = Math.sqrt(gaps.reduce((s, x) => s + x * x, 0) / gaps.length);
    expect(spread).toBeGreaterThan(.02);
    expect(spread).toBeLessThan(.1);
  });

  it("moves rivals together more than unrelated stocks", () => {
    const rivals: number[] = [], strangers: number[] = [];
    for (let g = 0; g < 80; g++) {
      const market = new Market(250);
      while (!market.done) market.advance([]);
      const moves = market.priceHistory.map((h) => h.slice(1).map((x, k) => x - h[k]));
      const rival = market.stocks[0].rival;
      const stranger = market.stocks.findIndex((_, i) => i !== 0 && i !== rival);
      rivals.push(correlation(moves[0], moves[rival]));
      strangers.push(correlation(moves[0], moves[stranger]));
    }
    const average = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    expect(average(rivals)).toBeGreaterThan(average(strangers) + .1);
  });

  it("has at least one pair of rivals and changes rates in quarter-point steps", () => {
    for (let g = 0; g < 50; g++) {
      const market = new Market(250);
      expect(market.stocks.length).toBeGreaterThanOrEqual(4);
      expect(market.stocks.some((s) => s.rival >= 0)).toBe(true);
      while (!market.done) {
        for (const event of market.advance([])) {
          if (event.type === "fed") expect([-FED_STEP, 0, FED_STEP]).toContain(event.change);
        }
      }
      expect(market.rate).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Trading match", () => {
  it("keeps every trader within the short-selling cap", () => {
    for (let g = 0; g < 30; g++) {
      const match = new TradingMatch([trader({ risk: 1, disc: 1 }), trader()], 60);
      while (!match.done) {
        match.playDay();
        for (const t of match.traders) {
          const equity = t.equity(match.market);
          const shorts = t.shares.reduce((s, q, i) => s + Math.max(0, -q) * match.market.stocks[i].price, 0);
          expect(shorts).toBeLessThan(equity * 1.6);
        }
      }
    }
  });

  it("is a fair coin flip between equal traders", () => {
    const rate = winRate(trader(), trader(), 2000);
    expect(rate).toBeGreaterThan(.45);
    expect(rate).toBeLessThan(.55);
  });

  // Measured over 1000 Quick games each: 60-74% for every stat at 10 against 1.
  it.each(TRADING_KEYS)("gives an edge to a trader with %s at 10 over 1", (key) => {
    const rate = winRate(trader({ [key]: 10 }), trader({ [key]: 1 }), 1500);
    expect(rate).toBeGreaterThan(.54);
    expect(rate).toBeLessThan(.9);
  });
});
