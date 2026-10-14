import { describe, expect, it } from "vitest";
import { buildValues, ratingToStat } from "../../data/sheets";
import { evenValues } from "../../data/statSheet";
import { DriveContest, rollPlay, START_YARDS } from "./engine";
import { FOOTBALL_KEYS, type FootballStats } from "./stats";

const team = (rating: number): FootballStats => evenValues(FOOTBALL_KEYS, ratingToStat(rating));
const build = (id: string) => buildValues("football", id) as FootballStats;

/** How often each outcome happens over many snaps from the opponent's 40. */
function playRates(offense: FootballStats, defense: FootballStats, snaps = 5000) {
  const counts: Record<string, number> = {};
  let runYards = 0, runs = 0;
  for (let i = 0; i < snaps; i++) {
    const play = rollPlay(0, offense, defense, 99);
    counts[play.outcome] = (counts[play.outcome] ?? 0) + 1;
    if (play.kind === "run" && play.outcome === "gain") {
      runYards += play.yards;
      runs++;
    }
  }
  const rate = (outcome: string) => (counts[outcome] ?? 0) / snaps;
  return { rate, yardsPerRun: runYards / runs };
}

describe("football engine", () => {
  it("never gains more yards than are left to the goal line", () => {
    for (let i = 0; i < 3000; i++) {
      const play = rollPlay(0, team(70), team(70), 12);
      expect(play.yards).toBeLessThanOrEqual(12);
      if (play.yards === 12 && play.outcome !== "fumble") expect(play.outcome).toBe("touchdown");
    }
  });

  it("gives each side the same number of drives, and the winner more touchdowns or more yards", () => {
    for (let i = 0; i < 500; i++) {
      const game = new DriveContest([team(70), team(70)], 1);
      game.playOut();
      expect(game.drivesTaken[0]).toBe(game.drivesTaken[1]);
      const w = game.winner, l = w === 0 ? 1 : 0;
      if (game.wonByTouchdowns()) expect(game.touchdowns[w]).toBeGreaterThan(game.touchdowns[l]);
      else expect(game.yards[w]).toBeGreaterThan(game.yards[l]);
    }
  });

  it("scores a touchdown on some drives but not most", () => {
    let touchdowns = 0, drives = 0;
    for (let i = 0; i < 1000; i++) {
      const game = new DriveContest([team(70), team(70)], 1);
      game.playOut();
      touchdowns += game.touchdowns[0] + game.touchdowns[1];
      drives += game.drivesTaken[0] + game.drivesTaken[1];
    }
    expect(touchdowns / drives).toBeGreaterThan(.1);
    expect(touchdowns / drives).toBeLessThan(.6);
  });

  it("starts every drive at the opponent's 40 with first down", () => {
    const game = new DriveContest([team(70), team(70)], 2);
    expect(game.yardsToGoal).toBe(START_YARDS);
    while (!game.done) {
      const before = game.drivesTaken[0] + game.drivesTaken[1];
      game.apply(game.next());
      if (game.drivesTaken[0] + game.drivesTaken[1] > before && !game.done) {
        expect(game.yardsToGoal).toBe(START_YARDS);
        expect(game.down).toBe(1);
      }
    }
  });

  it("is close to a coin flip between equal sides, and favors the better-rated side", () => {
    const winRate = (teams: [FootballStats, FootballStats]) => {
      let firstWins = 0;
      for (let i = 0; i < 2000; i++) {
        const game = new DriveContest(teams, 1);
        game.playOut();
        if (game.winner === 0) firstWins++;
      }
      return firstWins / 2000;
    };
    const even = winRate([team(70), team(70)]);
    expect(even).toBeGreaterThan(.44);
    expect(even).toBeLessThan(.56);
    expect(winRate([team(85), team(60)])).toBeGreaterThan(.6);
  });

  it("lets a Blitz defense get more sacks than a No-Fly Zone", () => {
    const offense = team(70);
    expect(playRates(offense, build("blitz")).rate("sack")).toBeGreaterThan(playRates(offense, build("nofly")).rate("sack") * 1.5);
  });

  it("lets a No-Fly Zone defense break up and pick off more passes than a Blitz", () => {
    const offense = team(70);
    const nofly = playRates(offense, build("nofly")), blitz = playRates(offense, build("blitz"));
    expect(nofly.rate("incomplete") + nofly.rate("interception")).toBeGreaterThan(blitz.rate("incomplete") + blitz.rate("interception"));
  });

  it("gains more per run with a Ground Game against a weak run defense", () => {
    const weakRunDefense = build("airraid");
    expect(playRates(build("ground"), weakRunDefense).yardsPerRun).toBeGreaterThan(playRates(build("airraid"), weakRunDefense).yardsPerRun + 1);
  });

  it("fumbles less with Steady Hands", () => {
    const defense = team(70);
    expect(playRates(build("steady"), defense, 20000).rate("fumble")).toBeLessThan(playRates(build("blitz"), defense, 20000).rate("fumble"));
  });
});
