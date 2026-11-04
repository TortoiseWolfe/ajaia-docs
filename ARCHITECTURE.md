# Architecture

A small editor, built in one 4-hour sitting. This note covers what I prioritized and why, how the data and access
model work, how two people are kept from overwriting each other, and what I left out on purpose.

## What I prioritized, and why

The brief asks for a lot of surface (editing, upload, sharing, persistence, deploy, tests, docs, video) in four hours.
I ranked by what a reviewer would hit first and what would hurt most if it were wrong:

1. **A live URL early.** Deployed to production with the database wired up before any feature work, so every later
   step was checked where the reviewer will check it, not just on my machine.
2. **Editing that doesn't lose work.** Autosave with a visible status, and a server-side version check so a stale tab
   can't silently overwrite a newer save. Losing someone's text is the one failure an editor can't recover from.
3. **Access rules that live in one place.** Sharing is the feature most likely to leak data. One function decides
   every role, and every route and page calls it.
4. **Upload that keeps structure.** Headings, lists and bold survive, because a flattened import is barely useful.
5. **Tests where bugs would be silent.** Access rules, the stale-save refusal and import fidelity, run against the
   real SQL schema.

Real-time co-editing and comments were cut so the above could be finished and verified. With the core verified on
production and time left, I added two stretch items: Markdown export, then version history, chosen because it
deepens priority 2 (the person who loses a conflict no longer loses their edit).

## Shape of the system

```
Browser                                  Vercel (Next.js 16, App Router)               Neon Postgres
───────                                  ───────────────────────────────               ─────────────
Tiptap editor ── PATCH /api/documents/:id ─► route handler ─► lib/access.ts getRole ─► documents
  (autosave, version)                           │                                      document_shares
Share dialog ─── /api/documents/:id/shares ─►   ├─► zod validation (lib/validation.ts)  users
Upload button ── POST /api/import ──────────►   └─► lib/db/repo.ts (plain SQL) ───────►
Server pages (home, doc) render with the same access check, so a stranger never gets the HTML.
```

- **Next.js App Router + TypeScript**, one deployable: pages and the JSON API live together. Server components render
  the home list and the document page; the editor itself is a client component.
- **Tiptap 3 (ProseMirror)**: one schema in `lib/editor/extensions.ts` is used by the browser editor *and* by the
  server-side import, so what the importer produces is exactly what the editor can display.
- **Neon Postgres** over HTTP (`@neondatabase/serverless`): no connection pool to manage on serverless functions.
- **Data layer takes a query function.** `lib/db/repo.ts` and `lib/access.ts` accept `query(text, params)`.
  Production passes Neon; tests pass PGlite (Postgres compiled to WebAssembly) running the same `db/schema.sql`, so
  tests exercise real SQL with no Docker and no network.

## Data model

```sql
users(id text pk, name, email unique)
documents(id uuid pk, owner_id → users, title 1..200 chars, content jsonb, version int, created_at, updated_at)
document_shares(document_id → documents, user_id → users, role 'viewer'|'editor', pk(document_id, user_id))
documents.updated_by → users            -- who made the latest content save (null = the owner)
document_versions(id uuid pk, document_id → documents, content jsonb, doc_version int,
                  author_id → users, saved_at, kind 'edit'|'conflict')
```

- **Content is stored as the editor's JSON**, not HTML. It round-trips exactly, it is what the editor loads natively,
  and it never needs to be injected as raw HTML anywhere. Size is capped at 512 KB per save.
- **One owner per document**, shares are rows. Ownership is a column rather than a share role, so it can't be revoked
  or duplicated by accident.
- Deleting a document or user cascades to its shares.

## Access model

`lib/access.ts` `getRole(user, doc)` returns `owner | editor | viewer | none` with one SQL query.

| Action | Owner | Editor | Viewer | No access |
| --- | --- | --- | --- | --- |
| Open / read | yes | yes | yes (read-only editor) | 404 |
| Edit content, rename | yes | yes | 403 | 404 |
| Share, change role, revoke | yes | 403 | 403 | 404 |
| Delete | yes | 403 | 403 | 404 |

- **No access is a 404, not a 403**, so a document's existence is never confirmed to someone who can't see it. A
  malformed id is treated the same way.
- The **page** applies the same check before rendering, so the HTML for a private doc is never sent to a stranger.
- **Sign-in is mocked**: a "Continue as" picker over three seeded users. The session cookie is `httpOnly`,
  `SameSite=Lax`, `Secure` in production, and its value is `userId.HMAC-SHA256(userId, SESSION_SECRET)`, compared in
  constant time. Editing the user id by hand breaks the signature (verified: a forged cookie gets 401).

## Conflict handling

Real-time co-editing was out of scope, but two people sharing an editable doc still must not silently overwrite each
other. I used **optimistic concurrency**:

1. The page loads the document with its `version`.
2. Each autosave sends `{ content, version }` (the version it started from).
3. The server runs one statement:
   `UPDATE documents SET content=$2, version=version+1 WHERE id=$1 AND version=$3 RETURNING version`.
   Being a single statement, two concurrent saves can't both win.
4. No row updated and the doc exists → **409**. The refused content is stored as a version (below). The editor stops
   autosaving, becomes read-only, and says "This document was changed by someone else. Your edit was kept in History.
   Reload to see the latest." with a Reload button.

Autosave fires about 1 s after typing stops. If a save is in flight when more typing happens, one more save is
queued for when it returns (with the new version), so the last keystrokes are never dropped and saves never race each
other from the same tab. Leaving the page with a pending save flushes it with `keepalive`, and the browser warns if a
save hasn't landed.

Rename is last-write-wins and does not bump the content version, so renaming in one tab doesn't knock an open editor
in another tab into a conflict.

## Version history

The point is that nobody loses work, including the person who loses a conflict.

- **When a version is kept.** Inside the same single save statement (a data-modifying CTE), the state being replaced
  is copied to `document_versions` when a different person is now saving, when the last save is more than 5 minutes
  old, or on restore. Unchanged content is never copied. The 1-second autosave therefore produces one version per
  stretch of work, not one per keystroke, and the one-winner guarantee above still holds.
- **Refused saves are kept.** A 409 stores the refused content as a `conflict` version, once per identical content,
  and only when it was based on a real earlier version. Each person keeps the newest 5 per document, so stale saves
  sent in a loop can't flood history (found by the automated security review).
- **Restore** is an ordinary optimistic save of the old content that always keeps the current state first, so every
  restore can be undone. A refused restore stores nothing. It is enabled only once the editor says Saved, and the
  editor is locked for the round trip so typing can't race it.
- **Rename doesn't touch the "last edited" time**, so it can't reset the 5-minute pause rule.
- **Access:** owners and editors only, as in Google Docs (viewers 403, strangers 404). Version ids are always looked
  up together with their document id, so a version id from another document is a 404.
- **Preview** renders through a read-only editor with the same schema, never as raw HTML.

## Upload and import

`.txt`, `.md` and `.docx`, 1 MB max, each becomes a new document owned by the uploader.

- `.md` → `marked` → HTML; `.docx` → `mammoth` → HTML; `.txt` → paragraphs (escaped).
- HTML → Tiptap JSON on the server with the shared schema. **The schema is the sanitizer**: any tag it doesn't know
  (script, style, iframe, img, tables, event-handler attributes) is dropped. Raw HTML inside Markdown is discarded
  before that, as a second line.
- **Zip-bomb guards for .docx**: the 1 MB cap only bounds the compressed size, so the server first checks the sizes
  declared in the zip directory, then inflates each entry as a stream counting real bytes and stops at 20 MB. The
  second check exists because headers can lie (a test forges them to prove it).

## Validation and errors

zod on every request body: title 1 to 200 characters, content must be a `doc` node under 512 KB, role must be
`viewer` or `editor`, version a positive integer. Every user-facing error has plain wording (empty title, file too
large, unsupported type, couldn't save, conflict).

## Testing

`npm test` (Vitest, 27 tests, about 2 s): access rules through the data layer on PGlite (owner, editor, viewer,
stranger, upgrade, revoke, malformed id), stale-version refusal, version history (when snapshots are and aren't
taken, refused edits kept once and capped, restore and undoing it, stale restore, a version id from another
document), Markdown/.docx/.txt import fidelity and HTML stripping, both zip-bomb guards, Markdown export.

Beyond unit tests, two scripts check the deployed app: `scripts/smoke.sh` (every API route as each user) and
`scripts/browser-check.mjs` (Playwright driving the real editor, 26 checks, including the two-tab conflict, restoring the refused edit from History, and deleting from the UI).

## Deliberate cuts

| Cut | Why | What it would take |
| --- | --- | --- |
| Real-time co-editing | Needs a sync layer (Yjs + a websocket service); the version check covers the safety need. | Yjs + Hocuspocus or Liveblocks, about 1 to 2 days. |
| Real authentication | Not what's being evaluated; mocked sign-in shows the access model just as well. | Auth.js or Clerk; the `users` table and cookie check stay. |
| Sharing by email to outside people | Needs invitations and real accounts. | Invite table + email, after real auth. |
| Comments | Its own feature with its own UI and threading. | A comments table anchored to text with a Tiptap mark, about a day. |
| Diffs between versions, pruning old versions | Preview and restore already cover recovery. | `prosemirror-changeset` for diffs; a retention rule (every version for a day, then hourly). |
| Images in documents, PDF upload | Needs file storage and a PDF text extractor; adds risk for little gain here. | Blob storage + Tiptap Image; `pdfjs` for text. |
| Docker | Docker-first is my default, but this deploys to Vercel from source and the clock favored host Node. | A two-service compose file (app + Postgres). |
