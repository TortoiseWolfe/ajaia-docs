import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkDocxInflatedSize, checkDocxSize, importFile, kindFromName, titleFromName } from "../lib/import";
import { buildSampleDocx } from "./helpers/docx-builder";
import { findNodes, headingLevels, markTypes } from "./helpers/tiptap";

const md = "# Title\n\n## Sub\n\n- one\n- two\n\n1. first\n2. second\n\nSome **bold** text";

describe("markdown import", () => {
  it("keeps structure and marks", async () => {
    const doc = await importFile("md", Buffer.from(md));
    expect(headingLevels(doc)).toEqual([1, 2]);
    expect(findNodes(doc, "bulletList")).toHaveLength(1);
    expect(findNodes(findNodes(doc, "bulletList")[0], "listItem")).toHaveLength(2);
    expect(findNodes(doc, "orderedList")).toHaveLength(1);
    expect(markTypes(doc).has("bold")).toBe(true);
  });

  it("drops raw HTML", async () => {
    const doc = await importFile(
      "md",
      Buffer.from("hello\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\nbye"),
    );
    const s = JSON.stringify(doc);
    for (const bad of ["script", "onerror", "alert"]) expect(s).not.toContain(bad);
  });
});

describe("txt import", () => {
  it("splits paragraphs on blank lines", async () => {
    const doc = await importFile("txt", Buffer.from("one\n\ntwo"));
    expect(findNodes(doc, "paragraph")).toHaveLength(2);
  });
  it("keeps HTML literal", async () => {
    const doc = await importFile("txt", Buffer.from("<b>x</b>"));
    expect(markTypes(doc).has("bold")).toBe(false);
    expect(JSON.stringify(doc)).toContain("<b>x</b>");
  });
});

describe("docx import", () => {
  it("maps headings, bullets and bold", async () => {
    const doc = await importFile("docx", await buildSampleDocx());
    expect(headingLevels(doc)).toEqual([1, 2]);
    const lists = findNodes(doc, "bulletList");
    expect(lists).toHaveLength(1);
    expect(findNodes(lists[0], "listItem")).toHaveLength(2);
    expect(markTypes(doc).has("bold")).toBe(true);
  });
});

describe("file name helpers", () => {
  it("kindFromName", () => {
    expect(kindFromName("a.TXT")).toBe("txt");
    expect(kindFromName("a.md")).toBe("md");
    expect(kindFromName("a.markdown")).toBeNull(); // only the types the UI and README promise
    expect(kindFromName("a.docx")).toBe("docx");
    expect(kindFromName("a.pdf")).toBeNull();
  });
  it("titleFromName", () => {
    expect(titleFromName("my_great-file.docx")).toBe("my great file");
    expect(titleFromName(".md")).toBe("Imported document");
  });
});

describe("docx zip-bomb guard", () => {
  it("refuses a small .docx that declares a huge uncompressed size", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("word/document.xml", "0".repeat(25 * 1024 * 1024)); // compresses to a few KB
    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    expect(buf.length).toBeLessThan(1024 * 1024); // passes the 1 MB upload cap...
    expect(() => checkDocxSize(buf)).toThrow(/too large/); // ...but not the unzipped-size check
    await expect(importFile("docx", buf)).rejects.toThrow();
  });

  it("accepts a normal .docx", async () => {
    expect(() => checkDocxSize(readFileSync("samples/sample.docx"))).not.toThrow();
  });
});

describe("docx zip-bomb guard, lying headers", () => {
  it("counts real inflated bytes when the zip header under-declares the size", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("word/document.xml", "0".repeat(25 * 1024 * 1024));
    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    // Rewrite every declared uncompressed size (local headers and central directory) to 100 bytes.
    for (let i = 0; i < buf.length - 4; i++) {
      const sig = buf.readUInt32LE(i);
      if (sig === 0x04034b50) buf.writeUInt32LE(100, i + 22);
      if (sig === 0x02014b50) buf.writeUInt32LE(100, i + 24);
    }
    expect(() => checkDocxSize(buf)).not.toThrow(); // the header check is fooled...
    await expect(checkDocxInflatedSize(buf)).rejects.toThrow(/too large/); // ...the byte count is not
    await expect(importFile("docx", buf)).rejects.toThrow();
  });

  it("passes the sample .docx", async () => {
    await expect(checkDocxInflatedSize(readFileSync("samples/sample.docx"))).resolves.toBeUndefined();
  });
});
