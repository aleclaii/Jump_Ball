export interface Point {
  x: number;
  y: number;
}

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export const rand = (min: number, max: number): number => min + Math.random() * (max - min);
export const chance = (probability: number): boolean => Math.random() < probability;
/** A random number from the standard bell curve (mean 0, standard deviation 1), by the Box-Muller method. */
export function gaussian(): number {
  const u = 1 - Math.random(), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
export const lerp = (from: number, to: number, k: number): number => from + (to - from) * k;
export const lerpPoint = (from: Point, to: Point, k: number): Point => ({ x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) });
export const easeInOut = (k: number): number => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Picks an index with probability proportional to its weight. */
export function weightedIndex(weights: readonly number[]): number {
  let remaining = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < weights.length; i++) {
    remaining -= weights[i];
    if (remaining <= 0) return i;
  }
  return weights.length - 1;
}

/** Formats seconds as m:ss. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
