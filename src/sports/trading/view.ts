/* Drawing the trading game: three panels on one canvas, in CSS pixels (`k` canvas pixels each).
   On a wide screen the portfolio race is big on the left with the stock chart and the trading floor
   stacked on the right; on a phone the race is on top with the two small panels side by side below. */

import { DISPLAY_FONT } from "../drawing";

export const MONO_FONT = '"Geist Mono", ui-monospace, Menlo, monospace';
/** Widths at or above this many CSS pixels get the side-by-side layout. */
const WIDE = 480;
const GAP = 8;
const INK = "#0F1115";
const MUTED = "#6B7180";
const LINE = "#E8EAEE";
/** Stock line colors: muted, and different from the bright side colors. */
export const STOCK_COLORS = ["#4C5BD4", "#C98A12", "#0E9F8E", "#C2417A", "#7A52C7"];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  race: Rect;
  stocks: Rect;
  floor: Rect;
}

/** Width divided by height of the whole canvas for a given CSS width. */
export const aspectFor = (cssWidth: number): number => (cssWidth >= WIDE ? 1.5 : .86);

export function layoutFor(width: number, height: number): Layout {
  if (width >= WIDE) {
    const left = Math.round(width * .62);
    const half = (height - GAP) / 2;
    return {
      race: { x: 0, y: 0, w: left, h: height },
      stocks: { x: left + GAP, y: 0, w: width - left - GAP, h: half },
      floor: { x: left + GAP, y: half + GAP, w: width - left - GAP, h: half },
    };
  }
  const top = Math.round(height * .52);
  const half = (width - GAP) / 2;
  return {
    race: { x: 0, y: 0, w: width, h: top },
    stocks: { x: 0, y: top + GAP, w: half, h: height - top - GAP },
    floor: { x: half + GAP, y: top + GAP, w: half, h: height - top - GAP },
  };
}

export function text(
  c: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string,
  options: { align?: CanvasTextAlign; weight?: number; mono?: boolean; baseline?: CanvasTextBaseline } = {},
): void {
  c.font = `${options.weight ?? 600} ${size}px ${options.mono ? MONO_FONT : DISPLAY_FONT}`;
  c.textAlign = options.align ?? "left";
  c.textBaseline = options.baseline ?? "alphabetic";
  c.fillStyle = color;
  c.fillText(value, x, y);
}

/** A white card with a small uppercase title; returns the area inside it for content. */
export function panel(c: CanvasRenderingContext2D, r: Rect, title: string, note = ""): Rect {
  c.fillStyle = "#FFFFFF";
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1, 8);
  c.fill();
  c.stroke();
  text(c, title, r.x + 10, r.y + 17, 10, MUTED, { mono: true, weight: 600 });
  if (note) text(c, note, r.x + r.w - 10, r.y + 17, 10, MUTED, { mono: true, weight: 500, align: "right" });
  return { x: r.x + 10, y: r.y + 26, w: r.w - 20, h: r.h - 34 };
}

export const formatMoney = (dollars: number): string =>
  Math.abs(dollars) >= 1000 ? `$${(dollars / 1000).toFixed(1)}k` : `$${dollars.toFixed(0)}`;

/** Maps day and value into a chart area, given the value range. */
export function chartScale(area: Rect, days: number, low: number, high: number) {
  const pad = (high - low) * .08 || 1;
  const lo = low - pad, hi = high + pad;
  return {
    x: (day: number) => area.x + area.w * day / Math.max(1, days),
    y: (value: number) => area.y + area.h * (1 - (value - lo) / (hi - lo)),
  };
}

/** A line through daily values; `last` is how far the newest segment has been drawn (0 to 1). */
export function series(
  c: CanvasRenderingContext2D, values: readonly number[], scale: ReturnType<typeof chartScale>, last: number,
  color: string, width: number, dash: number[] = [],
): { x: number; y: number } {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineJoin = "round";
  c.setLineDash(dash);
  c.beginPath();
  let end = { x: scale.x(0), y: scale.y(values[0]) };
  c.moveTo(end.x, end.y);
  for (let d = 1; d < values.length; d++) {
    const k = d === values.length - 1 ? last : 1;
    const value = values[d - 1] + (values[d] - values[d - 1]) * k;
    end = { x: scale.x(d - 1 + k), y: scale.y(value) };
    c.lineTo(end.x, end.y);
  }
  c.stroke();
  c.setLineDash([]);
  return end;
}

/** A dashed horizontal guide line with a small label at its left end. */
export function guide(c: CanvasRenderingContext2D, area: Rect, y: number, label: string): void {
  c.strokeStyle = "rgba(15,17,21,.18)";
  c.lineWidth = 1;
  c.setLineDash([3, 4]);
  c.beginPath();
  c.moveTo(area.x, y);
  c.lineTo(area.x + area.w, y);
  c.stroke();
  c.setLineDash([]);
  text(c, label, area.x + 2, y - 4, 9, MUTED, { mono: true, weight: 500 });
}

/** Spreads labels vertically so none overlap, keeping each as close to its wanted y as it can. */
export function spreadLabels(wanted: number[], gap: number, top: number, bottom: number): number[] {
  const order = wanted.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let n = 1; n < order.length; n++) order[n].y = Math.max(order[n].y, order[n - 1].y + gap);
  const overflow = order.length ? order[order.length - 1].y - bottom : 0;
  if (overflow > 0) order.forEach((o) => (o.y = Math.max(top, o.y - overflow)));
  const placed = new Array<number>(wanted.length);
  order.forEach((o) => (placed[o.i] = o.y));
  return placed;
}

/** A small triangle marker: up for buying, down for selling or shorting. */
export function tradeMarker(c: CanvasRenderingContext2D, x: number, y: number, up: boolean, color: string): void {
  const s = 4.5;
  c.fillStyle = color;
  c.strokeStyle = "#FFFFFF";
  c.lineWidth = 1.2;
  c.beginPath();
  if (up) {
    c.moveTo(x, y - s);
    c.lineTo(x + s, y + s * .8);
    c.lineTo(x - s, y + s * .8);
  } else {
    c.moveTo(x, y + s);
    c.lineTo(x + s, y - s * .8);
    c.lineTo(x - s, y - s * .8);
  }
  c.closePath();
  c.fill();
  c.stroke();
}

export const moodLabel = (mood: number): string =>
  mood <= -.6 ? "Extreme fear" : mood <= -.2 ? "Fear" : mood < .2 ? "Neutral" : mood < .6 ? "Greed" : "Extreme greed";

/** The fear-to-greed gauge: a half circle from red to green with a needle at the mood. */
export function moodGauge(c: CanvasRenderingContext2D, cx: number, cy: number, radius: number, mood: number): void {
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const from = Math.PI + t * Math.PI, to = Math.PI + (i + 1) / steps * Math.PI;
    const hue = 0 + t * 130;
    c.strokeStyle = `hsl(${hue} 70% 52%)`;
    c.lineWidth = radius * .22;
    c.beginPath();
    c.arc(cx, cy, radius, from, to + .01);
    c.stroke();
  }
  const angle = Math.PI + (mood + 1) / 2 * Math.PI;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx + Math.cos(angle) * radius * .92, cy + Math.sin(angle) * radius * .92);
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(cx, cy, 3, 0, Math.PI * 2);
  c.fill();
  c.lineCap = "butt";
}

/** Draws text wrapped to a width, up to `maxLines` lines (the last one cut with "…"). Returns the y after it. */
export function wrapped(
  c: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number,
  color: string, maxLines: number, weight = 500,
): number {
  c.font = `${weight} ${size}px ${DISPLAY_FONT}`;
  const words = value.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = shown[maxLines - 1];
    while (last.length > 1 && c.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    shown[maxLines - 1] = `${last}…`;
  }
  shown.forEach((l, i) => text(c, l, x, y + i * size * 1.25, size, color, { weight }));
  return y + shown.length * size * 1.25;
}

export const COLORS = { ink: INK, muted: MUTED, line: LINE };
