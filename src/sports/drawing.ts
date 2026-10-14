/* Canvas helpers shared by every sport. Coordinates are in each field's own units; `k` is pixels per unit. */

import type { Point } from "../util/math";

export interface TokenLook {
  name: string;
  color: string;
  logo: string | null;
}

export const DISPLAY_FONT = '"Geist", "Helvetica Neue", Arial, sans-serif';

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const second = words[1] ? words[1][0] : (words[0][1] ?? "");
  return (words[0][0] + second).toUpperCase();
}

const imageCache = new Map<string, HTMLImageElement>();

/** Returns the uploaded logo once it has loaded, or null to fall back to initials. */
export function logoImage(look: TokenLook): HTMLImageElement | null {
  if (!look.logo) return null;
  let image = imageCache.get(look.logo);
  if (!image) {
    image = new Image();
    image.src = look.logo;
    imageCache.set(look.logo, image);
  }
  return image.complete && image.naturalWidth ? image : null;
}

/** Text at a field position. Drawn in pixel space so small sizes stay crisp. */
export function drawLabel(
  ctx: CanvasRenderingContext2D, k: number, text: string, at: Point, size: number, color: string, stroke?: string,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `800 ${size * k}px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineWidth = size * k * .14;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.strokeText(text, at.x * k, at.y * k);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, at.x * k, at.y * k);
  ctx.restore();
}

/**
 * A player disc: their own color and photo inside, a ring in the color of the side they play for.
 * `lift` raises it off its shadow (jumping); `scale` grows or shrinks it.
 */
export function drawToken(
  ctx: CanvasRenderingContext2D, k: number, look: TokenLook, ringColor: string, at: Point,
  radius: number, lift = 0, alpha = 1,
): void {
  const r = radius * (1 + lift * .12);
  const y = at.y - lift * radius * .4;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(20,12,4,.3)";
  ctx.beginPath();
  ctx.ellipse(at.x, at.y + radius * .34, radius * 1.15 - lift * .2, radius * .65 - lift * .12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(at.x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = look.color;
  ctx.fill();
  const image = logoImage(look);
  if (image) {
    ctx.clip();
    ctx.drawImage(image, at.x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  ctx.lineWidth = radius * .12;
  ctx.strokeStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(at.x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = radius * .22;
  ctx.strokeStyle = ringColor;
  ctx.beginPath();
  ctx.arc(at.x, y, r + radius * .17, 0, Math.PI * 2);
  ctx.stroke();
  if (!image) drawLabel(ctx, k, initials(look.name), { x: at.x, y: y + radius * .05 }, radius * .9 * (1 + lift * .12), "#FFFFFF", "rgba(0,0,0,.35)");
  ctx.restore();
}

/** A burst of short lines, for impacts and saves. */
export function drawBurst(ctx: CanvasRenderingContext2D, at: Point, radius: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * .12;
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(at.x + Math.cos(angle) * radius * .45, at.y + Math.sin(angle) * radius * .45);
    ctx.lineTo(at.x + Math.cos(angle) * radius, at.y + Math.sin(angle) * radius);
    ctx.stroke();
  }
  ctx.restore();
}

/** A seeded random generator, so decorative textures look the same every frame. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** Builds an offscreen canvas once and reuses it until the size or key changes. */
export function cachedLayer(): (width: number, height: number, key: string, paint: (ctx: CanvasRenderingContext2D) => void) => HTMLCanvasElement {
  let layer: HTMLCanvasElement | null = null;
  let layerKey = "";
  return (width, height, key, paint) => {
    const fullKey = `${width}x${height}|${key}`;
    if (!layer || layerKey !== fullKey) {
      layer = document.createElement("canvas");
      layer.width = width;
      layer.height = height;
      const ctx = layer.getContext("2d");
      if (ctx) paint(ctx);
      layerKey = fullKey;
    }
    return layer;
  };
}
