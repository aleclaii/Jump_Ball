/* Projected odds: play many games with no animation and count who wins. */

import { resolveSport } from ".";
import type { OddsProgress, OddsRequest } from "./oddsWorker";
import type { MatchRules, Side, SideIndex, SportId } from "./types";

/** A whole series (one game, or best of 3). With "random", each game picks its own sport. */
export function simulateSeries(sides: Side[], rules: MatchRules, sportPick: SportId | "random"): SideIndex {
  const needed = Math.ceil(rules.bestOf / 2);
  const wins = [0, 0];
  let carry = 0;
  while (wins[0] < needed && wins[1] < needed) {
    const game = resolveSport(sportPick).simulate(sides, rules, carry);
    wins[game.winner]++;
    carry = game.carry;
  }
  return wins[0] > wins[1] ? 0 : 1;
}

/** How many practice games to play for an estimate. Slow games (chess) use fewer. */
export function practiceRuns(sportPick: SportId | "random", bestOf: number): number {
  const base = sportPick === "random" ? 800 : (resolveSport(sportPick).oddsRuns ?? 800);
  return bestOf === 3 ? Math.ceil(base / 2) : base;
}

/**
 * How often the first side wins (0-1), worked out on a background thread so the page never freezes.
 * `onUpdate` gets the running estimate as games finish. Returns a function that stops it early
 * (for when a setting changes mid-estimate).
 */
export function projectOdds(
  sides: Side[], rules: MatchRules, sportPick: SportId | "random", runs: number,
  onUpdate: (firstChance: number, played: number, finished: boolean) => void,
): () => void {
  const worker = new Worker(new URL("./oddsWorker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<OddsProgress>) => {
    const { firstChance, played, finished } = event.data;
    onUpdate(firstChance, played, finished);
    if (finished) worker.terminate();
  };
  const request: OddsRequest = { sides, rules, sportPick, runs };
  worker.postMessage(request);
  return () => worker.terminate();
}
