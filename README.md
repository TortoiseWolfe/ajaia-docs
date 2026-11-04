# Ajaia Docs

A small collaborative document editor: create, rename, format, autosave, reopen, upload files as new documents, and
share with other users as a viewer or editor.

**Live:** https://ajaia-docs-eight-green.vercel.app

**Sign-in is mocked.** There are no passwords. The sign-in page is a "Continue as" picker over three seeded users, and
the session is an httpOnly cookie signed with HMAC so it can't be edited by hand. Real auth was a deliberate cut.

## Try it in two minutes

| User | What they see on first sign-in |
| --- | --- |
| Alice Chen | Owns "Welcome to Ajaia Docs" and "Q4 launch plan" (shared with Bob as Editor). Has "Team offsite notes" from Carol as Viewer. |
| Bob Martinez | "Q4 launch plan" under Shared with me, editable. |
| Carol Okafor | Owns "Team offsite notes". Opening Alice's doc URLs gives a 404. |

Sample files to upload are in `samples/` (`sample.md`, `sample.docx`, `sample.txt`).

## Features

- **Documents:** create, rename inline (click the title), edit, autosave about 1 s after typing stops with a visible
  Saving / Saved / Couldn't save status, reopen from the home list.
- **Formatting:** bold, italic, underline, headings 1 to 3, bulleted and numbered lists, undo/redo.
- **Upload:** `.txt`, `.md` and `.docx` up to 1 MB become a new editable document. Headings, lists, bold, italic and
  underline are kept. Anything else (images, tables, raw HTML, scripts) is dropped by the editor schema.
- **Sharing:** the owner shares with a seeded user as **Viewer** (read-only) or **Editor**, changes the role, or
  revokes. Home has "My documents" and "Shared with me" with owner names and role badges.
- **Access on the server:** every API route and page asks one function (`lib/access.ts`) for the caller's role.
  Someone without access gets 404, the same as a missing document.
- **Export:** download any document you can read as Markdown (`.md`).
- **Conflict safety:** each save sends the version it started from. If someone else saved first, the server refuses
  with 409, keeps the refused edit in version history, and the editor says "This document was changed by someone
  else. Your edit was kept in History. Reload to see the latest."
- **Version history:** owners and editors open History to preview and restore earlier versions. A version is kept
  when a different person starts editing, after a 5-minute pause, and for every refused save (newest 5 per person
  per document). Restoring keeps the current text first, so a restore can be undone.

## Stack

Next.js 16 (App Router, TypeScript) on Vercel · Tiptap 3 (ProseMirror) · Neon Postgres via `@neondatabase/serverless`
with plain SQL · zod · `marked` and `mammoth` for import · Vitest with PGlite for tests.

Docker-first is my default for web projects. This one runs on host Node on purpose: it is a 4-hour build that deploys
to Vercel from source, so a container would only have added setup time.

## Run it locally

Needs Node 22 or newer (built and tested on Node 24) and a Postgres URL. The Neon free tier works: no paid services
are needed to run or review this.

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL and SESSION_SECRET
npm run db:seed                 # creates tables and the three users + sample docs (safe to re-run)
npm run dev                     # http://localhost:3000
```

With a linked Vercel project, `vercel env pull .env.local` fills the env file instead.

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon). |
| `SESSION_SECRET` | 32+ random characters; signs the session cookie. Required in production. |

## Commands

| Command | Does |
| --- | --- |
| `npm test` | Vitest (27 tests): access rules, stale-save rejection, version history and restore, import, zip-bomb guards, export, on an in-memory Postgres (PGlite) running the real `db/schema.sql`. No Docker, no network. |
| `npm run build` | Production build (TypeScript checked). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm run db:seed` | Schema + seed against `DATABASE_URL`. |
| `npm run check:api -- <url>` | Calls every API route as Alice, Bob and Carol and prints status codes (401, 403, 404, 409, uploads). |
| `npm run check:browser -- <url>` | Playwright drives the real editor: create, format, autosave, reload, export, share, viewer, 404, two-tab conflict, then restoring the refused edit from History. Saves `docs/screenshots/`. |

## Screenshots

From the production run of `npm run check:browser`: [home](docs/screenshots/1-home-alice.png),
[editor](docs/screenshots/2-editor-formatting.png), [share dialog](docs/screenshots/3-share-dialog.png),
[viewer](docs/screenshots/4-viewer-bob.png), [conflict](docs/screenshots/5-conflict.png),
[version history](docs/screenshots/6-history.png).

## Docs

- `ARCHITECTURE.md`: what was prioritized, data and access model, conflict handling, what was cut.
- `AI_WORKFLOW.md`: how AI tools were used, what was changed or rejected, how it was verified.
- `SUBMISSION.md`: what's included, what works, what's incomplete, what's next.
