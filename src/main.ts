/* Entry point: connects the setup, game, and winner screens. */

import "./styles.css";
import { buildSides, matchRules, saveSettings, state } from "./data/state";
import { withDistinctColors } from "./sports/sides";
import { $ } from "./ui/dom";
import { initGameScreen, startSeries, stopSeries } from "./ui/gameScreen";
import { initOptionEditor } from "./ui/optionEditor";
import { initPlayerEditor } from "./ui/playerEditor";
import { initSetupScreen, renderSetup } from "./ui/setupScreen";
import { showWinner } from "./ui/winnerScreen";

type Screen = "setup" | "game" | "winner";

function show(screen: Screen): void {
  $("#screen-setup").hidden = screen !== "setup";
  $("#screen-game").hidden = screen !== "game";
  $("#screen-winner").hidden = screen !== "winner";
  window.scrollTo(0, 0);
}

function play(): void {
  const rules = matchRules();
  show("game");
  startSeries(withDistinctColors(buildSides()), rules, rules.sport, (outcome) => {
    showWinner(outcome);
    show("winner");
  });
}

function backToSetup(): void {
  stopSeries();
  renderSetup();
  show("setup");
}

/** The logo: from anywhere, stop any game and go back to the Quick tab. */
function goHome(): void {
  state.settings.tab = "quick";
  saveSettings();
  backToSetup();
}

initSetupScreen(play);
initOptionEditor(renderSetup);
initPlayerEditor(renderSetup);
initGameScreen(backToSetup);
$("#again-btn").addEventListener("click", play);
$("#new-btn").addEventListener("click", backToSetup);
$("#home-btn").addEventListener("click", goHome);
renderSetup();
