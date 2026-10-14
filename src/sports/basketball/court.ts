/* The half court, in feet: 50 wide, 47 deep, basket at the top. */

import type { Point } from "../../util/math";
import { seededRandom } from "../drawing";

export const COURT_WIDTH = 50;
export const COURT_DEPTH = 47;
export const RIM: Point = { x: 25, y: 5.25 };
export const CHECK: Point = { x: 25, y: 33 };
export const GUARD: Point = { x: 25, y: 27 };
export const FT_SPOT: Point = { x: 25, y: 19.6 };

/** Paints the floor and lines. `paintColor` fills the lane. */
export function paintCourt(c: CanvasRenderingContext2D, k: number, paintColor: string): void {
  c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = "#D9A469";
  c.fillRect(0, 0, COURT_WIDTH, COURT_DEPTH);
  const rnd = seededRandom(11);
  for (let x = 0; x < COURT_WIDTH; x += 1.25) {
    for (let y = -rnd() * 10; y < COURT_DEPTH;) {
      const len = 6 + rnd() * 10;
      c.fillStyle = rnd() < .5 ? `rgba(120,70,30,${(.04 + rnd() * .08).toFixed(3)})` : `rgba(255,232,195,${(.04 + rnd() * .1).toFixed(3)})`;
      c.fillRect(x, y, 1.25, len);
      c.fillStyle = "rgba(90,50,20,.2)";
      c.fillRect(x, y, 1.25, .05);
      y += len;
    }
    c.fillStyle = "rgba(90,50,20,.15)";
    c.fillRect(x, 0, .04, COURT_DEPTH);
  }
  c.globalAlpha = .86;
  c.fillStyle = paintColor;
  c.fillRect(17, 0, 16, 19);
  c.globalAlpha = 1;

  c.strokeStyle = "#FBF3E4";
  c.lineWidth = .22;
  c.strokeRect(.11, .11, COURT_WIDTH - .22, COURT_DEPTH - .22);
  c.strokeRect(17, 0, 16, 19);
  c.beginPath(); c.arc(25, 19, 6, 0, Math.PI); c.stroke();
  c.setLineDash([.9, .7]);
  c.beginPath(); c.arc(25, 19, 6, Math.PI, Math.PI * 2); c.stroke();
  c.setLineDash([]);
  c.beginPath(); c.arc(RIM.x, RIM.y, 4, 0, Math.PI); c.stroke();
  const cornerY = RIM.y + Math.sqrt(23.75 ** 2 - 22 ** 2);
  const a = Math.atan2(cornerY - RIM.y, 22);
  c.beginPath();
  c.moveTo(3, 0);
  c.lineTo(3, cornerY);
  c.arc(RIM.x, RIM.y, 23.75, Math.PI - a, a, true);
  c.lineTo(47, 0);
  c.stroke();
  c.beginPath(); c.arc(25, COURT_DEPTH, 6, Math.PI, 0); c.stroke();
  c.beginPath(); c.arc(25, COURT_DEPTH, 2, Math.PI, 0); c.stroke();
  for (const y of [7, 11, 14]) {
    c.beginPath(); c.moveTo(16.3, y); c.lineTo(17, y); c.moveTo(33, y); c.lineTo(33.7, y); c.stroke();
  }
  c.strokeStyle = "#F4F6F8"; c.lineWidth = .4;
  c.beginPath(); c.moveTo(22, 4); c.lineTo(28, 4); c.stroke();
  c.strokeStyle = "#BFC5CC"; c.lineWidth = .18;
  c.beginPath(); c.moveTo(25, 4.2); c.lineTo(25, 4.5); c.stroke();
  c.strokeStyle = "#E2571A"; c.lineWidth = .24;
  c.beginPath(); c.arc(RIM.x, RIM.y, .75, 0, Math.PI * 2); c.stroke();
  const vignette = c.createRadialGradient(25, 23, 10, 25, 23, 40);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(40,20,5,.22)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, COURT_WIDTH, COURT_DEPTH);
}

/** The ball, lifted `h` feet off the floor, with its shadow. */
export function drawBasketball(ctx: CanvasRenderingContext2D, ball: Point & { h: number }): void {
  const h = Math.max(0, ball.h);
  ctx.fillStyle = `rgba(45,22,6,${(.32 - Math.min(h, 6) * .03).toFixed(3)})`;
  ctx.beginPath(); ctx.ellipse(ball.x, ball.y + .15, .6, .38, 0, 0, Math.PI * 2); ctx.fill();
  const y = ball.y - h * .55, r = .62 * (1 + h * .07);
  ctx.fillStyle = "#E8731E";
  ctx.beginPath(); ctx.arc(ball.x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(40,15,0,.75)"; ctx.lineWidth = .07;
  ctx.beginPath(); ctx.arc(ball.x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ball.x - r, y); ctx.lineTo(ball.x + r, y);
  ctx.moveTo(ball.x, y - r); ctx.lineTo(ball.x, y + r);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.beginPath(); ctx.arc(ball.x - r * .35, y - r * .35, r * .3, 0, Math.PI * 2); ctx.fill();
}
