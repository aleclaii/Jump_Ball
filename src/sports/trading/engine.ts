/* A trading match with no drawing: one market, two traders, one trading day at a time. The winner is
   whoever earned more return per unit of risk (the Sharpe ratio), not simply whoever made more money. */

import type { SideIndex } from "../types";
import { Market, type MarketEvent, TRADING_DAYS_PER_YEAR } from "./market";
import { START_CASH, Trader, type TraderAction, type TraderSpec } from "./trader";

export interface DayReport {
  day: number;
  events: MarketEvent[];
  actions: TraderAction[];
}

export type TradingEnd = "sharpe" | "return";

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

/** Standard deviation: how far, on average, values land from their mean. */
export function standardDeviation(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/**
 * The Sharpe ratio of daily returns that already have the safe rate taken out, scaled to a year:
 * average excess return divided by its standard deviation, times √252 (returns add up over a year's
 * 252 trading days, while their swings grow only with the square root). A trader who never took any
 * risk scores 0.
 */
export function sharpeRatio(excessReturns: number[]): number {
  const spread = standardDeviation(excessReturns);
  if (spread < 1e-12) return 0;
  return mean(excessReturns) / spread * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

export class TradingMatch {
  readonly market: Market;
  readonly traders: [Trader, Trader];
  /** Each stock's true value at the end of each day, starting with day 0. */
  readonly valueHistory: number[][];
  /** The crowd's mood at the end of each day, starting with day 0. */
  readonly moodHistory: number[];
  private orderFlow: number[];
  done = false;
  winner: SideIndex = 0;
  end: TradingEnd = "sharpe";

  constructor(specs: [TraderSpec, TraderSpec], days: number) {
    this.market = new Market(days);
    this.traders = [new Trader(0, specs[0], this.market), new Trader(1, specs[1], this.market)];
    this.valueHistory = this.market.stocks.map((s) => [s.value]);
    this.moodHistory = [this.market.mood];
    this.orderFlow = this.market.stocks.map(() => 0);
  }

  get day(): number {
    return this.market.day;
  }

  get days(): number {
    return this.market.days;
  }

  sharpe(side: SideIndex): number {
    return sharpeRatio(this.traders[side].excessReturns);
  }

  /** Total return so far, e.g. 0.042 for +4.2%. */
  totalReturn(side: SideIndex): number {
    return this.traders[side].equity(this.market) / START_CASH - 1;
  }

  /** How bumpy the ride was: the standard deviation of daily returns, scaled to a year. */
  volatility(side: SideIndex): number {
    return standardDeviation(this.traders[side].excessReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  playDay(): DayReport {
    const day = this.market.day;
    const events = this.market.advance(this.orderFlow);
    this.orderFlow = this.market.stocks.map(() => 0);
    const actions: TraderAction[] = [];
    // Who moves first alternates, so neither trader always gets the better price.
    const order: SideIndex[] = day % 2 === 0 ? [0, 1] : [1, 0];
    for (const side of order) {
      const trader = this.traders[side];
      trader.observe(this.market, events);
      const consult = trader.consult(this.market);
      if (consult) actions.push(consult);
      actions.push(...trader.trade(this.market, this.orderFlow));
    }
    this.traders.forEach((t) => t.closeDay(this.market));
    this.market.stocks.forEach((s, i) => this.valueHistory[i].push(s.value));
    this.moodHistory.push(this.market.mood);
    if (this.market.done) this.finish();
    return { day, events, actions };
  }

  playOut(): void {
    while (!this.done) this.playDay();
  }

  private finish(): void {
    this.done = true;
    const [a, b] = [this.sharpe(0), this.sharpe(1)];
    if (Math.abs(a - b) > 1e-9) {
      this.winner = a > b ? 0 : 1;
      this.end = "sharpe";
    } else {
      this.winner = this.totalReturn(0) >= this.totalReturn(1) ? 0 : 1;
      this.end = "return";
    }
  }
}
