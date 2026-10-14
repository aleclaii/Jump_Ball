/* The setup screen: Quick, Creative, Competition, and Strategy tabs, match options, and projected odds. */

import {
  addChoice, buildSides, choiceById, choiceByName, cleanName, competitionReady, ensureCompetition, ensureMatchup,
  ensureStrategyPlayers, matchRules, matchupChoiceIds, optionsPlay, personById, playersPerSide, rivalryRecord, saveChoices,
  saveSettings, state, type Settings,
} from "../data/state";
import { SHEETS, type StatSheets } from "../data/sheets";
import { buildNameOf, topStatsOf, type StatValues } from "../data/statSheet";
import { ROTATION, sportById, STRATEGY_GAMES } from "../sports";
import { practiceRuns, projectOdds } from "../sports/odds";
import type { SportId } from "../sports/types";
import { escapeHtml } from "../util/html";
import { attachChoicePicker } from "./choicePicker";
import { $, onSegment, setSegment } from "./dom";
import { renderOptionList } from "./optionEditor";
import { buildsSummary, renderPlayerList } from "./playerEditor";
import { paintTeamColor, tokenHtml } from "./tokens";

type SideKey = "homeId" | "awayId";

interface CreativeSide {
  el: HTMLElement;
  input: HTMLInputElement;
  range: HTMLInputElement;
  key: SideKey;
}

const creativeSides: CreativeSide[] = (["home", "away"] as const).map((name) => ({
  el: $(`[data-side="${name}"]`),
  input: $<HTMLInputElement>(`#pick-${name}`),
  range: $<HTMLInputElement>(`#ovr-${name}`),
  key: name === "home" ? "homeId" : "awayId",
}));

const tier = (ovr: number): string => (ovr >= 88 ? "MVP" : ovr >= 75 ? "All-Star" : ovr >= 60 ? "Starter" : "Bench");
const ppg = (ovr: number): number => Math.round(5 + (ovr - 40) * 0.45);

export function rivalryText(aId: string, bId: string): string {
  const a = choiceById(aId), b = choiceById(bId);
  if (!a || !b) return "";
  const record = rivalryRecord(aId, bId);
  if (!record) return `First meeting between ${escapeHtml(a.name)} and ${escapeHtml(b.name)}.`;
  const [aw, bw] = record;
  if (aw === bw) return `All-time record tied <b>${aw}–${bw}</b>.`;
  const leader = aw > bw ? a : b;
  return `<b>${escapeHtml(leader.name)}</b> leads the all-time record <b>${Math.max(aw, bw)}–${Math.min(aw, bw)}</b>.`;
}

function showRating(side: CreativeSide, ovr: number): void {
  $(".ovr-n", side.el).textContent = String(ovr);
  $(".tier", side.el).textContent = tier(ovr);
  $(".ppg", side.el).textContent = `plays like a ${ppg(ovr)} ppg scorer`;
}

function renderCreativeSide(side: CreativeSide): void {
  const c = choiceById(state.settings[side.key])!;
  paintTeamColor(side.el, c.color);
  $(".tok-slot", side.el).innerHTML = tokenHtml(c, 40);
  if (document.activeElement !== side.input) side.input.value = c.name;
  $(".rating", side.el).hidden = !optionsPlay() || matchRules().fair;
  side.range.value = String(c.ovr);
  showRating(side, c.ovr);
  renderStrategyPlayer(side);
}

/** Strategy tab, played by players: who plays for this option, and their build for the chosen game. */
function renderStrategyPlayer(side: CreativeSide): void {
  const slotEl = $(".strategy-player", side.el);
  const s = state.settings;
  slotEl.hidden = !(s.tab === "strategy" && s.strategyBy === "players");
  if (slotEl.hidden) return;
  const slot = side.key === "homeId" ? 0 : 1;
  const person = personById(s.strategyPlayers[slot])!;
  const options = state.people.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  slotEl.innerHTML = `<div class="player-line">
      <label class="who" for="sp-${slot}">Player</label>
      <div class="pl-row">${tokenHtml(person, 26)}<select id="sp-${slot}" data-strategy-slot="${slot}">${options}</select></div>
      ${buildHtml(person.sheets, s.strategyGame)}
    </div>`;
  $<HTMLSelectElement>(`#sp-${slot}`, slotEl).value = person.id;
}

/** A player's build for one sport, or one build per sport when the sport is random. */
function buildHtml(sheets: StatSheets, sport: SportId | "random" = state.settings.sport): string {
  if (sport === "random") return `<div class="build"><span class="build-all">${escapeHtml(buildsSummary(sheets))}</span></div>`;
  const sheet = SHEETS[sport], values = sheets[sport] as StatValues;
  const chips = topStatsOf(sheet, values, 3).map((s) => `<span class="chip">${s.abbr} ${values[s.key]}</span>`).join("");
  return `<div class="build"><span class="build-name">${escapeHtml(buildNameOf(sheet, values))}</span><span class="chips">${chips}</span></div>`;
}

function renderCompetitionSide(el: HTMLElement, key: "home" | "away"): void {
  const side = state.settings.comp[key], choice = choiceById(side.choice)!, count = playersPerSide();
  const personOptions = state.people.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  paintTeamColor(el, choice.color);
  let players = "";
  for (let i = 0; i < count; i++) {
    const person = personById(side.players[i] ?? null);
    const label = count > 1 ? `Player ${i + 1}` : "Player";
    players += person
      ? `<div class="player-line">
           <label class="who" for="cp-${key}-${i}">${label}</label>
           <div class="pl-row">${tokenHtml(person, 26)}<select id="cp-${key}-${i}" data-player="${key}" data-slot="${i}">${personOptions}</select></div>
           ${buildHtml(person.sheets)}
         </div>`
      : `<p class="hint">Add more players below for 2v2.</p>`;
  }
  el.innerHTML = `
    <div class="side-row">
      <div class="tok-slot">${tokenHtml(choice, 40)}</div>
      <div class="side-main">
        <label class="sr" for="cc-${key}">Playing for</label>
        <input class="name-in" id="cc-${key}" data-choice="${key}" maxlength="24" autocomplete="off" placeholder="Type an option" value="${escapeHtml(choice.name)}">
        <div class="odds-bar" aria-hidden="true"><span></span></div>
      </div>
      <span class="chance"><b></b><small>win chance</small></span>
    </div>
    <p class="side-error" id="cc-${key}-err" aria-live="polite"></p>
    <div class="players">${players}</div>`;
  const other = key === "home" ? "away" : "home";
  attachChoicePicker($<HTMLInputElement>(`#cc-${key}`, el), {
    excludedId: () => state.settings.comp[other].choice,
    currentId: () => state.settings.comp[key].choice,
    onPick: (id) => {
      state.settings.comp[key].choice = id;
      saveSettings();
      renderSetup();
    },
  });
  for (let i = 0; i < count; i++) {
    const select = el.querySelector<HTMLSelectElement>(`#cp-${key}-${i}`);
    if (select) select.value = side.players[i] ?? "";
  }
}

function renderGamePicker(): void {
  const group = $("#seg-game");
  if (!group.childElementCount) group.innerHTML = STRATEGY_GAMES.map((g) => `<button type="button" data-v="${g.id}">${g.name}</button>`).join("");
  if (!STRATEGY_GAMES.some((g) => g.id === state.settings.strategyGame)) state.settings.strategyGame = STRATEGY_GAMES[0].id;
  setSegment(group, state.settings.strategyGame);
}

function renderSportPicker(): void {
  const group = $("#seg-sport");
  if (!group.childElementCount) {
    group.innerHTML = `<button type="button" data-v="random">Random</button>`
      + ROTATION.map((s) => `<button type="button" data-v="${s.id}">${s.name}</button>`).join("");
  }
  setSegment(group, state.settings.sport);
  const s = state.settings, pickId = matchRules().sport;
  const lengthOf = (id: SportId) => { const sport = sportById(id); return `${sport.name}: ${s.length === "full" ? sport.lengths.full : sport.lengths.quick}`; };
  const lengths = pickId === "random" ? ROTATION.map((sport) => lengthOf(sport.id)).join(" · ") : lengthOf(pickId);
  $("#length-hint").textContent = lengths;
}

function matchSummary(): string {
  const rules = matchRules();
  const sport = rules.sport === "random" ? "Random sport" : sportById(rules.sport).name;
  const length = rules.bestOf === 3 ? "Best of 3" : rules.full ? "Full game" : "Quick game";
  return `${sport} · ${length}`;
}

export function renderSetup(): void {
  const s = state.settings;
  const quick = s.tab === "quick", competition = s.tab === "competition", strategy = s.tab === "strategy";
  const strategyPlayers = strategy && s.strategyBy === "players";
  document.querySelectorAll<HTMLElement>(".tabs [role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === s.tab)));
  $("#comp-panel").hidden = !competition;
  $("#people-panel").hidden = !(competition || strategyPlayers);
  $("#creative-panel").hidden = competition;
  // Quick hides every setting: just the two options, the button, and the guide.
  $("#field-mode").hidden = !optionsPlay();
  $("#field-strategy").hidden = !strategy;
  // Strategy games are picked from their own list and have no timed quarters.
  $("#field-game").hidden = !strategy;
  $("#field-sport").hidden = strategy;
  $("#field-period").hidden = strategy;
  $("#opts-panel").hidden = quick;
  $("#choices-panel").hidden = quick;
  $("#howto").hidden = !quick;

  if (competition) {
    ensureCompetition();
    setSegment($("#seg-format"), s.format);
    renderCompetitionSide($("#comp-home"), "home");
    renderCompetitionSide($("#comp-away"), "away");
    $("#comp-rivalry").innerHTML = rivalryText(s.comp.home.choice, s.comp.away.choice);
    $("#comp-title").textContent = `${choiceById(s.comp.home.choice)?.name} vs ${choiceById(s.comp.away.choice)?.name}`;
    renderPlayerList();
  } else {
    ensureMatchup();
    if (strategy) {
      ensureStrategyPlayers();
      setSegment($("#seg-strategy"), s.strategyBy);
    }
    if (strategyPlayers) renderPlayerList();
    creativeSides.forEach(renderCreativeSide);
    setSegment($("#seg-mode"), s.mode);
    $("#mode-hint").textContent = s.mode === "fair"
      ? "Pure chance. Neither side has an edge."
      : "Drag a rating up to make that option a better player. Better players win more often, but not always.";
    $("#creative-rivalry").innerHTML = rivalryText(s.homeId, s.awayId);
    $("#creative-title").textContent = `${choiceById(s.homeId)?.name} vs ${choiceById(s.awayId)?.name}`;
  }
  renderGamePicker();
  renderSportPicker();
  setSegment($("#seg-length"), s.length);
  setSegment($("#seg-series"), s.series);
  setSegment($("#seg-period"), s.periodSeconds);

  const ready = !competition || competitionReady();
  const [homeId, awayId] = matchupChoiceIds();
  $<HTMLButtonElement>("#tipoff").disabled = !ready;
  $("#tipoff-sub").textContent = ready
    ? `${choiceById(homeId)?.name} vs ${choiceById(awayId)?.name} · ${matchSummary()}`
    : "2v2 needs at least 4 players. Add one under Your players.";
  renderOptionList();
  showOdds(matchRules().fair ? .5 : lastOdds.firstChance, lastOdds.note);
  scheduleOdds();
}

let oddsTimer = 0;
function scheduleOdds(): void {
  window.clearTimeout(oddsTimer);
  oddsTimer = window.setTimeout(updateOdds, 150);
}

/** The latest projected odds, shown right away while a fresh projection runs. */
let lastOdds: { firstChance: number | null; note: string } = { firstChance: null, note: "" };

/** Fills each side's win chance and the bar under its name. */
function showOdds(firstChance: number | null, note: string): void {
  const panel = state.settings.tab === "competition" ? $("#comp-panel") : $("#creative-panel");
  panel.querySelectorAll<HTMLElement>(".card-rows > .side").forEach((el, i) => {
    const sideChance = firstChance === null ? null : (i === 0 ? firstChance : 1 - firstChance);
    $(".chance b", el).textContent = sideChance === null ? "–" : `${Math.round(sideChance * 100)}%`;
    $(".odds-bar span", el).style.width = `${(sideChance ?? 0) * 100}%`;
  });
  $(".odds-note", panel).textContent = note;
}

/** Stops the projection still running from a previous setting. */
let stopProjection: () => void = () => undefined;

function updateOdds(): void {
  stopProjection();
  if (state.settings.tab === "competition" && !competitionReady()) return showOdds(null, "");
  const rules = matchRules();
  if (rules.fair) {
    lastOdds = { firstChance: .5, note: "Even matchup" };
    return showOdds(lastOdds.firstChance, lastOdds.note);
  }
  const runs = practiceRuns(rules.sport, rules.bestOf);
  const unit = rules.bestOf === 3 ? "series" : "games";
  stopProjection = projectOdds(buildSides(), rules, rules.sport, runs, (firstChance, played, finished) => {
    lastOdds = { firstChance, note: finished ? `Win chance from ${runs} simulated ${unit}` : `Estimating… ${played} of ${runs} ${unit}` };
    showOdds(lastOdds.firstChance, lastOdds.note);
  });
}

/** Typing an option: reuse a saved one with that name, or create it. Returns the option id to use. */
function resolveTypedChoice(input: HTMLInputElement, currentId: string, otherId: string, errorEl: HTMLElement): string {
  const name = cleanName(input.value);
  const current = choiceById(currentId)!;
  errorEl.textContent = "";
  if (!name) {
    input.value = current.name;
    return currentId;
  }
  const existing = choiceByName(name);
  if (existing && existing.id === otherId) {
    errorEl.textContent = "Pick something different from the other side.";
    input.value = current.name;
    return currentId;
  }
  return (existing ?? addChoice(name)).id;
}

function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
  state.settings[key] = value;
  saveSettings();
  renderSetup();
}

export function initSetupScreen(onPlay: () => void): void {
  $(".tabs").addEventListener("click", (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-tab]")?.dataset.tab;
    if (tab === "quick" || tab === "creative" || tab === "competition" || tab === "strategy") update("tab", tab);
  });

  for (const side of creativeSides) {
    const otherKey: SideKey = side.key === "homeId" ? "awayId" : "homeId";
    attachChoicePicker(side.input, {
      excludedId: () => state.settings[otherKey],
      currentId: () => state.settings[side.key],
      onPick: (id) => {
        $(".side-error", side.el).textContent = "";
        update(side.key, id);
      },
    });
    // Typing a name and leaving the box (instead of picking from the list) still works.
    side.input.addEventListener("change", () => {
      const errorEl = $(".side-error", side.el);
      state.settings[side.key] = resolveTypedChoice(side.input, state.settings[side.key], state.settings[otherKey], errorEl);
      side.input.blur();
      saveSettings();
      renderSetup();
    });
    side.range.addEventListener("input", () => {
      const choice = choiceById(state.settings[side.key])!;
      choice.ovr = Number(side.range.value);
      showRating(side, choice.ovr);
      scheduleOdds();
    });
    side.range.addEventListener("change", () => saveChoices());
  }

  const compPanel = $("#comp-panel");
  compPanel.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const comp = state.settings.comp;
    if (target.dataset.choice === "home" || target.dataset.choice === "away") {
      const key = target.dataset.choice, other = key === "home" ? "away" : "home";
      const errorEl = $(`#cc-${key}-err`);
      comp[key].choice = resolveTypedChoice(target as HTMLInputElement, comp[key].choice, comp[other].choice, errorEl);
      const message = errorEl.textContent;
      saveSettings();
      renderSetup();
      $(`#cc-${key}-err`).textContent = message;
    } else if (target.dataset.player === "home" || target.dataset.player === "away") {
      const side = comp[target.dataset.player], slot = Number(target.dataset.slot);
      const previous = side.players[slot];
      // Picking someone already on court swaps the two players.
      for (const s of [comp.home, comp.away]) {
        const i = s.players.indexOf(target.value);
        if (i !== -1) s.players[i] = previous;
      }
      side.players[slot] = target.value;
      saveSettings();
      renderSetup();
    }
  });

  onSegment($("#seg-format"), (v) => update("format", v === "2v2" ? "2v2" : "1v1"));
  onSegment($("#seg-mode"), (v) => update("mode", v === "weighted" ? "weighted" : "fair"));
  onSegment($("#seg-strategy"), (v) => update("strategyBy", v === "players" ? "players" : "options"));
  onSegment($("#seg-game"), (v) => {
    const game = STRATEGY_GAMES.find((g) => g.id === v);
    if (game) update("strategyGame", game.id);
  });
  // Strategy tab: choosing who plays for an option. Picking the other side's player swaps the two.
  $("#creative-panel").addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.dataset.strategySlot === undefined) return;
    const slot = Number(select.dataset.strategySlot), chosen = state.settings.strategyPlayers;
    const otherSlot = slot === 0 ? 1 : 0;
    if (chosen[otherSlot] === select.value) chosen[otherSlot] = chosen[slot];
    chosen[slot] = select.value;
    saveSettings();
    renderSetup();
  });
  onSegment($("#seg-sport"), (v) => update("sport", v as Settings["sport"]));
  onSegment($("#seg-length"), (v) => update("length", v === "full" ? "full" : "quick"));
  onSegment($("#seg-series"), (v) => update("series", v === "3" ? 3 : 1));
  onSegment($("#seg-period"), (v) => update("periodSeconds", Number(v) as Settings["periodSeconds"]));
  $("#tipoff").addEventListener("click", onPlay);
}
