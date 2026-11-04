import { describe, expect, it } from "vitest";
import { importFile, kindFromName, titleFromName } from "../lib/import";
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
    expect(kindFromName("a.markdown")).toBe("md");
    expect(kindFromName("a.docx")).toBe("docx");
    expect(kindFromName("a.pdf")).toBeNull();
  });
  it("titleFromName", () => {
    expect(titleFromName("my_great-file.docx")).toBe("my great file");
    expect(titleFromName(".md")).toBe("Imported document");
  });
});
