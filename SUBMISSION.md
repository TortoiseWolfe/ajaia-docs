# Ajaia Docs: a small collaborative document editor for writing, importing and sharing documents

I built a lightweight Google-Docs-style editor: create and rename documents, format them, upload files as new
documents, and share them with other people as viewers or editors. It matters because a shared document is only
useful if nobody silently loses work and nobody sees what they shouldn't, so those two things got the most care.
It's deployed and working end to end; real-time co-editing and real sign-in are the main things deliberately left out.

- Live app: [Ajaia Docs, sign in as Alice, Bob or Carol](https://ajaia-docs-eight-green.vercel.app)
- Code: [the source with full git history](https://github.com/TortoiseWolfe/ajaia-docs)
- Drive folder: [everything listed below](https://drive.google.com/drive/folders/1wmhOH4Pk6CNueEoesRvVSCAt4tx1XK7A)
- Walkthrough video: [4 minute 44 second walkthrough on YouTube (unlisted), narrated by an AI (artificial intelligence) voice
  reading my script](https://www.youtube.com/watch?v=MGZJtXxeW8Y). The same file is in the Drive folder: [Drive copy](https://drive.google.com/file/d/1p2NOfOJFPFXRoiOgZm5Vo8p5nHLC-iyn/view).

**Test accounts:** no passwords. On the sign-in page choose Alice Chen, Bob Martinez or Carol Okafor. Bob can
already edit Alice's "Q4 launch plan", and Alice can view Carol's "Team offsite notes", so the sharing flows are
visible on first sign-in. Sample files to upload are in the code's samples folder. Nothing costs money to
review or run.

## What's included in this folder

| File | What's in it |
| --- | --- |
| SUBMISSION.md | This file. |
| README.md | Setup, environment variables, seeded users, commands, supported upload types. |
| ARCHITECTURE.md | What I prioritized and why, data and access model, conflict handling, cuts. |
| AI_WORKFLOW.md | AI tools used, where they sped things up, what I changed or rejected, how it was verified. |
| VIDEO_URL.txt | The walkthrough video link. |
| ajaia-docs-walkthrough.mp4 | The walkthrough video itself, the same file as the YouTube link. |
| screenshots/ | Six screenshots from the production browser check: home, editor, share dialog, viewer, conflict, version history. |
| ajaia-docs-source.zip | The full source (git archive of main: no node_modules, no environment files, no secrets). |

## Status

**Working end to end** (checked on the live site as all three users):
sign-in picker; create, rename, edit with bold, italic, underline, H1 to H3, both list types, undo/redo; autosave with
a visible status; reopen after refresh with formatting intact; upload .txt, .md and .docx as a new document; share as
Viewer or Editor, change role, revoke; "My documents" and "Shared with me" with role badges; read-only editor for
viewers; 404 for people without access; 409 on a stale save, with the refused edit kept; version history with
preview and restore; delete; Markdown export.

**Incomplete or deliberately left out:**
real-time co-editing and presence; comments; real sign-in; inviting people by email; images in documents; PDF (Portable Document Format) upload;
a diff view between versions. On a conflict the second person reloads; their refused edit is kept in History to
restore or copy from, but nothing merges automatically. Rename is last-write-wins. Tested in Chromium only.

**Next, with another 2 to 4 hours:**
1. A "who else is here" indicator (about 1 hour): a heartbeat every few seconds, shown as avatars on the document.
2. Show what changed between versions (about 1 hour): a diff view in the History panel.
3. Prune old versions (about 30 minutes): keep every version for a day, then one per hour. Refused edits are
   already capped.
4. Run the browser check in Firefox and WebKit too (about 15 minutes).

<details>
<summary>Approach and decomposition: 8 pieces, 8 built, 5 cut</summary>

Get a live URL (a public web address) with a real database first, so every later check happens where the reviewer will look.

> Next.js 16 on Vercel plus Neon Postgres, deployed with a "3 users" check before any feature work.

The editor lets you write and format, and it never loses the last few seconds of typing.

> Tiptap 3 with bold, italic, underline, H1 to H3, bulleted and numbered lists, undo/redo. Autosave about 1 s after
> typing stops, with a visible Saving / Saved / Couldn't save status. components/DocEditor.tsx

Sharing gives each document one owner, who can let others view or edit and can take that back.

> One function decides every role: lib/access.ts. Every API route and page calls it. No access returns 404.

Conflict safety means two people editing the same document can't silently overwrite each other.

> Each save sends the version it started from; the server updates only if it still matches, else 409 and the editor
> says "This document was changed by someone else. Reload to see the latest."

Upload turns a .txt, .md or .docx file into a new editable document, keeping headings and lists.

> marked and mammoth to HTML, then into the editor's own schema on the server, which drops anything it doesn't know.
> lib/import.ts, with zip-bomb guards for .docx.

Tests where a bug would be silent: access rules, stale saves, import fidelity.

> Vitest on PGlite (Postgres in WebAssembly) running the real db/schema.sql. 27 tests.

The first stretch item exports any document to Markdown.

> One button, turndown on the editor's HTML. lib/editor/export-markdown.ts

The second stretch item is version history, so the person who loses a conflict doesn't lose their edit.

> Versions written inside the same single save statement; a refused save kept as a version (newest 5 per person);
> preview and restore, which keeps the current text first so it can be undone. lib/db/repo.ts,
> components/HistoryPanel.tsx

<details>
<summary>The short spec I wrote first</summary>

The spec covered create, rename, rich-text edit, autosave with status, reopen; upload .txt/.md/.docx (1 MB) as a new
doc; share with a seeded user, who can view or edit, and revoke; "My documents" and "Shared with me"; read-only for viewers; 404 for
strangers; Postgres persistence with a version column; 409 on a stale save; mocked sign-in with an HMAC-signed cookie.

It left out real-time co-editing, comments, version history, real auth, sharing by email to outside people, images
in documents and PDF upload.

It was done when the production URL worked in a private window as Alice, Bob and Carol, npm test was green, and the
build was clean.

</details>

</details>

<details>
<summary>The deliverable: deployed and working</summary>

1. Open the live app and choose "Continue as Alice Chen". You'll see "My documents" (two) and "Shared with me" (one
   from Carol, marked Viewer).
2. Click "New document". Rename it by clicking the title. Type, use every toolbar button, and watch the status go to
   "Saved". Refresh, and everything is still there.
3. Click "Upload file" and pick a .md or .docx (samples are in the code's samples folder). It opens as a new document
   with headings and lists kept.
4. Click "Share", pick Bob, choose Viewer. Sign out, continue as Bob: the document is under "Shared with me" and
   read-only.
5. Continue as Carol and paste the document's URL: "Document not found" (a 404).
6. As Alice, open the same document in two tabs and type in both: the second tab to save is told to reload. Reload
   it and click History, where its refused edit is marked "Kept after a conflict". Restore it.

> Stack: Next.js 16 (App Router, TypeScript), Tiptap 3, Neon Postgres, zod, Vitest + PGlite, hosted on Vercel.
> Sign-in is mocked by design: no password, pick a seeded user. The cookie is httpOnly and HMAC-signed.

</details>

<details>
<summary>How I used AI: 39 prompts, 21 corrections logged, 6 AI tools</summary>

The full log, with every correction and how it was caught, is in AI_WORKFLOW.md.

<details>
<summary>The prompts, word for word (39)</summary>

Prompt 1, minute 5, to Claude Code (Opus). Start the build from the plan I approved at minute 3.

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

Prompts 5 to 8, minutes 13 to 18, unblocked the database (the Neon terms needed a human click) and confirmed no extra
backend service was needed. The last one ran the first production deploy, which means putting the live site up, myself.

```text
if you need me to click on legal terms give me the link to get it done?
what about backend, do we need supabase or something?
still don't see a link, what did you want me to click on?
! vercel deploy --prod --yes
```

Prompts 9 to 12, minutes 29 to 40, answered its four questions (a public repo, which means the code is open on
GitHub; the video; the honesty line; the Drive folder). They also asked for a second review with the full assignment
pasted in, and for the video script.

```text
let' also use the tmux subagent to run a code review on it for good measure?
does verbal imply my voice directly, I'll need a script for the video walk through.
where will I look for the script to practice reading it?
I'll need a clickable link to that
```

> The second review checked every doc claim against the code. It found stale counts and a promised Delete with no
> button, and the "working / incomplete / next" sections were missing; all fixed. I planned to narrate the video in my own voice,
> since the assignment grades verbal communication; prompts 20 to 26 explain why the final uses an AI voice.

Prompts 13 to 19, minutes 44 to 78, covered the voice-over plan and more stretch work while I practiced. Then came a
handoff and a fresh session, where I pasted in the portal page and asked for one more feature and a slower cut.

```text
so I'm waiting on you to make the video cut first then I play and talk over it on OBS?
seems like we're making good time, while I'm working on my recordig should you be addressing the stretch goals or even finish them first?
don't forget to hand off, context is getting long too?
I'm still practice reading it aloud, it maybe paced a little fast for me anyways, add the most impressive feature and recut it at a slower pace to help my reading and I'll keep practicing on the one we have.
also keep the transcript on screen as long as possibe so I can finish reading it
! npm run db:seed
let' also use the tmux subagent to run a code review on it for good measure?
```

> Version history, built test-first and live on production in about 20 minutes. Claude's own attempt at the
> production schema change was blocked by the permission layer, so I ran it. A second blind review of just that
> feature found four smaller issues; all fixed and redeployed.

Prompts 20 to 26, minutes 92 to 135, were about recording the voice-over. Two are paraphrased because of their language.

```text
mayb clip my lsst few seconds, what I improved after the script : "C:\Users\JonPo\Videos\2026-10-27 16-03-04.mkv"
I closed it, put your video back on screen   (three times, before each take)
[paraphrased] You opened a video on my screen and interrupted my take when I was almost done; prepare to hand off.
[paraphrased] That ruined the take, so I deleted it.
fuck it, I don't have time to keep doing takes, use the AI voice and get it finished
```

> My first take was complete but very quiet, and I wanted a better one. While I was recording it, Claude opened its
> processed version of the first take on my screen and interrupted the retake. With the clock running down, the final
> video uses an AI voice (Piper, offline) reading the script I approved; it opens with a "Narration: AI voice." label.

Prompts 27 to 29, minutes 140 to 146, were about the voice check I use on client email.

```text
did you give that any of our usual voice checks, probably should have done that with the script too
I don't care if it's an engineering submission, it's still going to be watched by people so give it the same voice check we use on emails
and we should still be able to export it to youtube for the unlisted link
```

> The second one was followed by a pasted copy of Claude's reply, which had said most of the check's hits didn't apply
> to an engineering submission. Claude hadn't run the check on the script or on this text. With the full check, the
> script failed on 8 points and this text on 37. Both were fixed, and the video was re-rendered from the fixed script.
> YouTube uploads go through Hatch. That's the agent that does my YouTube clicks, and it only picks up notes between
> 8 AM and 10 PM, so I woke it, and it uploaded the video as unlisted.

Prompts 30 to 35, minutes 150 to 160, came while I tried one more voice-over take and then stopped to finish.

```text
which three did we agree to skip?
why are you giving the youtube upload to me, if you can't do that directly then route it through Hatch
do what you can with that, give me a quite version and I'll try my take again while you finish up
you can delete the other unused takes to avoid confusion
why wouldn't you open it on my screen when it's ready?
don't wait on me, finish the assignment
```

> Five old cuts went to the Windows Recycle Bin, and the AI-voice video re-rendered from the fixed script is the final
> one.

Prompts 36 to 39, minutes 165 to 170, got the YouTube upload done tonight.

```text
no, now
8am is too late
I can wake Hatch up, you should have already sent it,
tell Hatch to send it back to you when it's done, quite adding manual steps for me when you know what to do
```

> Claude had left Hatch a note and told me it would be picked up in the morning. I woke Hatch, and Claude rewrote the
> note so the link came back to Claude, which put it into this text.

</details>

<details>
<summary>One place the AI was wrong, and how I caught it</summary>

The autosave sent its last save with a browser option that silently refuses large requests, so leaving a long
document right after typing lost the last words.

> fetch(..., { keepalive: true }) is capped at 64 KiB per request by browsers; a document over that dropped its final
> save with no warning.

I caught it because a second AI agent reviewed the code cold. I didn't take its word for it, so I wrote a browser test
that pastes about 90 KB and leaves within a second, then checks the server.

> scripts/browser-check.mjs, "large doc: last words saved after leaving quickly": FAIL on the old code (20/21),
> PASS on the fix (21/21). The fix sends keepalive only under 60 KB.

</details>

<details>
<summary>Which tool did what: 6 AI tools</summary>

- Claude Code, main session: plan, all code, deploys, verification scripts, docs.
- Helper agent: wrote the test suite in parallel.
- Review agents: two blind code reviews. The first found three real bugs; the second, of version history only, four smaller ones.
- Second review agent: checked every doc claim against the code and the deliverables against the assignment.
- Automated security review on each commit, meaning each saved change to the code. It caught the .docx zip-bomb risk
  twice, and a way to flood version history.
- Piper TTS (offline neural voice): the walkthrough narration, reading my script.

> Model: Claude Opus. Every prompt is quoted word for word above and in AI_WORKFLOW.md.

</details>

<details>
<summary>Honesty lines</summary>

I directed and verified the work myself, and no other person helped. The code was written with Claude Code as
described above. I started from an empty folder and the standard create-next-app scaffold.

</details>

</details>

<details>
<summary>Decisions and tradeoffs: 6 decisions</summary>

<details>
<summary>Decision 1: optimistic version check instead of real-time co-editing</summary>

I traded live cursors for a guarantee that nobody silently overwrites anyone, which is what actually protects work.

> Status: accepted. The problem was stopping lost updates in 4 hours when two people can edit a shared document. I
> weighed real-time sync (Yjs plus a websocket service), last-write-wins, and a version check with 409. I chose the
> version check because it's one SQL statement and fully testable, and it fails loudly instead of silently. The cost is
> that the second person must reload. Their refused edit is kept in History to restore, but nothing merges
> automatically. Real-time is the first thing I'd add next.

</details>

<details>
<summary>Decision 2: store the editor's own format, not web page markup</summary>

Keep the document in the editor's own JSON (structured document data), so what's saved is exactly what's shown.

> Status: accepted. I weighed HTML, Markdown, and editor JSON in a jsonb column. I chose JSON because it round-trips
> exactly and needs no HTML sanitizing on render, and the same schema validates imports. The cost is that export needs
> a conversion step (done for Markdown).

</details>

<details>
<summary>Decision 3: one access function, and 404 instead of 403 for strangers</summary>

One gatekeeper, and it never confirms a door exists to someone without a key.

> Status: accepted. lib/access.ts returns owner, editor, viewer or none; every route and page calls it. Strangers and
> malformed ids get 404. There's no real cost, and it also made access testable in isolation.

</details>

<details>
<summary>Decision 4: mocked sign-in, but a cookie that can't be forged</summary>

Skip passwords, keep the lock real.

> Status: accepted. I weighed real auth (Auth.js or Clerk) against two cookies: a plain user-id one and an HMAC-signed one.
> I chose the signed cookie because it shows the access model honestly in minutes and can't be edited to become
> someone else (a forged cookie gets 401). The cost is no real accounts. The users table and check stay when real auth
> is added.

</details>

<details>
<summary>Decision 5: tests on the real database, without Docker</summary>

Test against the real schema, which is the exact table layout production uses, not a stand-in.

> Status: accepted. The data layer takes a query function; tests pass PGlite running db/schema.sql. The cost is that PGlite is
> single-connection, so true concurrent-save races are covered by the single-statement design rather than a test.

</details>

<details>
<summary>Decision 6: keep a version when the hands change, not on every save</summary>

History should show stretches of work, not every keystroke, and must never break the no-overwrite guarantee.

> Status: accepted. I weighed a version per save (the 1-second autosave would flood it), timed checkpoints only, and
> a version when a different person starts editing or after a 5-minute pause, plus every refused save. I chose the
> last, written inside the same single save statement so only one save can still win. The cost is that edits by one
> person within 5 minutes are one version.

</details>

</details>

<details>
<summary>What I verified: 27 unit tests, 26 browser checks, every server route, all against production</summary>

I checked it the way a reviewer will use it: on the live site, as each of the three people.

> npm test, npm run build, ESLint, scripts/smoke.sh and scripts/browser-check.mjs against the production URL.

```text
Test Files  5 passed (5)
     Tests  27 passed (27)

browser-check against https://ajaia-docs-eight-green.vercel.app
26/26 checks passed
```

The smoke test (scripts/smoke.sh) against production returned the expected code for every case.

| Case | Code |
| --- | --- |
| No cookie, or a forged cookie | 401 |
| A stale save, or a stale restore | 409 |
| A stranger opening a document or its history | 404 |
| A malformed version id | 404 |
| A viewer writing, or opening history | 403 |
| Uploading .md, .docx or .txt | 201 |
| Uploading a PDF | 415 |
| A restore | 200 |

I didn't check behavior under heavy concurrent load, or browsers other than Chromium (the editor library supports
them, but I didn't run them).

</details>

<details>
<summary>Later, beyond the next few hours: 4 items, in priority order</summary>

1. Real-time co-editing with presence would remove the reload step entirely, using Yjs with a hosted provider, in 1
   to 2 days.
2. Real sign-in and email invitations are needed before anyone outside a demo uses it. That's Auth.js plus an
   invites table, about 1 day.
3. Comments anchored to text need a comments table plus a Tiptap mark, about a day.
4. Images and PDF import need blob storage plus the Tiptap image extension, and PDF text extraction, about 1 day.

</details>

<details>
<summary>Time log: about 176 minutes of 240</summary>

Clock times come from the git commit history, which is public in the code link.

| Minute | What happened |
| --- | --- |
| 0 | Started the assignment at 7:43 PM |
| 5 | Fresh Claude Code session reads the approved plan; Next.js scaffolded |
| 13 | Schema, data layer, access rules, API (the server's endpoints), editor interface committed; helper agent's 12 tests verified |
| 15 | Security review flags .docx zip bombs; guard added with a test |
| 17 | Neon terms accepted; database provisioned and seeded |
| 18 | First production deploy, which means the live site went up |
| 20 | Every API route checked on production as all three users |
| 21 | Browser click-through on production: 19/19; screenshots taken |
| 23 | Stronger .docx guard; Markdown export shipped (stretch) |
| 27 | Three review-agent bugs fixed and proven; 21/21 on production |
| 28 | Architecture, AI workflow and submission write-ups |
| 32 | Code published to a public GitHub repo after a secrets scan (gitleaks: no leaks) |
| 37 | Second review agent checks every doc claim against the code; fixes and an owner Delete button; 22/22 on production |
| 39 | Walkthrough script written; click path filmed on production (https://ajaia-docs-eight-green.vercel.app) from the same script |
| 53 | Fresh session; asked for one more feature and a slower cut to read along with |
| 70 | Version history live on production: 27 tests, 26/26 browser checks, every API check |
| 80 | Slower walkthrough cut ready; second blind review's four fixes shipped |
| 120 | My own voice-over take; a retake interrupted when Claude opened a video on my screen |
| 136 | Final video: the AI voice reading my script, uploaded to the Drive folder |
| 140 | Asked whether the voice check had run on the script and this text; it hadn't |
| 146 | Full strict voice check on the script and every doc; video re-rendered from the fixed script |
| 160 | Stopped the last voice-over take; the AI-voice video from the fixed script is final |
| 167 | Final video and docs in the Drive folder |
| 176 | Unlisted YouTube link from Hatch in the docs; portal text ready to paste |

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

# hosted on Vercel (production); database on Neon (free tier, via Vercel Marketplace)
```

</details>
