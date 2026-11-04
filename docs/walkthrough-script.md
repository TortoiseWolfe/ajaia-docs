# Walkthrough script (about 4.5 minutes, about 610 words)

Read at a relaxed pace. Each section is one shot in the recording; the bracket says what's on screen. The same words
appear as captions in the voice-over cut, so you can read along while it plays. Each caption stays on screen until the
next one replaces it, with a pause of about a second and a half between them.

---

**1. Intro** [sign-in page]

Hi, I'm Jonathan. This is Ajaia Docs, a small collaborative document editor I built for this assessment. It's live on
Vercel with a Postgres database behind it. Sign-in is mocked on purpose: you pick one of three seeded people. The
session cookie is signed, so nobody can edit it to become someone else.

**2. Home** [Alice's home page]

I'll continue as Alice. Her home page splits My documents from Shared with me, with the owner and a role badge on
every row, so it's always clear what's yours and what was shared with you.

**3. Create and rename** [new document, title being typed]

A new document is one click, and I rename it by clicking the title.

**4. Formatting and autosave** [typing a heading, bold text, a list; status turns to Saved]

The editor does bold, italic, underline, three heading levels, bulleted and numbered lists, and undo. It saves about a
second after I stop typing, and this status tells me whether my work is saved.

**5. Refresh and export** [page reloads, formatting intact; Export button highlighted]

If I refresh, everything comes back exactly. The document is stored as the editor's own JSON in Postgres, so the
formatting survives the round trip. There's also a Markdown export, and version history, which I'll show in a
minute.

**6. Share** [share dialog, Bob added as Viewer]

Sharing. As the owner, I pick a person and a role, viewer or editor, and I can change it or revoke it here. I'll give
Bob view access.

**7. Bob, the viewer** [Bob's home, then the document read-only]

Now as Bob. The document shows up under Shared with me, marked Viewer. He gets a read-only editor with no toolbar, and
the server refuses his edits too, not just the interface.

**8. Carol, no access** [Carol opens the same link: Document not found]

Carol was never given access. The same link gives her a 404, exactly like a document that doesn't exist, so the app
never confirms it's there.

**9. Upload** [Alice uploads a Word file; it opens as a new document]

Back as Alice: upload. A text, Markdown, or Word file up to one megabyte becomes a new editable document, and the
headings, lists and bold come through. The editor's schema drops anything it doesn't understand, which is what keeps
uploads safe.

**10. Conflict safety** [someone else saves; the editor shows the reload message]

This is the part I cared most about. Two people editing the same document can't silently overwrite each other. Every
save carries the version it started from. Here someone else just saved, so the server refuses my stale save, and the
editor tells me to reload instead of quietly losing their work.

**11. Version history** [Reload, then History: the refused edit, its preview, Restore; then the version list]

And my edit isn't lost either. The server kept it in version history. I can preview it and restore it. Restoring keeps
the current text in history first, so a restore can be undone too. History also keeps a version whenever someone else
starts editing, or after a five-minute pause, so autosave doesn't flood it.

**12. What I cut** [architecture note, the cuts table]

What I deprioritized on purpose: real-time co-editing, comments, real sign-in, and images.
Real-time needs a sync server, and the version check already covers the real risk, which is lost work. Each cut is in
the architecture note with what it would take.

**13. Key decisions** [architecture note, the access table]

Two decisions worth naming. One function decides every user's role, and every route and page calls it, so access
lives in one place. And the data layer takes a plain query function, so the twenty-seven tests run the real SQL schema in
memory, with no Docker and no network.

**14. How AI helped** [AI workflow note, the changed-or-rejected table]

How I used AI. A few minutes into the clock, Claude Code turned the brief into a build plan, which I approved and then
built from in a fresh session. It wrote most of the code. A helper agent wrote the tests in parallel, and a second
agent reviewed the code cold and found three real bugs. One lost the last edits on large documents. Before fixing it,
I had it reproduce the bug with a browser test that fails on the old code and passes on the fix. An automated security
review caught a zip-bomb risk in Word uploads, twice, and a way to flood version history. And everything was checked on the live site with scripted API and
browser tests, not just locally.

**15. Close** [Alice's home page]

The live link, the code, and these notes are all in the Drive folder. Thanks for watching.
