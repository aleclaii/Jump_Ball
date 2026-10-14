/* MMA stats. Each one owns one moment of an exchange: who lands, how hard it hits,
   who takes who down, who avoids it, who absorbs it, and who lasts. */

import { evenValues, type StatSheetDef, type StatValues } from "../../data/statSheet";

export const MMA_KEYS = ["str", "pow", "grp", "def", "chin", "card"] as const;
export type MmaStatKey = typeof MMA_KEYS[number];
export type MmaStats = StatValues<MmaStatKey>;

export const MMA_SHEET: StatSheetDef<MmaStatKey> = {
  groups: [
    {
      name: "Offense",
      stats: [
        { key: "str", name: "Striking", abbr: "STR", desc: "Land jabs and kicks", vs: "Countered by Defense" },
        { key: "pow", name: "Power", abbr: "POW", desc: "Hit harder, rock opponents", vs: "Countered by Chin" },
        { key: "grp", name: "Grappling", abbr: "GRP", desc: "Take them down, win on the ground", vs: "Countered by Defense" },
      ],
    },
    {
      name: "Defense",
      stats: [
        { key: "def", name: "Defense", abbr: "DEF", desc: "Slip strikes, stuff takedowns, counter", vs: "Beats Striking and Grappling" },
        { key: "chin", name: "Chin", abbr: "CHN", desc: "Absorb damage, stay on your feet", vs: "Beats Power" },
      ],
    },
    {
      name: "Conditioning",
      stats: [
        { key: "card", name: "Cardio", abbr: "CRD", desc: "Fade less in later rounds", vs: "Matters most in 3-round fights" },
      ],
    },
  ],
  builds: [
    { id: "brawler", name: "Brawler", blurb: "Heavy hands", stats: { str: 7, pow: 8, grp: 2, def: 3, chin: 6, card: 4 } },
    { id: "wrestler", name: "Wrestler", blurb: "Takes it down", stats: { str: 3, pow: 4, grp: 9, def: 5, chin: 4, card: 5 } },
    { id: "counter", name: "Counter-Striker", blurb: "Makes them miss", stats: { str: 6, pow: 4, grp: 2, def: 9, chin: 4, card: 5 } },
    { id: "tank", name: "Tank", blurb: "Can't be hurt", stats: { str: 4, pow: 6, grp: 3, def: 4, chin: 9, card: 4 } },
    { id: "marathon", name: "Marathoner", blurb: "Wins late", stats: { str: 5, pow: 3, grp: 5, def: 5, chin: 4, card: 8 } },
    { id: "balanced", name: "Balanced", blurb: "A bit of everything", stats: evenValues(MMA_KEYS, 5) },
  ],
};
