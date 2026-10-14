/* A trading game on screen: about 40 seconds for a quarter, 90 for a year. Each trading day the lines
   grow a step; news, earnings, and Fed decisions go to the commentary and the trading floor; consultant
   hires, panics, and big trades are called out and marked on the charts. */

import { escapeHtml, tableHtml } from "../../util/html";
import { clamp, pick } from "../../util/math";
import { sideName, teamStats } from "../sides";
import type { BoardState, GameHooks, GameResult, MatchRules, Side, SideIndex, SportGame } from "../types";
import { fillTradingLine, TRADING_LINES } from "./commentary";
import { type DayReport, TradingMatch } from "./engine";
import { TRADING_DAYS_PER_YEAR } from "./market";
import { FIRMS, NEUTRAL_STYLE, START_CASH, type TraderSpec, type TraderStyle } from "./trader";
import {
  chartScale, COLORS, formatMoney, guide, layoutFor, moodGauge, moodLabel, panel, type Rect, series, spreadLabels,
  STOCK_COLORS, text, tradeMarker, wrapped,
} from "./view";

export const DAYS = { quick: 60, full: 250 };
const SECONDS_PER_DAY = { quick: .65, full: .36 };
/** Trades at least this share of the portfolio get a marker on the stock chart. */
const MARKED_TRADE = .12;
/** Trades at least this share of the portfolio get called out, at most one per trader per day. */
const CALLED_TRADE = .2;
/** Days of history before a Sharpe ratio means anything. */
const SHARPE_FROM_DAY = 5;

interface Headline {
  text: string;
  tone: "good" | "bad" | "neutral";
}

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);
const percent = (value: number, digits = 1): string => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;

/** A side's trading style: its players' average lean, and contrarian if most of them are. */
export function sideStyle(side: Side): TraderStyle {
  const styles = side.players.map((p) => p.tradingStyle ?? NEUTRAL_STYLE);
  if (!styles.length) return NEUTRAL_STYLE;
  return {
    lean: styles.reduce((sum, s) => sum + s.lean, 0) / styles.length,
    contrarian: styles.filter((s) => s.contrarian).length * 2 >= styles.length,
  };
}

export const sideSpecs = (sides: Side[]): [TraderSpec, TraderSpec] =>
  [0, 1].map((i) => ({ stats: teamStats(sides[i], "trading"), style: sideStyle(sides[i]) })) as [TraderSpec, TraderSpec];

export class TradingGame implements SportGame {
  private readonly match: TradingMatch;
  private readonly sides: Side[];
  private readonly hooks: GameHooks;
  private readonly dayTime: number;
  private started = false;
  /** Seconds into the newest day's animation. */
  private local = 0;
  private readonly prices: number[][];
  /** What $100k in the bond alone would be worth each day. */
  private readonly bond: number[] = [START_CASH];
  private headlines: Headline[] = [];
  private markers: { day: number; stock: number; side: SideIndex; up: boolean }[] = [];
  private flags: { day: number; side: SideIndex; kind: "consult" | "panic" }[] = [];

  constructor(sides: Side[], rules: MatchRules, hooks: GameHooks) {
    this.sides = sides;
    this.hooks = hooks;
    this.match = new TradingMatch(sideSpecs(sides), rules.full ? DAYS.full : DAYS.quick);
    this.dayTime = rules.full ? SECONDS_PER_DAY.full : SECONDS_PER_DAY.quick;
    this.prices = this.match.market.stocks.map((s) => [s.price]);
  }

  get done(): boolean {
    return this.match.done && this.local >= this.dayTime;
  }

  private name(side: SideIndex): string {
    return sideName(this.sides[side]);
  }

  step(dt: number): void {
    if (!this.started) {
      this.started = true;
      this.hooks.say(fillTradingLine(pick(TRADING_LINES.start), { p: this.name(0), o: this.name(1) }), null);
    }
    this.local += dt;
    while (this.local >= this.dayTime && !this.match.done) {
      this.local -= this.dayTime;
      this.record(this.match.playDay(), true);
    }
    if (this.match.done) this.local = Math.min(this.local, this.dayTime);
  }

  /** Keeps the day's history for drawing, and (when `narrate`) calls out what happened. */
  private record(report: DayReport, narrate: boolean): void {
    const m = this.match, market = m.market, stocks = market.stocks;
    stocks.forEach((s, i) => this.prices[i].push(s.price));
    this.bond.push(this.bond[this.bond.length - 1] * (1 + market.rate / TRADING_DAYS_PER_YEAR));
    const day = market.day;

    for (const event of report.events) {
      if (event.type === "news") {
        this.headline(event.headline, event.good ? "good" : "bad", narrate);
      } else if (event.type === "earnings") {
        const s = stocks[event.stock];
        const beat = event.surprise >= 0;
        this.headline(`${s.name} (${s.ticker}) ${beat ? "beats" : "misses"} earnings by ${Math.abs(event.surprise * 100).toFixed(1)}%`, beat ? "good" : "bad", narrate);
      } else if (event.type === "cpi") {
        this.headline(`Inflation report: ${(event.inflation * 100).toFixed(1)}% a year`, "neutral", narrate);
      } else if (event.type === "fed") {
        const rate = `${(event.rate * 100).toFixed(2)}%`;
        const move = event.change > 0 ? "raises rates" : event.change < 0 ? "cuts rates" : "holds rates";
        const shock = Math.abs(event.surprise) > .001 ? " Markets didn't see it coming." : "";
        this.headline(`The Fed ${move} to ${rate}.${shock}`, event.change > 0 ? "bad" : event.change < 0 ? "good" : "neutral", narrate);
        if (narrate) this.hooks.banner(event.change > 0 ? "FED HIKES" : event.change < 0 ? "FED CUTS" : "FED HOLDS", `Rates now ${rate}`, 1.2);
      } else if (event.type === "mood") {
        this.headline(event.headline, event.greed ? "good" : "bad", narrate);
        if (narrate) this.hooks.banner(event.greed ? "EUPHORIA" : "PANIC", event.headline, 1.2);
      }
    }

    const called = new Set<SideIndex>();
    for (const action of report.actions) {
      const values = { p: this.name(action.side), o: this.name(other(action.side)) };
      if (action.type === "consult") {
        this.flags.push({ day, side: action.side, kind: "consult" });
        if (narrate) this.hooks.say(fillTradingLine(pick(TRADING_LINES.consult), { ...values, f: FIRMS[action.firm].name, s: stocks[action.stock].ticker, m: formatMoney(action.fee) }), action.side);
      } else if (action.type === "panic") {
        this.flags.push({ day, side: action.side, kind: "panic" });
        if (narrate) this.hooks.say(fillTradingLine(pick(TRADING_LINES.panic), values), action.side);
      } else {
        const equity = m.traders[action.side].equity(market);
        const share = action.dollars / equity;
        const up = action.kind === "buy" || action.kind === "cover";
        if (share >= MARKED_TRADE) this.markers.push({ day, stock: action.stock, side: action.side, up });
        if (narrate && share >= CALLED_TRADE && !called.has(action.side)) {
          called.add(action.side);
          this.hooks.say(fillTradingLine(pick(TRADING_LINES[action.kind]), { ...values, s: stocks[action.stock].ticker, m: formatMoney(action.dollars) }), action.side);
        }
      }
    }
  }

  private headline(line: string, tone: Headline["tone"], narrate: boolean): void {
    this.headlines.unshift({ text: line, tone });
    this.headlines.length = Math.min(this.headlines.length, 4);
    if (narrate) this.hooks.say(line, null);
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const k = width / (ctx.canvas.clientWidth || width);
    const w = width / k, h = height / k;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#F4F5F7";
    ctx.fillRect(0, 0, w, h);
    const layout = layoutFor(w, h);
    const last = this.match.day === 0 ? 1 : clamp(this.local / this.dayTime, 0, 1);
    this.drawRace(ctx, layout.race, last);
    this.drawStocks(ctx, layout.stocks, last);
    this.drawFloor(ctx, layout.floor);
  }

  private drawRace(c: CanvasRenderingContext2D, r: Rect, last: number): void {
    const m = this.match;
    const area = panel(c, r, "PORTFOLIO VALUE", `DAY ${Math.max(1, m.day)} OF ${m.days}`);
    const labelRoom = Math.min(86, area.w * .3);
    const chart = { ...area, w: area.w - labelRoom };
    const histories = m.traders.map((t) => t.equityHistory);
    const all = [...histories[0], ...histories[1], ...this.bond, START_CASH];
    const scale = chartScale(chart, m.days, Math.min(...all), Math.max(...all));
    guide(c, chart, scale.y(START_CASH), "$100k start");
    const bondEnd = series(c, this.bond, scale, last, "rgba(15,17,21,.35)", 1, [1, 3]);
    const ends = histories.map((values, i) => series(c, values, scale, last, this.sides[i].color, 2.5));

    for (const flag of this.flags) {
      const values = histories[flag.side];
      if (flag.day >= values.length) continue;
      const x = scale.x(flag.day), y = scale.y(values[flag.day]);
      if (flag.kind === "panic") {
        text(c, "!", x, y - 6, 13, "#D93A3A", { weight: 800, align: "center" });
      } else {
        c.strokeStyle = this.sides[flag.side].color;
        c.fillStyle = "#FFFFFF";
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x, y, 3.2, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }

    // Labels sit in a column right of the chart, spread apart so they never overlap.
    const labelX = chart.x + chart.w + 8;
    const labels = spreadLabels([ends[0].y, ends[1].y, bondEnd.y], 24, area.y + 8, area.y + area.h - 12);
    ends.forEach((end, i) => {
      c.fillStyle = this.sides[i].color;
      c.beginPath();
      c.arc(end.x, end.y, 3.5, 0, Math.PI * 2);
      c.fill();
      const equity = histories[i][histories[i].length - 1];
      const name = this.name(i as SideIndex);
      const short = name.length > 9 ? `${name.slice(0, 8)}…` : name;
      text(c, short, labelX, labels[i], 10.5, this.sides[i].color, { weight: 700 });
      text(c, formatMoney(equity), labelX, labels[i] + 11, 9.5, COLORS.ink, { mono: true, weight: 500 });
    });
    text(c, "Bond", labelX, labels[2] + 4, 9, COLORS.muted, { mono: true, weight: 500 });
  }

  private drawStocks(c: CanvasRenderingContext2D, r: Rect, last: number): void {
    const m = this.match, stocks = m.market.stocks;
    const area = panel(c, r, "STOCKS", "- - true value");
    const chart = { ...area, w: area.w - 32 };
    const all = [...this.prices.flat(), ...m.valueHistory.flat()];
    const scale = chartScale(chart, m.days, Math.min(...all), Math.max(...all));
    const ends = stocks.map((_, i) => {
      const color = STOCK_COLORS[i % STOCK_COLORS.length];
      c.globalAlpha = .55;
      series(c, m.valueHistory[i], scale, last, color, 1, [3, 3]);
      c.globalAlpha = 1;
      return series(c, this.prices[i], scale, last, color, 1.6);
    });
    for (const marker of this.markers) {
      const values = this.prices[marker.stock];
      if (marker.day >= values.length) continue;
      tradeMarker(c, scale.x(marker.day), scale.y(values[marker.day]), marker.up, this.sides[marker.side].color);
    }
    const labels = spreadLabels(ends.map((e) => e.y), 11, area.y + 4, area.y + area.h);
    stocks.forEach((s, i) => text(c, s.ticker, chart.x + chart.w + 4, labels[i] + 3, 9, STOCK_COLORS[i % STOCK_COLORS.length], { mono: true, weight: 700 }));
  }

  private drawFloor(c: CanvasRenderingContext2D, r: Rect): void {
    const market = this.match.market;
    const area = panel(c, r, "TRADING FLOOR");
    const radius = Math.min(area.w * .3, area.h * .26);
    const cx = area.x + area.w / 2, cy = area.y + radius + 4;
    moodGauge(c, cx, cy, radius, market.mood);
    text(c, "FEAR", cx - radius, cy + 12, 8.5, COLORS.muted, { mono: true, align: "center" });
    text(c, "GREED", cx + radius, cy + 12, 8.5, COLORS.muted, { mono: true, align: "center" });
    text(c, moodLabel(market.mood), cx, cy + 14, 11, COLORS.ink, { weight: 700, align: "center" });

    let y = cy + 32;
    const fedDay = market.nextFedDay;
    const fedNote = fedDay === null ? "No more Fed meetings" : fedDay === market.day ? "Fed meets today" : `Fed meets in ${fedDay - market.day} days`;
    text(c, `Fed rate ${(market.rate * 100).toFixed(2)}%`, area.x, y, 9.5, COLORS.ink, { mono: true, weight: 500 });
    y += 13;
    text(c, fedNote, area.x, y, 9.5, COLORS.muted, { mono: true, weight: 500 });
    y += 13;
    text(c, `Inflation ${(market.reportedInflation * 100).toFixed(1)}%`, area.x, y, 9.5, COLORS.ink, { mono: true, weight: 500 });
    y += 16;
    const bottom = area.y + area.h;
    for (const headline of this.headlines) {
      if (y + 12 > bottom) break;
      c.fillStyle = headline.tone === "good" ? "#17A34A" : headline.tone === "bad" ? "#D93A3A" : COLORS.muted;
      c.beginPath();
      c.arc(area.x + 3, y - 3.5, 2.5, 0, Math.PI * 2);
      c.fill();
      const lines = Math.max(1, Math.min(2, Math.floor((bottom - y + 10) / 12.5)));
      y = wrapped(c, headline.text, area.x + 10, y, area.w - 10, 10, COLORS.ink, lines) + 4;
    }
  }

  board(): BoardState {
    const m = this.match;
    const score = (side: SideIndex) => (m.day < SHARPE_FROM_DAY ? "—" : m.sharpe(side).toFixed(2));
    const note = (side: SideIndex) => `SHARPE · ${percent(m.totalReturn(side))} · ${formatMoney(m.traders[side].equity(m.market))}`;
    return {
      scores: [score(0), score(1)],
      period: this.done ? "FINAL" : `DAY ${Math.max(1, m.day)} OF ${m.days}`,
      clock: moodLabel(m.market.mood).toUpperCase(),
      holder: null,
      notes: [note(0), note(1)],
    };
  }

  stamp(): string {
    return `D${Math.max(1, this.match.day)}`;
  }

  finishNow(): void {
    while (!this.match.done) this.record(this.match.playDay(), false);
    this.local = this.dayTime;
  }

  result(): GameResult {
    const m = this.match, w = m.winner, l = other(w);
    const [sw, sl] = [m.sharpe(w).toFixed(2), m.sharpe(l).toFixed(2)];
    const how = m.end === "sharpe" ? "on risk-adjusted return" : "on total return, with equal Sharpe ratios";
    const rows = this.sides.map((s, i) => {
      const side = i as SideIndex, t = m.traders[side];
      return [
        `<span class="tdot" style="--tc:${s.color}"></span>${escapeHtml(sideName(s))}`,
        percent(m.totalReturn(side)), `${(m.volatility(side) * 100).toFixed(0)}%`, `<b>${m.sharpe(side).toFixed(2)}</b>`,
        formatMoney(t.feesPaid), formatMoney(t.costsPaid),
      ];
    });
    const note = `<p class="details-note">Sharpe ratio = (return − what the bond paid) ÷ volatility, scaled to a year:
      more return for each unit of risk. Vol. is how much the portfolio swung, Advice what consultants cost, and
      Costs what market makers' spreads cost.</p>`;
    return {
      winner: w,
      how,
      score: `Sharpe ${sw}–${sl}`,
      detailsHtml: tableHtml("Traders", ["Trader", "Return", "Vol.", "Sharpe", "Advice", "Costs"], rows) + note,
    };
  }

  carry(): number {
    return 0;
  }
}
