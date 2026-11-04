import TurndownService from "turndown";

/** Editor HTML to Markdown. Underline has no Markdown form, so it becomes plain text. */
export function htmlToMarkdown(html: string): string {
  const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  return td.turndown(html).trim() + "\n";
}

export function markdownFilename(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${safe || "document"}.md`;
}
