/* Soccer (penalty shootout) stats. Everyone both shoots and keeps goal, so the sheet has
   one half for each job. */

import { evenValues, type StatSheetDef, type StatValues } from "../../data/statSheet";

export const SOCCER_KEYS = ["acc", "pow", "dec", "rea", "ref"] as const;
export type SoccerStatKey = typeof SOCCER_KEYS[number];
export type SoccerStats = StatValues<SoccerStatKey>;

export const SOCCER_SHEET: StatSheetDef<SoccerStatKey> = {
  groups: [
    {
      name: "Shooting",
      stats: [
        { key: "acc", name: "Accuracy", abbr: "ACC", desc: "Keep shots on target", vs: "Can't be defended" },
        { key: "pow", name: "Power", abbr: "POW", desc: "Beat the keeper even when they guess right", vs: "Countered by Reflexes" },
        { key: "dec", name: "Deception", abbr: "DEC", desc: "Send the keeper the wrong way", vs: "Countered by Reading" },
      ],
    },
    {
      name: "Keeping",
      stats: [
        { key: "rea", name: "Reading", abbr: "REA", desc: "Dive the right way", vs: "Beats Deception" },
        { key: "ref", name: "Reflexes", abbr: "REF", desc: "Make the save once you're there", vs: "Beats Power" },
      ],
    },
  ],
  builds: [
    { id: "sniper", name: "Sniper", blurb: "Never misses", stats: { acc: 9, pow: 5, dec: 5, rea: 3, ref: 3 } },
    { id: "cannon", name: "Cannon", blurb: "Unstoppable shots", stats: { acc: 4, pow: 9, dec: 4, rea: 4, ref: 4 } },
    { id: "trickster", name: "Trickster", blurb: "Fools the keeper", stats: { acc: 5, pow: 3, dec: 9, rea: 4, ref: 4 } },
    { id: "stopper", name: "Shot-Stopper", blurb: "Quick hands", stats: { acc: 3, pow: 3, dec: 3, rea: 7, ref: 9 } },
    { id: "reader", name: "Mind Reader", blurb: "Always guesses right", stats: { acc: 4, pow: 4, dec: 4, rea: 9, ref: 4 } },
    { id: "balanced", name: "Balanced", blurb: "A bit of everything", stats: evenValues(SOCCER_KEYS, 5) },
  ],
};
