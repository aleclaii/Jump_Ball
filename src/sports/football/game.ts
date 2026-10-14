/* Football on screen: each side gets four downs from the opponent's 40. Runs, passes, sacks, and turnovers. */

import { escapeHtml, tableHtml } from "../../util/html";
import { clamp, easeInOut as ease, lerp, lerpPoint, pick, rand, type Point } from "../../util/math";
import { cachedLayer, drawBurst, drawLabel, drawToken } from "../drawing";
import { sideLook, sideName, teamStats } from "../sides";
import type { BoardState, GameHooks, GameResult, MatchRules, Side, SideIndex, SportGame } from "../types";
import { downName, fillPlayLine, PLAY_LINES } from "./commentary";
import { DriveContest, type Play } from "./engine";
import { drawFootball, FIELD_WIDTH, MIDDLE_Y, paintEndZone, paintField, yardX } from "./field";

const SET = .5;
const ACTION = 1.5;
const WHISTLE = .7;
const PLAY_TIME = SET + ACTION + WHISTLE;
const PLAYER_RADIUS = 1.5;

interface PlayPlan {
  play: Play;
  /** Field x of the line of scrimmage and of where the play ends. */
  lineX: number;
  endX: number;
  /** Where the pass is aimed (passes only). */
  targetX: number;
  weave: number;
  defenseStartY: number;
  local: number;
  called: boolean;
}

interface Figures {
  offense: Point;
  defense: Point;
  ball: Point & { h: number };
}

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

export class FootballGame implements SportGame {
  private readonly rules: DriveContest;
  private readonly sides: Side[];
  private readonly hooks: GameHooks;
  private readonly fieldLayer = cachedLayer();
  private plan: PlayPlan | null = null;
  private time = 0;
  private driveYards = 0;
  private driveAnnounced = false;
  private resting: Figures;
  private effects: { at: Point; label?: string; color: string; startedAt: number }[] = [];

  constructor(sides: Side[], rules: MatchRules, hooks: GameHooks) {
    this.sides = sides;
    this.hooks = hooks;
    this.rules = new DriveContest([teamStats(sides[0], "football"), teamStats(sides[1], "football")], rules.full ? 2 : 1);
    this.resting = this.formation(yardX(this.rules.yardsToGoal));
  }

  get done(): boolean {
    return this.rules.done;
  }

  private formation(lineX: number): Figures {
    return {
      offense: { x: lineX + 2.5, y: MIDDLE_Y },
      defense: { x: lineX - 4, y: MIDDLE_Y },
      ball: { x: lineX + 1.6, y: MIDDLE_Y + .4, h: .6 },
    };
  }

  private planPlay(play: Play): PlayPlan {
    const lineX = yardX(this.rules.yardsToGoal);
    const endX = lineX - play.yards;
    const passDistance = play.kind === "deep" ? rand(20, 35) : rand(6, 14);
    return {
      play, lineX, endX,
      targetX: play.outcome === "gain" || play.outcome === "touchdown" ? endX : Math.max(lineX - passDistance, 2),
      weave: rand(2, 5) * (Math.random() < .5 ? -1 : 1),
      defenseStartY: MIDDLE_Y + rand(-3, 3),
      local: 0,
      called: false,
    };
  }

  step(dt: number): void {
    this.time += dt;
    if (this.rules.done) return;
    const r = this.rules, offense = r.offense;
    if (!this.driveAnnounced) {
      this.driveAnnounced = true;
      this.driveYards = 0;
      this.resting = this.formation(yardX(r.yardsToGoal));
      this.hooks.say(`${this.sides[offense].choiceName} takes over at the 40. Four downs to score.`, offense);
    }
    if (!this.plan) this.plan = this.planPlay(r.next());
    const pl = this.plan;
    pl.local += dt;
    if (!pl.called && pl.local >= SET + ACTION) {
      pl.called = true;
      this.callPlay(pl.play);
    }
    if (pl.local >= PLAY_TIME) {
      this.resting = this.figuresAt(pl, PLAY_TIME);
      this.plan = null;
      this.driveYards += pl.play.yards;
      r.apply(pl.play);
      this.afterPlay(pl.play);
    }
  }

  private names(play: Play): [string, string] {
    return [sideName(this.sides[play.offense]), sideName(this.sides[other(play.offense)])];
  }

  private callPlay(play: Play): void {
    const [offense, defense] = this.names(play);
    let lines: string[];
    switch (play.outcome) {
      case "touchdown": lines = PLAY_LINES.touchdown; break;
      case "incomplete": lines = PLAY_LINES.incomplete; break;
      case "sack": lines = PLAY_LINES.sack; break;
      case "interception": lines = PLAY_LINES.interception; break;
      case "fumble": lines = PLAY_LINES.fumble; break;
      default:
        if (play.kind === "run") lines = play.big ? PLAY_LINES.bigRun : play.yards <= 0 ? PLAY_LINES.stuffed : PLAY_LINES.run;
        else lines = play.kind === "deep" ? PLAY_LINES.deep : PLAY_LINES.short;
    }
    const defended = play.outcome === "incomplete" || play.outcome === "sack" || play.outcome === "interception" || play.outcome === "fumble";
    this.hooks.say(fillPlayLine(pick(lines), offense, defense, play.yards), defended ? other(play.offense) : play.offense);
    const at = { x: (play.outcome === "touchdown" ? yardX(-1) : this.plan?.endX ?? 30), y: MIDDLE_Y };
    if (play.outcome === "touchdown") this.effects.push({ at, label: "TOUCHDOWN!", color: this.sides[play.offense].color, startedAt: this.time });
    else if (play.outcome !== "incomplete") this.effects.push({ at, color: "#FFFFFF", startedAt: this.time });
  }

  private afterPlay(play: Play): void {
    const r = this.rules, team = this.sides[play.offense].choiceName;
    if (r.lastEvent === null) return;
    this.driveAnnounced = false;
    const summary = `${team} gained ${this.driveYards} yard${this.driveYards === 1 ? "" : "s"} on the drive.`;
    const titles = { touchdown: "TOUCHDOWN!", downs: "TURNOVER ON DOWNS", interception: "INTERCEPTED", fumble: "FUMBLE" };
    if (r.lastDriveEnd === "downs") this.hooks.say(`Turnover on downs. ${summary}`, null);
    else if (r.lastDriveEnd !== "touchdown") this.hooks.say(summary, null);
    if (r.lastEvent === "driveOver") {
      this.hooks.banner(titles[r.lastDriveEnd ?? "downs"], `${team} · ${this.driveYards} yds`, 1.6);
    } else if (r.lastEvent === "overtime") {
      this.hooks.say("All square! Overtime: one more drive each.", null);
      this.hooks.banner("OVERTIME", "One more drive each", 2);
    }
  }

  /** Where the ball carrier, the defender, and the ball are during a play. */
  private figuresAt(pl: PlayPlan, t: number): Figures {
    const start = this.formation(pl.lineX);
    const defenseStart = { x: start.defense.x, y: pl.defenseStartY };
    const play = pl.play;
    if (t < SET) {
      const k = ease(t / SET);
      return {
        offense: lerpPoint(this.resting.offense, start.offense, k),
        defense: lerpPoint(this.resting.defense, defenseStart, k),
        ball: { ...lerpPoint(this.resting.ball, start.ball, k), h: lerp(this.resting.ball.h, start.ball.h, k) },
      };
    }
    const k = clamp((t - SET) / ACTION, 0, 1);
    const end: Point = { x: pl.endX, y: MIDDLE_Y + pl.weave * .4 };
    const carry = (P: Point) => ({ x: P.x - .9, y: P.y + .3, h: .9 });

    if (play.outcome === "sack") {
      const hit = Math.min(1, k / .6);
      const pushed = { x: pl.endX + 1.5, y: MIDDLE_Y };
      const offense = k < .6 ? start.offense : lerpPoint(start.offense, pushed, ease((k - .6) / .4));
      return { offense, defense: lerpPoint(defenseStart, offense, ease(hit)), ball: carry(offense) };
    }

    if (play.kind === "run") {
      const e = ease(k);
      const offense = { x: lerp(start.offense.x, end.x, e), y: MIDDLE_Y + Math.sin(e * Math.PI * 1.5) * pl.weave };
      const tackleSpot = play.outcome === "touchdown" ? { x: end.x + 3, y: end.y + 2 } : end;
      const defense = lerpPoint(defenseStart, tackleSpot, ease(Math.min(1, k * 1.1)));
      if (play.outcome === "fumble" && k > .7) {
        const kk = (k - .7) / .3;
        const loose = { x: end.x - 2, y: end.y + 1.5 };
        return { offense, defense: lerpPoint(defense, loose, ease(kk)), ball: { ...lerpPoint(offense, loose, kk), h: Math.sin(Math.PI * kk) * 1.5 } };
      }
      return { offense, defense, ball: carry(offense) };
    }

    // Passes: the receiver runs a route; the ball is thrown from behind the line.
    const throwFrom = { x: pl.lineX + 3, y: MIDDLE_Y };
    const catchAt: Point = { x: pl.targetX, y: MIDDLE_Y + pl.weave * .4 };
    const offense = lerpPoint(start.offense, catchAt, ease(Math.min(1, k / .75)));
    const flight = clamp((k - .25) / .5, 0, 1);
    const inAir = { ...lerpPoint(throwFrom, catchAt, flight), h: .8 + Math.sin(Math.PI * flight) * (play.kind === "deep" ? 8 : 3) };
    const defendSpot = { x: catchAt.x - 1.2, y: catchAt.y + 1.2 };
    if (play.outcome === "interception") {
      const defense = k < .75 ? lerpPoint(defenseStart, defendSpot, ease(k / .75)) : lerpPoint(defendSpot, { x: defendSpot.x + 4, y: defendSpot.y }, ease((k - .75) / .25));
      return { offense, defense, ball: k < .75 ? (k < .25 ? { ...throwFrom, h: .8 } : inAir) : carry(defense) };
    }
    if (play.outcome === "incomplete") {
      const defense = lerpPoint(defenseStart, defendSpot, ease(Math.min(1, k / .75)));
      const landed = { x: catchAt.x - 3, y: catchAt.y - 2, h: 0 };
      const ball = k < .25 ? { ...throwFrom, h: .8 } : k < .75 ? inAir : { ...lerpPoint(catchAt, landed, (k - .75) / .25), h: Math.abs(Math.sin((k - .75) * 20)) * .6 };
      return { offense, defense, ball };
    }
    // Complete: catch, then a few more steps until the tackle (or into the end zone).
    const finish = play.outcome === "touchdown" ? { x: yardX(-2), y: catchAt.y } : { x: pl.endX - .5, y: catchAt.y };
    const runner = k < .75 ? offense : lerpPoint(catchAt, finish, ease((k - .75) / .25));
    const defense = lerpPoint(defenseStart, play.outcome === "touchdown" ? { x: catchAt.x + 2, y: catchAt.y + 2 } : finish, ease(k));
    return { offense: runner, defense, ball: k < .25 ? { ...throwFrom, h: .8 } : k < .75 ? inAir : carry(runner) };
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const k = width / FIELD_WIDTH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.fieldLayer(width, height, "field", (c) => paintField(c, k)), 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const offense = this.plan ? this.plan.play.offense : this.rules.offense;
    const defense = other(offense);
    paintEndZone(ctx, k, this.sides[defense].color, this.sides[defense].choiceName);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const lineX = this.plan ? this.plan.lineX : yardX(this.rules.yardsToGoal);
    ctx.strokeStyle = "#3D7BFF";
    ctx.lineWidth = .3;
    ctx.beginPath(); ctx.moveTo(lineX, 0); ctx.lineTo(lineX, 30); ctx.stroke();

    const figures = this.plan ? this.figuresAt(this.plan, this.plan.local) : this.resting;
    drawToken(ctx, k, sideLook(this.sides[defense]), this.sides[defense].color, figures.defense, PLAYER_RADIUS);
    drawToken(ctx, k, sideLook(this.sides[offense]), this.sides[offense].color, figures.offense, PLAYER_RADIUS);
    drawFootball(ctx, figures.ball.x, figures.ball.y, figures.ball.h);

    this.effects = this.effects.filter((e) => this.time - e.startedAt < 1.2);
    for (const e of this.effects) {
      const age = (this.time - e.startedAt) / 1.2;
      drawBurst(ctx, e.at, 1.6 + age * 1.6, e.label ? e.color : "#FFFFFF", 1 - age);
      if (e.label) drawLabel(ctx, k, e.label, { x: 30, y: 6 }, 4, "#FFFFFF", e.color);
    }
  }

  board(): BoardState {
    const r = this.rules;
    const totalDrives = r.drivesTaken[0] + r.drivesTaken[1] + 1;
    return {
      scores: [String(r.points[0]), String(r.points[1])],
      period: r.done ? "FINAL" : r.overtime ? "OVERTIME" : `DRIVE ${Math.min(totalDrives, r.drivesEach * 2)}`,
      clock: r.done ? "FINAL" : `${downName(r.down).toUpperCase()} & GOAL`,
      holder: r.done ? null : (this.plan ? this.plan.play.offense : r.offense),
      notes: [`${r.yards[0]} YDS`, `${r.yards[1]} YDS`],
    };
  }

  stamp(): string {
    return `${downName(this.rules.down)} dn`;
  }

  finishNow(): void {
    if (this.plan) {
      this.rules.apply(this.plan.play);
      this.plan = null;
    }
    this.rules.playOut();
  }

  result(): GameResult {
    const r = this.rules, w = r.winner, l = other(w);
    const overtime = r.overtime ? " in overtime" : "";
    const rows = this.sides.map((s, i) => [
      `<span class="tdot" style="--tc:${s.color}"></span>${escapeHtml(s.choiceName)}`,
      String(r.touchdowns[i]), `<b>${r.yards[i]}</b>`, String(r.drivesTaken[i]),
    ]);
    const byTouchdowns = r.wonByTouchdowns();
    return {
      winner: w,
      how: (byTouchdowns ? "on touchdowns" : "on yards gained") + overtime,
      score: byTouchdowns ? `${r.points[w]}–${r.points[l]}` : `${r.yards[w]} yards to ${r.yards[l]}`,
      detailsHtml: tableHtml("Drives", ["Team", "TD", "Yards", "Drives"], rows),
    };
  }

  carry(): number {
    return 0;
  }
}
