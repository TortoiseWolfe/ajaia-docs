// Drives the real UI in Chromium: sign in, create, format, autosave, reload,
// share, viewer read-only, stranger 404, the two-tab conflict, and restoring the
// refused edit from version history.
// Saves screenshots to docs/screenshots/. Cleans up the document it creates.
//   node scripts/browser-check.mjs https://ajaia-docs-eight-green.vercel.app
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = "docs/screenshots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch();
const newUser = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signin`);
  await page.getByRole("button", { name: new RegExp(`Continue as ${name}`) }).click();
  await page.waitForURL(`${BASE}/`);
  return { ctx, page };
};
const waitSaved = (page) => page.getByRole("status").filter({ hasText: /^Saved$/ }).waitFor({ timeout: 15000 });

let docUrl;
let alice;
try {
  // Alice: home, create, format, autosave
  alice = await newUser("Alice");
  const a = alice.page;
  await a.getByText("Shared with me").waitFor();
  await a.screenshot({ path: `${SHOTS}/1-home-alice.png` });
  check("Alice home lists seeded docs", await a.getByText("Team offsite notes").isVisible());

  await a.getByRole("button", { name: "New document" }).click();
  await a.waitForURL(/\/docs\//);
  docUrl = a.url();
  const title = a.getByLabel("Document title");
  await title.fill("Browser check");
  await title.press("Enter");

  const body = a.locator(".ProseMirror");
  await body.click();
  await a.getByRole("button", { name: "Heading 1" }).click();
  await a.keyboard.type("Big heading");
  await a.keyboard.press("Enter");
  await a.getByRole("button", { name: /^Bold/ }).click();
  await a.keyboard.type("Bold words");
  await a.getByRole("button", { name: /^Bold/ }).click();
  await a.getByRole("button", { name: /^Italic/ }).click();
  await a.keyboard.type(" italic");
  await a.getByRole("button", { name: /^Italic/ }).click();
  await a.getByRole("button", { name: /^Underline/ }).click();
  await a.keyboard.type(" underlined");
  await a.getByRole("button", { name: /^Underline/ }).click();
  await a.keyboard.press("Enter");
  await a.getByRole("button", { name: "Heading 2" }).click();
  await a.keyboard.type("Second level");
  await a.keyboard.press("Enter");
  await a.getByRole("button", { name: "Bulleted list" }).click();
  await a.keyboard.type("item one");
  await a.keyboard.press("Enter");
  await a.keyboard.type("item two");
  await a.keyboard.press("Enter");
  await a.keyboard.press("Enter");
  await a.getByRole("button", { name: "Numbered list" }).click();
  await a.keyboard.type("step one");
  await a.getByRole("button", { name: /^Undo/ }).click();
  await a.getByRole("button", { name: /^Redo/ }).click();
  check("status shows Saving or Unsaved while typing", await a.getByRole("status").isVisible());
  await waitSaved(a);
  check("autosave reaches Saved", true);
  await a.screenshot({ path: `${SHOTS}/2-editor-formatting.png` });

  // Reload: formatting and title survive
  await a.reload();
  await a.locator(".ProseMirror h1").waitFor();
  check("title kept after reload", (await a.getByLabel("Document title").inputValue()) === "Browser check");
  check("H1 kept", (await a.locator(".ProseMirror h1").innerText()) === "Big heading");
  check("H2 kept", (await a.locator(".ProseMirror h2").innerText()) === "Second level");
  check("bold kept", (await a.locator(".ProseMirror strong").first().innerText()) === "Bold words");
  check("italic kept", (await a.locator(".ProseMirror em").count()) === 1);
  check("underline kept", (await a.locator(".ProseMirror u").count()) === 1);
  check("bullet list kept", (await a.locator(".ProseMirror ul > li").count()) === 2);
  check("numbered list kept (undo/redo round-trip)", (await a.locator(".ProseMirror ol > li").innerText()) === "step one");

  // Export to Markdown downloads a real .md file
  const [download] = await Promise.all([a.waitForEvent("download"), a.getByRole("button", { name: "Export .md" }).click()]);
  const mdText = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  check("export .md downloads with headings and list", download.suggestedFilename() === "Browser check.md" && mdText.includes("# Big heading") && /^-\s+item one$/m.test(mdText));

  // Large doc (over the 64 KiB keepalive limit): leave within 1 s of typing, the edit must still land
  const bigDoc = await a.request.post(`${BASE}/api/documents`, { data: { title: "Big doc check" } }).then((r) => r.json());
  await a.goto(`${BASE}/docs/${bigDoc.id}`);
  await a.locator(".ProseMirror").click();
  const chunk = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(1600); // ~90 KB
  await a.keyboard.insertText(chunk);
  await a.keyboard.type(" LAST-WORDS");
  await a.getByRole("link", { name: /All documents/ }).click();
  await a.waitForURL(`${BASE}/`);
  await a.waitForTimeout(2500);
  const bigBody = await a.request.get(`${BASE}/api/documents/${bigDoc.id}`).then((r) => r.json());
  check("large doc: last words saved after leaving quickly", JSON.stringify(bigBody.content).includes("LAST-WORDS"));
  await a.request.delete(`${BASE}/api/documents/${bigDoc.id}`);
  await a.goto(docUrl);
  await a.locator(".ProseMirror h1").waitFor();

  // Share with Bob as Viewer
  await a.getByRole("button", { name: "Share" }).click();
  await a.getByLabel("Person").selectOption({ label: "Bob Martinez" });
  await a.getByLabel("Role", { exact: true }).selectOption("viewer");
  await a.getByRole("dialog").getByRole("button", { name: "Share" }).click();
  await a.getByLabel("Role for Bob Martinez").waitFor();
  await a.screenshot({ path: `${SHOTS}/3-share-dialog.png` });
  check("share dialog lists Bob", true);
  await a.getByRole("button", { name: "Close" }).click();

  // Bob: sees it under Shared with me, read-only
  const bob = await newUser("Bob");
  const b = bob.page;
  const sharedSection = b.locator("section", { hasText: "Shared with me" });
  check("Bob sees doc under Shared with me", await sharedSection.getByText("Browser check").isVisible());
  await b.goto(docUrl);
  await b.locator(".ProseMirror h1").waitFor();
  check("Bob's editor is read-only", (await b.locator(".ProseMirror").getAttribute("contenteditable")) === "false");
  check("Bob sees view-only banner", await b.getByText(/view-only access/).isVisible());
  check("Bob has no toolbar", (await b.getByRole("toolbar").count()) === 0);
  await b.screenshot({ path: `${SHOTS}/4-viewer-bob.png` });

  // Carol: stranger gets 404
  const carol = await newUser("Carol");
  const resp = await carol.page.goto(docUrl);
  check("Carol gets 404", resp?.status() === 404 && (await carol.page.getByText("Document not found").isVisible()));

  // Conflict: Alice has two tabs open, both edit
  const tab1 = a;
  await tab1.goto(docUrl);
  await tab1.locator(".ProseMirror h1").waitFor();
  const tab2 = await alice.ctx.newPage();
  await tab2.goto(docUrl);
  await tab2.locator(".ProseMirror h1").waitFor();
  await tab2.locator(".ProseMirror h1").click();
  await tab2.keyboard.press("End");
  await tab2.keyboard.type(" (tab 2)");
  await waitSaved(tab2);
  await tab1.locator(".ProseMirror h1").click();
  await tab1.keyboard.press("End");
  await tab1.keyboard.type(" (stale tab)");
  await tab1.getByText("This document was changed by someone else. Your edit was kept in History. Reload to see the latest.").waitFor({ timeout: 15000 });
  check("stale tab shows conflict message", true);
  await tab1.screenshot({ path: `${SHOTS}/5-conflict.png` });
  await tab1.reload();
  await tab1.locator(".ProseMirror h1").waitFor();
  check("reload shows the other tab's save", (await tab1.locator(".ProseMirror h1").innerText()) === "Big heading (tab 2)");

  // Version history: the refused edit was kept, can be previewed, restored, and survives a reload
  await tab1.getByRole("button", { name: "History" }).click();
  const kept = tab1.getByRole("button", { name: /Unsaved edit by Alice Chen/ });
  await kept.waitFor({ timeout: 10000 });
  check("history lists the refused edit", true);
  await kept.click();
  await tab1.getByLabel("Version preview").getByText("Big heading (stale tab)").waitFor({ timeout: 10000 });
  check("preview shows the refused edit", true);
  await tab1.screenshot({ path: `${SHOTS}/6-history.png` });
  await tab1.getByRole("button", { name: "Restore this version" }).click();
  await tab1.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 });
  check("restore puts the refused edit back", (await tab1.locator(".ProseMirror h1").innerText()) === "Big heading (stale tab)");
  await tab1.reload();
  await tab1.locator(".ProseMirror h1").waitFor();
  check("restored edit survives a reload", (await tab1.locator(".ProseMirror h1").innerText()) === "Big heading (stale tab)");

  // Owner deletes from the UI: confirm dialog, back home, gone from the list
  await tab2.close();
  tab1.once("dialog", (d) => d.accept());
  await tab1.getByRole("button", { name: "Delete" }).click();
  await tab1.waitForURL(`${BASE}/`);
  await tab1.getByText("My documents").waitFor();
  check("owner deletes from the UI", (await tab1.getByText("Browser check").count()) === 0);
} catch (err) {
  check("script ran to the end", false, String(err).split("\n")[0]);
} finally {
  if (docUrl && alice) {
    const id = docUrl.split("/").pop();
    const res = await alice.page.request.delete(`${BASE}/api/documents/${id}`);
    console.log(`cleanup: test doc ${res.status() === 404 ? "already deleted" : `deleted (${res.status()})`}`);
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
