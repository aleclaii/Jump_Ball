/* A Mini 4X game on screen: about 1.5 seconds per turn. Territory fades from one color to the next,
   new cities pop in, and attacks are drawn as arrows that end in a capture or a repelled assault. */

import { readableTextOn } from "../../util/color";
import { escapeHtml, tableHtml } from "../../util/html";
import { clamp, pick } from "../../util/math";
import { cachedLayer, drawBurst } from "../drawing";
import { sideName, teamStats } from "../sides";
import type { BoardState, GameHooks, GameResult, MatchRules, Side, SideIndex, SportGame } from "../types";
import { CONQUEST_LINES, fillConquestLine } from "./commentary";
import { ConquestMatch, type TurnEvent, type TurnReport } from "./engine";
import { drawArrow, drawCity, frameFor, hexPath, type MapFrame, paintTerrain, tileCenter } from "./mapView";

const TURN_TIME = 1.5;
const FADE_TIME = .6;
const ARROW_START = .25;
const ARROW_END = .95;
export const TURNS = { quick: 20, full: 35 };

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

/** When during the turn each event is shown, in seconds. */
function eventTime(event: TurnEvent, index: number): number {
  switch (event.type) {
    case "contact": return .1;
    case "found": return .15 + index * .05;
    case "tech": return .5;
    case "attack": return ARROW_END + index * .08;
  }
}

export class ConquestGame implements SportGame {
  private readonly match: ConquestMatch;
  private readonly sides: Side[];
  private readonly hooks: GameHooks;
  private readonly frame: MapFrame;
  private readonly terrainLayer = cachedLayer();
  private started = false;
  private report: TurnReport | null = null;
  private fired: boolean[] = [];
  private local = 0;
  private time = 0;
  private bursts: { tile: number; startedAt: number; color: string; big: boolean }[] = [];

  constructor(sides: Side[], rules: MatchRules, hooks: GameHooks) {
    this.sides = sides;
    this.hooks = hooks;
    this.match = new ConquestMatch(
      [teamStats(sides[0], "conquest"), teamStats(sides[1], "conquest")],
      rules.full ? TURNS.full : TURNS.quick,
      [sides[0].choiceName, sides[1].choiceName],
    );
    this.frame = frameFor(this.match.map);
  }

  /** Finished once the last turn has also finished playing on screen. */
  get done(): boolean {
    return this.match.done && !this.report;
  }

  private name(side: SideIndex): string {
    return sideName(this.sides[side]);
  }

  step(dt: number): void {
    if (!this.started) {
      this.started = true;
      this.hooks.say(fillConquestLine(pick(CONQUEST_LINES.start), { p: this.name(0), o: this.name(1) }), null);
    }
    this.time += dt;
    if (!this.report) {
      if (this.match.done) return;
      this.report = this.match.playTurn();
      this.fired = this.report.events.map(() => false);
      this.local = 0;
    }
    this.local += dt;
    const report = this.report;
    report.events.forEach((event, i) => {
      if (!this.fired[i] && this.local >= eventTime(event, i)) {
        this.fired[i] = true;
        this.call(event);
      }
    });
    if (this.local >= TURN_TIME) {
      this.report = null;
      if (this.match.done && this.match.end !== "capital") this.callEnding();
    }
  }

  private call(event: TurnEvent): void {
    if (event.type === "contact") {
      this.hooks.say(fillConquestLine(pick(CONQUEST_LINES.contact), { p: this.name(0), o: this.name(1) }), null);
      this.hooks.banner("WAR", "The borders meet", 1.4);
      return;
    }
    const values = { p: this.name(event.side), o: this.name(other(event.side)) };
    if (event.type === "found") {
      this.hooks.say(fillConquestLine(pick(CONQUEST_LINES.found), { ...values, c: event.name }), event.side);
    } else if (event.type === "tech") {
      this.hooks.say(fillConquestLine(pick(CONQUEST_LINES.tech), { ...values, n: event.level }), event.side);
    } else {
      const lines = event.capital ? CONQUEST_LINES.capital : event.captured ? CONQUEST_LINES.capture : CONQUEST_LINES.repelled;
      this.hooks.say(fillConquestLine(pick(lines), { ...values, c: event.name }), event.captured ? event.side : other(event.side));
      this.bursts.push({ tile: event.to, startedAt: this.time, color: event.captured ? this.sides[event.side].color : "#8A909E", big: event.captured });
    }
  }

  private callEnding(): void {
    const m = this.match, w = m.winner;
    const [tw, tl] = [m.territory(w), m.territory(other(w))];
    const line = m.end === "territory"
      ? `Time's up. ${this.name(w)} holds more land, ${tw} tiles to ${tl}.`
      : `Time's up, and the land is split evenly. ${this.name(w)} has more people.`;
    this.hooks.say(line, w);
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const k = width / this.frame.width;
    const m = this.match, tiles = m.map.tiles, report = this.report;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.terrainLayer(width, height, "terrain", (c) => paintTerrain(c, k, m.map, this.frame)), 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // Territory: each tile cross-fades from who held it before this turn to who holds it now.
    const fade = report ? clamp(this.local / FADE_TIME, 0, 1) : 1;
    tiles.forEach((tile, i) => {
      const center = tileCenter(this.frame, tile.q, tile.r);
      const now = m.owners[i], before = report ? report.before[i] : now;
      const shade = (owner: number, alpha: number) => {
        if (owner < 0 || alpha <= 0) return;
        hexPath(ctx, center, .97);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.sides[owner].color;
        ctx.fill();
        ctx.globalAlpha = alpha * 1.6;
        ctx.lineWidth = .05;
        ctx.strokeStyle = this.sides[owner].color;
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      if (before === now) shade(now, .34);
      else {
        shade(before, .34 * (1 - fade));
        shade(now, .34 * fade);
      }
    });

    // Attacks this turn, and which cities haven't changed hands on screen yet.
    const attacks = report ? report.events.filter((e): e is Extract<TurnEvent, { type: "attack" }> => e.type === "attack") : [];
    const pendingCapture = new Set(attacks.filter((a) => a.captured && this.local < ARROW_END).map((a) => a.to));
    const foundings = new Map(report ? report.events.filter((e) => e.type === "found").map((e) => [(e as { tile: number }).tile, true]) : []);

    for (const city of m.cities) {
      const tile = tiles[city.tile];
      const owner = pendingCapture.has(city.tile) ? other(city.owner) : city.owner;
      const color = this.sides[owner].color;
      const scale = foundings.has(city.tile) ? clamp((this.local - .15) / .3, 0, 1) : 1;
      if (scale <= 0) continue;
      drawCity(ctx, k, tileCenter(this.frame, tile.q, tile.r), color, readableTextOn(color), city.name, city.pop, city.capital, scale);
    }

    for (const attack of attacks) {
      const progress = clamp((this.local - ARROW_START) / (ARROW_END - ARROW_START), 0, 1);
      if (progress <= 0 || this.local > ARROW_END + .3) continue;
      const from = tiles[attack.from], to = tiles[attack.to];
      ctx.globalAlpha = this.local > ARROW_END ? 1 - (this.local - ARROW_END) / .3 : 1;
      drawArrow(ctx, tileCenter(this.frame, from.q, from.r), tileCenter(this.frame, to.q, to.r), this.sides[attack.side].color, progress);
      ctx.globalAlpha = 1;
    }

    this.bursts = this.bursts.filter((b) => this.time - b.startedAt < .6);
    for (const b of this.bursts) {
      const age = (this.time - b.startedAt) / .6, tile = tiles[b.tile];
      drawBurst(ctx, tileCenter(this.frame, tile.q, tile.r), (b.big ? 1.1 : .7) + age * .5, b.color, 1 - age);
    }
  }

  board(): BoardState {
    const m = this.match;
    const note = (side: SideIndex) => {
      const count = m.citiesOf(side).length;
      return `${count} ${count === 1 ? "CITY" : "CITIES"} · TECH ${m.techLevel[side]}`;
    };
    return {
      scores: [String(m.territory(0)), String(m.territory(1))],
      period: this.done ? "FINAL" : `TURN ${Math.max(1, m.turn)} OF ${m.turns}`,
      clock: m.atWar ? "AT WAR" : "EXPANDING",
      holder: null,
      notes: [note(0), note(1)],
    };
  }

  stamp(): string {
    return `T${Math.max(1, this.match.turn)}`;
  }

  finishNow(): void {
    this.report = null;
    this.match.playOut();
  }

  result(): GameResult {
    const m = this.match, w = m.winner, l = other(w);
    const capital = m.cities.find((c) => c.capital && c.founder === l);
    const how = m.end === "capital" ? `by taking ${capital?.name ?? "the capital"} on turn ${m.turn}`
      : m.end === "territory" ? "on territory" : "on population, with the land split evenly";
    const rows = this.sides.map((s, i) => {
      const side = i as SideIndex;
      return [
        `<span class="tdot" style="--tc:${s.color}"></span>${escapeHtml(sideName(s))}`,
        `<b>${m.territory(side)}</b>`, String(m.citiesOf(side).length), String(m.techLevel[side]), String(m.captures[side]),
      ];
    });
    return {
      winner: w,
      how,
      score: `${m.territory(w)}–${m.territory(l)} tiles`,
      detailsHtml: tableHtml("Empires", ["Empire", "Tiles", "Cities", "Tech", "Captures"], rows),
    };
  }

  carry(): number {
    return 0;
  }
}
