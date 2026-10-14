/* One trader: what they believe each company is worth, when they hire consultants, and how they turn
   beliefs into a portfolio each day. Every stat owns one step:

   - Research: how far their own estimate of each true value is off.
   - Network: what consultants charge them and how sharp the reports are (together with Research).
   - Macro: how well they read the crowd's mood and forecast the Fed.
   - Risk Control: sizing bets steadily instead of by gut feeling, and not keeping "pet" positions.
   - Discipline: not chasing hot stocks, not panic-selling after losses, and not letting their
     bull/bear lean override the evidence.
   - Quant: trading rivals whose prices drift apart, and hedging out the market's ups and downs.
   - Execution: paying less of the market makers' spread, and skipping trades too small to be worth it.

   Their style (outside the budget) is a lean from bearish (-1) to bullish (+1), and whether they are a
   contrarian, who bets against the crowd's mood instead of riding the trend. */

import { clamp, gaussian } from "../../util/math";
import type { SideIndex } from "../types";
import { dailyVariance, EARNINGS_SPREAD, type Market, type MarketEvent, MISPRICING_FADE, RATE_SENSITIVITY, TRADING_DAYS_PER_YEAR } from "./market";
import type { TradingStats } from "./stats";

export interface TraderStyle {
  /** -1 bearish to +1 bullish. */
  lean: number;
  contrarian: boolean;
}

export const NEUTRAL_STYLE: TraderStyle = { lean: 0, contrarian: false };

export interface TraderSpec {
  stats: TradingStats;
  style: TraderStyle;
}

export const START_CASH = 100_000;

/** Consulting firms: pricier ones see more clearly. `fee` is a share of the client's portfolio. */
export const FIRMS = [
  { name: "Two Guys & a Spreadsheet", fee: .0004, noise: .045 },
  { name: "Brightline Advisory", fee: .001, noise: .028 },
  { name: "Summit Strategy Group", fee: .0025, noise: .014 },
];

export type TraderAction =
  | { type: "trade"; side: SideIndex; stock: number; kind: "buy" | "sell" | "short" | "cover"; dollars: number }
  | { type: "consult"; side: SideIndex; stock: number; firm: number; fee: number }
  | { type: "panic"; side: SideIndex };

/** Days ahead a trader plans for. */
const HORIZON = 10;
/** Share of a stock's mispricing expected to fade within the horizon. */
const CONVERGENCE = 1 - Math.pow(1 - MISPRICING_FADE, HORIZON);
/** Typical size of a mispricing, so a trader can tell how much of a gap is real or their own error. */
const MISPRICING_VAR = .03 ** 2;
/** How strongly expected return turns into position size. Higher = more cautious for everyone. */
const RISK_AVERSION = 30;
const MAX_GROSS = 2;
const MAX_POSITION = .8;
/** Shorts can total up to this many times the portfolio: a high cap, but a cap. */
const MAX_SHORT = 1.5;
const BORROW_FEE = .01;
const ERROR_PERSISTENCE = .85;
const PARTIAL_FILL = .5;
const PET_SIZE = .3;
const PET_PERSISTENCE = .97;
const STAKE_SHARE = .1;

const statShare = (value: number): number => (value - 1) / 9;

export class Trader {
  readonly side: SideIndex;
  readonly stats: TradingStats;
  readonly style: TraderStyle;
  cash = START_CASH;
  shares: number[];
  /** How far off their estimate of each log true value is. They can't see this, only its typical size. */
  private errors: number[];
  private errorVar: number[];
  private readonly dailyErrorNoise: number;
  /** A consultant's estimate of each stock's coming earnings surprise, if they bought one. */
  private tips: (number | null)[];
  private fedForecast: number | null = null;
  private moodError = 0;
  private gutFeeling = 0;
  /** Their pet positions, in standard units (scaled by how careless they are). */
  private petBets: number[];
  /** Which rival pairs they've noticed move together (Quant), and the price gap they consider normal for each. */
  private readonly knownPairs: [number, number][] = [];
  private pairAnchors: number[] = [];
  /** How much each stock typically moves over the horizon, for sizing bets. */
  private readonly risks: number[];
  private peak = START_CASH;
  private panicking = false;
  /** Portfolio value at the end of each day, starting with day 0. */
  readonly equityHistory: number[] = [START_CASH];
  /** Each day's return minus what the bond paid that day. */
  readonly excessReturns: number[] = [];
  feesPaid = 0;
  costsPaid = 0;
  consultations = 0;

  constructor(side: SideIndex, spec: TraderSpec, market: Market) {
    this.side = side;
    this.stats = spec.stats;
    this.style = spec.style;
    const n = market.stocks.length;
    this.shares = new Array(n).fill(0);
    this.dailyErrorNoise = .022 * (1 - statShare(this.stats.res)) ** 1.5 + .007;
    const steady = this.dailyErrorNoise ** 2 / (1 - ERROR_PERSISTENCE ** 2);
    this.errors = Array.from({ length: n }, () => gaussian() * Math.sqrt(steady));
    this.errorVar = new Array(n).fill(steady);
    this.tips = new Array(n).fill(null);
    this.petBets = Array.from({ length: n }, () => gaussian());
    market.stocks.forEach((s, i) => {
      if (s.rival > i && Math.random() < .25 + .075 * this.stats.quant) this.knownPairs.push([i, s.rival]);
    });
    this.pairAnchors = this.knownPairs.map(([a, b]) => Math.log(market.stocks[a].price / market.stocks[b].price));
    this.risks = market.stocks.map((s) => dailyVariance(s) * HORIZON);
  }

  equity(market: Market): number {
    return this.cash + this.shares.reduce((sum, q, i) => sum + q * market.stocks[i].price, 0);
  }

  /** Their estimate of a stock's log true value. */
  private estimate(market: Market, stock: number): number {
    return Math.log(market.stocks[stock].value) + this.errors[stock];
  }

  /** Updates what they believe after a day's events (Research decides how well they read the news). */
  observe(market: Market, events: MarketEvent[]): void {
    const misread = 1.05 - .09 * this.stats.res;
    this.errors = this.errors.map((e, i) => {
      this.errorVar[i] = this.errorVar[i] * ERROR_PERSISTENCE ** 2 + this.dailyErrorNoise ** 2;
      return e * ERROR_PERSISTENCE + gaussian() * this.dailyErrorNoise;
    });
    for (const event of events) {
      if (event.type === "news") {
        this.errors[event.stock] += gaussian() * Math.abs(event.jump) * misread;
        if (event.rival !== undefined) this.errors[event.rival] += gaussian() * Math.abs(event.jump) * misread;
      } else if (event.type === "earnings") {
        this.errors[event.stock] += gaussian() * Math.abs(event.surprise) * misread;
        this.tips[event.stock] = null;
      } else if (event.type === "fed") {
        this.fedForecast = null;
      }
    }
    // Quant: the normal gap between rivals follows the prices slowly, and jumps with real news at once
    // (a skilled quant knows news changes what the companies are worth, so that part of a gap won't close).
    const newsMoves = market.stocks.map(() => 0);
    for (const event of events) {
      if (event.type === "news") {
        newsMoves[event.stock] += event.jump;
        if (event.rival !== undefined) newsMoves[event.rival] -= event.jump * .7;
      } else if (event.type === "earnings") newsMoves[event.stock] += event.surprise;
    }
    this.pairAnchors = this.knownPairs.map(([a, b], p) => {
      const gap = Math.log(market.stocks[a].price / market.stocks[b].price);
      const anchor = this.pairAnchors[p] + (newsMoves[a] - newsMoves[b]) * statShare(this.stats.quant);
      return anchor + (gap - anchor) / 15;
    });
    // Macro: a read of the crowd's mood that is off by a slowly wandering error.
    const moodNoise = .4 * (1 - statShare(this.stats.mac)) ** 2 + .02;
    this.moodError = this.moodError * .9 + gaussian() * moodNoise * Math.sqrt(1 - .81);
    // Macro: a forecast of the next Fed surprise a few days ahead of the meeting.
    const fedDay = market.nextFedDay;
    if (fedDay !== null && fedDay - market.day <= 3 && this.fedForecast === null) {
      const skill = .08 * this.stats.mac;
      this.fedForecast = market.nextFedSurprise * skill + gaussian() * .0012 * (1 - skill);
    }
  }

  /**
   * Maybe hires one consultant today for a preview of a stock's coming earnings, which also sharpens
   * their estimate of its value. Network lowers the fee; Network and Research sharpen the report.
   */
  consult(market: Market): TraderAction | null {
    const equity = this.equity(market);
    const feeScale = 1.45 - .09 * this.stats.net;
    // A report is only as good as the questions asked: Research matters as much as the firm's Network ties.
    const clarity = 2 - .06 * this.stats.res - .1 * this.stats.net;
    // Information is only worth what you can do with it: judged against a typical bet, not the whole portfolio.
    const stake = equity * STAKE_SHARE;
    let best: { stock: number; firm: number; value: number } | null = null;
    market.stocks.forEach((_, i) => {
      const earningsDay = market.nextEarnings(i);
      // Consultants are hired ahead of earnings, when private research is worth the most.
      if (earningsDay === null || earningsDay - market.day > HORIZON || this.tips[i] !== null) return;
      FIRMS.forEach((firm, f) => {
        const noise = firm.noise * clarity;
        // An earnings preview is worth the typical surprise times the share of it the report explains (R²).
        const edge = EARNINGS_SPREAD * EARNINGS_SPREAD ** 2 / (EARNINGS_SPREAD ** 2 + (noise * 1.2) ** 2);
        const value = stake * edge - firm.fee * feeScale * equity;
        if (value > 0 && (!best || value > best.value)) best = { stock: i, firm: f, value };
      });
    });
    if (!best) return null;
    const { stock, firm } = best;
    const noise = FIRMS[firm].noise * clarity;
    const fee = FIRMS[firm].fee * feeScale * equity;
    this.cash -= fee;
    this.feesPaid += fee;
    this.consultations++;
    // Combining their own estimate with the report, weighted by how much each can be trusted (Bayes' rule).
    const keep = noise ** 2 / (noise ** 2 + this.errorVar[stock]);
    this.errors[stock] = keep * this.errors[stock] + (1 - keep) * gaussian() * noise;
    this.errorVar[stock] = keep * this.errorVar[stock];
    this.tips[stock] = market.stocks[stock].upcomingSurprise + gaussian() * noise * 1.2;
    return { type: "consult", side: this.side, stock, firm, fee };
  }

  /** The share of the portfolio they want in each stock (negative = short). */
  private targetWeights(market: Market): number[] {
    const { risk, disc, quant } = this.stats;
    const stocks = market.stocks;
    const moodRead = market.mood + this.moodError;

    // Each stock's expected return over the horizon: the gap between their estimate and the price,
    // minus the part they blame on the mood, trusted only as far as their own estimate deserves.
    const alpha = stocks.map((s, i) => {
      const gap = this.estimate(market, i) - (Math.log(s.price) - s.moodSensitivity * moodRead);
      const trust = MISPRICING_VAR / (MISPRICING_VAR + this.errorVar[i]);
      let expected = gap * trust * CONVERGENCE;
      const earningsDay = market.nextEarnings(i);
      if (this.tips[i] !== null && earningsDay !== null && earningsDay - market.day <= HORIZON) expected += this.tips[i]! * .9;
      // Discipline: an undisciplined trader chases whatever went up last week.
      expected += (1 - statShare(disc)) ** 2 * .35 * market.stockMove(i, 5);
      return expected;
    });

    // Quant: when rivals' prices drift apart more than the news explains, expect the gap to close.
    this.knownPairs.forEach(([a, b], p) => {
      const drift = Math.log(stocks[a].price / stocks[b].price) - this.pairAnchors[p];
      const expected = -drift * CONVERGENCE * 3 * statShare(quant);
      alpha[a] += expected / 2;
      alpha[b] -= expected / 2;
    });

    // The whole market: ride the mood or fight it, the bull/bear lean, and the Fed.
    let marketView = 0;
    if (this.style.contrarian) marketView -= .14 * moodRead * .05;
    else marketView += .25 * market.recentMove(5);
    marketView += .006 * this.style.lean * (1.3 - .1 * disc);
    const fedDay = market.nextFedDay;
    if (this.fedForecast !== null && fedDay !== null && fedDay - market.day <= 3) marketView -= RATE_SENSITIVITY * this.fedForecast;
    stocks.forEach((s, i) => (alpha[i] += s.beta * marketView));

    // Size each bet by its expected return over its risk. (Full Markowitz sizing, which also accounts for
    // how stocks move together, did worse here: it magnifies errors in the expected returns.)
    const optimal = alpha.map((a, i) => a / (RISK_AVERSION * this.risks[i]));

    // Risk Control: a careless trader sizes by gut feeling, betting big one week and small the next for
    // no reason. That adds swings without adding return, which is exactly what a Sharpe ratio punishes.
    this.gutFeeling = this.gutFeeling * .8 + gaussian() * .6;
    const careless = (1 - statShare(risk)) ** 1.5;
    const gut = Math.exp(this.gutFeeling * careless);
    // Risk Control: a careless trader also keeps "pet" positions in stocks they just like. Those add
    // swings with nothing expected in return, which drags down the Sharpe ratio.
    this.petBets = this.petBets.map((b) => b * PET_PERSISTENCE + gaussian() * Math.sqrt(1 - PET_PERSISTENCE ** 2));
    let weights = optimal.map((w, i) => w * gut + this.petBets[i] * PET_SIZE * careless);

    weights = weights.map((w) => clamp(w, -MAX_POSITION, MAX_POSITION));

    // Discipline: after a big drop from their best, an undisciplined trader panic-sells.
    const drawdown = 1 - this.equity(market) / this.peak;
    const threshold = .02 + .006 * disc;
    const panic = drawdown > threshold ? Math.max(.15, 1 - (drawdown - threshold) * (10 - disc) * 1.5) : 1;
    this.panicking = panic < .8;
    weights = weights.map((w) => w * panic);

    // Limits on everyone: total size and total shorts.
    const totalGross = weights.reduce((sum, w) => sum + Math.abs(w), 0);
    if (totalGross > MAX_GROSS) weights = weights.map((w) => w * MAX_GROSS / totalGross);
    const totalShort = weights.reduce((sum, w) => sum + Math.max(0, -w), 0);
    if (totalShort > MAX_SHORT) weights = weights.map((w) => (w < 0 ? w * MAX_SHORT / totalShort : w));
    return weights;
  }

  /** Whether they're panic-selling right now (for commentary). */
  get inPanic(): boolean {
    return this.panicking;
  }

  /**
   * Trades toward today's targets and records the day's return. Returns the trades worth mentioning,
   * and adds each stock's net dollars traded to `orderFlow`.
   */
  trade(market: Market, orderFlow: number[]): TraderAction[] {
    const actions: TraderAction[] = [];
    const before = this.equity(market);
    const wasPanicking = this.panicking;
    const weights = this.targetWeights(market);
    if (this.panicking && !wasPanicking) actions.push({ type: "panic", side: this.side });

    // Execution: skip adjustments that are small next to the position, and pay less of the spread.
    // Everyone moves only partway to the target each day, like a real desk working an order.
    const band = .05 + .02 * this.stats.exec;
    const costRate = market.halfSpread * (1.6 - .11 * this.stats.exec);
    market.stocks.forEach((s, i) => {
      const current = this.shares[i] * s.price / before;
      const change = weights[i] - current;
      if (Math.abs(change) < band * Math.max(Math.abs(weights[i]), Math.abs(current), .02)) return;
      const dollars = change * PARTIAL_FILL * before;
      const cost = Math.abs(dollars) * costRate;
      const held = this.shares[i];
      this.shares[i] += dollars / s.price;
      this.cash -= dollars + cost;
      this.costsPaid += cost;
      orderFlow[i] += dollars;
      if (Math.abs(dollars) > before * .05) {
        const kind = dollars > 0 ? (held < 0 ? "cover" : "buy") : (held > 0 ? "sell" : "short");
        actions.push({ type: "trade", side: this.side, stock: i, kind, dollars: Math.abs(dollars) });
      }
    });
    return actions;
  }

  /** Pays the day's interest and borrowing fees and records the day's return. Call once per day, after trading. */
  closeDay(market: Market): void {
    const shortValue = this.shares.reduce((sum, q, i) => sum + Math.max(0, -q) * market.stocks[i].price, 0);
    this.cash += this.cash * market.rate / TRADING_DAYS_PER_YEAR - shortValue * BORROW_FEE / TRADING_DAYS_PER_YEAR;
    const equity = this.equity(market);
    const yesterday = this.equityHistory[this.equityHistory.length - 1];
    this.excessReturns.push(equity / yesterday - 1 - market.rate / TRADING_DAYS_PER_YEAR);
    this.equityHistory.push(equity);
    this.peak = Math.max(this.peak, equity);
  }
}
