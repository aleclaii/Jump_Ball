/* "Your players": Competition players with one stat sheet per sport. Every sheet in a sport has the same
   budget; players start from a one-tap build and fine-tune. */

import { buildValues, copySheets, SHEET_ORDER, SHEETS, sheetsFromBuilds, withSheet, type StatSheets } from "../data/sheets";
import { cleanName, NEW_COLORS, newId, personById, savePeople, state } from "../data/state";
import { budgetOf, buildNameOf, sameValues, STAT_MAX, STAT_MIN, statsOf, totalOf, type StatValues } from "../data/statSheet";
import { sportById } from "../sports";
import { NEUTRAL_STYLE, type TraderStyle } from "../sports/trading/trader";
import type { SportId } from "../sports/types";
import { escapeHtml } from "../util/html";
import { $ } from "./dom";
import { takeImage } from "./imageUpload";
import { tokenHtml } from "./tokens";

const form = $<HTMLFormElement>("#person-editor");
const nameInput = $<HTMLInputElement>("#pe-name");
const colorInput = $<HTMLInputElement>("#pe-color");
const errorEl = $("#pe-error");
const deleteBtn = $<HTMLButtonElement>("#pe-delete");
const clearPhotoBtn = $<HTMLButtonElement>("#pe-logo-clear");
const leanInput = $<HTMLInputElement>("#pe-lean");
const contrarianInput = $<HTMLInputElement>("#pe-contrarian");

const balancedSheets = (): StatSheets => sheetsFromBuilds({ basketball: "balanced", mma: "balanced", soccer: "balanced", football: "balanced", chess: "balanced", conquest: "balanced", trading: "balanced" });

let editingId: string | null = null;
let pendingPhoto: string | null = null;
let pendingSheets: StatSheets = balancedSheets();
let pendingStyle: TraderStyle = { ...NEUTRAL_STYLE };
let activeSport: SportId = "basketball";
let deleteArmed = false;

const valuesFor = (sport: SportId): StatValues => pendingSheets[sport] as StatValues;
const pointsLeft = (sport: SportId): number => budgetOf(SHEETS[sport]) - totalOf(SHEETS[sport], valuesFor(sport));

/** One line per player: their build in each sport. */
export const buildsSummary = (sheets: StatSheets): string =>
  SHEET_ORDER.map((sport) => buildNameOf(SHEETS[sport], sheets[sport] as StatValues)).join(" · ");

export function renderPlayerList(): void {
  $("#people").innerHTML = state.people.map((p) => `
    <li>
      ${tokenHtml(p, 36)}
      <span class="rmain"><span class="rname">${escapeHtml(p.name)}</span><span class="rsub">${escapeHtml(buildsSummary(p.sheets))}</span></span>
      <button type="button" class="ghost" data-edit-person="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">Edit</button>
    </li>`).join("");
}

function renderPreview(): void {
  $("#pe-token").innerHTML = tokenHtml({ name: nameInput.value || "?", color: colorInput.value, logo: pendingPhoto }, 64);
  clearPhotoBtn.hidden = !pendingPhoto;
}

/** The sport switcher: each tab shows ✓ once its points are all spent. */
function renderSportTabs(): void {
  $("#pe-sports").innerHTML = SHEET_ORDER.map((sport) => {
    const left = pointsLeft(sport);
    const status = left === 0 ? "✓" : `${left} left`;
    return `<button type="button" role="tab" data-v="${sport}" aria-pressed="${sport === activeSport}" aria-selected="${sport === activeSport}">
      ${sportById(sport).name}<small class="${left === 0 ? "sheet-done" : ""}">${status}</small></button>`;
  }).join("");
}

function renderSheet(): void {
  const sheet = SHEETS[activeSport], values = valuesFor(activeSport);
  const left = pointsLeft(activeSport);
  const counter = $("#pe-left");
  counter.textContent = String(left);
  counter.className = "budget-num" + (left === 0 ? " done" : "");
  $("#pe-budget-label").textContent = `${sportById(activeSport).name} points left`;
  $("#pe-budget-hint").textContent = left === 0
    ? "All spent. Lower one stat to raise another."
    : `${budgetOf(sheet)} points, each stat ${STAT_MIN}–${STAT_MAX}.`;
  $("#pe-archetypes").innerHTML = sheet.builds.map((b) =>
    `<button type="button" data-build="${b.id}" aria-pressed="${sameValues(sheet, b.stats, values)}"><b>${b.name}</b><small>${b.blurb}</small></button>`).join("");
  $("#pe-stats").innerHTML = sheet.groups.map((group) => `
    <div class="stat-group">
      <h4>${group.name}</h4>
      ${group.stats.map((s) => {
        const value = values[s.key];
        const pips = Array.from({ length: STAT_MAX }, (_, i) => `<i class="${i < value ? "on" : ""}"></i>`).join("");
        return `
        <div class="stat-row">
          <span class="stat-text"><span class="stat-name">${s.name}${s.tag ? `<em>${s.tag}</em>` : ""}</span><span class="stat-desc">${s.desc}</span></span>
          <span class="stepper">
            <button type="button" data-step="${s.key}" data-d="-1" aria-label="Lower ${s.name}" ${value <= STAT_MIN ? "disabled" : ""}>−</button>
            <output aria-label="${s.name}">${value}</output>
            <button type="button" data-step="${s.key}" data-d="1" aria-label="Raise ${s.name}" ${value >= STAT_MAX || left <= 0 ? "disabled" : ""}>+</button>
          </span>
          <span class="pips" aria-hidden="true">${pips}</span>
        </div>`;
      }).join("")}
    </div>`).join("");
  $("#pe-vs").innerHTML = statsOf(sheet).map((s) => `<li><b>${s.name}</b> ${s.vs.charAt(0).toLowerCase()}${s.vs.slice(1)}.</li>`).join("");
}

export const leanLabel = (lean: number): string =>
  lean <= -.75 ? "Strong bear" : lean <= -.35 ? "Bearish" : lean < 0 ? "Slightly bearish"
    : lean === 0 ? "Neutral" : lean < .35 ? "Slightly bullish" : lean < .75 ? "Bullish" : "Strong bull";

/** The trading style box, shown only on the trading sheet. */
function renderStyle(): void {
  $("#pe-style").hidden = activeSport !== "trading";
  leanInput.value = String(Math.round(pendingStyle.lean * 100));
  $("#pe-lean-label").textContent = leanLabel(pendingStyle.lean);
  contrarianInput.checked = pendingStyle.contrarian;
}

function renderEditor(): void {
  renderSportTabs();
  renderSheet();
  renderStyle();
}

function open(id: string | null): void {
  editingId = id;
  const existing = personById(id);
  nameInput.value = existing?.name ?? "";
  colorInput.value = existing?.color ?? NEW_COLORS[state.people.length % NEW_COLORS.length];
  pendingPhoto = existing?.logo ?? null;
  pendingSheets = existing ? copySheets(existing.sheets) : balancedSheets();
  pendingStyle = existing ? { ...existing.tradingStyle } : { ...NEUTRAL_STYLE };
  activeSport = "basketball";
  errorEl.textContent = "";
  deleteArmed = false;
  deleteBtn.textContent = "Delete";
  deleteBtn.hidden = !existing;
  $("#person-editor-title").textContent = existing ? `Edit ${existing.name}` : "New player";
  form.hidden = false;
  renderPreview();
  renderEditor();
  nameInput.focus();
}

function close(): void {
  form.hidden = true;
  editingId = null;
}

/** Wires up the editor. `onChange` re-renders the setup screen after a save or delete. */
export function initPlayerEditor(onChange: () => void): void {
  $("#add-person-btn").addEventListener("click", () => open(null));
  $("#people").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-edit-person]");
    if (button?.dataset.editPerson) open(button.dataset.editPerson);
  });
  $("#pe-sports").addEventListener("click", (event) => {
    const sport = (event.target as HTMLElement).closest<HTMLElement>("[data-v]")?.dataset.v as SportId | undefined;
    if (!sport || !SHEETS[sport]) return;
    activeSport = sport;
    renderEditor();
  });
  $("#pe-archetypes").addEventListener("click", (event) => {
    const buildId = (event.target as HTMLElement).closest<HTMLElement>("[data-build]")?.dataset.build;
    if (!buildId) return;
    pendingSheets = withSheet(pendingSheets, activeSport, buildValues(activeSport, buildId));
    renderEditor();
  });
  $("#pe-stats").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-step]");
    if (!button || button.disabled || !button.dataset.step) return;
    const key = button.dataset.step, delta = Number(button.dataset.d);
    const values = valuesFor(activeSport);
    const next = values[key] + delta;
    if (next < STAT_MIN || next > STAT_MAX) return;
    if (delta > 0 && pointsLeft(activeSport) <= 0) return;
    values[key] = next;
    renderEditor();
    // Keep focus on the same button so repeated taps keep working.
    const again = document.querySelector<HTMLButtonElement>(`#pe-stats [data-step="${key}"][data-d="${delta}"]`);
    if (again && !again.disabled) again.focus();
  });
  leanInput.addEventListener("input", () => {
    pendingStyle.lean = Number(leanInput.value) / 100;
    renderStyle();
  });
  contrarianInput.addEventListener("change", () => {
    pendingStyle.contrarian = contrarianInput.checked;
  });
  nameInput.addEventListener("input", renderPreview);
  colorInput.addEventListener("input", renderPreview);
  $<HTMLInputElement>("#pe-logo").addEventListener("change", (event) => {
    void takeImage(event.target as HTMLInputElement, errorEl, (photo) => {
      pendingPhoto = photo;
      renderPreview();
    });
  });
  clearPhotoBtn.addEventListener("click", () => {
    pendingPhoto = null;
    renderPreview();
  });
  $("#pe-cancel").addEventListener("click", close);
  deleteBtn.addEventListener("click", () => {
    if (state.people.length <= 2) {
      errorEl.textContent = "Keep at least two players so there's a matchup.";
      return;
    }
    if (!deleteArmed) {
      deleteArmed = true;
      deleteBtn.textContent = "Tap again to delete";
      return;
    }
    state.people = state.people.filter((p) => p.id !== editingId);
    savePeople();
    close();
    onChange();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = cleanName(nameInput.value);
    if (!name) {
      errorEl.textContent = "Give this player a name.";
      nameInput.focus();
      return;
    }
    const clash = state.people.find((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== editingId);
    if (clash) {
      errorEl.textContent = `You already have a player called ${clash.name}.`;
      return;
    }
    // Every sport's points must be spent, so all players stay on an equal budget.
    const unfinished = SHEET_ORDER.find((sport) => pointsLeft(sport) !== 0);
    if (unfinished) {
      activeSport = unfinished;
      renderEditor();
      errorEl.textContent = `Spend all your ${sportById(unfinished).name} points first (${pointsLeft(unfinished)} left).`;
      return;
    }
    const data = { name, color: colorInput.value, logo: pendingPhoto, sheets: copySheets(pendingSheets), tradingStyle: { ...pendingStyle } };
    const existing = personById(editingId);
    if (existing) Object.assign(existing, data);
    else state.people.push({ id: newId("p"), ...data });
    if (savePeople()) close();
    else errorEl.textContent = "Saved for now, but this browser couldn't store it for next time.";
    onChange();
  });
}
