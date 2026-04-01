import MarkdownIt from "markdown-it";
import { diffWords } from "diff";

const md = new MarkdownIt({ html: false, linkify: true, typographer: false });

/** Render markdown text to HTML for seeding a TipTap editor. */
export function fromMarkdown(text: string): string {
  return md.render(text ?? "");
}

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/** Return word-level diff parts between oldText and newText. */
export function diffTextParts(oldText: string, newText: string): DiffPart[] {
  return diffWords(oldText, newText);
}

/** Render word-level diff as HTML (for preview display only, not for the editor). */
export function diffTextToHtml(oldText: string, newText: string): string {
  const parts = diffWords(oldText, newText);
  return parts
    .map((part) => {
      const escaped = escapeHtml(part.value);
      if (part.added) {
        return `<em class="diff-added" style="background:#bbf7d0;font-style:normal;border-radius:2px">${escaped}</em>`;
      }
      if (part.removed) {
        return `<s class="diff-removed" style="background:#fecaca;border-radius:2px">${escaped}</s>`;
      }
      return escaped;
    })
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
