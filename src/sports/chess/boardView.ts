/* Drawing the board and pieces. The board is 8 x 8 units, one per square, with White at the bottom.
   Pieces are white or black discs (so the two sides always contrast, whatever their colors), ringed in
   their side's color: a letter for each piece, a plain disc for pawns, and a gold outer ring on the king. */

import type { Point } from "../../util/math";
import { drawLabel } from "../drawing";
import { fileOf, KING, PAWN, rankOf } from "./board";

export const BOARD_SIZE = 8;
const LIGHT = "#EEF1F6";
const DARK = "#C7D0DE";
const LETTERS = ["", "", "N", "B", "R", "Q", "K"];

/** The center of a square, in board units. */
export const squareCenter = (square: number): Point => ({ x: fileOf(square) + .5, y: 7 - rankOf(square) + .5 });

export function paintBoard(c: CanvasRenderingContext2D, k: number): void {
  c.setTransform(k, 0, 0, k, 0, 0);
  for (let file = 0; file < 8; file++) {
    for (let row = 0; row < 8; row++) {
      c.fillStyle = (file + row) % 2 === 0 ? LIGHT : DARK;
      c.fillRect(file, row, 1, 1);
    }
  }
  for (let i = 0; i < 8; i++) {
    drawLabel(c, k, "abcdefgh"[i], { x: i + .9, y: 7.88 }, .2, "rgba(15,17,21,.45)");
    drawLabel(c, k, String(8 - i), { x: .1, y: i + .14 }, .2, "rgba(15,17,21,.45)");
  }
}

/** Tints a square: the last move, or a king in check. */
export function highlightSquare(c: CanvasRenderingContext2D, square: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(fileOf(square), 7 - rankOf(square), 1, 1);
}

export const PIECE_FILL = { white: "#FFFFFF", black: "#1B1E25" };

export function drawPiece(
  c: CanvasRenderingContext2D, k: number, type: number, white: boolean, ring: string, at: Point, alpha = 1, lift = 0,
): void {
  const fill = white ? PIECE_FILL.white : PIECE_FILL.black;
  const ink = white ? PIECE_FILL.black : PIECE_FILL.white;
  const radius = type === PAWN ? .26 : .36;
  const y = at.y - lift * .12;
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = "rgba(15,17,21,.22)";
  c.beginPath();
  c.ellipse(at.x, at.y + radius * .55, radius * .95, radius * .45, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = fill;
  c.beginPath();
  c.arc(at.x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = .075;
  c.strokeStyle = ring;
  c.stroke();
  if (type === KING) {
    c.lineWidth = .05;
    c.strokeStyle = "#F2B61D";
    c.beginPath();
    c.arc(at.x, y, radius + .085, 0, Math.PI * 2);
    c.stroke();
  }
  if (type !== PAWN) drawLabel(c, k, LETTERS[type], { x: at.x, y: y + .02 }, .36, ink);
  c.restore();
}
