/** Finds a required element. Throws early if the page markup and the code disagree. */
export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

/** Marks which button in a segmented control is selected. */
export function setSegment(group: HTMLElement, value: string | number): void {
  group.querySelectorAll<HTMLButtonElement>("button[data-v]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.v === String(value)));
  });
}

/** Calls `onPick` with the value of whichever segment button is clicked. */
export function onSegment(group: HTMLElement, onPick: (value: string) => void): void {
  group.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-v]");
    if (button?.dataset.v) onPick(button.dataset.v);
  });
}

/** Respect the system "reduce motion" setting when scrolling. */
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
