/* Fight calls. Placeholders: {a} attacker, {d} defender. */

import type { Move } from "./engine";

export const FIGHT_LINES: Record<Move, { landed: string[]; missed: string[] }> = {
  jab: {
    landed: ["{a} snaps a jab into {d}.", "Stiff jab from {a}!", "{a} lands a crisp one-two."],
    missed: ["{d} slips the jab.", "{a} jabs at air.", "{d} rolls under it."],
  },
  kick: {
    landed: ["Big leg kick from {a}!", "{a} lands a body kick. That one hurt.", "{a} goes upstairs with a head kick!"],
    missed: ["{d} checks the kick.", "{a} misses the high kick.", "{d} catches the kick and shoves it away."],
  },
  takedown: {
    landed: ["{a} shoots in and takes {d} down! Ground and pound.", "Takedown {a}! Heavy shots on the ground."],
    missed: ["{d} stuffs the takedown.", "Great sprawl by {d}."],
  },
};

export const ROCKED_LINES = ["{d} IS ROCKED! {a} lands the big one!", "DOWN GOES {d}! {a} drops them!"];
export const COUNTER_LINES = [" {d} counters!", " And {d} fires right back."];
export const KO_LINES = ["IT'S OVER! {a} knocks out {d}!", "{d} is out cold. {a} wins by KO!"];

export const fillFightLine = (line: string, attacker: string, defender: string): string =>
  line.replace(/\{a\}/g, attacker).replace(/\{d\}/g, defender);
