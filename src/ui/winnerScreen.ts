/* The winner screen: the answer, a final result card with W and L for each side,
   how it was won, and a recap of each game. */

import { recordWin } from "../data/state";
import type { Side } from "../sports/types";
import { escapeHtml } from "../util/html";
import { $ } from "./dom";
import type { SeriesOutcome } from "./gameScreen";
import { rivalryText } from "./setupScreen";
import { tokenHtml } from "./tokens";

function resultRow(side: Side, won: boolean, wins: number, bestOf: number): string {
  const look = { name: side.choiceName, color: side.color, logo: side.logo };
  const record = bestOf > 1 ? `<span class="result-sub">${wins} ${wins === 1 ? "game" : "games"} won</span>` : "";
  return `<div class="side ${won ? "won" : "lost"}" style="--tc:${side.color}">
    <div class="side-row">
      <div class="tok-slot">${tokenHtml(look, 40)}</div>
      <div class="side-main">
        <span class="result-name">${escapeHtml(side.choiceName)}</span>${record}
      </div>
      <span class="result-badge" aria-label="${won ? "Won" : "Lost"}">${won ? "W" : "L"}</span>
    </div>
  </div>`;
}

export function showWinner(outcome: SeriesOutcome): void {
  const winnerIndex = outcome.winner, loserIndex = winnerIndex === 0 ? 1 : 0;
  const winner = outcome.sides[winnerIndex], loser = outcome.sides[loserIndex];
  recordWin(winner.choiceId, loser.choiceId);

  const last = outcome.games[outcome.games.length - 1];
  const sports = [...new Set(outcome.games.map((g) => g.sport.name))].join(" · ");
  $("#winner-sport").textContent = outcome.bestOf > 1 ? `Best of 3 · ${sports}` : sports;
  $("#winner-name").textContent = winner.choiceName;
  $("#winner-rows").innerHTML = [winnerIndex, loserIndex]
    .map((i) => resultRow(outcome.sides[i], i === winnerIndex, outcome.wins[i], outcome.bestOf))
    .join("");
  $("#winner-how").textContent = outcome.bestOf > 1
    ? `${winner.choiceName} won the series ${outcome.wins[winnerIndex]}–${outcome.wins[loserIndex]} over ${loser.choiceName}.`
    : `${winner.choiceName} beat ${loser.choiceName} at ${last.sport.nameInSentence} ${last.result.how}, ${last.result.score}.`;
  $("#winner-record").innerHTML = rivalryText(outcome.sides[0].choiceId, outcome.sides[1].choiceId);

  $("#game-list").innerHTML = outcome.games.map((game, i) => {
    const gameWinner = outcome.sides[game.result.winner].choiceName;
    const label = outcome.bestOf > 1 ? `Game ${i + 1} · ${game.sport.name}` : game.sport.name;
    const summary = `${escapeHtml(gameWinner)} ${escapeHtml(game.result.how)}, ${escapeHtml(game.result.score)}`;
    const body = game.result.detailsHtml ? `<div class="details-body">${game.result.detailsHtml}</div>` : "";
    return `<li><details ${outcome.games.length === 1 ? "open" : ""}>
      <summary><span>${label}</span><small>${summary}</small></summary>${body}
    </details></li>`;
  }).join("");
}
