/* Chess calls. Placeholders: {p} the player moving, {o} the opponent, {m} the move in notation, {x} what was captured. */

export const CHESS_LINES = {
  quiet: ["{p}: {m}.", "{p} plays {m}.", "{m} from {p}."],
  capture: ["{p} takes the {x}. {m}.", "{m}: {p} wins the {x}.", "{p} captures with {m}."],
  bigCapture: ["{p} grabs the {x}! {m}.", "Huge: {p} takes the {x} with {m}!"],
  check: ["{m}, check! {o}'s king has to move.", "Check from {p}: {m}."],
  castle: ["{p} castles. Safe king.", "{p} tucks the king away: {m}."],
  promotion: ["{p} promotes a pawn! {m}.", "New queen for {p}: {m}."],
  fork: ["Fork! {p} hits two pieces at once with {m}.", "{m}: a fork from {p}!"],
  blunder: ["{p} is rattled by the clock… {m}?!", "A nervous {m} from {p}."],
  mate: ["CHECKMATE! {m}. {p} wins.", "{m} is mate! {p} takes it."],
};

export const PIECE_NAMES: Record<number, string> = { 1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king" };

export const fillChessLine = (line: string, values: { p: string; o: string; m: string; x: string }): string =>
  line.replace(/\{([pomx])\}/g, (_, key: "p" | "o" | "m" | "x") => values[key]);
