import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeDb } from "./helpers/pglite";
import { canEdit, canRead, getRole, isOwner } from "../lib/access";
import { createDocument, deleteShare, listSharedDocs, upsertShare } from "../lib/db/repo";
import { SEED_DOCS } from "../lib/db/seed";
import type { Query } from "../lib/db/types";

let q: Query;
let close: () => Promise<void>;
beforeAll(async () => ({ q, close } = await makeDb()));
afterAll(() => close());

describe("access rules", () => {
  it("seeded state", async () => {
    expect(await getRole(q, "alice", SEED_DOCS.offsite)).toBe("viewer");
    expect(await getRole(q, "bob", SEED_DOCS.launch)).toBe("editor");
    expect(await getRole(q, "carol", SEED_DOCS.launch)).toBe("none");
  });

  it("share lifecycle: none -> viewer -> editor -> none", async () => {
    const { id } = await createDocument(q, "alice", "Private", { type: "doc", content: [{ type: "paragraph" }] });
    expect(await getRole(q, "alice", id)).toBe("owner");
    expect(isOwner(await getRole(q, "alice", id))).toBe(true);
    expect(await getRole(q, "bob", id)).toBe("none");

    await upsertShare(q, id, "bob", "viewer");
    const v = await getRole(q, "bob", id);
    expect(v).toBe("viewer");
    expect(canRead(v)).toBe(true);
    expect(canEdit(v)).toBe(false);

    await upsertShare(q, id, "bob", "editor");
    const e = await getRole(q, "bob", id);
    expect(e).toBe("editor");
    expect(canEdit(e)).toBe(true);

    const shared = await listSharedDocs(q, "bob");
    expect(shared.find((d) => d.id === id)?.role).toBe("editor");
    expect((await listSharedDocs(q, "carol")).some((d) => d.id === id)).toBe(false);

    await deleteShare(q, id, "bob");
    const n = await getRole(q, "bob", id);
    expect(n).toBe("none");
    expect(canRead(n)).toBe(false);
  });

  it("malformed or unknown ids are none", async () => {
    expect(await getRole(q, "alice", "not-a-uuid")).toBe("none");
    expect(await getRole(q, "alice", "99999999-9999-4999-8999-999999999999")).toBe("none");
  });
});
