// Run: npx tsx tests/helpers/make-samples.ts
import { writeFileSync } from "node:fs";
import { buildSampleDocx } from "./docx-builder";

buildSampleDocx().then((b) => {
  writeFileSync("samples/sample.docx", b);
  console.log("wrote samples/sample.docx", b.length);
});
