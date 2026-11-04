import type { Query, Role } from "./db/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids reach SQL as uuids; a malformed one must become a 404, not a database error. */
export const isUuid = (s: string) => UUID_RE.test(s);

/**
 * The single answer to "what may this user do with this document?".
 * Every route and page calls this; nothing else decides access.
 * A malformed id or a document the user can't see both come back "none",
 * so callers return the same 404 either way and never confirm a doc exists.
 */
export async function getRole(q: Query, userId: string, docId: string): Promise<Role> {
  if (!isUuid(docId)) return "none";
  const rows = await q<{ owner_id: string; share_role: "viewer" | "editor" | null }>(
    `select d.owner_id, s.role as share_role
       from documents d
       left join document_shares s on s.document_id = d.id and s.user_id = $2
      where d.id = $1`,
    [docId, userId],
  );
  const row = rows[0];
  if (!row) return "none";
  if (row.owner_id === userId) return "owner";
  return row.share_role ?? "none";
}

export const canRead = (r: Role) => r !== "none";
export const canEdit = (r: Role) => r === "owner" || r === "editor";
export const isOwner = (r: Role) => r === "owner";
