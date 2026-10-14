/* A basketball game on screen: runs the engine one possession at a time and animates it. */

import { escapeHtml, tableHtml } from "../../util/html";
import { pick, type Point } from "../../util/math";
import { cachedLayer, drawLabel, drawToken } from "../drawing";
import type { BoardState, GameHooks, GameResult, MatchRules, Side, SideIndex, SportGame } from "../types";
import { planPossession, poseAt, tipOffPositions, type Ball, type Pose, type PossessionPlan } from "./animation";
import { fillLine, LINES, type LineNames } from "./commentary";
import { COURT_WIDTH, drawBasketball, paintCourt, RIM } from "./court";
import { BasketballMatch, FT_TIME, FT_WALK } from "./engine";

interface Effect {
  type: "flash" | "points";
  text?: string;
  color: string;
  startedAt: number;
  duration: number;
}

const TOKEN_RADIUS = 1.6;

export class BasketballGame implements SportGame {
  private readonly match: BasketballMatch;
  private readonly sides: Side[];
  private readonly hooks: GameHooks;
  private readonly playersPerSide: number;
  private started = false;
  private plan: PossessionPlan | null = null;
  private local = 0;
  private time = 0;
  private positions: Point[][];
  private ball: Ball = { x: 25, y: 42, h: 5 };
  private shown: [number, number] = [0, 0];
  private effects: Effect[] = [];
  private readonly courtLayer = cachedLayer();

  constructor(sides: Side[], rules: MatchRules, hooks: GameHooks, carryIn: number) {
    this.sides = sides;
    this.hooks = hooks;
    this.playersPerSide = sides[0].players.length;
    this.match = new BasketballMatch(sides.map((s) => s.players.map((p) => p.sheets.basketball)), rules.full ? 4 : 1, rules.periodSeconds, carryIn);
    this.positions = tipOffPositions(this.playersPerSide, this.match.first);
  }

  get done(): boolean {
    return this.match.done;
  }

  step(dt: number): void {
    if (!this.started) {
      this.started = true;
      const first = this.match.first, side = this.sides[first], jumper = side.players[0].name;
      const forWhom = jumper === side.choiceName ? "" : ` for ${side.choiceName}`;
      this.hooks.say(`Tip-off! ${jumper} wins the jump ball${forWhom}.`, first);
    }
    this.time += dt;
    if (this.match.done) return;
    if (!this.plan) {
      this.plan = planPossession(this.match.next(), this.positions, this.ball, this.playersPerSide);
      this.local = 0;
    }
    this.local += dt;
    const pl = this.plan, p = pl.p;
    const tShot = p.reset + p.drive, tResult = tShot + p.flight, tFreeThrows = tResult + p.after + FT_WALK;
    if (!pl.called && this.local >= tShot) {
      pl.called = true;
      this.callShot(pl);
    }
    if (!pl.resolved && this.local >= tResult) {
      pl.resolved = true;
      this.callResult(pl);
    }
    while (pl.ftDone < p.fts.length && this.local >= tFreeThrows + pl.ftDone * FT_TIME + FT_TIME * .55) {
      this.callFreeThrow(pl, pl.ftDone);
      pl.ftDone++;
    }
    if (this.local >= p.dur) {
      const end = poseAt(pl, p.dur);
      this.positions = end.P;
      this.ball = end.B;
      this.plan = null;
      this.match.apply(p);
      this.afterPossession();
    }
  }

  private afterPossession(): void {
    const m = this.match;
    this.shown = [...m.score];
    if (m.lastEvent === "endQuarter") {
      const ended = m.quarter - 1;
      this.hooks.say(`End of Q${ended}. ${this.sides[0].choiceName} ${m.score[0]}, ${this.sides[1].choiceName} ${m.score[1]}.`, null);
      this.hooks.banner(`END OF Q${ended}`, `${m.score[0]} – ${m.score[1]}`, 1.8);
    } else if (m.lastEvent === "suddenDeath") {
      this.hooks.say("Tied at the buzzer! Sudden death: next score wins.", null);
      this.hooks.banner("TIED UP", "Next score wins", 2);
    }
  }

  private names(pl: PossessionPlan): LineNames {
    const p = pl.p, name = (side: SideIndex, slot: number) => this.sides[side].players[slot].name;
    return {
      o: name(pl.o, pl.S),
      h: name(pl.o, pl.H),
      d: name(pl.d, pl.S),
      s: p.stealer !== undefined ? name(pl.d, p.stealer) : "",
      r: p.rebounder !== undefined ? name(p.oreb ? pl.o : pl.d, p.rebounder) : "",
    };
  }

  private callShot(pl: PossessionPlan): void {
    const p = pl.p;
    if (p.kind === "turnover" || !p.shot) return;
    const tone = pl.contested ? "contested" : "open";
    const line = p.passed ? pick(LINES.pass[tone]) : pick(LINES[tone][p.shot]);
    this.hooks.say(fillLine(line, this.names(pl)), pl.o);
  }

  private scoreEffect(side: SideIndex, points: number): void {
    const color = this.sides[side].color;
    this.effects.push({ type: "flash", color, startedAt: this.time, duration: .6 });
    this.effects.push({ type: "points", text: `+${points}`, color, startedAt: this.time, duration: 1.1 });
  }

  private callResult(pl: PossessionPlan): void {
    const p = pl.p, names = this.names(pl);
    const say = (lines: string[], side: SideIndex) => this.hooks.say(fillLine(pick(lines), names), side);
    if (p.kind === "turnover") return say(p.intercepted ? LINES.intercept : LINES.steal, pl.d);
    if (p.kind === "block") return say(LINES.block, pl.d);
    if (p.made && p.shot) {
      this.shown[pl.o] += p.pts;
      this.scoreEffect(pl.o, p.pts);
      let line = fillLine(pick(p.fouled ? LINES.andOne : pl.contested ? LINES.makeContested : LINES.make[p.shot]), names);
      if (p.passed) line += ` Assist: ${names.h}.`;
      this.hooks.say(line, pl.o);
      return;
    }
    if (p.fouled) return say(LINES.fouled, pl.o);
    say(p.oreb ? LINES.oreb : LINES.dreb, p.oreb ? pl.o : pl.d);
  }

  private callFreeThrow(pl: PossessionPlan, index: number): void {
    const p = pl.p, good = p.fts[index], shooter = this.sides[pl.o].players[pl.S].name;
    const which = p.fts.length > 1 ? `${index === 0 ? "First" : "Second"} free throw` : "The free throw";
    if (good) {
      this.shown[pl.o] += 1;
      this.scoreEffect(pl.o, 1);
    }
    this.hooks.say(`${which}… ${good ? "good" : "no good"} for ${shooter}.`, pl.o);
  }

  private currentPose(): Pose {
    if (this.plan) return poseAt(this.plan, Math.min(this.local, this.plan.p.dur));
    return { P: this.positions, J: [[0, 0], [0, 0]], B: this.ball };
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const k = width / COURT_WIDTH;
    const paint = this.sides[0].color;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.courtLayer(width, height, paint, (c) => paintCourt(c, k, paint)), 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const pose = this.currentPose();
    const bodies: { side: number; slot: number; at: Point }[] = [];
    pose.P.forEach((team, side) => team.forEach((at, slot) => bodies.push({ side, slot, at })));
    bodies.sort((a, b) => a.at.y - b.at.y);
    for (const b of bodies) {
      drawToken(ctx, k, this.sides[b.side].players[b.slot], this.sides[b.side].color, b.at, TOKEN_RADIUS, pose.J[b.side][b.slot] ?? 0);
    }

    this.effects = this.effects.filter((e) => this.time - e.startedAt < e.duration);
    for (const e of this.effects) {
      if (e.type !== "flash") continue;
      const age = (this.time - e.startedAt) / e.duration;
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = .5;
      ctx.beginPath();
      ctx.arc(RIM.x, RIM.y, .9 + age * 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawBasketball(ctx, pose.B);
    for (const e of this.effects) {
      if (e.type !== "points" || !e.text) continue;
      const age = (this.time - e.startedAt) / e.duration;
      ctx.save();
      ctx.globalAlpha = age < .7 ? 1 : 1 - (age - .7) / .3;
      drawLabel(ctx, k, e.text, { x: RIM.x + 4.5, y: RIM.y + 4 - age * 2.5 }, 3.4, "#FFFFFF", e.color);
      ctx.restore();
    }
  }

  private extraSeconds(): number {
    return this.plan ? Math.min(this.local, this.plan.p.dur) : 0;
  }

  board(): BoardState {
    const m = this.match;
    return {
      scores: [String(this.shown[0]), String(this.shown[1])],
      period: m.periodLabel(),
      clock: m.suddenDeath ? "NEXT BUCKET" : m.clockText(this.extraSeconds()),
      holder: m.done ? null : (this.plan ? this.plan.o : m.ball),
    };
  }

  stamp(): string {
    const m = this.match;
    return m.suddenDeath ? "SD" : `${m.periodLabel()} ${m.clockText(this.extraSeconds())}`;
  }

  finishNow(): void {
    if (this.plan) {
      this.match.apply(this.plan.p);
      this.plan = null;
    }
    this.match.playOut();
    this.shown = [...this.match.score];
    this.positions = tipOffPositions(this.playersPerSide, 0).map((team) => team.map((pt) => ({ x: pt.x, y: pt.y - 10 })));
    this.ball = { x: 25, y: 6.4, h: .25 };
  }

  result(): GameResult {
    const m = this.match, w = m.winner, l: SideIndex = w === 0 ? 1 : 0;
    const margin = m.score[w] - m.score[l];
    return {
      winner: w,
      how: m.suddenDeath ? "in sudden death" : `by ${margin} point${margin === 1 ? "" : "s"}`,
      score: `${m.score[w]}–${m.score[l]}`,
      detailsHtml: this.detailsHtml(),
    };
  }

  private detailsHtml(): string {
    const m = this.match;
    const periods = m.byQuarter.map((_, i) => (m.suddenDeath && i === m.byQuarter.length - 1 ? "SD" : m.quarters === 1 ? "Q1" : `Q${i + 1}`));
    const scoreRows = this.sides.map((s, i) => [escapeHtml(s.choiceName), ...m.byQuarter.map((q) => String(q[i])), `<b>${m.score[i]}</b>`]);
    const playerRows = this.sides.flatMap((s, si) => s.players.map((p, pi) => {
      const line = m.box[si][pi];
      return [`<span class="tdot" style="--tc:${s.color}"></span>${escapeHtml(p.name)}`, `<b>${line.pts}</b>`, String(line.ast), String(line.reb), String(line.stl), String(line.blk)];
    }));
    const contested = this.sides.map((s, i) =>
      `<li><b>${escapeHtml(s.choiceName)}</b>: ${m.shots[i].contested} of ${m.shots[i].att} shots were contested</li>`).join("");
    return tableHtml("Score", ["Team", ...periods, "T"], scoreRows)
      + tableHtml("Players", ["Player", "PTS", "AST", "REB", "STL", "BLK"], playerRows)
      + `<ul class="contest-list">${contested}</ul>`;
  }

  carry(): number {
    return this.match.quartersPlayed();
  }
}
