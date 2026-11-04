import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeDb } from "./helpers/pglite";
import { createDocument, getDocument, saveContent } from "../lib/db/repo";
import type { Query } from "../lib/db/types";

let q: Query;
let close: () => Promise<void>;
beforeAll(async () => ({ q, close } = await makeDb()));
afterAll(() => close());

const doc = (t: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

describe("optimistic save", () => {
  it("accepts a fresh save, rejects a stale one, keeps first content", async () => {
    const { id } = await createDocument(q, "alice", "T", doc("start"));
    const first = await saveContent(q, id, doc("first"), 1);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.version).toBe(2);

    const stale = await saveContent(q, id, doc("stale"), 1);
    expect(stale).toEqual({ ok: false, reason: "conflict", currentVersion: 2 });

    const stored = await getDocument(q, id);
    expect(stored?.content).toEqual(doc("first"));
    expect(stored?.version).toBe(2);
  });

  it("reports missing for an unknown uuid", async () => {
    const r = await saveContent(q, "99999999-9999-4999-8999-999999999999", doc("x"), 1);
    expect(r).toEqual({ ok: false, reason: "missing" });
  });
});
