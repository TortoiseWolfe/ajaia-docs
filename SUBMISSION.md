# Ajaia Docs: a small collaborative document editor for writing, importing and sharing documents

I built a lightweight Google-Docs-style editor: create and rename documents, format them, upload files as new
documents, and share them with other people as viewers or editors. It matters because a shared document is only
useful if nobody silently loses work and nobody sees what they shouldn't, so those two things got the most care.
It is deployed and working end to end; real-time co-editing and real sign-in are the main things deliberately left out.

- Live app: [Ajaia Docs, sign in as Alice, Bob or Carol](https://ajaia-docs-eight-green.vercel.app)
- Code: [the source with full git history](https://github.com/TortoiseWolfe/ajaia-docs)
- Walkthrough video: [3 to 5 minute walkthrough](VIDEO_LINK_PENDING)

<details>
<summary>Approach and decomposition: 7 pieces, 7 built, 6 cut</summary>

Get a live URL with a real database first, so every later check happens where the reviewer will look.

> Next.js 16 on Vercel plus Neon Postgres, deployed with a "3 users" check before any feature work.

The editor: write, format, and never lose the last few seconds of typing.

> Tiptap 3 with bold, italic, underline, H1 to H3, bulleted and numbered lists, undo/redo. Autosave about 1 s after
> typing stops, with a visible Saving / Saved / Couldn't save status. components/DocEditor.tsx

Sharing: one owner per document, who can let others view or edit, and take it back.

> One function decides every role: lib/access.ts. Every API route and page calls it. No access returns 404.

Conflict safety: two people editing the same document can't silently overwrite each other.

> Each save sends the version it started from; the server updates only if it still matches, else 409 and the editor
> says "This document was changed by someone else. Reload to see the latest."

Upload: a .txt, .md or .docx file becomes a new editable document, keeping headings and lists.

> marked and mammoth to HTML, then into the editor's own schema on the server, which drops anything it doesn't know.
> lib/import.ts, with zip-bomb guards for .docx.

Tests where a bug would be silent: access rules, stale saves, import fidelity.

> Vitest on PGlite (Postgres in WebAssembly) running the real db/schema.sql. 18 tests.

Stretch: export any document to Markdown.

> One button, turndown on the editor's HTML. lib/editor/export-markdown.ts

<details>
<summary>The short spec I wrote first</summary>

In: create, rename, rich-text edit, autosave with status, reopen; upload .txt/.md/.docx (1 MB) as a new doc; share
with a seeded user as Viewer or Editor, revoke; "My documents" and "Shared with me"; read-only for viewers; 404 for
strangers; Postgres persistence with a version column; 409 on a stale save; mocked sign-in with an HMAC-signed cookie.

Out: real-time co-editing, comments, version history, real auth, sharing by email to outside people, images in
documents, PDF upload.

Done when: production URL works in a private window as Alice, Bob and Carol; npm test green; build clean.

</details>

</details>

<details>
<summary>The deliverable: deployed and working</summary>

1. Open the live app and choose "Continue as Alice Chen". You'll see "My documents" (two) and "Shared with me" (one
   from Carol, marked Viewer).
2. Click "New document". Rename it by clicking the title. Type, use every toolbar button, and watch the status go to
   "Saved". Refresh: everything is still there.
3. Click "Upload file" and pick a .md or .docx (samples are in the repo's samples folder). It opens as a new document
   with headings and lists kept.
4. Click "Share", pick Bob, choose Viewer. Sign out, continue as Bob: the document is under "Shared with me" and
   read-only.
5. Continue as Carol and paste the document's URL: "Document not found" (a 404).
6. As Alice, open the same document in two tabs and type in both: the second tab to save is told to reload.

> Stack: Next.js 16 (App Router, TypeScript), Tiptap 3, Neon Postgres, zod, Vitest + PGlite, hosted on Vercel.
> Sign-in is mocked by design: no password, pick a seeded user. The cookie is httpOnly and HMAC-signed.

</details>

<details>
<summary>How I used AI: 8 prompts, 11 corrections logged, 4 AI tools</summary>

The full log, with every correction and how it was caught, is in AI_WORKFLOW.md. The short version follows.

<details>
<summary>The prompts, word for word (8)</summary>

Prompt 1, minute 5, to Claude Code (Opus). Start the build from the plan approved before the clock.

```text
Read
```

> It found the approved plan file, checked the clock, and started Phase 1 (scaffold and deploy).

Prompt 2, minute 9. Check the plan against my usual Docker-first rule.

```text
are you making it docker first like all our other projects too?
```

> No, by plan: Vercel builds from source and the clock favored host Node. Stated in the README.

Prompt 3, minute 10. Reuse existing tooling for the video.

```text
we've recently added helpers for recording beta testing, we can add that as the video they are asking for at the end?
```

> Agreed for the screen capture, with my own voice for the decisions.

Prompt 4, minute 11. Allow parallel work.

```text
if it helps with pace and timing you can delegate to tmux subagents too?
```

> The test suite went to a helper agent with a narrow file scope while the main session built the UI.

Prompts 5 to 8, minutes 13 to 18: unblocking the database (the Neon terms needed a human click), confirming no extra
backend service was needed, and running the first production deploy myself.

```text
if you need me to click on legal terms give me the link to get it done?
what about backend, do we need supabase or something?
still don't see a link, what did you want me to click on?
! vercel deploy --prod --yes
```

</details>

<details>
<summary>One place the AI was wrong, and how I caught it</summary>

The autosave sent its last save with a browser option that silently refuses large requests, so leaving a long
document right after typing lost the last words.

> fetch(..., { keepalive: true }) is capped at 64 KiB per request by browsers; a document over that dropped its final
> save with no warning.

How I caught it: a second AI agent reviewed the code cold. I didn't take its word for it: I wrote a browser test that
pastes about 90 KB, leaves within a second, and checks the server.

> scripts/browser-check.mjs, "large doc: last words saved after leaving quickly": FAIL on the old code (20/21),
> PASS on the fix (21/21). Fix: keepalive only under 60 KB.

</details>

<details>
<summary>Which tool did what: 4 AI tools</summary>

- Claude Code, main session: plan, all code, deploys, verification scripts, docs.
- Helper agent: wrote the test suite in parallel.
- Review agent: blind code review, found three real bugs.
- Automated security review on each commit: caught the .docx zip-bomb risk twice.

> Model: Claude Opus. Session transcript exported with secrets scrubbed (included in the folder if attached).

</details>

<details>
<summary>Honesty lines</summary>

I directed and verified the work myself, and no other person helped. The code was written with Claude Code as
described above. I started from an empty folder and the standard create-next-app scaffold.

</details>

</details>

<details>
<summary>Decisions and tradeoffs: 5 decisions</summary>

<details>
<summary>Decision 1: optimistic version check instead of real-time co-editing</summary>

I traded live cursors for a guarantee that nobody silently overwrites anyone, which is what actually protects work.

> Status: accepted. Problem: two people can edit a shared document; how do we stop lost updates in 4 hours?
> Options considered: real-time sync (Yjs plus a websocket service); last-write-wins; version check with 409.
> Chosen: version check, because it is one SQL statement, fully testable, and fails loudly instead of silently.
> Cost: the second person must reload and re-apply their edit; real-time is the first thing I'd add next.

</details>

<details>
<summary>Decision 2: store the editor's JSON, not HTML</summary>

Keep the document in the editor's own format, so what's saved is exactly what's shown.

> Status: accepted. Options: HTML; Markdown; editor JSON in a jsonb column. Chosen: JSON, because it round-trips
> exactly, needs no HTML sanitizing on render, and the same schema validates imports. Cost: export needs a conversion
> step (done for Markdown).

</details>

<details>
<summary>Decision 3: one access function, and 404 instead of 403 for strangers</summary>

One gatekeeper, and it never confirms a door exists to someone without a key.

> Status: accepted. lib/access.ts returns owner, editor, viewer or none; every route and page calls it. Strangers and
> malformed ids get 404. Cost: none worth noting; it also made access testable in isolation.

</details>

<details>
<summary>Decision 4: mocked sign-in, but a cookie that can't be forged</summary>

Skip passwords, keep the lock real.

> Status: accepted. Options: real auth (Auth.js or Clerk); a plain user-id cookie; an HMAC-signed user-id cookie.
> Chosen: signed cookie, because it shows the access model honestly in minutes and can't be edited to become someone
> else (a forged cookie gets 401). Cost: no real accounts; the users table and check stay when real auth is added.

</details>

<details>
<summary>Decision 5: tests on real SQL without Docker</summary>

Test against the real recipe, not a stand-in.

> Status: accepted. The data layer takes a query function; tests pass PGlite running db/schema.sql. Cost: PGlite is
> single-connection, so true concurrent-save races are covered by the single-statement design rather than a test.

</details>

</details>

<details>
<summary>What I verified: 18 unit tests, 21 browser checks, every API route, all against production</summary>

I checked it the way a reviewer will use it: on the live site, as each of the three people.

> npm test, npm run build, ESLint, scripts/smoke.sh and scripts/browser-check.mjs against the production URL.

```text
Test Files  4 passed (4)
     Tests  18 passed (18)

browser-check against https://ajaia-docs-eight-green.vercel.app
21/21 checks passed

smoke.sh against production
api no cookie: 401 · forged cookie: 401 · stale save: 409 · stranger: 404 · viewer write: 403
upload md / docx / txt: 201 · upload pdf: 415
```

Not checked: behavior under heavy concurrent load, and browsers other than Chromium (the editor library supports
them, but I didn't run them).

</details>

<details>
<summary>What I'd do next: 4 items, in priority order</summary>

1. Real-time co-editing with presence: removes the reload step entirely. Yjs with a hosted provider, 1 to 2 days.
2. Real sign-in and email invitations: needed before anyone outside a demo uses it. Auth.js plus an invites table,
   about 1 day.
3. Version history with restore: the natural safety net next to autosave. A versions table written on save, half a day.
4. Images and PDF import: blob storage plus the Tiptap image extension, and PDF text extraction, about 1 day.

</details>

<details>
<summary>Time log: TOTAL_PENDING minutes of 240</summary>

| Minute | What happened |
| --- | --- |
| 0 | Started the assignment at 7:43 PM |
| 5 | Fresh Claude Code session reads the approved plan; Next.js scaffolded |
| 13 | Schema, data layer, access rules, API, editor UI committed; helper agent's 12 tests verified |
| 15 | Security review flags .docx zip bombs; guard added with a test |
| 17 | Neon terms accepted; database provisioned and seeded |
| 18 | First production deploy |
| 20 | Every API route checked on production as all three users |
| 21 | Browser click-through on production: 19/19; screenshots taken |
| 23 | Stronger .docx guard; Markdown export shipped (stretch) |
| 27 | Three review-agent bugs fixed and proven; 21/21 on production |
| 28 | Architecture, AI workflow and submission write-ups |
| VIDEO_MINUTE | Walkthrough video recorded |
| SUBMIT_MINUTE | Submitted |

</details>

<details>
<summary>Technical details: stack, commands, links</summary>

```text
Next.js 16.4 (App Router, TypeScript) · React 19 · Tiptap 3.32 · Neon Postgres (@neondatabase/serverless 1.2)
zod 4 · marked 18 · mammoth 1.13 · turndown 7 · Vitest 5 · PGlite · Playwright 1.55

npm install
vercel env pull .env.local     # or copy .env.example and fill DATABASE_URL, SESSION_SECRET
npm run db:seed
npm run dev
npm test
npm run check:api -- https://ajaia-docs-eight-green.vercel.app
npm run check:browser -- https://ajaia-docs-eight-green.vercel.app

Deployed: Vercel (production), database: Neon (free tier, via Vercel Marketplace)
```

</details>
