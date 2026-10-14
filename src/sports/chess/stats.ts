/* Chess stats. Each one owns one part of how a move gets chosen or one stage of the game:
   the opening, seeing tactics, looking ahead, the endgame, and holding nerve as the move cap nears. */

import { evenValues, type StatSheetDef, type StatValues } from "../../data/statSheet";

export const CHESS_KEYS = ["open", "tac", "calc", "end", "comp"] as const;
export type ChessStatKey = typeof CHESS_KEYS[number];
export type ChessStats = StatValues<ChessStatKey>;

export const CHESS_SHEET: StatSheetDef<ChessStatKey> = {
  groups: [
    {
      name: "Stages of the game",
      stats: [
        { key: "open", name: "Opening", abbr: "OPN", desc: "Play the first moves well", vs: "Matters most in the first 8 moves" },
        { key: "end", name: "Endgame", abbr: "END", desc: "Convert once most pieces are gone", vs: "Matters most once the queens or most pieces are off" },
      ],
    },
    {
      name: "Thinking",
      stats: [
        { key: "tac", name: "Tactics", abbr: "TAC", desc: "See captures and trades through to the end", vs: "Punishes low Tactics: hung pieces, lost trades" },
        { key: "calc", name: "Calculation", abbr: "CAL", desc: "Look further ahead", vs: "Sees the opponent's reply before moving" },
      ],
    },
    {
      name: "Nerve",
      stats: [
        { key: "comp", name: "Composure", abbr: "CMP", desc: "Fewer blunders as the move cap nears", vs: "Matters most in the last quarter of the game" },
      ],
    },
  ],
  builds: [
    { id: "tactician", name: "Tactician", blurb: "Sees every trick", stats: { open: 4, tac: 9, calc: 5, end: 3, comp: 4 } },
    { id: "calculator", name: "Calculator", blurb: "Thinks ahead", stats: { open: 4, tac: 4, calc: 9, end: 4, comp: 4 } },
    { id: "bookworm", name: "Book Worm", blurb: "Knows the openings", stats: { open: 9, tac: 4, calc: 4, end: 4, comp: 4 } },
    { id: "grinder", name: "Grinder", blurb: "Wins endgames", stats: { open: 3, tac: 4, calc: 5, end: 9, comp: 4 } },
    { id: "icecold", name: "Ice Cold", blurb: "Never panics", stats: { open: 4, tac: 4, calc: 4, end: 4, comp: 9 } },
    { id: "balanced", name: "Balanced", blurb: "A bit of everything", stats: evenValues(CHESS_KEYS, 5) },
  ],
};
