/* Mini 4X stats. Each one owns one step of an empire's turn: founding cities, growing them,
   researching, attacking, and holding what it has. */

import { evenValues, type StatSheetDef, type StatValues } from "../../data/statSheet";

export const CONQUEST_KEYS = ["exp", "econ", "sci", "mil", "def"] as const;
export type ConquestStatKey = typeof CONQUEST_KEYS[number];
export type ConquestStats = StatValues<ConquestStatKey>;

export const CONQUEST_SHEET: StatSheetDef<ConquestStatKey> = {
  groups: [
    {
      name: "Growth",
      stats: [
        { key: "exp", name: "Expansion", abbr: "EXP", desc: "Found new cities sooner and cheaper", vs: "Wins the land grab before borders meet" },
        { key: "econ", name: "Economy", abbr: "ECO", desc: "Cities grow faster and produce more", vs: "Pays for everything else" },
        { key: "sci", name: "Science", abbr: "SCI", desc: "Reach higher tech: stronger later", vs: "Matters most in long games" },
      ],
    },
    {
      name: "War",
      stats: [
        { key: "mil", name: "Military", abbr: "MIL", desc: "Stronger armies and attacks", vs: "Countered by Defense" },
        { key: "def", name: "Defense", abbr: "DEF", desc: "Cities hold out against attacks", vs: "Beats Military" },
      ],
    },
  ],
  builds: [
    { id: "expansionist", name: "Expansionist", blurb: "Grabs land fast", stats: { exp: 9, econ: 5, sci: 4, mil: 4, def: 3 } },
    { id: "economist", name: "Economist", blurb: "Booming cities", stats: { exp: 4, econ: 9, sci: 4, mil: 4, def: 4 } },
    { id: "scholar", name: "Scholar", blurb: "Out-teches everyone", stats: { exp: 4, econ: 4, sci: 9, mil: 4, def: 4 } },
    { id: "warlord", name: "Warlord", blurb: "Conquers neighbors", stats: { exp: 4, econ: 3, sci: 5, mil: 9, def: 4 } },
    { id: "turtle", name: "Turtle", blurb: "Unbreakable walls", stats: { exp: 3, econ: 4, sci: 5, mil: 4, def: 9 } },
    { id: "balanced", name: "Balanced", blurb: "A bit of everything", stats: evenValues(CONQUEST_KEYS, 5) },
  ],
};
