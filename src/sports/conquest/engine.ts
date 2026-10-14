/* Mini 4X rules with no drawing. Two empires start from capitals on a symmetric hex map. Each turn,
   each empire grows its cities (Economy), researches (Science), founds a city or builds up its army
   (Expansion), and, once the borders meet, attacks the weakest enemy city along the border
   (Military vs. Defense). Taking the enemy capital wins; otherwise more territory after the last turn wins. */

import { chance, clamp, rand } from "../../util/math";
import type { SideIndex } from "../types";
import { generateMap, type HexMap, hexDistance } from "./map";
import type { ConquestStats } from "./stats";

export interface City {
  tile: number;
  owner: SideIndex;
  /** The side that founded it (a captured capital still counts as its founder's capital). */
  founder: SideIndex;
  pop: number;
  capital: boolean;
  name: string;
}

export type TurnEvent =
  | { type: "found"; side: SideIndex; tile: number; name: string }
  | { type: "tech"; side: SideIndex; level: number }
  | { type: "contact" }
  | { type: "attack"; side: SideIndex; from: number; to: number; captured: boolean; name: string; capital: boolean };

export interface TurnReport {
  turn: number;
  events: TurnEvent[];
  /** Who held each tile before and after this turn (-1 = nobody), for animating the borders. */
  before: Int8Array;
  after: Int8Array;
}

export type ConquestEnd = "capital" | "territory" | "tiebreak";

const MAX_POP = 10;
const SETTLE_COST = 8;
const TECH_STEP = 9;
const MAX_TECH = 5;
const CITY_SUFFIXES = ["New {b}", "{b}ville", "Port {b}", "{b} Heights", "Fort {b}", "{b} Springs", "{b}burg", "Lake {b}", "{b} Falls", "Mount {b}", "{b} Bay", "{b} Ridge"];

const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

export class ConquestMatch {
  readonly map: HexMap = generateMap();
  readonly empires: [ConquestStats, ConquestStats];
  readonly turns: number;
  readonly names: [string, string];
  turn = 0;
  cities: City[] = [];
  /** Who holds each tile (-1 = nobody). */
  owners: Int8Array;
  army: [number, number] = [3, 3];
  production: [number, number] = [0, 0];
  research: [number, number] = [0, 0];
  techLevel: [number, number] = [0, 0];
  captures: [number, number] = [0, 0];
  atWar = false;
  done = false;
  winner: SideIndex = 0;
  end: ConquestEnd = "territory";
  private namesUsed: [number, number] = [0, 0];

  constructor(empires: [ConquestStats, ConquestStats], turns: number, names: [string, string] = ["Red", "Blue"]) {
    this.empires = empires;
    this.turns = turns;
    this.names = names;
    this.owners = new Int8Array(this.map.tiles.length).fill(-1);
    this.map.capitals.forEach((tile, i) => {
      const side = i as SideIndex;
      this.cities.push({ tile, owner: side, founder: side, pop: 2, capital: true, name: names[side] });
    });
    this.claimTerritory();
  }

  citiesOf(side: SideIndex): City[] {
    return this.cities.filter((c) => c.owner === side);
  }

  territory(side: SideIndex): number {
    return this.owners.filter((o) => o === side).length;
  }

  population(side: SideIndex): number {
    return this.citiesOf(side).reduce((sum, c) => sum + c.pop, 0);
  }

  /** Tech level makes everything a bit stronger: +8% per level. */
  private techBonus(side: SideIndex): number {
    return 1 + this.techLevel[side] * .08;
  }

  /** Each city holds the tiles around it (two rings for a capital). A tile already held stays with its holder. */
  private claimTerritory(): void {
    const next = new Int8Array(this.owners.length).fill(-1);
    const tiles = this.map.tiles;
    tiles.forEach((tile, i) => {
      if (tile.terrain === "water") return;
      let best: City | null = null, bestDistance = Infinity;
      for (const city of this.cities) {
        const reach = city.capital ? 2 : 1;
        const distance = hexDistance(tiles[city.tile], tile);
        if (distance > reach) continue;
        const keepsIt = this.owners[i] === city.owner && distance === bestDistance;
        if (distance < bestDistance || keepsIt) {
          best = city;
          bestDistance = distance;
        }
      }
      if (best) next[i] = best.owner;
    });
    this.cities.forEach((c) => { next[c.tile] = c.owner; });
    this.owners = next;
  }

  private cityName(side: SideIndex): string {
    const base = (this.names[side].match(/[A-Za-z']+/)?.[0] ?? this.names[side]).replace(/'s$/i, "");
    const pattern = CITY_SUFFIXES[this.namesUsed[side] % CITY_SUFFIXES.length];
    this.namesUsed[side]++;
    return pattern.replace("{b}", base.charAt(0).toUpperCase() + base.slice(1));
  }

  /** Open land at least two tiles from every city, next to this empire's territory. Best first. */
  private settleSites(side: SideIndex): number[] {
    const tiles = this.map.tiles, capital = tiles[this.map.capitals[side]];
    return tiles.map((_, i) => i).filter((i) => {
      if (tiles[i].terrain === "water" || this.owners[i] === other(side)) return false;
      if (this.cities.some((c) => hexDistance(tiles[c.tile], tiles[i]) < 2)) return false;
      return this.map.neighbors[i].some((n) => this.owners[n] === side) || this.owners[i] === side;
    }).sort((a, b) => {
      const value = (i: number) => this.map.neighbors[i].filter((n) => tiles[n].terrain === "plains").length * 2
        - hexDistance(tiles[i], capital) + (tiles[i].terrain === "plains" ? 2 : 0);
      return value(b) - value(a);
    });
  }

  /** Whether the two empires' territories touch anywhere. */
  private bordersMeet(): boolean {
    return this.owners.some((owner, i) => owner === 0 && this.map.neighbors[i].some((n) => this.owners[n] === 1));
  }

  /** Grow, produce, research, then found a city or build the army. */
  private develop(side: SideIndex, events: TurnEvent[]): void {
    const stats = this.empires[side], tiles = this.map.tiles;
    let output = 0;
    for (const city of this.citiesOf(side)) {
      const fertile = this.map.neighbors[city.tile].filter((n) => tiles[n].terrain === "plains").length;
      city.pop = Math.min(MAX_POP, city.pop + .3 + (stats.econ - 5) * .008 + fertile * .03);
      output += 1 + city.pop * .45;
    }
    output *= 1 + (stats.econ - 5) * .008;
    this.research[side] += (1 + this.citiesOf(side).length * .2) * (1 + (stats.sci - 5) * .15);
    const level = Math.min(MAX_TECH, Math.floor(this.research[side] / TECH_STEP));
    if (level > this.techLevel[side]) {
      this.techLevel[side] = level;
      events.push({ type: "tech", side, level });
    }
    this.production[side] += output;
    const cost = SETTLE_COST - (stats.exp - 5) * .5;
    const urge = clamp(.45 + (stats.exp - 5) * .08 - (this.atWar ? .3 : 0), .05, .95);
    const site = this.production[side] >= cost && chance(urge) ? this.settleSites(side)[0] : undefined;
    if (site !== undefined) {
      this.production[side] -= cost;
      const name = this.cityName(side);
      this.cities.push({ tile: site, owner: side, founder: side, pop: 1, capital: false, name });
      events.push({ type: "found", side, tile: site, name });
      this.claimTerritory();
    }
    // Whatever isn't saved for the next city goes to the army; at war, almost all of it.
    const spend = this.production[side] * (this.atWar ? .85 : .4);
    this.production[side] -= spend;
    this.army[side] += spend * (1 + (stats.mil - 5) * .015);
  }

  /** At war: attack the weakest enemy city near the border, if the army is ready. */
  private attack(side: SideIndex, events: TurnEvent[]): void {
    const enemy = other(side), tiles = this.map.tiles;
    const ownTiles = this.owners.reduce<number[]>((list, o, i) => (o === side ? [...list, i] : list), []);
    const near = (city: City) => ownTiles.some((t) => hexDistance(tiles[t], tiles[city.tile]) <= 2);
    const targets = this.citiesOf(enemy).filter(near);
    if (!targets.length || !chance(clamp(.35 + (this.army[side] / Math.max(1, this.army[enemy]) - 1) * .3, .15, .8))) return;
    // Rally: an empire with fewer cities fights harder for each one it has left, so one early edge doesn't snowball.
    const rally = 1 + Math.max(0, this.citiesOf(side).length - this.citiesOf(enemy).length) * .1;
    const defense = (city: City) => {
      const stats = this.empires[enemy];
      const terrain = tiles[city.tile].terrain === "hills" ? 1.25 : 1;
      return (2 + city.pop * 1.1 + this.army[enemy] * .35) * (1 + (stats.def - 5) * .045) * this.techBonus(enemy)
        * terrain * (city.capital ? 1.35 : 1) * rally;
    };
    const target = targets.reduce((a, b) => (defense(a) <= defense(b) ? a : b));
    const from = ownTiles.reduce((a, b) => (hexDistance(tiles[a], tiles[target.tile]) <= hexDistance(tiles[b], tiles[target.tile]) ? a : b));
    const attackPower = this.army[side] * .6 * (1 + (this.empires[side].mil - 5) * .03) * this.techBonus(side) * rand(.5, 1.5);
    const defensePower = defense(target) * rand(.5, 1.5);
    const captured = attackPower > defensePower;
    if (captured) {
      target.owner = side;
      target.pop = Math.max(1, target.pop * .6);
      this.captures[side]++;
      this.army[side] = Math.max(1, this.army[side] - defensePower * .45);
      this.army[enemy] *= .8;
      this.claimTerritory();
    } else {
      this.army[side] *= .55;
      this.army[enemy] = Math.max(1, this.army[enemy] - attackPower * .2);
    }
    const capitalTaken = captured && target.capital && target.founder === enemy;
    events.push({ type: "attack", side, from, to: target.tile, captured, name: target.name, capital: capitalTaken });
    if (capitalTaken) this.finish(side, "capital");
  }

  playTurn(): TurnReport {
    const before = this.owners.slice();
    const events: TurnEvent[] = [];
    this.turn++;
    // Both empires act each turn, in a random order so neither always goes first.
    const order: SideIndex[] = Math.random() < .5 ? [0, 1] : [1, 0];
    for (const side of order) this.develop(side, events);
    if (!this.atWar && this.bordersMeet()) {
      this.atWar = true;
      events.push({ type: "contact" });
    }
    if (this.atWar) {
      for (const side of order) {
        if (this.done) break;
        this.attack(side, events);
      }
    }
    if (!this.done && this.turn >= this.turns) this.finishOnTerritory();
    return { turn: this.turn, events, before, after: this.owners.slice() };
  }

  private finishOnTerritory(): void {
    const [t0, t1] = [this.territory(0), this.territory(1)];
    if (t0 !== t1) return this.finish(t0 > t1 ? 0 : 1, "territory");
    const [p0, p1] = [this.population(0), this.population(1)];
    this.finish(p0 === p1 ? (Math.random() < .5 ? 0 : 1) : (p0 > p1 ? 0 : 1), "tiebreak");
  }

  private finish(winner: SideIndex, end: ConquestEnd): void {
    this.done = true;
    this.winner = winner;
    this.end = end;
  }

  playOut(): void {
    while (!this.done) this.playTurn();
  }
}
