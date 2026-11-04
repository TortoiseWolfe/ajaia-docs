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

export const MAX_DOCX_UNZIPPED_BYTES = 20 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 2000;
const MAX_HTML_CHARS = 2 * 1024 * 1024;

/**
 * Zip-bomb guard: read the .docx (a zip) central directory without inflating
 * anything, and refuse if the declared uncompressed total is too big. The 1 MB
 * upload cap only bounds the compressed size.
 */
export function checkDocxSize(buf: Buffer): void {
  // End of central directory record: signature 0x06054b50, within the last 64 KB + 22 bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const entries = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (entries === 0xffff || offset === 0xffffffff) throw new Error("zip64 not supported");
  if (entries > MAX_DOCX_ENTRIES) throw new Error("too many entries");
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) throw new Error("bad central directory");
    const size = buf.readUInt32LE(offset + 24);
    if (size === 0xffffffff) throw new Error("zip64 not supported");
    total += size;
    if (total > MAX_DOCX_UNZIPPED_BYTES) throw new Error("uncompressed size too large");
    offset += 46 + buf.readUInt16LE(offset + 28) + buf.readUInt16LE(offset + 30) + buf.readUInt16LE(offset + 32);
  }
}

export async function docxToHtml(buffer: Buffer): Promise<string> {
  checkDocxSize(buffer);
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

export function htmlToDoc(html: string): unknown {
  if (html.length > MAX_HTML_CHARS) throw new Error("converted document too large");
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
