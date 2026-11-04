import { generateJSON } from "@tiptap/html/server";
import mammoth from "mammoth";
import { Marked } from "marked";
import { extensions } from "./editor/extensions";

export type ImportKind = "txt" | "md" | "docx";

// Raw HTML inside Markdown is ignored outright; the editor schema is the
// second line of defence for anything else.
const markdown = new Marked({ gfm: true, async: false });
markdown.use({ renderer: { html: () => "" } });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text: blank lines separate paragraphs, single newlines become line breaks. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${para.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

export function markdownToHtml(text: string): string {
  return markdown.parse(text) as string;
}

export async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

export function htmlToDoc(html: string): unknown {
  return generateJSON(html || "<p></p>", extensions);
}

export async function importFile(kind: ImportKind, data: Buffer): Promise<unknown> {
  if (kind === "docx") return htmlToDoc(await docxToHtml(data));
  const text = data.toString("utf8");
  return htmlToDoc(kind === "md" ? markdownToHtml(text) : textToHtml(text));
}

export function kindFromName(name: string): ImportKind | null {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "txt" || ext === "md" || ext === "docx") return ext;
  if (ext === "markdown") return "md";
  return null;
}

export function titleFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "Imported document").slice(0, 200);
}
