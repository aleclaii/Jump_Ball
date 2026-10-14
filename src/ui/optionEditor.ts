/* "Saved options": the list of things people decide between, with an editor for name, color, and logo. */

import { choiceById, choiceByName, cleanName, FAIR_RATING, NEW_COLORS, newId, saveChoices, state } from "../data/state";
import { escapeHtml } from "../util/html";
import { $ } from "./dom";
import { takeImage } from "./imageUpload";
import { tokenHtml } from "./tokens";

const form = $<HTMLFormElement>("#option-editor");
const nameInput = $<HTMLInputElement>("#oe-name");
const colorInput = $<HTMLInputElement>("#oe-color");
const errorEl = $("#oe-error");
const deleteBtn = $<HTMLButtonElement>("#oe-delete");
const clearLogoBtn = $<HTMLButtonElement>("#oe-logo-clear");

let editingId: string | null = null;
let pendingLogo: string | null = null;
let deleteArmed = false;

export function renderOptionList(): void {
  $("#choices-title").textContent = `Saved options (${state.choices.length})`;
  $("#roster").innerHTML = state.choices.map((c) => `
    <li>
      ${tokenHtml(c, 36)}
      <span class="rmain"><span class="rname">${escapeHtml(c.name)}</span></span>
      <button type="button" class="ghost" data-edit="${c.id}" aria-label="Edit ${escapeHtml(c.name)}">Edit</button>
    </li>`).join("");
}

function renderPreview(): void {
  $("#oe-token").innerHTML = tokenHtml({ name: nameInput.value || "?", color: colorInput.value, logo: pendingLogo }, 64);
  clearLogoBtn.hidden = !pendingLogo;
}

function open(id: string | null): void {
  editingId = id;
  const existing = id ? choiceById(id) : undefined;
  nameInput.value = existing?.name ?? "";
  colorInput.value = existing?.color ?? NEW_COLORS[state.choices.length % NEW_COLORS.length];
  pendingLogo = existing?.logo ?? null;
  errorEl.textContent = "";
  deleteArmed = false;
  deleteBtn.textContent = "Delete";
  deleteBtn.hidden = !existing;
  $("#option-editor-title").textContent = existing ? `Edit ${existing.name}` : "New option";
  form.hidden = false;
  renderPreview();
  nameInput.focus();
}

function close(): void {
  form.hidden = true;
  editingId = null;
}

/** Wires up the editor. `onChange` re-renders the setup screen after a save or delete. */
export function initOptionEditor(onChange: () => void): void {
  $("#add-option-btn").addEventListener("click", () => open(null));
  $("#roster").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-edit]");
    if (button?.dataset.edit) open(button.dataset.edit);
  });
  nameInput.addEventListener("input", renderPreview);
  colorInput.addEventListener("input", renderPreview);
  $<HTMLInputElement>("#oe-logo").addEventListener("change", (event) => {
    void takeImage(event.target as HTMLInputElement, errorEl, (logo) => {
      pendingLogo = logo;
      renderPreview();
    });
  });
  clearLogoBtn.addEventListener("click", () => {
    pendingLogo = null;
    renderPreview();
  });
  $("#oe-cancel").addEventListener("click", close);
  deleteBtn.addEventListener("click", () => {
    if (state.choices.length <= 2) {
      errorEl.textContent = "Keep at least two options so there's a matchup.";
      return;
    }
    if (!deleteArmed) {
      deleteArmed = true;
      deleteBtn.textContent = "Tap again to delete";
      return;
    }
    state.choices = state.choices.filter((c) => c.id !== editingId);
    saveChoices();
    close();
    onChange();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = cleanName(nameInput.value);
    if (!name) {
      errorEl.textContent = "Give this option a name.";
      nameInput.focus();
      return;
    }
    const clash = choiceByName(name);
    if (clash && clash.id !== editingId) {
      errorEl.textContent = `You already have an option called ${clash.name}.`;
      return;
    }
    const existing = editingId ? choiceById(editingId) : undefined;
    if (existing) Object.assign(existing, { name, color: colorInput.value, logo: pendingLogo });
    else state.choices.push({ id: newId("c"), name, color: colorInput.value, ovr: FAIR_RATING, logo: pendingLogo });
    if (saveChoices()) close();
    else errorEl.textContent = "Saved for now, but this browser couldn't store it for next time.";
    onChange();
  });
}
