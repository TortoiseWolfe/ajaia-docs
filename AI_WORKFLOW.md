# AI workflow

Kept as I went, not reconstructed at the end.

## Tools

- **Claude Code (Opus)** in the terminal, in a fresh session scoped to this folder only.
- One **helper agent** (Claude Code subagent) wrote the Vitest suite in parallel while the main session built the UI.
- Vercel CLI, Neon (via the Vercel Marketplace), Vitest + PGlite.

## Where the plan came from

The build plan (scope, cuts, stack, phase checkpoints) was drafted by Claude Code (Opus) from the assignment text in my
main terminal, then approved by me, then built in this fresh session so the transcript holds only this work.

## Prompt log

| # | What I asked | What happened |
| --- | --- | --- |
| 1 | "Read" (pointed it at the plan file) | It found the plan, checked the clock, and started Phase 1. |
| 2 | "Are you making it Docker-first like our other projects?" | No: the plan says host Node for the 4-hour clock; Vercel builds from source. Noted in README. |
| 3 | "We have helpers for recording beta testing; use that for the video?" | Agreed for screen capture; my own voice for the decisions part. |
| 4 | "You can delegate to subagents if it helps pace." | Tests handed to one helper agent with a narrow file scope; main session kept the UI. |

## Changed or rejected AI output

| What it proposed / did | What I did instead | How it was caught |
| --- | --- | --- |
| Plan said "StarterKit + Underline extension". | Dropped the separate Underline package: Tiptap v3's StarterKit already bundles Underline and Link, and registering it twice warns. | Read the installed StarterKit source before wiring the schema. |
| create-next-app (Next 16.4) turned on Cache Components + Partial Prefetching by default. | Turned both off: every page here is per-user and reads a cookie, so the old dynamic model is simpler and has no Suspense boundary rules to trip over. | Read the Next 16 docs bundled in node_modules (AGENTS.md says to). |
| `npm i -D vitest` failed on a peer conflict (@types/node 20 vs Vitest 5). | Bumped @types/node to 24 to match the host Node, rather than `--legacy-peer-deps`. | The install log, not a silent success. |
| Claude tried to accept Neon's marketplace terms on my behalf. | Blocked by the permission layer; Left the terms click to me. | Claude Code's auto-mode classifier denied it. |
| Helper agent reported "12 passed". | Re-ran the suite myself before trusting it and read the conflict test. | `npx vitest run` in the main session: 12/12. |

## How it was verified

(filled in at the end: test count, build, production click-through)
