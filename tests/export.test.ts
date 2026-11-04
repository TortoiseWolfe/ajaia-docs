import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownFilename } from "../lib/editor/export-markdown";

describe("markdown export", () => {
  it("keeps headings, lists and emphasis", () => {
    const md = htmlToMarkdown(
      "<h1>Title</h1><h2>Sub</h2><p><strong>bold</strong> and <em>italic</em></p><ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li><p>first</p></li></ol>",
    );
    expect(md).toContain("# Title");
    expect(md).toContain("## Sub");
    expect(md).toContain("**bold**");
    expect(md).toContain("_italic_");
    expect(md).toMatch(/^-\s+one$/m);
    expect(md).toMatch(/^1\.\s+first$/m);
  });

  it("makes a safe filename", () => {
    expect(markdownFilename('Q4: plan/"draft"')).toBe("Q4 plan draft.md");
    expect(markdownFilename("   ")).toBe("document.md");
  });
});
