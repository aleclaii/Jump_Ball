/* A penalty shootout on screen: the shooter runs up, the keeper dives, and the ball finds the net (or doesn't). */

import { escapeHtml, tableHtml } from "../../util/html";
import { clamp, easeInOut as ease, lerp, lerpPoint, pick, rand, type Point } from "../../util/math";
import { cachedLayer, drawBurst, drawLabel, drawToken } from "../drawing";
import { sideName } from "../sides";
import type { BoardState, Competitor, GameHooks, GameResult, MatchRules, Side, SideIndex, SportGame } from "../types";
import { fillKickLine, KICK_LINES } from "./commentary";
import { type Kick, Shootout } from "./engine";
import { drawSoccerBall, GOAL, KEEPER_HOME, paintPitch, SHOOTER_HOME, shotTarget, SPOT, VIEW_WIDTH } from "./pitch";

const SETUP = .7;
const RUN_UP = .6;
const FLIGHT = .45;
const RESULT = 1.2;
const KICK_TIME = SETUP + RUN_UP + FLIGHT + RESULT;
const NEAR_BALL = 1;
const FAR_BALL = .45;
const SHOOTER_RADIUS = 2.6;
const KEEPER_RADIUS = 1.9;

interface KickPlan {
  kick: Kick;
  /** Where the ball reaches the goal line. */
  end: Point;
  /** Where it goes after: into the net, off the keeper, off the post. */
  after: Point;
  local: number;
  announced: boolean;
  resolved: boolean;
}

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

function planKick(kick: Kick): KickPlan {
  const target = shotTarget(kick.column, kick.height);
  const jitter = { x: target.x + rand(-1.2, 1.2), y: target.y + rand(-.6, .6) };
  const side = kick.column === 0 ? (Math.random() < .5 ? -1 : 1) : kick.column;
  let end = jitter, after = { x: jitter.x, y: jitter.y + .4 };
  if (kick.outcome === "save") {
    after = { x: jitter.x + side * 5, y: jitter.y + 6 };
  } else if (kick.outcome === "miss") {
    if (kick.missKind === "over") {
      end = { x: jitter.x, y: GOAL.top - 1.2 };
      after = { x: jitter.x + side * 1.5, y: GOAL.top - 4 };
    } else if (kick.missKind === "wide") {
      end = { x: side < 0 ? GOAL.left - 1.6 : GOAL.right + 1.6, y: 12.8 };
      after = { x: end.x + side * 3, y: 12 };
    } else {
      end = { x: side < 0 ? GOAL.left : GOAL.right, y: jitter.y };
      after = { x: end.x - side * 4, y: 20 };
    }
  }
  return { kick, end, after, local: 0, announced: false, resolved: false };
}

export class SoccerGame implements SportGame {
  private readonly shootout: Shootout;
  private readonly sides: Side[];
  private readonly hooks: GameHooks;
  private readonly pitchLayer = cachedLayer();
  private plan: KickPlan | null = null;
  private time = 0;
  private shownGoals: [number, number] = [0, 0];
  private shownKicks: Kick[] = [];
  private effects: { at: Point; label: string; color: string; startedAt: number }[] = [];

  constructor(sides: Side[], rules: MatchRules, hooks: GameHooks) {
    this.sides = sides;
    this.hooks = hooks;
    this.shootout = new Shootout([sides[0].players.map((p) => p.sheets.soccer), sides[1].players.map((p) => p.sheets.soccer)], rules.full ? 5 : 3);
  }

  get done(): boolean {
    return this.shootout.done;
  }

  step(dt: number): void {
    this.time += dt;
    if (this.shootout.done) return;
    if (!this.plan) this.plan = planKick(this.shootout.next());
    const pl = this.plan, kick = pl.kick;
    pl.local += dt;
    const { shooter: shooterPlayer, keeper: keeperPlayer } = this.takers();
    const shooter = shooterPlayer.name, keeper = keeperPlayer.name;
    if (!pl.announced) {
      pl.announced = true;
      this.hooks.say(fillKickLine(pick(KICK_LINES.setup), shooter, keeper), kick.shooter);
    }
    if (!pl.resolved && pl.local >= SETUP + RUN_UP + FLIGHT) {
      pl.resolved = true;
      this.resolve(pl, shooter, keeper);
    }
    if (pl.local >= KICK_TIME) {
      this.plan = null;
      this.shootout.apply(kick);
      this.shownGoals = [...this.shootout.goals];
      if (this.shootout.lastEvent === "suddenDeath") {
        this.hooks.say(`Level after ${this.shootout.kicksEach} kicks each! Sudden death.`, null);
        this.hooks.banner("SUDDEN DEATH", `${this.shownGoals[0]} – ${this.shownGoals[1]}`, 2);
      }
    }
  }

  private resolve(pl: KickPlan, shooter: string, keeper: string): void {
    const kick = pl.kick;
    this.shownKicks.push(kick);
    let lines: string[];
    if (kick.outcome === "goal") {
      this.shownGoals[kick.shooter]++;
      lines = kick.column === 0 && kick.dive !== 0 ? KICK_LINES.goalMiddle : kick.height === "high" ? KICK_LINES.goalHigh : KICK_LINES.goalLow;
      this.effects.push({ at: pl.end, label: "GOAL!", color: this.sides[kick.shooter].color, startedAt: this.time });
    } else if (kick.outcome === "save") {
      lines = KICK_LINES.save;
      this.effects.push({ at: pl.end, label: "SAVED!", color: this.sides[other(kick.shooter)].color, startedAt: this.time });
    } else {
      lines = KICK_LINES[kick.missKind ?? "wide"];
      this.effects.push({ at: pl.end, label: "MISS", color: "#5B616D", startedAt: this.time });
    }
    this.hooks.say(fillKickLine(pick(lines), shooter, keeper), kick.outcome === "save" ? other(kick.shooter) : kick.shooter);
  }

  /** The players taking and facing the current (or next) kick. */
  private takers(): { shooterSide: SideIndex; keeperSide: SideIndex; shooter: Competitor; keeper: Competitor } {
    const shooterSide = this.plan ? this.plan.kick.shooter : this.shootout.nextShooter();
    const keeperSide = other(shooterSide);
    const slots = this.plan ? this.plan.kick : this.shootout.nextSlots();
    return {
      shooterSide,
      keeperSide,
      shooter: this.sides[shooterSide].players[slots.shooterSlot],
      keeper: this.sides[keeperSide].players[slots.keeperSlot],
    };
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const k = width / VIEW_WIDTH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.pitchLayer(width, height, "pitch", (c) => paintPitch(c, k)), 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const { shooterSide, keeperSide, shooter, keeper } = this.takers();
    const t = this.plan?.local ?? 0;

    // The keeper: set on the line, then a dive toward their guess.
    let keeperAt = KEEPER_HOME, keeperLift = 0;
    if (this.plan) {
      const kick = this.plan.kick;
      const diveTarget = { x: 20 + kick.dive * 6, y: kick.height === "high" && kick.dive === kick.column ? 10.5 : 13.2 };
      const k2 = clamp((t - SETUP - RUN_UP + .05) / .35, 0, 1);
      keeperAt = lerpPoint(KEEPER_HOME, diveTarget, ease(k2));
      keeperLift = kick.height === "high" ? Math.sin(Math.PI * Math.min(1, k2)) * .6 : 0;
    }
    drawToken(ctx, k, keeper, this.sides[keeperSide].color, keeperAt, KEEPER_RADIUS, keeperLift);

    // The ball: on the spot, then flying toward the goal and shrinking with distance.
    let ball = { ...SPOT }, radius = NEAR_BALL, groundY = SPOT.y + .5;
    if (this.plan && t >= SETUP + RUN_UP) {
      const pl = this.plan;
      const kf = Math.min(1, (t - SETUP - RUN_UP) / FLIGHT);
      const lift = pl.kick.height === "high" ? Math.sin(Math.PI * kf) * 1.5 : Math.sin(Math.PI * kf) * .4;
      ball = { x: lerp(SPOT.x, pl.end.x, kf), y: lerp(SPOT.y, pl.end.y, ease(kf)) - lift };
      radius = lerp(NEAR_BALL, FAR_BALL, kf);
      groundY = lerp(SPOT.y + .5, GOAL.bottom, kf);
      if (t >= SETUP + RUN_UP + FLIGHT) {
        const ka = Math.min(1, (t - SETUP - RUN_UP - FLIGHT) / (RESULT * .5));
        ball = lerpPoint(pl.end, pl.after, ease(ka));
        radius = FAR_BALL * (pl.kick.outcome === "save" ? lerp(1, 1.4, ka) : 1);
        groundY = pl.kick.outcome === "goal" ? GOAL.bottom - .2 : lerp(GOAL.bottom, pl.after.y + .5, ka);
      }
    }
    const ballBehindKeeper = this.plan?.kick.outcome === "goal" && t >= SETUP + RUN_UP + FLIGHT * .9;
    if (ballBehindKeeper) {
      drawSoccerBall(ctx, ball, radius, groundY);
      drawToken(ctx, k, keeper, this.sides[keeperSide].color, keeperAt, KEEPER_RADIUS, keeperLift);
    }

    // The shooter: waiting, then the run-up to the ball.
    const strikeSpot = { x: SPOT.x - 1, y: SPOT.y + 1.4 };
    const kr = clamp((t - SETUP) / RUN_UP, 0, 1);
    const shooterAt = this.plan ? lerpPoint(SHOOTER_HOME, strikeSpot, ease(kr)) : SHOOTER_HOME;
    if (!ballBehindKeeper) drawSoccerBall(ctx, ball, radius, groundY);
    drawToken(ctx, k, shooter, this.sides[shooterSide].color, shooterAt, SHOOTER_RADIUS);

    this.effects = this.effects.filter((e) => this.time - e.startedAt < 1.1);
    for (const e of this.effects) {
      const age = (this.time - e.startedAt) / 1.1;
      drawBurst(ctx, e.at, 1.6 + age * 1.6, "#FFFFFF", 1 - age);
      drawLabel(ctx, k, e.label, { x: 20, y: 3.5 }, 3.2, "#FFFFFF", e.color);
    }
  }

  /** Each side's kicks so far: ● scored, ○ missed or saved, · still to take. */
  private kickMarks(side: SideIndex): string {
    const marks = this.shownKicks.filter((kick) => kick.shooter === side).map((kick) => (kick.outcome === "goal" ? "●" : "○"));
    const left = this.shootout.suddenDeath ? 0 : Math.max(0, this.shootout.kicksEach - marks.length);
    return [...marks, ...Array(left).fill("·")].join(" ");
  }

  board(): BoardState {
    const s = this.shootout;
    const round = Math.floor(s.kicks.length / 2) + 1;
    return {
      scores: [String(this.shownGoals[0]), String(this.shownGoals[1])],
      period: s.suddenDeath ? "SUDDEN DEATH" : "PENALTIES",
      clock: s.done ? "FINAL" : `KICK ${round}`,
      holder: s.done ? null : (this.plan ? this.plan.kick.shooter : s.nextShooter()),
      notes: [this.kickMarks(0), this.kickMarks(1)],
    };
  }

  stamp(): string {
    return `K${Math.floor(this.shootout.kicks.length / 2) + 1}`;
  }

  finishNow(): void {
    if (this.plan) {
      this.shootout.apply(this.plan.kick);
      this.plan = null;
    }
    this.shootout.playOut();
    this.shownGoals = [...this.shootout.goals];
    this.shownKicks = [...this.shootout.kicks];
  }

  result(): GameResult {
    const s = this.shootout, w = s.winner, l = other(w);
    const rounds = Math.ceil(s.kicks.length / 2);
    const mark = (kick: Kick | undefined) => (!kick ? "–" : kick.outcome === "goal" ? "Goal" : kick.outcome === "save" ? "Saved" : "Missed");
    const rows = Array.from({ length: rounds }, (_, r) => {
      const pair = s.kicks.slice(r * 2, r * 2 + 2);
      return [String(r + 1), mark(pair.find((kick) => kick.shooter === 0)), mark(pair.find((kick) => kick.shooter === 1))];
    });
    return {
      winner: w,
      how: s.suddenDeath ? "in a sudden-death shootout" : "on penalties",
      score: `${s.goals[w]}–${s.goals[l]}`,
      detailsHtml: tableHtml("Kicks", ["#", escapeHtml(sideName(this.sides[0])), escapeHtml(sideName(this.sides[1]))], rows),
    };
  }

  carry(): number {
    return 0;
  }
}

