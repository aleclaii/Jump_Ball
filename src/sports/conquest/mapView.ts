/* Drawing the hex map: terrain, territory, cities, and attack arrows. One unit is one hex's radius;
   hexes are pointy-top, so a tile at axial (q, r) sits at x = √3·(q + r/2), y = 1.5·r. */

import type { Point } from "../../util/math";
import { drawLabel, seededRandom } from "../drawing";
import type { HexMap, Terrain } from "./map";

const SQRT3 = Math.sqrt(3);
const PADDING = 1.1;
const TERRAIN_COLORS: Record<Terrain, string> = { plains: "#EAF0DD", forest: "#CFE1C4", hills: "#E6DCC8", water: "#CFE4F6" };

export interface MapFrame {
  width: number;
  height: number;
  /** Shifts axial positions so the map starts at (0, 0) in drawing units. */
  offset: Point;
}

export const tileCenter = (frame: MapFrame, q: number, r: number): Point =>
  ({ x: SQRT3 * (q + r / 2) + frame.offset.x, y: 1.5 * r + frame.offset.y });

/** The drawing area that fits the whole map with a little margin. */
export function frameFor(map: HexMap): MapFrame {
  const xs = map.tiles.map((t) => SQRT3 * (t.q + t.r / 2)), ys = map.tiles.map((t) => 1.5 * t.r);
  const minX = Math.min(...xs) - SQRT3 / 2 - PADDING, maxX = Math.max(...xs) + SQRT3 / 2 + PADDING;
  const minY = Math.min(...ys) - 1 - PADDING, maxY = Math.max(...ys) + 1 + PADDING;
  return { width: maxX - minX, height: maxY - minY, offset: { x: -minX, y: -minY } };
}

export function hexPath(c: CanvasRenderingContext2D, center: Point, radius: number): void {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + i * Math.PI / 3;
    const x = center.x + Math.cos(angle) * radius, y = center.y + Math.sin(angle) * radius;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

/** The terrain layer, which doesn't change during a game. */
export function paintTerrain(c: CanvasRenderingContext2D, k: number, map: HexMap, frame: MapFrame): void {
  c.setTransform(k, 0, 0, k, 0, 0);
  c.fillStyle = "#F4F6F8";
  c.fillRect(0, 0, frame.width, frame.height);
  const rnd = seededRandom(5);
  for (const tile of map.tiles) {
    const center = tileCenter(frame, tile.q, tile.r);
    hexPath(c, center, .97);
    c.fillStyle = TERRAIN_COLORS[tile.terrain];
    c.fill();
    c.strokeStyle = "rgba(15,17,21,.08)";
    c.lineWidth = .04;
    c.stroke();
    if (tile.terrain === "forest") {
      c.fillStyle = "rgba(46,110,64,.35)";
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(center.x + (rnd() - .5) * .9, center.y + (rnd() - .5) * .9, .12, 0, Math.PI * 2);
        c.fill();
      }
    } else if (tile.terrain === "hills") {
      c.strokeStyle = "rgba(120,96,60,.4)";
      c.lineWidth = .06;
      for (const dx of [-.28, .22]) {
        c.beginPath();
        c.arc(center.x + dx, center.y + .2, .26, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
    } else if (tile.terrain === "water") {
      c.strokeStyle = "rgba(60,120,190,.35)";
      c.lineWidth = .05;
      for (const dy of [-.18, .14]) {
        c.beginPath();
        c.moveTo(center.x - .4, center.y + dy);
        c.quadraticCurveTo(center.x - .2, center.y + dy - .12, center.x, center.y + dy);
        c.quadraticCurveTo(center.x + .2, center.y + dy + .12, center.x + .4, center.y + dy);
        c.stroke();
      }
    }
  }
}

/** A city marker: the owner's color, a gold ring for a capital, and the name underneath. */
export function drawCity(
  c: CanvasRenderingContext2D, k: number, at: Point, color: string, ink: string, name: string,
  pop: number, capital: boolean, scale = 1,
): void {
  const radius = (.36 + Math.min(pop, 10) * .02) * scale;
  c.fillStyle = "rgba(15,17,21,.25)";
  c.beginPath();
  c.ellipse(at.x, at.y + radius * .7, radius, radius * .45, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.arc(at.x, at.y, radius, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = .07;
  c.strokeStyle = "#FFFFFF";
  c.stroke();
  if (capital) {
    c.lineWidth = .07;
    c.strokeStyle = "#F2B61D";
    c.beginPath();
    c.arc(at.x, at.y, radius + .1, 0, Math.PI * 2);
    c.stroke();
  }
  drawLabel(c, k, String(Math.round(pop)), { x: at.x, y: at.y + .01 }, radius * 1.05, ink);
  if (scale > .5) drawLabel(c, k, name, { x: at.x, y: at.y + radius + .42 }, .46, "rgba(15,17,21,.8)", "rgba(255,255,255,.9)");
}

/** An attack arrow, drawn from `from` toward `to` as `progress` goes from 0 to 1. */
export function drawArrow(c: CanvasRenderingContext2D, from: Point, to: Point, color: string, progress: number): void {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const end = { x: from.x + dx * progress - ux * .35 * progress, y: from.y + dy * progress - uy * .35 * progress };
  c.strokeStyle = color;
  c.lineWidth = .16;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(from.x, from.y);
  c.lineTo(end.x, end.y);
  c.stroke();
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(end.x + ux * .32, end.y + uy * .32);
  c.lineTo(end.x - uy * .22, end.y + ux * .22);
  c.lineTo(end.x + uy * .22, end.y - ux * .22);
  c.closePath();
  c.fill();
}
