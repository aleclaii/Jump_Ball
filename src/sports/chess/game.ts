/* A speed-chess game on screen: one move about every 0.4 seconds, each piece sliding to its square,
   with the last move and any check highlighted and a call for every move. */

import { escapeHtml, tableHtml } from "../../util/html";
import { easeInOut as ease, lerpPoint, pick } from "../../util/math";
import { cachedLayer, drawBurst } from "../drawing";
import { sideName, teamStats } from "../sides";
import type { BoardState, GameHooks, GameResult, MatchRules, Side, SideIndex, SportGame } from "../types";
import { pieceColor, pieceType, QUEEN, ROOK, WHITE } from "./board";
import { BOARD_SIZE, drawPiece, highlightSquare, paintBoard, squareCenter } from "./boardView";
import { CHESS_LINES, fillChessLine, PIECE_NAMES } from "./commentary";
import { ChessMatch, type PlayedMove } from "./engine";

/** Seconds a piece takes to slide, and the whole move including a short pause. */
const SLIDE = .26;
const MOVE_TIME = .42;
export const MOVES_EACH = { quick: 20, full: 40 };

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

export class ChessGame implements SportGame {
  private readonly match: ChessMatch;
  private readonly sides: Side[];
  private readonly hooks: GameHooks;
  private readonly boardLayer = cachedLayer();
  private started = false;
  private current: PlayedMove | null = null;
  private local = 0;
  private time = 0;
  private bursts: { square: number; startedAt: number; color: string }[] = [];

  constructor(sides: Side[], rules: MatchRules, hooks: GameHooks) {
    this.sides = sides;
    this.hooks = hooks;
    this.match = new ChessMatch([teamStats(sides[0], "chess"), teamStats(sides[1], "chess")], rules.full ? MOVES_EACH.full : MOVES_EACH.quick);
  }

  get done(): boolean {
    return this.match.done;
  }

  private name(side: SideIndex): string {
    return sideName(this.sides[side]);
  }

  step(dt: number): void {
    const m = this.match;
    if (!this.started) {
      this.started = true;
      this.hooks.say(`${this.name(m.whiteSide)} has White and moves first. ${m.movesEach} moves each.`, m.whiteSide);
    }
    this.time += dt;
    if (m.done) return;
    if (!this.current) {
      this.current = m.next();
      this.local = 0;
    }
    this.local += dt;
    if (this.local >= MOVE_TIME) {
      const played = this.current;
      this.current = null;
      m.apply(played);
      this.call(played);
      if (played.move.captured) this.bursts.push({ square: played.move.to, startedAt: this.time, color: this.sides[played.side].color });
      if (m.done) this.callEnding();
    }
  }

  private call(played: PlayedMove): void {
    const p = this.name(played.side), o = this.name(other(played.side));
    const captured = played.move.captured ? pieceType(played.move.captured) : 0;
    const values = { p, o, m: played.san, x: PIECE_NAMES[captured] ?? "piece" };
    let lines = CHESS_LINES.quiet;
    if (played.mate) lines = CHESS_LINES.mate;
    else if (played.move.promotion) lines = CHESS_LINES.promotion;
    else if (played.forked.length) lines = CHESS_LINES.fork;
    else if (captured === QUEEN || captured === ROOK) lines = CHESS_LINES.bigCapture;
    else if (captured) lines = CHESS_LINES.capture;
    else if (played.check) lines = CHESS_LINES.check;
    else if (played.move.flag === "castleKing" || played.move.flag === "castleQueen") lines = CHESS_LINES.castle;
    else if (played.blunder) lines = CHESS_LINES.blunder;
    this.hooks.say(fillChessLine(pick(lines), values), played.side);
  }

  private callEnding(): void {
    const m = this.match;
    if (m.end === "checkmate") return;
    const reason = m.stopReason === "stalemate" ? "Stalemate!" : m.stopReason === "insufficient" ? "Not enough pieces left to checkmate." : "That's the move cap.";
    const [a, b] = [m.material(0), m.material(1)];
    if (m.end === "material") {
      this.hooks.say(`${reason} ${this.name(m.winner)} wins on material, ${Math.max(a, b)} to ${Math.min(a, b)}.`, m.winner);
    } else {
      this.hooks.say(`${reason} Level on material, so the Armageddon rule gives the draw to Black: ${this.name(m.winner)}.`, m.winner);
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const k = width / BOARD_SIZE;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.boardLayer(width, height, "board", (c) => paintBoard(c, k)), 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const board = this.match.board;
    const last = this.match.played[this.match.played.length - 1];
    const shown = this.current ?? last;
    if (shown) {
      highlightSquare(ctx, shown.move.from, "rgba(242,182,29,.28)");
      highlightSquare(ctx, shown.move.to, "rgba(242,182,29,.42)");
    }
    if (!this.current && board.inCheck() && !this.match.done) highlightSquare(ctx, board.kings[board.turn], "rgba(229,72,77,.45)");
    if (this.match.done && this.match.end === "checkmate") highlightSquare(ctx, board.kings[board.turn], "rgba(229,72,77,.6)");

    const moving = this.current;
    const slide = moving ? ease(Math.min(1, this.local / SLIDE)) : 0;
    const rookMove = moving?.move.flag === "castleKing" ? [moving.move.to + 1, moving.move.to - 1]
      : moving?.move.flag === "castleQueen" ? [moving.move.to - 2, moving.move.to + 1] : null;
    const enPassantVictim = moving?.move.flag === "enPassant" ? moving.move.to + (pieceColor(moving.move.piece) === WHITE ? -8 : 8) : -1;

    for (let square = 0; square < 64; square++) {
      const piece = board.squares[square];
      if (!piece) continue;
      if (moving && (square === moving.move.from || (rookMove && square === rookMove[0]))) continue;
      const side = this.match.sideOf(pieceColor(piece));
      const capturedNow = moving && (square === moving.move.to || square === enPassantVictim);
      this.drawSidePiece(ctx, k, pieceType(piece), side, squareCenter(square), capturedNow ? 1 - slide : 1);
    }
    if (moving) {
      const side = moving.side;
      const type = moving.move.promotion && slide >= 1 ? moving.move.promotion : pieceType(moving.move.piece);
      const at = lerpPoint(squareCenter(moving.move.from), squareCenter(moving.move.to), slide);
      this.drawSidePiece(ctx, k, type, side, at, 1, Math.sin(Math.PI * slide));
      if (rookMove) this.drawSidePiece(ctx, k, ROOK, side, lerpPoint(squareCenter(rookMove[0]), squareCenter(rookMove[1]), slide), 1);
    }

    this.bursts = this.bursts.filter((b) => this.time - b.startedAt < .5);
    for (const b of this.bursts) {
      const age = (this.time - b.startedAt) / .5;
      drawBurst(ctx, squareCenter(b.square), .45 + age * .3, b.color, 1 - age);
    }
  }

  private drawSidePiece(ctx: CanvasRenderingContext2D, k: number, type: number, side: SideIndex, at: { x: number; y: number }, alpha: number, lift = 0): void {
    drawPiece(ctx, k, type, this.match.colorOf(side) === WHITE, this.sides[side].color, at, alpha, lift);
  }

  board(): BoardState {
    const m = this.match;
    const colorName = (side: SideIndex) => (m.colorOf(side) === WHITE ? "WHITE" : "BLACK");
    const lastSan = (this.current ?? m.played[m.played.length - 1])?.san ?? "—";
    return {
      scores: [String(m.material(0)), String(m.material(1))],
      period: m.done ? "FINAL" : `MOVE ${Math.min(m.moveNumber, m.movesEach)} OF ${m.movesEach}`,
      clock: lastSan,
      holder: m.done ? null : m.toMove,
      notes: [`${colorName(0)} · MATERIAL`, `${colorName(1)} · MATERIAL`],
    };
  }

  stamp(): string {
    return `M${this.match.moveNumber}`;
  }

  finishNow(): void {
    if (this.current) {
      this.match.apply(this.current);
      this.current = null;
    }
    this.match.playOut();
  }

  result(): GameResult {
    const m = this.match, w = m.winner, l = other(w);
    const fullMoves = Math.ceil(m.played.length / 2);
    let how: string, score: string;
    if (m.end === "checkmate") {
      how = `by checkmate in ${fullMoves} moves`;
      score = `${m.material(w)}–${m.material(l)} in material`;
    } else if (m.end === "material") {
      how = "on material";
      score = `${m.material(w)}–${m.material(l)}`;
    } else {
      how = "on the Armageddon tiebreak (a draw goes to Black)";
      score = `level at ${m.material(w)} each`;
    }
    const rows = this.sides.map((s, i) => [
      `<span class="tdot" style="--tc:${s.color}"></span>${escapeHtml(sideName(s))}`,
      m.colorOf(i as SideIndex) === WHITE ? "White" : "Black",
      `<b>${m.material(i as SideIndex)}</b>`,
      String(m.played.filter((p) => p.side === i && p.move.captured).length),
    ]);
    const moves = m.played.map((p, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : "") + p.san).join(" ");
    return {
      winner: w,
      how,
      score,
      detailsHtml: tableHtml("Players", ["Player", "Color", "Material", "Captures"], rows) + `<p class="move-list">${escapeHtml(moves)}</p>`,
    };
  }

  carry(): number {
    return 0;
  }
}
