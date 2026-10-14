/* Basketball stats. Each one owns one moment of a possession, so no two do the same job,
   and together they cover the whole trip down the floor. */

import { evenValues, type StatSheetDef, type StatValues } from "../../data/statSheet";

export const BASKETBALL_KEYS = ["fin", "mid", "thr", "ft", "han", "pas", "per", "int", "reb", "sta"] as const;
export type BasketballStatKey = typeof BASKETBALL_KEYS[number];
export type BasketballStats = StatValues<BasketballStatKey>;

export const BASKETBALL_SHEET: StatSheetDef<BasketballStatKey> = {
  groups: [
    {
      name: "Scoring",
      stats: [
        { key: "fin", name: "Finishing", abbr: "FIN", desc: "Make layups and dunks", vs: "Countered by Interior Defense" },
        { key: "mid", name: "Mid-Range", abbr: "MID", desc: "Make pull-ups and fadeaways", vs: "Countered by Perimeter Defense" },
        { key: "thr", name: "Three-Point", abbr: "3PT", desc: "Make threes, and take more of them", vs: "Countered by Perimeter Defense" },
        { key: "ft", name: "Free Throws", abbr: "FT", desc: "Make free throws after a foul", vs: "Can't be defended" },
      ],
    },
    {
      name: "Ball control",
      stats: [
        { key: "han", name: "Ball Handling", abbr: "HDL", desc: "Avoid steals, get open shots", vs: "Countered by Perimeter Defense" },
        { key: "pas", name: "Passing", abbr: "PAS", tag: "2v2", desc: "Pass more, set up open shots", vs: "Countered by Perimeter Defense (interceptions)" },
      ],
    },
    {
      name: "Defense",
      stats: [
        { key: "per", name: "Perimeter Defense", abbr: "PER", desc: "Steal, and contest jumpers", vs: "Beats Ball Handling, Passing, Mid-Range, Three-Point" },
        { key: "int", name: "Interior Defense", abbr: "INT", desc: "Block shots, contest the rim", vs: "Beats Finishing" },
      ],
    },
    {
      name: "Hustle",
      stats: [
        { key: "reb", name: "Rebounding", abbr: "REB", desc: "Grab missed shots", vs: "Countered by the other side's Rebounding" },
        { key: "sta", name: "Stamina", abbr: "STA", desc: "Fade less late in long games", vs: "Matters most in Full games and Best of 3" },
      ],
    },
  ],
  builds: [
    { id: "sharp", name: "Sharpshooter", blurb: "Lives at the arc", stats: { fin: 3, mid: 7, thr: 10, ft: 8, han: 5, pas: 3, per: 4, int: 2, reb: 3, sta: 5 } },
    { id: "slasher", name: "Slasher", blurb: "Attacks the rim", stats: { fin: 10, mid: 4, thr: 2, ft: 6, han: 8, pas: 3, per: 4, int: 3, reb: 4, sta: 6 } },
    { id: "general", name: "Floor General", blurb: "Sets up teammates", stats: { fin: 4, mid: 5, thr: 5, ft: 6, han: 8, pas: 10, per: 5, int: 1, reb: 2, sta: 4 } },
    { id: "lockdown", name: "Lockdown", blurb: "Steals and contests", stats: { fin: 4, mid: 4, thr: 3, ft: 4, han: 5, pas: 3, per: 10, int: 6, reb: 5, sta: 6 } },
    { id: "big", name: "Big Man", blurb: "Blocks and boards", stats: { fin: 8, mid: 3, thr: 1, ft: 3, han: 2, pas: 3, per: 3, int: 10, reb: 10, sta: 7 } },
    { id: "balanced", name: "Balanced", blurb: "A bit of everything", stats: evenValues(BASKETBALL_KEYS, 5) },
  ],
};
