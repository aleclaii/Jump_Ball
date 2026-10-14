/* A name box that also lists your saved options. Tap it (or the ▾) to see every saved option and pick one,
   or type to filter the list and add a new option. Replaces the browser's built-in suggestion list, which
   only suggested names matching what was already in the box. */

import { addChoice, choiceById, cleanName, state } from "../data/state";
import { escapeHtml } from "../util/html";
import { tokenHtml } from "./tokens";

interface PickerOptions {
  /** The option on the other side, which can't be picked twice. */
  excludedId: () => string;
  /** The option this box shows right now. */
  currentId: () => string;
  /** Called with the chosen (or newly added) option's id. */
  onPick: (id: string) => void;
}

let pickerCount = 0;

export function attachChoicePicker(input: HTMLInputElement, options: PickerOptions): void {
  const host = input.parentElement;
  if (!host) return;
  host.classList.add("picker-host");
  const listId = `choice-picker-${++pickerCount}`;
  const list = document.createElement("ul");
  list.className = "picker";
  list.id = listId;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  host.append(list);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "picker-toggle";
  toggle.setAttribute("aria-label", "Show saved options");
  toggle.tabIndex = -1;
  toggle.textContent = "▾";
  host.append(toggle);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-controls", listId);
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-autocomplete", "list");

  let active = -1;
  let items: { id: string | null; name: string }[] = [];

  /** Everything except the other side's option; once you start typing, only names that match. */
  function render(): void {
    const current = choiceById(options.currentId());
    const query = cleanName(input.value).toLowerCase();
    const typing = query !== "" && query !== current?.name.toLowerCase();
    const choices = state.choices.filter((c) => c.id !== options.excludedId() && (!typing || c.name.toLowerCase().includes(query)));
    items = choices.map((c) => ({ id: c.id, name: c.name }));
    const exact = state.choices.some((c) => c.name.toLowerCase() === query);
    if (typing && !exact) items.push({ id: null, name: cleanName(input.value) });
    if (active >= items.length) active = items.length - 1;
    list.innerHTML = items.length
      ? items.map((item, i) => {
        const choice = item.id ? choiceById(item.id) : undefined;
        const label = choice
          ? `${tokenHtml(choice, 24)}<span>${escapeHtml(choice.name)}</span>${choice.id === current?.id ? `<small>Current</small>` : ""}`
          : `<span class="picker-add">+</span><span>Add “${escapeHtml(item.name)}”</span>`;
        return `<li role="option" id="${listId}-${i}" data-index="${i}" aria-selected="${i === active}">${label}</li>`;
      }).join("")
      : `<li class="picker-empty">No other saved options yet. Type a name to add one.</li>`;
    input.setAttribute("aria-activedescendant", active >= 0 ? `${listId}-${active}` : "");
  }

  function open(): void {
    active = -1;
    render();
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function close(): void {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  function choose(index: number): void {
    const item = items[index];
    if (!item) return;
    const id = item.id ?? addChoice(item.name).id;
    close();
    input.value = choiceById(id)?.name ?? input.value;
    input.blur();
    options.onPick(id);
  }

  input.addEventListener("focus", () => {
    input.select();
    open();
  });
  input.addEventListener("input", () => {
    active = 0;
    render();
    list.hidden = false;
  });
  input.addEventListener("blur", () => close());
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) open();
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = Math.max(0, Math.min(items.length - 1, active + step));
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!list.hidden && active >= 0) choose(active);
      else input.blur();
    } else if (event.key === "Escape") {
      close();
      input.value = choiceById(options.currentId())?.name ?? "";
      input.blur();
    }
  });
  // mousedown would blur the box before the click lands, so keep focus until the pick is made.
  list.addEventListener("mousedown", (event) => event.preventDefault());
  list.addEventListener("click", (event) => {
    const li = (event.target as HTMLElement).closest<HTMLElement>("li[data-index]");
    if (li) choose(Number(li.dataset.index));
  });
  toggle.addEventListener("mousedown", (event) => event.preventDefault());
  toggle.addEventListener("click", () => {
    if (list.hidden) input.focus();
    else close();
  });
}
