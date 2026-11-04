import type { Doc, DocSummary, Query, Share, ShareRole, User, Version, VersionSummary } from "./types";

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

/** A pause longer than this between saves starts a new version in history. */
export const SNAPSHOT_GAP_MINUTES = 5;

/**
 * Optimistic concurrency: the write only lands if the row is still at the
 * version the client started editing from. One statement, so two concurrent
 * saves can't both win, and the history snapshot is part of that same statement.
 *
 * History: the state being replaced is kept as a version when a different
 * person is now saving, when the last save is older than SNAPSHOT_GAP_MINUTES,
 * or when the caller forces it (restore). Unchanged content is never kept.
 *
 * A refused (stale) save is kept as a "conflict" version, so the person who
 * lost the race doesn't lose their edit. Identical refused content is kept once.
 */
export async function saveContent(
  q: Query,
  id: string,
  content: unknown,
  baseVersion: number,
  userId: string,
  opts: { snapshot?: boolean; keepRejected?: boolean } = {},
): Promise<SaveResult> {
  const json = JSON.stringify(content);
  const rows = await q<{ version: number; updated_at: string }>(
    `with prev as (
       select id, content, version, updated_at, coalesce(updated_by, owner_id) as last_author
         from documents
        where id = $1::uuid and version = $3::int
     ),
     upd as (
       update documents d
          set content = $2::jsonb, version = d.version + 1, updated_at = now(), updated_by = $4::text
         from prev
        where d.id = prev.id and d.version = prev.version
       returning d.version, d.updated_at
     ),
     snap as (
       insert into document_versions (document_id, content, doc_version, author_id, saved_at, kind)
       select prev.id, prev.content, prev.version, prev.last_author, prev.updated_at, 'edit'
         from prev
        where exists (select 1 from upd)
          and prev.content is distinct from $2::jsonb
          and ($5::boolean
               or prev.last_author is distinct from $4::text
               or prev.updated_at < now() - make_interval(mins => $6::int))
     )
     select version, updated_at from upd`,
    [id, json, baseVersion, userId, opts.snapshot ?? false, SNAPSHOT_GAP_MINUTES],
  );
  if (rows[0]) return { ok: true, version: rows[0].version, updated_at: rows[0].updated_at };
  const current = await q<{ version: number }>("select version from documents where id = $1::uuid", [id]);
  if (!current[0]) return { ok: false, reason: "missing" };
  if (opts.keepRejected ?? true) {
    await q(
      `insert into document_versions (document_id, content, doc_version, author_id, kind)
       select $1::uuid, $2::jsonb, $3::int, $4::text, 'conflict'
        where not exists (
          select 1 from document_versions
           where document_id = $1::uuid and kind = 'conflict' and author_id = $4::text and content = $2::jsonb)`,
      [id, json, baseVersion, userId],
    );
  }
  return { ok: false, reason: "conflict", currentVersion: current[0].version };
}

export async function listVersions(q: Query, docId: string): Promise<VersionSummary[]> {
  return q<VersionSummary>(
    `select v.id, v.kind, v.doc_version, v.saved_at, v.author_id, u.name as author_name
       from document_versions v left join users u on u.id = v.author_id
      where v.document_id = $1::uuid
      order by v.saved_at desc, v.doc_version desc
      limit 50`,
    [docId],
  );
}

/** Always scoped to the document, so a version id from another document is "not found". */
export async function getVersion(q: Query, docId: string, versionId: string): Promise<Version | null> {
  const rows = await q<Version>(
    `select v.id, v.kind, v.doc_version, v.saved_at, v.author_id, u.name as author_name, v.content
       from document_versions v left join users u on u.id = v.author_id
      where v.id = $2::uuid and v.document_id = $1::uuid`,
    [docId, versionId],
  );
  return rows[0] ?? null;
}

export type RestoreResult =
  | { ok: true; version: number; updated_at: string; content: unknown }
  | Exclude<SaveResult, { ok: true }>;

/**
 * Restore = an ordinary optimistic save of the old content, with the current
 * state always kept first, so a restore can itself be undone from history.
 * A refused restore isn't kept as a conflict edit: nothing new was written.
 */
export async function restoreVersion(
  q: Query,
  docId: string,
  versionId: string,
  baseVersion: number,
  userId: string,
): Promise<RestoreResult> {
  const v = await getVersion(q, docId, versionId);
  if (!v) return { ok: false, reason: "missing" };
  const r = await saveContent(q, docId, v.content, baseVersion, userId, { snapshot: true, keepRejected: false });
  return r.ok ? { ...r, content: v.content } : r;
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
