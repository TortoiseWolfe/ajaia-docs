import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeDb } from "./helpers/pglite";
import {
  createDocument,
  getDocument,
  getVersion,
  listVersions,
  restoreVersion,
  saveContent,
} from "../lib/db/repo";
import type { Query } from "../lib/db/types";

let q: Query;
let close: () => Promise<void>;
beforeAll(async () => ({ q, close } = await makeDb()));
afterAll(() => close());

const doc = (t: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

async function newDoc(text = "start") {
  const { id } = await createDocument(q, "alice", "History test", doc(text));
  return id;
}

/** Pretend the last save happened `minutes` ago. */
const backdate = (id: string, minutes: number) =>
  q(`update documents set updated_at = now() - make_interval(mins => $2::int) where id = $1::uuid`, [id, minutes]);

describe("version history snapshots", () => {
  it("keeps the earlier state when a different person starts editing", async () => {
    const id = await newDoc();
    expect((await saveContent(q, id, doc("alice wrote"), 1, "alice")).ok).toBe(true);
    expect((await saveContent(q, id, doc("bob wrote"), 2, "bob")).ok).toBe(true);

    const versions = await listVersions(q, id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ kind: "edit", author_id: "alice", author_name: "Alice Chen", doc_version: 2 });
    const full = await getVersion(q, id, versions[0].id);
    expect(full?.content).toEqual(doc("alice wrote"));
  });

  it("does not snapshot quick saves by the same person (autosave)", async () => {
    const id = await newDoc();
    for (let v = 1; v <= 4; v++) expect((await saveContent(q, id, doc(`draft ${v}`), v, "alice")).ok).toBe(true);
    expect(await listVersions(q, id)).toHaveLength(0);
  });

  it("snapshots after a pause of more than five minutes", async () => {
    const id = await newDoc();
    await saveContent(q, id, doc("before the break"), 1, "alice");
    await backdate(id, 6);
    await saveContent(q, id, doc("after the break"), 2, "alice");
    const versions = await listVersions(q, id);
    expect(versions).toHaveLength(1);
    expect((await getVersion(q, id, versions[0].id))?.content).toEqual(doc("before the break"));
  });

  it("does not snapshot when the content didn't change", async () => {
    const id = await newDoc();
    await saveContent(q, id, doc("same"), 1, "alice");
    await saveContent(q, id, doc("same"), 2, "bob");
    expect(await listVersions(q, id)).toHaveLength(0);
  });
});

describe("conflicts keep the refused edit", () => {
  it("stores a stale save as a conflict version, once", async () => {
    const id = await newDoc();
    await saveContent(q, id, doc("bob got there first"), 1, "bob");

    const stale = await saveContent(q, id, doc("alice's stale edit"), 1, "alice");
    expect(stale).toEqual({ ok: false, reason: "conflict", currentVersion: 2 });
    // The same refused content again (a retry, or the flush on leaving the page) is not duplicated.
    await saveContent(q, id, doc("alice's stale edit"), 1, "alice");

    const conflicts = (await listVersions(q, id)).filter((v) => v.kind === "conflict");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ author_id: "alice", doc_version: 1 });
    expect((await getVersion(q, id, conflicts[0].id))?.content).toEqual(doc("alice's stale edit"));
    // The winner's save is untouched.
    expect((await getDocument(q, id))?.content).toEqual(doc("bob got there first"));
  });
});

describe("restore", () => {
  it("brings a version back and keeps the replaced state, so restore can be undone", async () => {
    const id = await newDoc();
    await saveContent(q, id, doc("alice wrote"), 1, "alice");
    await saveContent(q, id, doc("bob wrote"), 2, "bob");
    const [aliceVersion] = await listVersions(q, id);

    const restored = await restoreVersion(q, id, aliceVersion.id, 3, "alice");
    expect(restored).toMatchObject({ ok: true, version: 4, content: doc("alice wrote") });
    expect((await getDocument(q, id))?.content).toEqual(doc("alice wrote"));

    const versions = await listVersions(q, id);
    const bobState = versions.find((v) => v.author_id === "bob");
    expect(bobState).toBeDefined();
    expect((await getVersion(q, id, bobState!.id))?.content).toEqual(doc("bob wrote"));
  });

  it("refuses a restore based on a stale version and changes nothing", async () => {
    const id = await newDoc();
    await saveContent(q, id, doc("one"), 1, "alice");
    await saveContent(q, id, doc("two"), 2, "bob");
    const before = await listVersions(q, id);
    const r = await restoreVersion(q, id, before[0].id, 2, "alice");
    expect(r).toMatchObject({ ok: false, reason: "conflict", currentVersion: 3 });
    expect((await getDocument(q, id))?.content).toEqual(doc("two"));
    // A refused restore is not itself kept as a "conflict" edit.
    expect(await listVersions(q, id)).toHaveLength(before.length);
  });

  it("treats a version id from another document as missing", async () => {
    const a = await newDoc("a");
    await saveContent(q, a, doc("a1"), 1, "alice");
    await saveContent(q, a, doc("a2"), 2, "bob");
    const [foreign] = await listVersions(q, a);

    const b = await newDoc("b");
    expect(await getVersion(q, b, foreign.id)).toBeNull();
    expect(await restoreVersion(q, b, foreign.id, 1, "alice")).toEqual({ ok: false, reason: "missing" });
    expect((await getDocument(q, b))?.content).toEqual(doc("b"));
  });
});
