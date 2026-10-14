const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for safe use inside HTML. User-typed names always go through this. */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** A simple table: header cells, then rows of cells. Cells are already-escaped HTML. */
export function tableHtml(caption: string, header: string[], rows: string[][]): string {
  return `<div class="box-scroll"><table class="box"><caption>${caption}</caption>
    <thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}
