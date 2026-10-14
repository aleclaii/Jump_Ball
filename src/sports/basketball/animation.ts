/* Where every player and the ball are at each moment of a possession.
   Roles: H = ball handler, S = shooter (H, or the teammate after a pass). Defender slot i guards offense slot i. */

import { clamp, easeInOut as ease, lerp, lerpPoint, rand, type Point } from "../../util/math";
import type { SideIndex } from "../types";
import { CHECK, FT_SPOT, GUARD, RIM } from "./court";
import { FT_TIME, FT_WALK, type Possession } from "./engine";

export type Ball = Point & { h: number };

export interface Pose {
  /** Positions, [side][slot]. */
  P: Point[][];
  /** Jump height 0-1, [side][slot]. */
  J: number[][];
  B: Ball;
}

export interface PossessionPlan {
  p: Possession;
  o: SideIndex;
  d: SideIndex;
  H: number;
  S: number;
  T: number | null;
  wing: Point;
  spot: Point;
  dist: number;
  guardEnd: Point;
  passPt: Point;
  passGuard: Point;
  contested: boolean;
  finish: Point;
  reb: Point;
  deflect: Point;
  stealRun: Point;
  wiggle: number;
  start: Point[][];
  startBall: Ball;
  /** Commentary already given for this possession. */
  called: boolean;
  resolved: boolean;
  ftDone: number;
  cache: { driveEnd?: Pose; flightEnd?: Pose; afterEnd?: Pose };
}

export function planPossession(p: Possession, positions: Point[][], ball: Ball, playersPerSide: number): PossessionPlan {
  const o = p.off, d: SideIndex = o === 0 ? 1 : 0;
  const side = Math.random() < .5 ? -1 : 1;
  const wing = { x: 25 + side * 17, y: 16 };
  let dist: number;
  if (p.kind === "turnover") dist = rand(14, 22);
  else dist = p.shot === "three" ? rand(24, 25.5) : p.shot === "mid" ? rand(10, 17) : rand(2.6, 3.8);
  const angle = p.passed ? side * rand(.5, 1.2) : rand(-1.2, 1.2);
  const spot = { x: clamp(RIM.x + Math.sin(angle) * dist, 2.5, 47.5), y: clamp(RIM.y + Math.cos(angle) * dist, 2.5, 44) };
  const dx = RIM.x - spot.x, dy = RIM.y - spot.y, len = Math.hypot(dx, dy) || 1;
  const toRim = { x: dx / len, y: dy / len };
  const perp = { x: -toRim.y, y: toRim.x };
  const along = (P: Point, forward: number, sideways = 0): Point =>
    ({ x: P.x + toRim.x * forward + perp.x * sideways, y: P.y + toRim.y * forward + perp.y * sideways });
  const contested = p.contested || p.kind === "block";
  let guardEnd: Point;
  if (p.kind === "turnover") guardEnd = along(spot, 1.8);
  else if (p.shot === "rim") guardEnd = contested ? along(lerpPoint(spot, RIM, .4), 0, 1.8) : along(spot, -2.5, 1.5);
  else guardEnd = contested ? along(spot, 2.6) : along(spot, 6.5, 2.5);
  const passPt = { x: 25 + side * 4, y: 24 };
  const passLen = Math.hypot(RIM.x - passPt.x, RIM.y - passPt.y);
  return {
    p, o, d, H: p.handler, S: p.shooter, T: playersPerSide > 1 ? 1 - p.handler : null,
    wing, spot, dist: len, guardEnd, passPt, contested,
    passGuard: { x: passPt.x + (RIM.x - passPt.x) / passLen * 2.4, y: passPt.y + (RIM.y - passPt.y) / passLen * 2.4 },
    finish: { x: RIM.x - toRim.x * 1.6, y: RIM.y - toRim.y * 1.6 + .6 },
    reb: { x: clamp(RIM.x + rand(-9, 9), 4, 46), y: RIM.y + rand(4, 11) },
    deflect: { x: clamp(RIM.x + rand(-11, 11), 3, 47), y: rand(11, 18) },
    stealRun: { x: clamp(spot.x + rand(-3, 3), 4, 46), y: clamp(spot.y + 5, 10, 42) },
    wiggle: rand(1.4, 3) * (Math.random() < .5 ? -1 : 1),
    start: positions.map((team) => team.map((P) => ({ ...P }))),
    startBall: { ...ball },
    called: false,
    resolved: false,
    ftDone: 0,
    cache: {},
  };
}

const dribble = (P: Point, t: number): Ball => ({ x: P.x + .95, y: P.y + .35, h: .25 + 1.1 * Math.abs(Math.sin(t * 8)) });
const holding = (P: Point): Ball => ({ x: P.x + .95, y: P.y + .35, h: 1.3 });
const noJumps = (): number[][] => [[0, 0], [0, 0]];
const copyPose = (pose: Pose): Pose => ({
  P: pose.P.map((team) => team.map((pt) => ({ ...pt }))),
  J: noJumps(),
  B: { ...pose.B },
});

export function poseAt(pl: PossessionPlan, t: number): Pose {
  const { p, o, d, H, S, T } = pl;
  const tDrive = p.reset, tShot = tDrive + p.drive, tAfter = tShot + p.flight, tFT = tAfter + p.after;

  if (t < tDrive) {
    // Everyone walks back to their starting spots.
    const k = ease(t / p.reset);
    const P: Point[][] = [[], []];
    const target = (team: number, slot: number): Point => {
      if (team === o) return slot === H ? CHECK : pl.wing;
      return slot === H ? GUARD : lerpPoint(pl.wing, RIM, .25);
    };
    pl.start.forEach((team, ti) => team.forEach((pt, si) => { P[ti][si] = lerpPoint(pt, target(ti, si), k); }));
    const hb = dribble(P[o][H], t), sb = pl.startBall;
    return { P, J: noJumps(), B: { x: lerp(sb.x, hb.x, k), y: lerp(sb.y, hb.y, k), h: lerp(sb.h, hb.h, k) } };
  }

  if (t < tShot) {
    // The drive, and the pass in 2v2.
    const k = (t - tDrive) / p.drive;
    const P: Point[][] = [[], []];
    const helpStart = lerpPoint(pl.wing, RIM, .25);
    let B: Ball;
    if (!p.passed) {
      const e = ease(k);
      const hp = lerpPoint(CHECK, pl.spot, e);
      hp.x += Math.sin(Math.PI * e) * pl.wiggle;
      P[o][H] = hp;
      P[d][H] = lerpPoint(GUARD, pl.guardEnd, ease(Math.min(1, k * 1.15)));
      if (T !== null) {
        P[o][T] = lerpPoint(pl.wing, { x: pl.wing.x, y: pl.wing.y - 2.5 }, ease(k));
        P[d][T] = lerpPoint(helpStart, lerpPoint(pl.wing, RIM, .4), ease(k));
      }
      B = dribble(hp, t);
    } else {
      const passK = .5, kp = Math.min(1, k / passK);
      P[o][H] = lerpPoint(CHECK, pl.passPt, ease(kp));
      P[d][H] = lerpPoint(GUARD, pl.passGuard, ease(kp));
      P[o][S] = lerpPoint(pl.wing, pl.spot, ease(k));
      P[d][S] = lerpPoint(helpStart, pl.guardEnd, ease(clamp((k - .3) / .6, 0, 1)));
      if (k < passK) B = dribble(P[o][H], t);
      else if (k < passK + .22) {
        const kk = (k - passK) / .22, from = holding(P[o][H]), to = holding(P[o][S]);
        B = { x: lerp(from.x, to.x, kk), y: lerp(from.y, to.y, kk), h: 1.3 + Math.sin(Math.PI * kk) * .6 };
      } else B = holding(P[o][S]);
    }
    return { P, J: noJumps(), B };
  }

  if (t < tAfter) {
    // The shot in the air.
    const base = pl.cache.driveEnd ?? (pl.cache.driveEnd = poseAt(pl, tShot - 1e-4));
    const pose = copyPose(base), P = pose.P, J = pose.J;
    const k = (t - tShot) / p.flight;
    if (p.shot === "rim") {
      P[o][S] = lerpPoint(pl.spot, pl.finish, ease(k));
      J[o][S] = Math.sin(Math.PI * k);
      P[d][S] = lerpPoint(base.P[d][S], lerpPoint(base.P[d][S], pl.finish, .5), ease(k));
      J[d][S] = (pl.contested ? 1 : .3) * Math.sin(Math.PI * Math.min(1, k * 1.2));
    } else {
      P[o][S] = { ...pl.spot };
      J[o][S] = Math.sin(Math.PI * Math.min(1, k * 1.6));
      J[d][S] = pl.contested ? .75 * Math.sin(Math.PI * Math.min(1, k * 1.4)) : 0;
    }
    const shooter = P[o][S];
    if (p.kind === "block" && k > .45) {
      const kk = (k - .45) / .55, M = lerpPoint(shooter, RIM, .45);
      pose.B = { x: lerp(M.x, pl.deflect.x, kk), y: lerp(M.y, pl.deflect.y, kk), h: lerp(3, .4, kk) + Math.sin(Math.PI * kk) * 1.2 };
    } else if (p.shot === "rim") {
      const kb = p.kind === "block" ? k : k * k;
      pose.B = { x: lerp(shooter.x + .6, RIM.x, kb), y: lerp(shooter.y, RIM.y, kb), h: 2 + 1.1 * k };
    } else {
      pose.B = { x: lerp(pl.spot.x, RIM.x, k), y: lerp(pl.spot.y, RIM.y, k), h: lerp(2.4, 3.05, k) + Math.sin(Math.PI * k) * (2 + pl.dist * .22) };
    }
    return pose;
  }

  if (t < tFT || !p.ftTime) return afterShot(pl, t, tAfter);
  return freeThrows(pl, t, tFT);
}

/** After the shot (or the steal): the make, miss, block, or rebound plays out. */
function afterShot(pl: PossessionPlan, t: number, tAfter: number): Pose {
  const { p, o, d, H, S } = pl;
  const s = pl.cache.flightEnd ?? (pl.cache.flightEnd = poseAt(pl, tAfter - 1e-4));
  const pose = copyPose(s), P = pose.P;
  const k = Math.min(1, (t - tAfter) / p.after);
  const drift = (team: number, slot: number, target: Point, amount: number) => {
    P[team][slot] = lerpPoint(s.P[team][slot], lerpPoint(s.P[team][slot], target, amount), ease(k));
  };
  if (p.kind === "turnover") {
    const st = p.stealer ?? 0;
    P[d][st] = lerpPoint(s.P[d][st], pl.stealRun, ease(k));
    drift(o, H, { x: s.P[o][H].x, y: s.P[o][H].y + 4 }, .4);
    if (k < .3) {
      const hb = dribble(P[d][st], t), kk = k / .3;
      pose.B = { x: lerp(s.B.x, hb.x, kk), y: lerp(s.B.y, hb.y, kk), h: lerp(s.B.h, hb.h, kk) };
    } else pose.B = dribble(P[d][st], t);
  } else if (p.made) {
    pose.B = { x: RIM.x, y: lerp(RIM.y, RIM.y + 1.2, k), h: Math.max(.25, 3.05 * Math.pow(1 - k, 2) + Math.abs(Math.sin(k * 9)) * .6 * (1 - k)) };
    drift(o, S, { x: s.P[o][S].x, y: s.P[o][S].y + 3 }, .55);
  } else if (p.fouled) {
    pose.B = { x: lerp(RIM.x, RIM.x + 1.5, k), y: lerp(RIM.y, RIM.y + 2.5, k), h: Math.max(.25, 3 * (1 - k) + Math.abs(Math.sin(k * 9)) * .4 * (1 - k)) };
  } else if (p.kind === "block") {
    const target = { x: pl.deflect.x - .95, y: pl.deflect.y - .35 };
    P[d][S] = lerpPoint(s.P[d][S], target, ease(Math.min(1, k / .7)));
    drift(o, S, target, .35);
    pose.B = k < .7 ? { x: pl.deflect.x, y: pl.deflect.y, h: Math.abs(Math.sin(k * 10)) * .7 * (1 - k) + .2 } : dribble(P[d][S], t);
  } else {
    const rTeam = p.oreb ? o : d, rSlot = p.rebounder ?? 0;
    const target = { x: pl.reb.x - .95, y: pl.reb.y - .35 };
    const kr = ease(Math.min(1, k / .6));
    s.P.forEach((team, ti) => team.forEach((pt, si) => {
      P[ti][si] = ti === rTeam && si === rSlot ? lerpPoint(pt, target, kr) : lerpPoint(pt, lerpPoint(pt, target, .35), kr);
    }));
    if (k < .55) {
      const kk = k / .55;
      pose.B = { x: lerp(RIM.x, pl.reb.x, kk), y: lerp(RIM.y, pl.reb.y, kk), h: lerp(3, 1, kk) + Math.sin(Math.PI * kk) * 1.6 };
    } else pose.B = dribble(P[rTeam][rSlot], t);
  }
  return pose;
}

/** Free throws: everyone lines up on the lane and the shooter takes them from the line. */
function freeThrows(pl: PossessionPlan, t: number, tFT: number): Pose {
  const { p, o, S } = pl;
  const s = pl.cache.afterEnd ?? (pl.cache.afterEnd = poseAt(pl, tFT - 1e-4));
  const pose = copyPose(s), P = pose.P;
  const lane = [[{ x: 31.5, y: 15 }, { x: 18.5, y: 15 }], [{ x: 31.5, y: 10 }, { x: 18.5, y: 10 }]];
  const walk = ease(Math.min(1, (t - tFT) / FT_WALK));
  s.P.forEach((team, ti) => team.forEach((pt, si) => {
    const target = ti === o && si === S ? FT_SPOT : lane[ti === o ? 0 : 1][ti === o ? 0 : si === S ? 0 : 1];
    P[ti][si] = lerpPoint(pt, target, walk);
  }));
  const tt = t - tFT - FT_WALK;
  if (tt < 0) {
    pose.B = { x: lerp(s.B.x, FT_SPOT.x + .95, walk), y: lerp(s.B.y, FT_SPOT.y + .35, walk), h: lerp(s.B.h, 1.3, walk) };
    return pose;
  }
  const i = Math.min(p.fts.length - 1, Math.floor(tt / FT_TIME));
  const kk = Math.min(1, (tt - i * FT_TIME) / FT_TIME);
  const from = holding(FT_SPOT);
  if (kk < .55) {
    const kf = kk / .55;
    pose.B = { x: lerp(from.x, RIM.x, kf), y: lerp(from.y, RIM.y, kf), h: lerp(1.6, 3.05, kf) + Math.sin(Math.PI * kf) * 4.5 };
  } else {
    const kr = (kk - .55) / .45;
    pose.B = p.fts[i]
      ? { x: RIM.x, y: lerp(RIM.y, RIM.y + 1.2, kr), h: Math.max(.25, 3.05 * (1 - kr) * (1 - kr)) }
      : { x: lerp(RIM.x, RIM.x + 3, kr), y: lerp(RIM.y, RIM.y + 3.5, kr), h: Math.max(.25, 3 * (1 - kr) + Math.sin(Math.PI * kr) * 1.2) };
  }
  return pose;
}

/** Where players stand for the opening jump ball. */
export function tipOffPositions(playersPerSide: number, first: SideIndex): Point[][] {
  const pos: Point[][] = [[], []];
  const other = first === 0 ? 1 : 0;
  pos[first][0] = { x: 24, y: 40 };
  pos[other][0] = { x: 26, y: 44 };
  if (playersPerSide > 1) {
    pos[first][1] = { x: 15, y: 36 };
    pos[other][1] = { x: 35, y: 36 };
  }
  return pos;
}
