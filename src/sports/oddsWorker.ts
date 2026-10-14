/* Runs practice games for the win-chance estimate on a background thread (a Web Worker),
   so slow games like chess never freeze the page. Started and stopped by projectOdds in odds.ts. */

import { simulateSeries } from "./odds";
import type { MatchRules, Side, SportId } from "./types";

export interface OddsRequest {
  sides: Side[];
  rules: MatchRules;
  sportPick: SportId | "random";
  runs: number;
}

export interface OddsProgress {
  firstChance: number;
  played: number;
  finished: boolean;
}

/** Report after every game for slow sports, but not after every one of 800 fast games. */
const REPORT_EVERY_MS = 150;

// In a worker, `self` is the worker's global scope; this narrow type avoids mixing in the browser window's types.
const scope = self as unknown as { onmessage: ((event: MessageEvent<OddsRequest>) => void) | null; postMessage(message: OddsProgress): void };

scope.onmessage = (event) => {
  const { sides, rules, sportPick, runs } = event.data;
  let firstWins = 0, lastReport = performance.now();
  for (let played = 1; played <= runs; played++) {
    if (simulateSeries(sides, rules, sportPick) === 0) firstWins++;
    const finished = played === runs;
    if (finished || performance.now() - lastReport >= REPORT_EVERY_MS) {
      scope.postMessage({ firstChance: firstWins / played, played, finished });
      lastReport = performance.now();
    }
  }
};
