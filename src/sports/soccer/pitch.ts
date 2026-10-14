/* The penalty view, from behind the shooter: 40 wide, 30 tall. The goal is in the distance. */

import type { Point } from "../../util/math";
import { seededRandom } from "../drawing";
import type { Column, Height } from "./engine";

export const VIEW_WIDTH = 40;
export const VIEW_HEIGHT = 30;
export const GOAL = { left: 11, right: 29, top: 6.5, bottom: 15 };
export const SPOT: Point = { x: 20, y: 25.5 };
export const KEEPER_HOME: Point = { x: 20, y: 13 };
export const SHOOTER_HOME: Point = { x: 16.5, y: 27 };

/** Where in the goal a shot ends up. */
export function shotTarget(column: Column, height: Height): Point {
  return { x: 20 + column * 6.5, y: height === "high" ? 8.6 : 13.4 };
}

/** Paints the stands, the grass, and the goal. */
export function paintPitch(c: CanvasRenderingContext2D, k: number): void {
  c.setTransform(k, 0, 0, k, 0, 0);
  // Stands with a crowd.
  const stands = c.createLinearGradient(0, 0, 0, GOAL.bottom);
  stands.addColorStop(0, "#7FB4FF");
  stands.addColorStop(1, "#C9DEFF");
  c.fillStyle = stands;
  c.fillRect(0, 0, VIEW_WIDTH, GOAL.bottom);
  const rnd = seededRandom(7);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `hsla(${Math.floor(rnd() * 360)}, 85%, ${50 + rnd() * 15}%, .8)`;
    c.fillRect(rnd() * VIEW_WIDTH, rnd() * (GOAL.top - .5), .35, .35);
  }
  c.fillStyle = "#FFFFFF";
  c.fillRect(0, GOAL.top - .4, VIEW_WIDTH, .4);
  // Grass with mowing stripes, wider as they come closer.
  c.fillStyle = "#2E8B45";
  c.fillRect(0, GOAL.bottom - 1.6, VIEW_WIDTH, VIEW_HEIGHT);
  for (let i = 0, y = GOAL.bottom - 1.6; y < VIEW_HEIGHT; i++) {
    const band = .9 + i * .55;
    if (i % 2 === 0) {
      c.fillStyle = "rgba(255,255,255,.06)";
      c.fillRect(0, y, VIEW_WIDTH, band);
    }
    y += band;
  }
  // Six-yard box and penalty area lines, in perspective.
  c.strokeStyle = "rgba(255,255,255,.85)";
  c.lineWidth = .18;
  c.beginPath();
  c.moveTo(0, GOAL.bottom); c.lineTo(VIEW_WIDTH, GOAL.bottom);
  c.moveTo(8, GOAL.bottom); c.lineTo(6.5, 17.5); c.lineTo(33.5, 17.5); c.lineTo(32, GOAL.bottom);
  c.moveTo(2, GOAL.bottom); c.lineTo(-2, 23); c.moveTo(38, GOAL.bottom); c.lineTo(42, 23);
  c.moveTo(-2, 23); c.lineTo(42, 23);
  c.stroke();
  c.fillStyle = "rgba(255,255,255,.9)";
  c.beginPath(); c.ellipse(SPOT.x, SPOT.y + .2, .35, .15, 0, 0, Math.PI * 2); c.fill();
  // The net, then the frame.
  c.fillStyle = "rgba(255,255,255,.07)";
  c.fillRect(GOAL.left, GOAL.top, GOAL.right - GOAL.left, GOAL.bottom - GOAL.top);
  c.strokeStyle = "rgba(255,255,255,.28)";
  c.lineWidth = .06;
  c.beginPath();
  for (let x = GOAL.left; x <= GOAL.right; x += .7) { c.moveTo(x, GOAL.top); c.lineTo(x, GOAL.bottom); }
  for (let y = GOAL.top; y <= GOAL.bottom; y += .7) { c.moveTo(GOAL.left, y); c.lineTo(GOAL.right, y); }
  c.stroke();
  c.strokeStyle = "#F7F7F2";
  c.lineWidth = .45;
  c.lineCap = "square";
  c.beginPath();
  c.moveTo(GOAL.left, GOAL.bottom); c.lineTo(GOAL.left, GOAL.top); c.lineTo(GOAL.right, GOAL.top); c.lineTo(GOAL.right, GOAL.bottom);
  c.stroke();
}

/** The ball, drawn smaller the farther it travels toward the goal. */
export function drawSoccerBall(c: CanvasRenderingContext2D, at: Point, radius: number, groundY: number): void {
  c.fillStyle = "rgba(10,30,15,.35)";
  c.beginPath(); c.ellipse(at.x, groundY, radius * .9, radius * .35, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#FAFAFA";
  c.beginPath(); c.arc(at.x, at.y, radius, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#1E2228";
  c.beginPath(); c.arc(at.x, at.y, radius * .38, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2 - Math.PI / 2;
    c.beginPath(); c.arc(at.x + Math.cos(angle) * radius * .78, at.y + Math.sin(angle) * radius * .78, radius * .2, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = "rgba(0,0,0,.35)";
  c.lineWidth = radius * .08;
  c.beginPath(); c.arc(at.x, at.y, radius, 0, Math.PI * 2); c.stroke();
}
