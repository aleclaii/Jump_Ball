/* Play calls. Placeholders: {o} offense, {d} defense, {y} yards gained, {l} yards lost. */

export const PLAY_LINES = {
  run: ["{o} pounds it up the middle for {y}.", "{o} bounces outside for {y}.", "{o} grinds out {y} on the ground."],
  bigRun: ["{o} BREAKS FREE! {y} yards!", "Nobody touches {o}! A {y}-yard run!"],
  stuffed: ["{o} is stuffed by {d}. No gain.", "{d} meets {o} in the backfield. Loss of {l}."],
  short: ["{o} hits a quick slant for {y}.", "Short pass, {o} picks up {y}.", "{o} dumps it off for {y}."],
  deep: ["BOMB! {o} connects deep for {y}!", "{o} airs it out… CAUGHT! {y} yards!"],
  incomplete: ["Incomplete. {d} breaks it up.", "{o} throws it away. Incomplete.", "Overthrown. Incomplete."],
  sack: ["SACK! {d} drops {o} for a loss of {l}.", "{d} gets home! Sack, loss of {l}."],
  interception: ["INTERCEPTED! {d} jumps the route. Drive over.", "Picked off by {d}! That's the drive."],
  fumble: ["FUMBLE! {d} jumps on it. Drive over.", "{o} coughs it up! {d} recovers."],
  touchdown: ["TOUCHDOWN {o}!", "{o} is IN! Touchdown!"],
};

export const fillPlayLine = (line: string, offense: string, defense: string, yards: number): string =>
  line.replace(/\{o\}/g, offense).replace(/\{d\}/g, defense)
    .replace(/\{y\}/g, `${yards} yard${Math.abs(yards) === 1 ? "" : "s"}`)
    .replace(/\{l\}/g, String(Math.abs(yards)));

const ORDINALS = ["1st", "2nd", "3rd", "4th"];
export const downName = (down: number): string => ORDINALS[down - 1] ?? `${down}th`;
