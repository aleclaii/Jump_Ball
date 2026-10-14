/* Penalty calls. Placeholders: {s} shooter, {k} keeper. */

export const KICK_LINES = {
  setup: ["{s} places the ball. {k} bounces on the line.", "{s} steps up. {k} stares them down.", "{s} takes a deep breath…"],
  goalLow: ["{s} slots it into the bottom corner!", "GOAL! {s} sends {k} the wrong way."],
  goalHigh: ["Top corner! {s} buries it!", "Into the roof of the net! {s} scores!"],
  goalMiddle: ["{s} goes right down the middle. Ice cold. GOAL!"],
  save: ["SAVED! {k} guesses right!", "What a stop by {k}!", "{k} gets a strong hand to it. Saved!"],
  over: ["{s} blasts it over the bar!", "Way too high from {s}."],
  wide: ["{s} drags it wide!", "Wide! {s} can't believe it."],
  post: ["OFF THE POST! So close for {s}.", "It rattles the woodwork! No goal for {s}."],
};

export const fillKickLine = (line: string, shooter: string, keeper: string): string =>
  line.replace(/\{s\}/g, shooter).replace(/\{k\}/g, keeper);
