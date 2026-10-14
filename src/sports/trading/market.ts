/* A simulated stock market, one trading day at a time, with no traders in it yet.

   Every stock has a hidden TRUE VALUE (what the business is really worth). It moves with the whole
   economy, with its sector (rivals like two soda makers move together), and on its own, and it jumps
   on news, earnings, and Fed decisions. The PRICE is the true value plus three kinds of mispricing:
   the crowd's mood (greed pushes every price above value, fear below), a sector's own mood (soda stocks
   are "hot" this week), and stock-specific noise. The last two fade within a week or so. The crowd herds: rising prices make it greedier, which lifts prices
   further, so bubbles and crashes build until true value pulls prices back.

   Neutral market makers quote every trade at a small spread around the price, wider when the mood is
   extreme. One safe asset, a bond, pays the Fed's interest rate. */

import { chance, clamp, gaussian, pick, rand } from "../../util/math";

export const TRADING_DAYS_PER_YEAR = 252;
const DAILY = 1 / Math.sqrt(TRADING_DAYS_PER_YEAR);

// Yearly volatilities of a true value's two parts: the whole economy, and the company with its sector.
const ECONOMY_VOL = .12;
const COMPANY_VOL = .16;
/** Each day, this share of a stock's own mispricing fades away (a half-life of about 5 days). */
export const MISPRICING_FADE = 1 / 8;
const MISPRICING_NOISE = .011;
/** Daily noise in each sector's own mood (soda stocks are "hot" this week), shared by its rivals. */
const SECTOR_MOOD_NOISE = .009;
/** Each day, this share of the crowd's mood fades back toward neutral. */
const MOOD_FADE = .035;
const MOOD_NOISE = .05;
/** How strongly the last week's market move feeds the mood (herding). */
const HERDING = 2.2;
/** How much the crowd overreacts to news, as a share of the news itself. */
const OVERREACTION = .5;
/** A surprise of one rate point moves true values by this much (higher rates make future profits worth less). */
export const RATE_SENSITIVITY = 16;
/** Dollars of trading that move a stock's price by 1%. Traders are small next to the market. */
const MARKET_DEPTH = 5e7;
export const FED_STEP = .0025;
const FED_INTERVAL = 31;
const CPI_INTERVAL = 21;
const INFLATION_TARGET = .02;

interface Company {
  name: string;
  ticker: string;
}

/** Made-up companies in sectors of two rivals each. */
const SECTORS: { name: string; companies: [Company, Company] }[] = [
  { name: "Soda", companies: [{ name: "Fizzle Cola", ticker: "FIZZ" }, { name: "PopCo", ticker: "POPC" }] },
  { name: "Phones", companies: [{ name: "Pear Mobile", ticker: "PEAR" }, { name: "Andro", ticker: "ANDR" }] },
  { name: "Burgers", companies: [{ name: "BurgerBarn", ticker: "BRGR" }, { name: "Patty Shack", ticker: "PTTY" }] },
  { name: "Cars", companies: [{ name: "Voltra Motors", ticker: "VOLT" }, { name: "Gasket Auto", ticker: "GSKT" }] },
  { name: "Sneakers", companies: [{ name: "Stride", ticker: "STRD" }, { name: "Bounce", ticker: "BNCE" }] },
  { name: "Streaming", companies: [{ name: "Streamly", ticker: "STRM" }, { name: "Flixr", ticker: "FLXR" }] },
  { name: "Chips", companies: [{ name: "Silicore", ticker: "SILI" }, { name: "NanoByte", ticker: "NANO" }] },
];

export interface Stock {
  name: string;
  ticker: string;
  sector: string;
  /** The index of its rival in the same sector, or -1 for a company with no rival here. */
  rival: number;
  /** How much it moves with the whole economy (1 = like the average stock). */
  beta: number;
  /** How tightly it moves with its sector, 0 to 1. Rivals with a high value are near twins. */
  sectorTie: number;
  /** How far the crowd's mood pushes its price away from its value. */
  moodSensitivity: number;
  /** Yearly growth of its true value. */
  growth: number;
  /** Hidden true value per share. */
  value: number;
  price: number;
  /** Stock-specific mispricing, as a log ratio of price to value (before the mood). */
  noise: number;
  /** Days on which it reports earnings. */
  earningsDays: number[];
  /** How far its next earnings will beat (+) or miss (-) expectations, hidden until the report. */
  upcomingSurprise: number;
}

export type MarketEvent =
  | { type: "news"; stock: number; headline: string; good: boolean; jump: number; rival?: number }
  | { type: "earnings"; stock: number; surprise: number }
  | { type: "fed"; change: number; rate: number; surprise: number }
  | { type: "cpi"; inflation: number }
  | { type: "mood"; headline: string; greed: boolean };

const GOOD_NEWS = ["{c} lands a huge new contract", "{c} launches a hit product", "Analysts upgrade {c}", "{c} cuts costs and boosts margins"];
const BAD_NEWS = ["{c} recalls its newest product", "{c}'s CEO resigns suddenly", "Regulators probe {c}", "{c} loses its biggest customer"];
const SHARE_NEWS = ["{c} steals customers from {r}", "{c} beats {r} in a head-to-head launch", "Shoppers switch from {r} to {c}"];
const GREED_SHOCKS = ["Euphoria: everyone is buying stocks", "Retail investors pile into the market"];
const FEAR_SHOCKS = ["Panic selling sweeps the market", "Recession fears grip investors"];

/** Typical earnings surprise: the part of a company's results the market didn't already expect. */
export const EARNINGS_SPREAD = .035;
const earningsSurprise = (): number => gaussian() * EARNINGS_SPREAD;

const fill = (line: string, company: string, rival = ""): string => line.replace("{c}", company).replace("{r}", rival);

/** Which companies play: rival pairs (at least one) and maybe a loner, 4 or 5 stocks in all. */
function chooseStocks(): Stock[] {
  const sectors = [...SECTORS].sort(() => Math.random() - .5);
  const count = chance(.5) ? 4 : 5;
  const pairs = count === 4 ? (chance(.6) ? 2 : 1) : (chance(.7) ? 2 : 1);
  const stocks: Stock[] = [];
  const add = (company: Company, sector: string, rival: number, tie: number): void => {
    const price = Math.round(rand(40, 160) * 100) / 100;
    stocks.push({
      ...company, sector, rival,
      beta: rand(.6, 1.4),
      sectorTie: tie,
      moodSensitivity: rand(.07, .12),
      growth: rand(.03, .11),
      value: price,
      price,
      noise: 0,
      earningsDays: [],
      upcomingSurprise: earningsSurprise(),
    });
  };
  for (let i = 0; i < pairs; i++) {
    const tie = rand(.7, .95);
    const first = stocks.length;
    add(sectors[i].companies[0], sectors[i].name, first + 1, tie);
    add(sectors[i].companies[1], sectors[i].name, first, tie);
  }
  for (let i = pairs; stocks.length < count; i++) add(pick(sectors[i].companies), sectors[i].name, -1, 0);
  return stocks;
}

// Measured from simulated markets rather than derived, because herding makes the mood swing more than
// its own noise alone.
/** Typical daily jumps from news and earnings, as a variance. */
const JUMP_VAR = 1.2e-4;
/** Typical daily change in the mood, herding included. */
const MOOD_STEP = .073;

/** How much each stock's price typically moves in a day, as a variance: the economy, the mood, and the company. */
export const dailyVariance = (stock: Stock): number =>
  stock.beta ** 2 * ECONOMY_VOL ** 2 / TRADING_DAYS_PER_YEAR + stock.moodSensitivity ** 2 * MOOD_STEP ** 2
  + COMPANY_VOL ** 2 / TRADING_DAYS_PER_YEAR + MISPRICING_NOISE ** 2 + SECTOR_MOOD_NOISE ** 2 + JUMP_VAR;

export class Market {
  readonly stocks: Stock[] = chooseStocks();
  readonly days: number;
  day = 0;
  /** The crowd's mood, -1 (panic) to +1 (euphoria). */
  mood = rand(-.25, .25);
  /** The Fed's interest rate, which the bond pays. */
  rate = Math.round(rand(2, 5) * 4) / 4 / 100;
  /** Real inflation, which only shows up in the monthly report. */
  inflation = rand(.015, .045);
  /** The last published inflation report. */
  reportedInflation: number;
  readonly fedDays: number[] = [];
  /** Each stock's log price change over recent days, newest last, for herding and trend-following. */
  readonly priceHistory: number[][];
  /** The surprise in the next Fed decision, decided ahead of time so forecasters can partly see it. */
  nextFedSurprise = 0;
  private nextFedChange = 0;
  /** Each sector's own mood, as a log push on its stocks' prices; it fades like a stock's own mispricing. */
  private readonly sectorMoods = new Map<string, number>();

  constructor(days: number) {
    this.days = days;
    this.reportedInflation = this.inflation;
    for (let d = 18; d < days; d += FED_INTERVAL) this.fedDays.push(d + Math.floor(rand(-2, 3)));
    for (const stock of this.stocks) {
      for (let q = 0; q * 63 < days; q++) {
        const day = q * 63 + Math.floor(rand(10, 52));
        if (day < days) stock.earningsDays.push(day);
      }
    }
    this.priceHistory = this.stocks.map((s) => [Math.log(s.price)]);
    this.planFedDecision();
  }

  get done(): boolean {
    return this.day >= this.days;
  }

  get nextFedDay(): number | null {
    return this.fedDays.find((d) => d >= this.day) ?? null;
  }

  /** Market makers' half-spread: the share of the price a trader pays on each side of a trade. */
  get halfSpread(): number {
    return .0012 + .002 * Math.abs(this.mood);
  }

  /** How much the next decision is expected to move the rate, judged from the last published inflation. */
  private expectedChange(inflation: number): number {
    const gap = this.ruleRate(inflation) - this.rate;
    return FED_STEP * clamp(gap / .008, -1, 1) * .8;
  }

  /** The rate the Fed's rule of thumb (like the Taylor rule) calls for at a given inflation. */
  private ruleRate(inflation: number): number {
    return .025 + 1.5 * (inflation - INFLATION_TARGET);
  }

  private planFedDecision(): void {
    const gap = this.ruleRate(this.inflation) - this.rate;
    let change = gap > .004 ? FED_STEP : gap < -.004 ? -FED_STEP : 0;
    if (chance(.15)) change = pick([-FED_STEP, 0, FED_STEP]);
    if (this.rate + change < 0) change = 0;
    this.nextFedChange = change;
    this.nextFedSurprise = change - this.expectedChange(this.reportedInflation);
  }

  /** How much the market moved over the last `days` days, averaged across stocks (log return). */
  recentMove(days: number): number {
    return this.priceHistory.reduce((sum, h) => sum + (h[h.length - 1] - h[Math.max(0, h.length - 1 - days)]), 0) / this.stocks.length;
  }

  /** The day a stock next reports earnings, or null if not again this game. */
  nextEarnings(stock: number): number | null {
    return this.stocks[stock].earningsDays.find((d) => d >= this.day) ?? null;
  }

  /** One stock's log return over the last `days` days. */
  stockMove(stock: number, days: number): number {
    const h = this.priceHistory[stock];
    return h[h.length - 1] - h[Math.max(0, h.length - 1 - days)];
  }

  /** Moves a true value by a log amount; the crowd overreacts to it in the price. */
  private jump(stock: number, amount: number, overreact: boolean): void {
    const s = this.stocks[stock];
    s.value *= Math.exp(amount);
    if (overreact) s.noise += amount * OVERREACTION;
  }

  /** Plays one trading day. `orderFlow` is each stock's net dollars bought by the traders yesterday. */
  advance(orderFlow: number[]): MarketEvent[] {
    const events: MarketEvent[] = [];
    const day = this.day;

    // Inflation drifts, and the monthly report makes it public.
    this.inflation = clamp(this.inflation + gaussian() * .0004 + (.028 - this.inflation) * .004, -.005, .09);
    if (day > 0 && day % CPI_INTERVAL === 0) {
      this.reportedInflation = this.inflation;
      events.push({ type: "cpi", inflation: this.inflation });
      this.planFedDecision();
    }

    if (this.fedDays.includes(day)) {
      const change = this.nextFedChange, surprise = this.nextFedSurprise;
      this.rate += change;
      this.stocks.forEach((s, i) => this.jump(i, -RATE_SENSITIVITY * surprise * s.beta, false));
      this.mood = clamp(this.mood - surprise * 60, -1, 1);
      events.push({ type: "fed", change, rate: this.rate, surprise });
      this.planFedDecision();
    }

    // True values: the economy, each sector, and each company.
    const economy = gaussian() * ECONOMY_VOL * DAILY;
    const sectorShocks = new Map<string, number>();
    this.stocks.forEach((s, i) => {
      if (!sectorShocks.has(s.sector)) sectorShocks.set(s.sector, gaussian());
      // Mixing a shared sector shock with the company's own shock, so `sectorTie` is how alike rivals move.
      const tied = s.sectorTie * sectorShocks.get(s.sector)! + Math.sqrt(1 - s.sectorTie ** 2) * gaussian();
      this.jump(i, s.growth / TRADING_DAYS_PER_YEAR + s.beta * economy + tied * COMPANY_VOL * DAILY, false);

      if (s.earningsDays.includes(day)) {
        const surprise = s.upcomingSurprise;
        s.upcomingSurprise = earningsSurprise();
        this.jump(i, surprise, true);
        events.push({ type: "earnings", stock: i, surprise });
      } else if (chance(.03)) {
        const size = rand(.012, .045);
        if (s.rival >= 0 && chance(.4)) {
          const winner = chance(.5) ? i : s.rival, loser = winner === i ? s.rival : i;
          this.jump(winner, size, true);
          this.jump(loser, -size * .7, true);
          events.push({ type: "news", stock: winner, rival: loser, good: true, jump: size, headline: fill(pick(SHARE_NEWS), this.stocks[winner].name, this.stocks[loser].name) });
        } else {
          const good = chance(.5);
          this.jump(i, good ? size : -size, true);
          events.push({ type: "news", stock: i, good, jump: good ? size : -size, headline: fill(pick(good ? GOOD_NEWS : BAD_NEWS), s.name) });
        }
      }
    });

    // The crowd: mood fades, herds after last week's move, and now and then swings hard.
    this.mood += -MOOD_FADE * this.mood + HERDING * this.recentMove(5) / 5 + gaussian() * MOOD_NOISE;
    if (chance(.008)) {
      const greed = this.mood < .2 && chance(.5);
      this.mood += greed ? rand(.35, .55) : -rand(.35, .55);
      events.push({ type: "mood", greed, headline: pick(greed ? GREED_SHOCKS : FEAR_SHOCKS) });
    }
    this.mood = clamp(this.mood, -1, 1);

    // Prices: true value, times the market's and the sector's mood, times fading noise, nudged a little by the traders.
    for (const sector of new Set(this.stocks.map((s) => s.sector))) {
      this.sectorMoods.set(sector, (this.sectorMoods.get(sector) ?? 0) * (1 - MISPRICING_FADE) + gaussian() * SECTOR_MOOD_NOISE);
    }
    this.stocks.forEach((s, i) => {
      s.noise = s.noise * (1 - MISPRICING_FADE) + gaussian() * MISPRICING_NOISE + (orderFlow[i] ?? 0) / MARKET_DEPTH * .01;
      s.price = s.value * Math.exp(s.moodSensitivity * this.mood + this.sectorMoods.get(s.sector)! + s.noise);
      this.priceHistory[i].push(Math.log(s.price));
    });

    this.day++;
    return events;
  }
}
