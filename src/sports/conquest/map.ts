/* The hex map. Tiles use axial coordinates (q, r) with pointy-top hexes, centered on (0, 0).
   The map is point-symmetric: the tile at (q, r) always matches the one at (-q, -r), so both empires
   start with exactly the same land around them and equal players stay 50/50. */

import { weightedIndex } from "../../util/math";

export type Terrain = "plains" | "forest" | "hills" | "water";

export interface Tile {
  q: number;
  r: number;
  terrain: Terrain;
  /** The index of the tile at (-q, -r). */
  mirror: number;
}

export interface HexMap {
  tiles: Tile[];
  /** Neighbor indices for each tile. */
  neighbors: number[][];
  /** Each side's capital tile. */
  capitals: [number, number];
}

/** Rows run from -ROWS to ROWS; each row spans a horizontal distance of HALF_WIDTH either side of center. */
const ROWS = 3;
const HALF_WIDTH = 4.3;
const CAPITAL_Q = 3;
const TERRAINS: Terrain[] = ["plains", "forest", "hills", "water"];
const TERRAIN_WEIGHTS = [.52, .22, .16, .1];
const AXIAL_STEPS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Horizontal position of a tile, in hex widths. */
export const tileX = (q: number, r: number): number => q + r / 2;

/** All tiles of the map's shape, without terrain yet. */
function shape(): { q: number; r: number }[] {
  const cells: { q: number; r: number }[] = [];
  for (let r = -ROWS; r <= ROWS; r++) {
    for (let q = -10; q <= 10; q++) if (Math.abs(tileX(q, r)) <= HALF_WIDTH) cells.push({ q, r });
  }
  return cells;
}

/** Land tiles reachable from `start` over land. */
function reachable(map: HexMap, start: number): Set<number> {
  const seen = new Set([start]), queue = [start];
  while (queue.length) {
    const tile = queue.shift()!;
    for (const next of map.neighbors[tile]) {
      if (!seen.has(next) && map.tiles[next].terrain !== "water") {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** A new random, symmetric map whose capitals are connected over land. */
export function generateMap(): HexMap {
  const cells = shape();
  const index = new Map(cells.map((c, i) => [`${c.q},${c.r}`, i]));
  const at = (q: number, r: number) => index.get(`${q},${r}`);
  const neighbors = cells.map((c) => AXIAL_STEPS.map(([dq, dr]) => at(c.q + dq, c.r + dr)).filter((i): i is number => i !== undefined));
  const capitals: [number, number] = [at(-CAPITAL_Q, 0)!, at(CAPITAL_Q, 0)!];
  for (;;) {
    const tiles: Tile[] = cells.map((c) => ({ ...c, terrain: "plains", mirror: at(-c.q, -c.r)! }));
    // Pick terrain for one half and copy it to the mirrored half.
    tiles.forEach((tile, i) => {
      if (i > tile.mirror) return;
      const terrain = TERRAINS[weightedIndex(TERRAIN_WEIGHTS)];
      tile.terrain = terrain;
      tiles[tile.mirror].terrain = terrain;
    });
    // Capitals start on plains with no water next to them.
    for (const capital of capitals) {
      tiles[capital].terrain = "plains";
      for (const n of neighbors[capital]) if (tiles[n].terrain === "water") tiles[n].terrain = "plains";
    }
    const map: HexMap = { tiles, neighbors, capitals };
    if (reachable(map, capitals[0]).has(capitals[1])) return map;
  }
}

/** Steps between two tiles, ignoring terrain. */
export function hexDistance(a: Tile, b: Tile): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
