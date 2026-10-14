/* Football stats. Each side plays offense on its drive and defense on the other side's,
   so the sheet has one half for each, and each offensive stat has a defensive counter. */

import { evenValues, type StatSheetDef, type StatValues } from "../../data/statSheet";

export const FOOTBALL_KEYS = ["rush", "pass", "sec", "prush", "cov", "rdef"] as const;
export type FootballStatKey = typeof FOOTBALL_KEYS[number];
export type FootballStats = StatValues<FootballStatKey>;

export const FOOTBALL_SHEET: StatSheetDef<FootballStatKey> = {
  groups: [
    {
      name: "Offense",
      stats: [
        { key: "rush", name: "Rushing", abbr: "RSH", desc: "Gain yards on runs", vs: "Countered by Run Defense" },
        { key: "pass", name: "Passing", abbr: "PAS", desc: "Complete short and deep throws", vs: "Countered by Coverage" },
        { key: "sec", name: "Ball Security", abbr: "SEC", desc: "Fewer fumbles and interceptions", vs: "Beats Coverage on interceptions" },
      ],
    },
    {
      name: "Defense",
      stats: [
        { key: "prush", name: "Pass Rush", abbr: "PRU", desc: "Sack the quarterback", vs: "Stops passing plays before they start" },
        { key: "cov", name: "Coverage", abbr: "COV", desc: "Break up passes, pick them off", vs: "Beats Passing" },
        { key: "rdef", name: "Run Defense", abbr: "RDF", desc: "Stuff runs at the line", vs: "Beats Rushing" },
      ],
    },
  ],
  builds: [
    { id: "ground", name: "Ground Game", blurb: "Pounds the rock", stats: { rush: 9, pass: 3, sec: 6, prush: 4, cov: 3, rdef: 5 } },
    { id: "airraid", name: "Air Raid", blurb: "Throws deep", stats: { rush: 3, pass: 9, sec: 5, prush: 4, cov: 5, rdef: 4 } },
    { id: "steady", name: "Steady Hands", blurb: "Never turns it over", stats: { rush: 6, pass: 6, sec: 9, prush: 3, cov: 3, rdef: 3 } },
    { id: "blitz", name: "Blitz", blurb: "Lives in the backfield", stats: { rush: 4, pass: 4, sec: 4, prush: 9, cov: 4, rdef: 5 } },
    { id: "nofly", name: "No-Fly Zone", blurb: "Shuts down passes", stats: { rush: 4, pass: 4, sec: 4, prush: 4, cov: 9, rdef: 5 } },
    { id: "balanced", name: "Balanced", blurb: "A bit of everything", stats: evenValues(FOOTBALL_KEYS, 5) },
  ],
};
