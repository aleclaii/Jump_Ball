import { initials, type TokenLook } from "../sports/drawing";
import { readableTextOn } from "../util/color";
import { escapeHtml } from "../util/html";

/** A round badge for an option or player: their logo, or their initials on their color. */
export function tokenHtml(look: TokenLook, size: number): string {
  const inner = look.logo ? `<img src="${look.logo}" alt="">` : `<span>${escapeHtml(initials(look.name))}</span>`;
  return `<span class="token" style="--tc:${look.color};--ts:${size}px" aria-hidden="true">${inner}</span>`;
}

/** Fills an element with an option's color, with text that stays readable on it. */
export function paintTeamColor(element: HTMLElement, color: string): void {
  element.style.setProperty("--tc", color);
  element.style.setProperty("--on-tc", readableTextOn(color));
}
