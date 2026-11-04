# AI workflow

How AI was used to build Ajaia Docs, what I changed or rejected, and how the result was verified. Kept as I went, not
reconstructed at the end.

## Tools

| Tool | Used for |
| --- | --- |
| **Claude Code (Opus)**, main session | Planning, all application code, deploys, verification scripts, these docs. Run in a fresh session scoped to this folder only, so the transcript holds only this work. |
| **Helper agent #1** (Claude Code subagent) | Wrote the Vitest suite on PGlite in parallel while the main session built the UI. Scoped to `tests/`, `samples/` and the Vitest config only. |
| **Helper agent #2** (Claude Code code-review subagent) | A blind, read-only review of the finished code. Found three real bugs (below). |
| **Automated security review** (Claude Code plugin, runs on each commit) | Flagged the .docx zip-bomb risk, twice (below). |
| Vercel CLI, Neon, Vitest + PGlite, Playwright | Deploy, database, tests on real SQL, browser checks against production. |

## How the work was split

1. **Plan before code.** Before the clock started, Claude Code drafted the build plan from the assignment text in my
   main terminal: the product slice, what's out, the stack, and phase checkpoints with clock times. I approved it.
   The build then ran in a fresh session from that plan.
2. **Deploy first.** The first deploy went out before feature work was clicked through, so every later check ran
   where the reviewer will look.
3. **Parallel where independent.** Tests went to a helper agent with a narrow file scope while the main session built
   the UI. Review went to a second agent that hadn't seen my reasoning, so it read the code cold.
4. **Verify, don't trust.** Every agent claim was re-run in the main session before it counted.

## The prompts, word for word

These are what I typed in the build session, in order. The plan-drafting conversation happened in my main terminal
before the clock and is summarized above.

1. `Read` (to start; the session found the approved plan file and began Phase 1)
2. `are you making it docker first like all our other projects too?`
   → No: the plan chose host Node for the 4-hour clock, since Vercel builds from source. Kept, and stated in the README.
3. `we've recently added helpers for recording beta testing, we can add that as the video they are asking for at the end?`
   → Agreed for the screen capture; my own voice for the decisions part.
4. `if it helps with pace and timing you can delegate to tmux subagents too?`
   → Tests delegated to one helper agent (built-in subagent rather than tmux, so its result comes back into the
   session).
5. `if you need me to click on legal terms give me the link to get it done?`
6. `what about backend, do we need supabase or something?`
   → No: the API routes are the backend and Neon is the database; Supabase's extras (auth, file storage) aren't used.
7. `still don't see a link, what did you want me to click on?`
   → The link had been buried in progress notes; it was re-sent on its own line.
8. `! vercel integration accept-terms neon --yes` (I ran it), then `! vercel deploy --prod --yes`

## Changed or rejected AI output

| What the AI proposed or did | What happened instead | How it was caught |
| --- | --- | --- |
| Plan said "StarterKit + Underline extension". | Dropped the separate Underline package: Tiptap 3's StarterKit already bundles Underline and Link; registering it twice warns. | Read the installed StarterKit source before wiring the schema. |
| create-next-app (Next 16.4) turned on Cache Components and Partial Prefetching. | Turned both off. Every page here is per-user and reads a cookie, so the plain dynamic model is simpler and has no Suspense-boundary rules to trip over. | Read the Next 16 docs bundled in `node_modules` (the scaffold's AGENTS.md says to). |
| `npm i -D vitest` failed on a peer conflict. | Bumped `@types/node` to 24 to match the host, instead of `--legacy-peer-deps`. | The install log showed ERESOLVE rather than a silent success. |
| Claude tried to accept Neon's marketplace terms, and later to deploy to production, on its own. | Both blocked by Claude Code's permission layer. I accepted the terms and ran the first deploy myself. | The permission classifier denied the calls. |
| First .docx guard only checked the 1 MB upload size. | Added a check of the uncompressed sizes in the zip directory. | Automated security review on commit: a 25 MB file compresses to a few KB. |
| That guard trusted the sizes the zip file declares about itself. | Now inflates each entry as a stream, counting real bytes, and stops at 20 MB. A test forges the headers to prove the header check is fooled and the byte count is not. | Second automated security review. |
| Autosave flushed with `keepalive` on leaving the page. | Browsers refuse keepalive bodies over 64 KiB, so a large doc lost its last edits. Keepalive now only under 60 KB. | Blind review agent. I wrote a browser check that reproduces it: **fails on the old code, passes on the fix.** |
| Save status went to "Saved" when a save returned. | If more typing arrived during that save, it now stays "Unsaved changes". | Blind review agent; confirmed by reading the timer logic. |
| Upload and New document buttons had no error path for a dropped connection. | try/catch added; they recover and show a message. | Blind review agent. |
| Helper agent reported "12 passed". | Re-ran the suite myself and read the conflict test before counting it. | `npx vitest run` in the main session. |
| My own cleanup command (`pkill -f "next start ..."`) matched and killed its own shell. | Re-ran it killing the server by process id. No files were affected. | The command exited 144; checked `git diff` before continuing. |

## Where AI sped things up most

- **Scaffolding the whole vertical slice** (schema, data layer, access rules, routes, editor UI) in about 15 minutes,
  type-checking clean on the first pass.
- **Parallel test writing** by a helper agent while the UI was being written.
- **Verification as code**: an API smoke script and a Playwright click-through that run against production in under a
  minute, re-run after every deploy, instead of clicking through by hand.
- **Review**: a fresh agent found three bugs I would not have hit in a short manual test.

## How it was verified

- `npm test`: 18 tests pass (Vitest on PGlite running the real schema).
- `npm run build`: clean, TypeScript checked; ESLint clean.
- `scripts/smoke.sh` against production: every API route as Alice, Bob and Carol, including 401 without a cookie,
  401 with a forged cookie, 403 for viewers writing, 404 for strangers, 409 on a stale save, uploads 201, PDF 415.
- `scripts/browser-check.mjs` against production: **21/21** (create, all toolbar buttons, autosave to "Saved",
  reload keeps formatting, export, share to Bob, Bob read-only, Carol 404, large-doc fast exit, two-tab conflict).
- Screenshots in `docs/screenshots/` come from that production run.
