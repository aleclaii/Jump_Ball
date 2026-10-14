/* Play-by-play lines. Placeholders: {o} shooter, {h} passer, {d} the shooter's defender,
   {s} who stole it, {r} rebounder. */

export const LINES = {
  open: {
    three: ["{o} is wide open from deep…", "{o} gets a clean look from three…"],
    mid: ["{o} has room at the elbow…", "{o} pulls up, nobody close…"],
    rim: ["{o} gets a clear lane to the rim!", "{o} blows right past {d}!"],
  },
  contested: {
    three: ["{o} fires over {d}'s hand…", "{o} steps back, {d} right there…"],
    mid: ["{o} rises over {d}…", "{o} with the tough fadeaway on {d}…"],
    rim: ["{o} attacks {d} at the rim!", "{o} drives right into {d}!"],
  },
  pass: {
    open: ["{h} finds {o} wide open…", "{h} kicks it out to {o}…"],
    contested: ["{h} swings it to {o}, {d} closing out…", "{h} hits {o}, {d} flies out…"],
  },
  make: {
    three: ["SPLASH! Three for {o}.", "Bang! {o} from way downtown.", "Wet. {o} buries the three."],
    mid: ["Money. {o} hits the jumper.", "Nothing but net for {o}.", "{o} drains it."],
    rim: ["{o} throws it DOWN!", "{o} finishes strong at the rim.", "Up and under. {o} scores."],
  },
  makeContested: ["Tough shot, and it goes! {o} over {d}.", "Contested and it STILL drops for {o}!"],
  andOne: ["AND ONE! {o} scores through the foul by {d}.", "{o} takes the hit from {d} and finishes! Free throw coming."],
  fouled: ["Foul on {d}! {o} heads to the line for two.", "{d} hacks {o} on the way up. Two free throws."],
  oreb: ["Off the rim, but {r} grabs the offensive board!", "Rattles out. {r} keeps it alive!"],
  dreb: ["Off the rim. {r} cleans it up.", "No good. {r} with the rebound.", "Rims out. {r} secures it."],
  block: ["REJECTED! {d} swats it away!", "{d} says not in here! Blocked!"],
  steal: ["Stolen! {s} picks {h}'s pocket.", "{h} loses the handle. {s} takes it.", "Turnover! {s} rips it away from {h}."],
  intercept: ["Picked off! {s} jumps the passing lane.", "{h} tries to pass, {s} reads it and steals it!"],
};

export interface LineNames {
  o: string;
  h: string;
  d: string;
  s: string;
  r: string;
}

export const fillLine = (line: string, names: LineNames): string =>
  line.replace(/\{([ohdsr])\}/g, (_, key: keyof LineNames) => names[key]);
