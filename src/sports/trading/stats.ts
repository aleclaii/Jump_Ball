/* Trading stats. Each one owns one part of how a trader thinks: knowing what a company is worth,
   reading the big picture, sizing bets, keeping a cool head, spotting patterns, and trading cheaply. */

import { evenValues, type StatSheetDef, type StatValues } from "../../data/statSheet";

export const TRADING_KEYS = ["res", "net", "mac", "risk", "disc", "quant", "exec"] as const;
export type TradingStatKey = typeof TRADING_KEYS[number];
export type TradingStats = StatValues<TradingStatKey>;

export const TRADING_SHEET: StatSheetDef<TradingStatKey> = {
  groups: [
    {
      name: "Information",
      stats: [
        { key: "res", name: "Research", abbr: "RES", desc: "Closer guesses of what a company is really worth", vs: "Also sharpens consultant reports" },
        { key: "net", name: "Network", abbr: "NET", desc: "Consultants cost less and know more", vs: "Pairs with Research" },
        { key: "mac", name: "Macro", abbr: "MAC", desc: "Reads the Fed and the market's mood", vs: "Matters most around Fed meetings" },
      ],
    },
    {
      name: "Temperament",
      stats: [
        { key: "risk", name: "Risk Control", abbr: "RSK", desc: "Spreads bets and keeps swings small", vs: "Steadier returns mean a better Sharpe ratio" },
        { key: "disc", name: "Discipline", abbr: "DSC", desc: "Doesn't panic in crashes or chase bubbles", vs: "Beats the herd" },
      ],
    },
    {
      name: "Craft",
      stats: [
        { key: "quant", name: "Quant", abbr: "QNT", desc: "Trades rivals that drift too far apart", vs: "Profits whichever way the market moves" },
        { key: "exec", name: "Execution", abbr: "EXE", desc: "Loses less to trading costs", vs: "Small edges that add up" },
      ],
    },
  ],
  builds: [
    { id: "analyst", name: "Analyst", blurb: "Knows what things are worth", stats: { res: 9, net: 7, mac: 4, risk: 4, disc: 4, quant: 3, exec: 4 } },
    { id: "macro", name: "Macro Trader", blurb: "Trades the Fed and the mood", stats: { res: 4, net: 4, mac: 9, risk: 5, disc: 6, quant: 3, exec: 4 } },
    { id: "quant", name: "Quant", blurb: "Patterns and cheap trades", stats: { res: 3, net: 3, mac: 4, risk: 6, disc: 5, quant: 9, exec: 5 } },
    { id: "steady", name: "Steady Hand", blurb: "Small, careful bets", stats: { res: 4, net: 4, mac: 4, risk: 9, disc: 8, quant: 3, exec: 3 } },
    { id: "balanced", name: "Balanced", blurb: "A bit of everything", stats: evenValues(TRADING_KEYS, 5) },
  ],
};
