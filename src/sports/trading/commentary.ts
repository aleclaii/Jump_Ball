/* Trading calls. Placeholders: {p} the trader acting, {o} their rival, {s} a stock's ticker,
   {f} a consulting firm, {m} an amount of money. */

export const TRADING_LINES = {
  start: ["The opening bell rings. {p} and {o} each start with $100k.", "Markets are open: {p} vs. {o}, $100k each."],
  consult: ["{p} pays {f} {m} for a preview of {s}'s earnings.", "{p} hires {f} ({m}) to dig into {s} before earnings."],
  panic: ["{p} is panic-selling after a losing streak!", "Nerves crack: {p} dumps positions near the lows."],
  buy: ["{p} buys {m} of {s}.", "{p} loads up on {s}: {m}."],
  sell: ["{p} sells {m} of {s}.", "{p} takes {m} off the table in {s}."],
  short: ["{p} shorts {m} of {s}, betting it falls.", "{p} bets against {s}: {m} short."],
  cover: ["{p} covers {m} of a {s} short.", "{p} buys back {m} of {s} to close a short."],
};

export const fillTradingLine = (line: string, values: { p: string; o?: string; s?: string; f?: string; m?: string }): string =>
  line.replace(/\{([posfm])\}/g, (_, key: "p" | "o" | "s" | "f" | "m") => values[key] ?? "");
