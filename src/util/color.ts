const INK = "#0F1222";
const WHITE = "#FFFFFF";

/** Relative luminance (0 = black, 1 = white) of a #RRGGBB color, per WCAG. */
export function luminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
  };
  return .2126 * channel(16) + .7152 * channel(8) + .0722 * channel(0);
}

const contrast = (a: number, b: number): number => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);

function channels(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** How different two colors look, roughly (0 = identical). Weighted toward green, which the eye is most sensitive to. */
export function colorDistance(a: string, b: string): number {
  const ca = channels(a), cb = channels(b);
  if (!ca || !cb) return Infinity;
  const [dr, dg, db] = [ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/** Below this distance two side colors are too easy to confuse during a game. */
const CONFUSABLE = 180;
const STAND_INS = ["#2D6BFF", "#FF4D2E", "#9B3DFF", "#FF9F1C", "#00B8D9", "#E5173F", "#12B886"];

/** If two colors are easy to confuse, a clearly different stand-in for the second one; otherwise the second as is. */
export function contrastingColor(first: string, second: string): string {
  if (colorDistance(first, second) >= CONFUSABLE) return second;
  return STAND_INS.reduce((best, c) => (colorDistance(first, c) > colorDistance(first, best) ? c : best));
}

/** White or dark ink, whichever reads better on the given background color. */
export function readableTextOn(background: string): string {
  const bg = luminance(background);
  return contrast(bg, luminance(WHITE)) >= contrast(bg, luminance(INK)) ? WHITE : INK;
}
