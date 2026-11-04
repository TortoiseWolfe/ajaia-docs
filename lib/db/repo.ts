import type { Doc, DocSummary, Query, Share, ShareRole, User } from "./types";

// Plain SQL, parameterised everywhere. Every function takes the query function
// first so tests can run it against PGlite.

export async function listUsers(q: Query): Promise<User[]> {
  return q<User>("select id, name, email from users order by name");
}

export async function getUser(q: Query, id: string): Promise<User | null> {
  const rows = await q<User>("select id, name, email from users where id = $1", [id]);
  return rows[0] ?? null;
}

export async function listOwnedDocs(q: Query, userId: string): Promise<DocSummary[]> {
  return q<DocSummary>(
    `select d.id, d.title, d.owner_id, u.name as owner_name, d.updated_at, 'owner' as role
       from documents d join users u on u.id = d.owner_id
      where d.owner_id = $1
      order by d.updated_at desc`,
    [userId],
  );
}

export async function listSharedDocs(q: Query, userId: string): Promise<DocSummary[]> {
  return q<DocSummary>(
    `select d.id, d.title, d.owner_id, u.name as owner_name, d.updated_at, s.role
       from document_shares s
       join documents d on d.id = s.document_id
       join users u on u.id = d.owner_id
      where s.user_id = $1
      order by d.updated_at desc`,
    [userId],
  );
}

export async function createDocument(
  q: Query,
  ownerId: string,
  title: string,
  content: unknown,
): Promise<{ id: string }> {
  const rows = await q<{ id: string }>(
    "insert into documents (owner_id, title, content) values ($1, $2, $3::jsonb) returning id",
    [ownerId, title, JSON.stringify(content)],
  );
  return rows[0];
}

export async function getDocument(q: Query, id: string): Promise<Doc | null> {
  const rows = await q<Doc>(
    `select d.id, d.title, d.owner_id, u.name as owner_name, d.content, d.version, d.updated_at
       from documents d join users u on u.id = d.owner_id
      where d.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function renameDocument(q: Query, id: string, title: string): Promise<void> {
  await q("update documents set title = $2, updated_at = now() where id = $1", [id, title]);
}

export type SaveResult =
  | { ok: true; version: number; updated_at: string }
  | { ok: false; reason: "conflict"; currentVersion: number }
  | { ok: false; reason: "missing" };

/**
 * Optimistic concurrency: the write only lands if the row is still at the
 * version the client started editing from. One statement, so two concurrent
 * saves can't both win.
 */
export async function saveContent(
  q: Query,
  id: string,
  content: unknown,
  baseVersion: number,
): Promise<SaveResult> {
  const rows = await q<{ version: number; updated_at: string }>(
    `update documents
        set content = $2::jsonb, version = version + 1, updated_at = now()
      where id = $1 and version = $3
      returning version, updated_at`,
    [id, JSON.stringify(content), baseVersion],
  );
  if (rows[0]) return { ok: true, version: rows[0].version, updated_at: rows[0].updated_at };
  const current = await q<{ version: number }>("select version from documents where id = $1", [id]);
  if (!current[0]) return { ok: false, reason: "missing" };
  return { ok: false, reason: "conflict", currentVersion: current[0].version };
}

export async function deleteDocument(q: Query, id: string): Promise<void> {
  await q("delete from documents where id = $1", [id]);
}

export async function listShares(q: Query, docId: string): Promise<Share[]> {
  return q<Share>(
    `select s.user_id, u.name, u.email, s.role
       from document_shares s join users u on u.id = s.user_id
      where s.document_id = $1
      order by u.name`,
    [docId],
  );
}

export async function upsertShare(q: Query, docId: string, userId: string, role: ShareRole): Promise<void> {
  await q(
    `insert into document_shares (document_id, user_id, role) values ($1, $2, $3)
     on conflict (document_id, user_id) do update set role = excluded.role`,
    [docId, userId, role],
  );
}

export async function deleteShare(q: Query, docId: string, userId: string): Promise<void> {
  await q("delete from document_shares where document_id = $1 and user_id = $2", [docId, userId]);
}
