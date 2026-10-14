/* The field, seen from above: the end zone on the left, midfield on the right. 60 wide, 30 tall.
   x = 0-10 is the end zone; yards from the goal line run left to right. */

import { DISPLAY_FONT, drawLabel } from "../drawing";

export const FIELD_WIDTH = 60;
export const FIELD_HEIGHT = 30;
export const GOAL_LINE_X = 10;
export const MIDDLE_Y = 15;

/** Field x for a spot this many yards from the goal line. */
export const yardX = (yardsToGoal: number): number => GOAL_LINE_X + yardsToGoal;

/** Paints the grass, yard lines, and numbers. The end zone is colored separately each drive. */
export function paintField(c: CanvasRenderingContext2D, k: number): void {
  c.setTransform(k, 0, 0, k, 0, 0);
  for (let x = GOAL_LINE_X, i = 0; x < FIELD_WIDTH; x += 5, i++) {
    c.fillStyle = i % 2 === 0 ? "#2F8A47" : "#2A7F41";
    c.fillRect(x, 0, 5, FIELD_HEIGHT);
  }
  c.strokeStyle = "rgba(255,255,255,.85)";
  c.lineWidth = .18;
  for (let yards = 0; yards <= FIELD_WIDTH - GOAL_LINE_X; yards += 5) {
    c.beginPath();
    c.moveTo(yardX(yards), 1);
    c.lineTo(yardX(yards), FIELD_HEIGHT - 1);
    c.stroke();
  }
  // Hash marks.
  c.lineWidth = .12;
  for (let yards = 1; yards < FIELD_WIDTH - GOAL_LINE_X; yards++) {
    if (yards % 5 === 0) continue;
    for (const y of [1, 11, 18.4, FIELD_HEIGHT - 1.6]) {
      c.beginPath();
      c.moveTo(yardX(yards), y);
      c.lineTo(yardX(yards), y + .6);
      c.stroke();
    }
  }
  c.lineWidth = .4;
  c.beginPath();
  c.moveTo(GOAL_LINE_X, 0);
  c.lineTo(GOAL_LINE_X, FIELD_HEIGHT);
  c.stroke();
  for (let yards = 10; yards < FIELD_WIDTH - GOAL_LINE_X; yards += 10) {
    drawLabel(c, k, String(yards), { x: yardX(yards), y: 4.2 }, 2.6, "rgba(255,255,255,.8)");
    drawLabel(c, k, String(yards), { x: yardX(yards), y: FIELD_HEIGHT - 4.2 }, 2.6, "rgba(255,255,255,.8)");
  }
}

/** The end zone, in the color of the side defending it. */
export function paintEndZone(c: CanvasRenderingContext2D, k: number, color: string, label: string): void {
  c.fillStyle = color;
  c.globalAlpha = .85;
  c.fillRect(0, 0, GOAL_LINE_X, FIELD_HEIGHT);
  c.globalAlpha = 1;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.translate(GOAL_LINE_X / 2 * k, MIDDLE_Y * k);
  c.rotate(-Math.PI / 2);
  c.font = `600 ${2.4 * k}px ${DISPLAY_FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "rgba(255,255,255,.9)";
  c.fillText(label.toUpperCase(), 0, 0, FIELD_HEIGHT * k * .9);
  c.restore();
}

/** A football, with an optional height off the ground while it's thrown. */
export function drawFootball(c: CanvasRenderingContext2D, x: number, y: number, height: number): void {
  c.fillStyle = "rgba(10,30,15,.3)";
  c.beginPath(); c.ellipse(x, y + .3, .7, .3, 0, 0, Math.PI * 2); c.fill();
  const lifted = y - height * .5, scale = 1 + height * .06;
  c.save();
  c.translate(x, lifted);
  c.rotate(-.5);
  c.fillStyle = "#8B4A22";
  c.beginPath(); c.ellipse(0, 0, .75 * scale, .45 * scale, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#FFFFFF";
  c.lineWidth = .08;
  c.beginPath(); c.moveTo(-.3 * scale, 0); c.lineTo(.3 * scale, 0); c.stroke();
  c.restore();
}
