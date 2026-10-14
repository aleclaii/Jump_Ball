/* An MMA fight on screen: two fighters circle, trade strikes and takedowns, and drain each other's health. */

import { escapeHtml, tableHtml } from "../../util/html";
import { clamp, easeInOut as ease, lerpPoint, pick, type Point } from "../../util/math";
import { cachedLayer, drawBurst, drawLabel, drawToken } from "../drawing";
import { sideLook, sideName, teamStats } from "../sides";
import type { BoardState, GameHooks, GameResult, MatchRules, Side, SideIndex, SportGame } from "../types";
import { COUNTER_LINES, FIGHT_LINES, fillFightLine, KO_LINES, ROCKED_LINES } from "./commentary";
import { type Exchange, MmaFight, MOVES } from "./engine";
import { CAGE_SIZE, CENTER, paintCage } from "./octagon";

const FIGHTER_RADIUS = 2.3;
const ORBIT_RADIUS = 6;
const ORBIT_SPEED = .35;
const APPROACH = .35;
/** How long the strike itself lasts, per move. Takedowns spend this time on the ground. */
const STRIKE_TIME = { jab: .2, kick: .3, takedown: 1.2 };

interface Effect {
  at: Point;
  color: string;
  size: number;
  label?: string;
  startedAt: number;
  duration: number;
}

interface FighterPose {
  at: [Point, Point];
  lift: [number, number];
}

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

export class MmaGame implements SportGame {
  private readonly fight: MmaFight;
  private readonly sides: Side[];
  private readonly hooks: GameHooks;
  private readonly cageLayer = cachedLayer();
  private started = false;
  private exchange: Exchange | null = null;
  private local = 0;
  private struck = false;
  private time = 0;
  private angle = Math.random() * Math.PI * 2;
  private shownHealth: [number, number];
  private effects: Effect[] = [];

  constructor(sides: Side[], rules: MatchRules, hooks: GameHooks) {
    this.sides = sides;
    this.hooks = hooks;
    this.fight = new MmaFight([teamStats(sides[0], "mma"), teamStats(sides[1], "mma")], rules.full ? 3 : 1, rules.periodSeconds);
    this.shownHealth = [...this.fight.health];
  }

  get done(): boolean {
    return this.fight.done;
  }

  private name(side: SideIndex): string {
    return sideName(this.sides[side]);
  }

  private orbit(angle: number): [Point, Point] {
    const at = (a: number): Point => ({ x: CENTER.x + Math.cos(a) * ORBIT_RADIUS, y: CENTER.y + Math.sin(a) * ORBIT_RADIUS });
    return [at(angle), at(angle + Math.PI)];
  }

  step(dt: number): void {
    if (!this.started) {
      this.started = true;
      this.hooks.say(`${this.name(0)} and ${this.name(1)} touch gloves. Fight!`, null);
    }
    this.time += dt;
    if (this.fight.done) return;
    if (!this.exchange) {
      this.exchange = this.fight.next();
      this.local = 0;
      this.struck = false;
    }
    const e = this.exchange;
    // Fighters circle until someone commits to an attack.
    if (this.local < e.feel) this.angle += ORBIT_SPEED * dt;
    this.local += dt;
    if (!this.struck && this.local >= e.feel + APPROACH) {
      this.struck = true;
      this.strike(e);
    }
    if (this.local >= e.duration) {
      this.exchange = null;
      this.fight.apply(e);
      this.shownHealth = [...this.fight.health];
      this.afterExchange();
    }
  }

  private strike(e: Exchange): void {
    const a = e.attacker, d = other(a);
    const attacker = this.name(a), defender = this.name(d);
    const pose = this.pose();
    const contact = lerpPoint(pose.at[a], pose.at[d], .7);
    if (e.landed) {
      this.shownHealth[d] = Math.max(0, this.shownHealth[d] - e.damage);
      this.effects.push({ at: contact, color: e.knockdown ? "#FF4D3A" : "#FFD34D", size: e.knockdown ? 4 : 2.4, label: e.knockdown ? "ROCKED!" : undefined, startedAt: this.time, duration: e.knockdown ? 1.1 : .5 });
    }
    if (e.counter) {
      this.shownHealth[a] = Math.max(0, this.shownHealth[a] - e.counter);
      this.effects.push({ at: lerpPoint(pose.at[d], pose.at[a], .7), color: "#FFD34D", size: 1.8, startedAt: this.time + .25, duration: .45 });
    }
    const lines = e.knockdown ? ROCKED_LINES : (e.landed ? FIGHT_LINES[e.move].landed : FIGHT_LINES[e.move].missed);
    let line = fillFightLine(pick(lines), attacker, defender);
    if (e.counter) line += fillFightLine(pick(COUNTER_LINES), attacker, defender);
    this.hooks.say(line, e.landed ? a : (e.counter ? d : a));
  }

  private afterExchange(): void {
    const f = this.fight;
    if (f.done && f.method === "ko") {
      const winner = f.winner, loser = other(winner);
      this.hooks.say(fillFightLine(pick(KO_LINES), this.name(winner), this.name(loser)), winner);
    } else if (f.lastEvent === "endRound") {
      const [h0, h1] = this.healthPercents();
      this.hooks.say(`End of round ${f.round - 1}. Health: ${this.name(0)} ${h0}%, ${this.name(1)} ${h1}%.`, null);
      this.hooks.banner(`END OF ROUND ${f.round - 1}`, `${h0}% – ${h1}%`, 1.8);
    } else if (f.lastEvent === "suddenDeath") {
      this.hooks.say("Dead even after the final round! Next clean hit wins.", null);
      this.hooks.banner("DEAD EVEN", "Next clean hit wins", 2);
    }
  }

  private healthPercents(health = this.shownHealth): [number, number] {
    const pct = (h: number) => Math.ceil(h / this.fight.maxHealth * 100);
    return [pct(health[0]), pct(health[1])];
  }

  /** Where both fighters are right now. */
  private pose(): FighterPose {
    const anchors = this.orbit(this.angle);
    const e = this.exchange;
    if (!e || this.local < e.feel) return { at: anchors, lift: [0, 0] };
    const a = e.attacker, d = other(a);
    const toward = { x: anchors[d].x - anchors[a].x, y: anchors[d].y - anchors[a].y };
    const len = Math.hypot(toward.x, toward.y) || 1;
    const dir = { x: toward.x / len, y: toward.y / len };
    const closeIn: Point = { x: anchors[d].x - dir.x * (FIGHTER_RADIUS * 1.5), y: anchors[d].y - dir.y * (FIGHTER_RADIUS * 1.5) };
    const strikeTime = STRIKE_TIME[e.move];
    const t = this.local - e.feel;
    const at: [Point, Point] = [{ ...anchors[0] }, { ...anchors[1] }];
    const lift: [number, number] = [0, 0];
    const recoverTime = MOVES[e.move].duration - APPROACH - strikeTime;

    if (t < APPROACH) {
      at[a] = lerpPoint(anchors[a], closeIn, ease(t / APPROACH));
      return { at, lift };
    }
    const knockback: Point = e.landed
      ? { x: anchors[d].x + dir.x * 1.4, y: anchors[d].y + dir.y * 1.4 }
      : { x: anchors[d].x - dir.y * 1.6, y: anchors[d].y + dir.x * 1.6 };
    if (t < APPROACH + strikeTime) {
      const k = (t - APPROACH) / strikeTime;
      if (e.move === "takedown" && e.landed) {
        // On the ground: the attacker on top, shaking with ground and pound.
        const ground = { x: anchors[d].x + dir.x * 1.2, y: anchors[d].y + dir.y * 1.2 };
        at[d] = lerpPoint(anchors[d], ground, ease(Math.min(1, k * 3)));
        const shake = Math.sin(k * 40) * .25;
        at[a] = { x: at[d].x - dir.x * .9 + shake, y: at[d].y - dir.y * .9 - .4 };
        lift[a] = .35;
      } else if (e.move === "takedown") {
        // Sprawl: the defender stuffs it and the attacker bounces off.
        at[a] = lerpPoint(closeIn, { x: closeIn.x - dir.x * 2, y: closeIn.y - dir.y * 2 }, ease(clamp(k * 2 - .3, 0, 1)));
      } else {
        const lunge = Math.sin(Math.PI * k) * .9;
        at[a] = { x: closeIn.x + dir.x * lunge, y: closeIn.y + dir.y * lunge };
        at[d] = lerpPoint(anchors[d], knockback, ease(k));
        if (e.move === "kick") lift[a] = .4 * Math.sin(Math.PI * k);
      }
      return { at, lift };
    }
    // Recover: back out to circling distance. A counter is a quick lunge the other way.
    const k = clamp((t - APPROACH - strikeTime) / recoverTime, 0, 1);
    const from: [Point, Point] = [{ ...anchors[0] }, { ...anchors[1] }];
    from[a] = closeIn;
    from[d] = e.move === "takedown" && e.landed ? { x: anchors[d].x + dir.x * 1.2, y: anchors[d].y + dir.y * 1.2 } : knockback;
    at[a] = lerpPoint(from[a], anchors[a], ease(k));
    at[d] = lerpPoint(from[d], anchors[d], ease(k));
    if (e.counter && k < .4) {
      const jab = Math.sin(Math.PI * k / .4) * 1.4;
      at[d] = { x: at[d].x - dir.x * jab, y: at[d].y - dir.y * jab };
    }
    return { at, lift };
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const k = width / CAGE_SIZE;
    const colors: [string, string] = [this.sides[0].color, this.sides[1].color];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.cageLayer(width, height, colors.join(), (c) => paintCage(c, k, colors)), 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const pose = this.pose();
    const knockedOut = this.fight.done && this.fight.method === "ko" ? other(this.fight.winner) : null;
    // Draw the nearer fighter last, except the one on top during a takedown, who always goes last.
    let order: SideIndex[] = pose.at[0].y <= pose.at[1].y ? [0, 1] : [1, 0];
    const onTop = this.exchange?.move === "takedown" && pose.lift[this.exchange.attacker] > 0 ? this.exchange.attacker : null;
    if (onTop !== null) order = [other(onTop), onTop];
    for (const side of order) {
      const down = side === knockedOut;
      drawToken(ctx, k, sideLook(this.sides[side]), this.sides[side].color, pose.at[side], down ? FIGHTER_RADIUS * .85 : FIGHTER_RADIUS, pose.lift[side], down ? .5 : 1);
    }
    if (knockedOut !== null) {
      drawLabel(ctx, k, "KO!", { x: pose.at[knockedOut].x, y: pose.at[knockedOut].y - 4 }, 4, "#FFFFFF", "#C2341D");
    }

    this.effects = this.effects.filter((e) => this.time - e.startedAt < e.duration);
    for (const e of this.effects) {
      const age = (this.time - e.startedAt) / e.duration;
      if (age < 0) continue;
      drawBurst(ctx, e.at, e.size * (.6 + age * .6), e.color, 1 - age);
      if (e.label) drawLabel(ctx, k, e.label, { x: e.at.x, y: e.at.y - 3.5 - age * 1.5 }, 2.8, "#FFFFFF", e.color);
    }
  }

  board(): BoardState {
    const [h0, h1] = this.healthPercents();
    const extra = this.exchange ? Math.min(this.local, this.exchange.duration) : 0;
    return {
      scores: [String(h0), String(h1)],
      period: this.fight.periodLabel(),
      clock: this.fight.clockText(extra),
      holder: null,
      health: [this.shownHealth[0] / this.fight.maxHealth, this.shownHealth[1] / this.fight.maxHealth],
      notes: ["HEALTH %", "HEALTH %"],
    };
  }

  stamp(): string {
    return this.fight.suddenDeath ? "SD" : `R${this.fight.round}`;
  }

  finishNow(): void {
    if (this.exchange) {
      this.fight.apply(this.exchange);
      this.exchange = null;
    }
    this.fight.playOut();
    this.shownHealth = [...this.fight.health];
  }

  result(): GameResult {
    const f = this.fight, w = f.winner, l = other(w);
    const [hw, hl] = [this.healthPercents(f.health)[w], this.healthPercents(f.health)[l]];
    const how = f.method === "ko" ? `by KO in round ${f.round}` : f.method === "suddenDeath" ? "in a sudden-death exchange" : "with more health left";
    const rows = this.sides.map((s, i) => [
      `<span class="tdot" style="--tc:${s.color}"></span>${escapeHtml(sideName(s))}`,
      `<b>${this.healthPercents(f.health)[i]}%</b>`, String(f.landed[i]), String(f.knockdowns[i]), String(f.takedowns[i]),
    ]);
    return {
      winner: w,
      how,
      score: f.method === "ko" ? `${hw}% health left` : `${hw}% health to ${hl}%`,
      detailsHtml: tableHtml("Fight stats", ["Fighter", "Health", "Landed", "Rocked", "Takedowns"], rows),
    };
  }

  carry(): number {
    return 0;
  }
}
