/* The game screen: runs any sport's game, one or a best-of-3 series, with scoreboard, banners, and play-by-play. */

import { saveSettings, state, type SportPick } from "../data/state";
import { resolveSport } from "../sports";
import { DISPLAY_FONT } from "../sports/drawing";
import type { GameHooks, GameResult, MatchRules, Side, SideIndex, Sport, SportGame } from "../sports/types";
import { $, onSegment, setSegment } from "./dom";
import { paintTeamColor, tokenHtml } from "./tokens";

export interface PlayedGame {
  sport: Sport;
  result: GameResult;
}

export interface SeriesOutcome {
  sides: Side[];
  bestOf: number;
  wins: [number, number];
  games: PlayedGame[];
  winner: SideIndex;
}

interface Banner {
  title: string;
  subtitle: string;
  secondsLeft: number;
  /** What happens when the banner ends. */
  then: "resume" | "nextGame" | "finish";
}

interface FeedItem {
  text: string;
  color: string | null;
  stamp: string;
}

const canvas = $<HTMLCanvasElement>("#field");
const context = canvas.getContext("2d");
const boardSides = [$("#b-home"), $("#b-away")];
const FEED_LENGTH = 7;
/** Longest frame step, so a background tab doesn't jump the game forward. */
const MAX_FRAME_SECONDS = .05;
const SILENT_HOOKS: GameHooks = { say: () => undefined, banner: () => undefined };

class Series {
  readonly sides: Side[];
  readonly rules: MatchRules;
  readonly sportPick: SportPick;
  readonly onFinish: (outcome: SeriesOutcome) => void;
  readonly hooks: GameHooks;
  sport: Sport;
  game: SportGame;
  wins: [number, number] = [0, 0];
  games: PlayedGame[] = [];
  banner: Banner | null = null;
  feed: FeedItem[] = [];
  speed: number = state.settings.speed;
  lastFrame = 0;
  frameId = 0;
  stopped = false;

  constructor(sides: Side[], rules: MatchRules, sportPick: SportPick, onFinish: (outcome: SeriesOutcome) => void) {
    this.sides = sides;
    this.rules = rules;
    this.sportPick = sportPick;
    this.onFinish = onFinish;
    this.hooks = {
      say: (text, side) => this.say(text, side),
      banner: (title, subtitle, seconds) => { this.banner = { title, subtitle, secondsLeft: seconds, then: "resume" }; },
    };
    this.sport = resolveSport(sportPick);
    this.game = this.sport.create(sides, rules, this.hooks, 0);
    this.showSport();
  }

  private get over(): boolean {
    const needed = Math.ceil(this.rules.bestOf / 2);
    return this.wins[0] >= needed || this.wins[1] >= needed;
  }

  say(text: string, side: SideIndex | null): void {
    const gameNumber = this.rules.bestOf > 1 ? `G${this.games.length + 1} ` : "";
    this.feed.unshift({ text, color: side === null ? null : this.sides[side].color, stamp: gameNumber + this.game.stamp() });
    this.feed.length = Math.min(this.feed.length, FEED_LENGTH);
    renderFeed(this.feed);
  }

  private showSport(): void {
    $("#field-wrap").style.aspectRatio = String(this.aspect());
    $("#sport-name").textContent = this.sport.name;
    $("#sport-hint").textContent = this.rules.bestOf > 1
      ? `Game ${this.games.length + 1} · first to 2 wins is your answer`
      : "Whoever wins is your answer";
  }

  /** The next game of the series, with a fresh sport if the sport is random. */
  private nextGame(): void {
    const carry = this.game.carry();
    this.sport = resolveSport(this.sportPick);
    this.game = this.sport.create(this.sides, this.rules, this.hooks, carry);
    this.showSport();
  }

  /** Records the finished game and decides what's next: another game, or the winner screen. */
  private gameFinished(): void {
    const result = this.game.result();
    this.wins[result.winner]++;
    this.games.push({ sport: this.sport, result });
    const winnerName = this.sides[result.winner].choiceName;
    if (this.over) {
      this.say(`${winnerName} wins it ${result.how}, ${result.score}.`, result.winner);
      this.banner = { title: this.rules.bestOf > 1 ? "SERIES OVER" : "FINAL", subtitle: `${winnerName} wins`, secondsLeft: 1.6, then: "finish" };
      return;
    }
    const [a, b] = this.wins;
    const lead = a === b ? `Series tied ${a}–${b}` : `${this.sides[a > b ? 0 : 1].choiceName} leads ${Math.max(a, b)}–${Math.min(a, b)}`;
    this.say(`${winnerName} takes Game ${this.games.length} ${result.how}. ${lead}.`, result.winner);
    this.banner = { title: `GAME ${this.games.length} FINAL`, subtitle: lead, secondsLeft: 2.6, then: "nextGame" };
  }

  tick(now: number): void {
    const dt = Math.min(MAX_FRAME_SECONDS, (now - (this.lastFrame || now)) / 1000) * this.speed;
    this.lastFrame = now;
    if (this.banner) {
      this.banner.secondsLeft -= dt;
      if (this.banner.secondsLeft <= 0) {
        const then = this.banner.then;
        this.banner = null;
        if (then === "finish") return this.finish();
        if (then === "nextGame") this.nextGame();
      }
    } else if (!this.game.done) {
      this.game.step(dt);
      if (this.game.done) this.gameFinished();
    }
    this.draw();
    this.updateBoard();
  }

  /** Plays out the rest of the series instantly. */
  skip(): void {
    if (!this.game.done) {
      this.game.finishNow();
      this.gameFinished();
    }
    while (!this.over) {
      const sport = resolveSport(this.sportPick);
      const game = sport.create(this.sides, this.rules, SILENT_HOOKS, this.game.carry());
      game.finishNow();
      this.sport = sport;
      this.game = game;
      const result = game.result();
      this.wins[result.winner]++;
      this.games.push({ sport, result });
    }
    this.finish();
  }

  stop(): void {
    this.stopped = true;
    window.cancelAnimationFrame(this.frameId);
  }

  private finish(): void {
    this.stop();
    this.onFinish({
      sides: this.sides,
      bestOf: this.rules.bestOf,
      wins: this.wins,
      games: this.games,
      winner: this.wins[0] > this.wins[1] ? 0 : 1,
    });
  }

  /** The field's shape right now (some fields change shape with the screen width). */
  private aspect(): number {
    return this.sport.aspectFor?.(canvas.clientWidth || 500) ?? this.sport.aspect;
  }

  private draw(): void {
    if (!context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const width = Math.round((canvas.clientWidth || 500) * dpr);
    const aspect = this.aspect();
    const height = Math.round(width / aspect);
    const wrap = $("#field-wrap");
    if (wrap.style.aspectRatio !== String(aspect)) wrap.style.aspectRatio = String(aspect);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    this.game.draw(context, width, height);
    if (this.banner) drawBanner(context, width, height, this.banner);
  }

  private updateBoard(): void {
    const board = this.game.board();
    boardSides.forEach((el, i) => {
      $(".bscore", el).textContent = board.scores[i];
      $(".bnote", el).textContent = board.notes?.[i] ?? "";
      el.classList.toggle("has-ball", board.holder === i);
      const bar = $(".bhealth", el);
      bar.hidden = !board.health;
      if (board.health) $("span", bar).style.width = `${Math.round(board.health[i] * 100)}%`;
    });
    $("#b-series").textContent = this.rules.bestOf > 1
      ? `GAME ${Math.min(this.games.length + 1, this.rules.bestOf)} · ${this.wins[0]}–${this.wins[1]}`
      : "";
    $("#b-period").textContent = board.period;
    const clock = $("#b-clock");
    clock.textContent = board.clock;
    clock.style.fontSize = board.clock.length > 6 ? "18px" : "";
  }
}

function renderFeed(feed: FeedItem[]): void {
  const list = $("#feed");
  list.innerHTML = "";
  for (const item of feed) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "dot";
    if (item.color) dot.style.setProperty("--tc", item.color);
    const text = document.createElement("span");
    text.textContent = item.text;
    const stamp = document.createElement("span");
    stamp.className = "ftime";
    stamp.textContent = item.stamp;
    li.append(dot, text, stamp);
    list.append(li);
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, width: number, height: number, banner: Banner): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(15,17,21,.9)";
  ctx.fillRect(0, height * .37, width, height * .26);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 ${height * .08}px ${DISPLAY_FONT}`;
  ctx.fillText(banner.title, width / 2, height * .46);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = `400 ${height * .045}px ${DISPLAY_FONT}`;
  ctx.fillText(banner.subtitle, width / 2, height * .56);
}

let current: Series | null = null;

function frame(now: number): void {
  if (!current || current.stopped) return;
  current.tick(now);
  if (!current.stopped) current.frameId = window.requestAnimationFrame(frame);
}

export function stopSeries(): void {
  current?.stop();
}

export function startSeries(sides: Side[], rules: MatchRules, sportPick: SportPick, onFinish: (outcome: SeriesOutcome) => void): void {
  stopSeries();
  sides.forEach((side, i) => {
    $(".tok-slot", boardSides[i]).innerHTML = tokenHtml({ name: side.choiceName, color: side.color, logo: side.logo }, 40);
    $(".bname", boardSides[i]).textContent = side.choiceName;
    // Name the players when people are playing for the option (Competition, or Strategy played by players).
    const peoplePlay = side.players.some((p) => p.name !== side.choiceName);
    $(".bplayers", boardSides[i]).textContent = peoplePlay ? side.players.map((p) => p.name).join(" & ") : "";
    paintTeamColor(boardSides[i], side.color);
  });
  $("#feed").innerHTML = "";
  setSegment($("#seg-speed"), state.settings.speed);
  current = new Series(sides, rules, sportPick, onFinish);
  current.frameId = window.requestAnimationFrame(frame);
}

export function initGameScreen(onQuit: () => void): void {
  onSegment($("#seg-speed"), (value) => {
    const speed = value === "4" ? 4 : value === "2" ? 2 : 1;
    state.settings.speed = speed;
    saveSettings();
    if (current) current.speed = speed;
    setSegment($("#seg-speed"), speed);
  });
  $("#skip-btn").addEventListener("click", () => {
    if (current && !current.stopped) current.skip();
  });
  $("#quit-btn").addEventListener("click", () => {
    stopSeries();
    onQuit();
  });
}
