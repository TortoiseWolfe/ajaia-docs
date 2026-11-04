import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/** Builds a small real .docx: H1, H2, two bullets, a bold run. */
export async function buildSampleDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Sample Title")] }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Sub heading")] }),
          new Paragraph({ bullet: { level: 0 }, children: [new TextRun("first bullet")] }),
          new Paragraph({ bullet: { level: 0 }, children: [new TextRun("second bullet")] }),
          new Paragraph({
            children: [new TextRun("Some "), new TextRun({ text: "bold", bold: true }), new TextRun(" text")],
          }),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
