/* The cage, seen from above: a 40 x 40 square with the octagon inside. */

import type { Point } from "../../util/math";

export const CAGE_SIZE = 40;
export const CENTER: Point = { x: 20, y: 20 };
const CAGE_RADIUS = 18.5;

function octagonPath(c: CanvasRenderingContext2D, radius: number): void {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 8 + i * Math.PI / 4;
    const x = CENTER.x + Math.cos(angle) * radius, y = CENTER.y + Math.sin(angle) * radius;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

/** Paints the mat, the fence, and each side's corner color. */
export function paintCage(c: CanvasRenderingContext2D, k: number, colors: [string, string]): void {
  c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = "#E3E6EF";
  c.fillRect(0, 0, CAGE_SIZE, CAGE_SIZE);
  octagonPath(c, CAGE_RADIUS);
  const mat = c.createRadialGradient(CENTER.x, CENTER.y, 2, CENTER.x, CENTER.y, CAGE_RADIUS);
  mat.addColorStop(0, "#FFFFFF");
  mat.addColorStop(1, "#E9ECF4");
  c.fillStyle = mat;
  c.fill();
  // Corner pads in each side's color.
  const corners: [number, string][] = [[Math.PI * 1.25, colors[0]], [Math.PI * .25, colors[1]]];
  for (const [angle, color] of corners) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(CENTER.x + Math.cos(angle) * (CAGE_RADIUS - .6), CENTER.y + Math.sin(angle) * (CAGE_RADIUS - .6), 1.1, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "rgba(20,23,29,.18)";
  c.lineWidth = .25;
  c.beginPath();
  c.arc(CENTER.x, CENTER.y, 5, 0, Math.PI * 2);
  c.stroke();
  octagonPath(c, CAGE_RADIUS);
  c.strokeStyle = "#2B2F38";
  c.lineWidth = .9;
  c.stroke();
  octagonPath(c, CAGE_RADIUS + .45);
  c.strokeStyle = "#5B616D";
  c.lineWidth = .2;
  c.stroke();
}
