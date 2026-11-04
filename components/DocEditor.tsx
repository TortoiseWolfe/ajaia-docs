"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Role, Share, User } from "@/lib/db/types";
import { extensions } from "@/lib/editor/extensions";
import { RoleBadge } from "./RoleBadge";
import { ShareDialog } from "./ShareDialog";
import { Toolbar } from "./Toolbar";

type Status = "saved" | "dirty" | "saving" | "error" | "conflict";

const STATUS_TEXT: Record<Status, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Couldn't save",
  conflict: "This document was changed by someone else. Reload to see the latest.",
};

const AUTOSAVE_MS = 1000;

interface Props {
  doc: { id: string; title: string; content: unknown; version: number; ownerName: string };
  role: Role;
  initialShares: Share[];
  shareCandidates: User[];
}

export function DocEditor({ doc, role, initialShares, shareCandidates }: Props) {
  const canEdit = role === "owner" || role === "editor";
  const [status, setStatus] = useState<Status>("saved");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(doc.title);
  const router = useRouter();


  async function exportMarkdown() {
    if (!editor) return;
    const { htmlToMarkdown, markdownFilename } = await import("@/lib/editor/export-markdown");
    const blob = new Blob([htmlToMarkdown(editor.getHTML())], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = markdownFilename(currentTitle);
    a.click();
    URL.revokeObjectURL(url);
  }

  // Save bookkeeping lives in refs so the editor's onUpdate callback always sees the latest.
  const versionRef = useRef(doc.version);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const again = useRef(false);
  const stopped = useRef(false); // set after a 409; no more saves from this tab
  const saveRef = useRef<(opts?: { keepalive?: boolean }) => void>(() => {});

  const editor = useEditor({
    extensions,
    content: doc.content as object,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "ProseMirror", "aria-label": "Document body" } },
    onUpdate: () => {
      if (stopped.current) return;
      setStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => saveRef.current(), AUTOSAVE_MS);
    },
  });

  const save = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      if (!editor || stopped.current) return;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (inFlight.current) {
        again.current = true; // save once more when the current request returns
        return;
      }
      inFlight.current = true;
      again.current = false;
      setStatus("saving");
      try {
        const payload = JSON.stringify({ content: editor.getJSON(), version: versionRef.current });
        const res = await fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: payload,
          // Browsers refuse keepalive bodies over 64 KiB; a normal fetch still
          // completes after in-app navigation, which is when this flush runs.
          keepalive: opts.keepalive && payload.length < 60_000,
        });
        if (res.status === 409) {
          stopped.current = true;
          editor.setEditable(false);
          setStatus("conflict");
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorDetail(body.error ?? null);
          setStatus("error");
          return;
        }
        versionRef.current = body.version;
        setErrorDetail(null);
        // Still dirty if more typing arrived while this save was in flight.
        setStatus(again.current || timer.current ? "dirty" : "saved");
      } catch {
        setErrorDetail("Check your connection.");
        setStatus("error");
      } finally {
        inFlight.current = false;
        if (again.current && !stopped.current) saveRef.current();
      }
    },
    [editor, doc.id],
  );

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Flush a pending save when leaving the page, and warn if a save hasn't landed.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving" || status === "error") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  useEffect(() => {
    return () => {
      if (timer.current) saveRef.current({ keepalive: true });
    };
  }, []);

  async function deleteDoc() {
    if (!window.confirm(`Delete "${currentTitle}"? This can't be undone.`)) return;
    stopped.current = true; // no autosave into a deleted document
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      stopped.current = false;
      setErrorDetail("Couldn't delete the document.");
      setStatus("error");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-3 flex items-center justify-between gap-4 text-sm">
        <Link href="/" className="text-stone-600 hover:text-stone-900">
          ← All documents
        </Link>
        <div className="flex items-center gap-3">
          {canEdit && (
            <span
              role="status"
              aria-live="polite"
              className={
                status === "conflict" || status === "error"
                  ? "font-medium text-red-700"
                  : status === "saved"
                    ? "text-stone-500"
                    : "text-amber-700"
              }
            >
              {STATUS_TEXT[status]}
              {status === "error" && errorDetail ? ` · ${errorDetail}` : ""}
            </span>
          )}
          {status === "error" && (
            <button className="rounded border border-stone-300 px-2 py-0.5" onClick={() => save()}>
              Retry
            </button>
          )}
          {status === "conflict" && (
            <button className="rounded bg-stone-900 px-2.5 py-1 text-white" onClick={() => window.location.reload()}>
              Reload
            </button>
          )}
          <button
            className="rounded-md px-2.5 py-1.5 text-stone-700 hover:bg-stone-100"
            onClick={exportMarkdown}
            title="Download this document as Markdown"
          >
            Export .md
          </button>
          {role === "owner" && (
            <button className="rounded-md px-2.5 py-1.5 text-red-700 hover:bg-red-50" onClick={deleteDoc}>
              Delete
            </button>
          )}
          {role === "owner" && (
            <button
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium hover:bg-stone-100"
              onClick={() => setShareOpen(true)}
            >
              Share
            </button>
          )}
        </div>
      </div>

      <TitleField docId={doc.id} initial={doc.title} editable={canEdit} onRenamed={setCurrentTitle} />

      <div className="mb-3 flex items-center gap-2 text-xs text-stone-500">
        {role === "owner" ? <span>You own this document</span> : <span>Owned by {doc.ownerName}</span>}
        {role !== "owner" && <RoleBadge role={role} />}
      </div>

      {role === "viewer" && (
        <p className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
          You have view-only access. Ask {doc.ownerName} for edit access.
        </p>
      )}

      <div className="rounded-lg border border-stone-200 bg-white">
        {canEdit && <Toolbar editor={editor} />}
        <div className="px-6 py-5 sm:px-10 sm:py-8">
          <EditorContent editor={editor} />
        </div>
      </div>

      {role === "owner" && shareOpen && (
        <ShareDialog
          docId={doc.id}
          initialShares={initialShares}
          candidates={shareCandidates}
          onClose={() => setShareOpen(false)}
        />
      )}
    </main>
  );
}

function TitleField({
  docId,
  initial,
  editable,
  onRenamed,
}: {
  docId: string;
  initial: string;
  editable: boolean;
  onRenamed: (title: string) => void;
}) {
  const [title, setTitle] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const next = title.trim();
    if (next === saved) {
      setTitle(saved);
      return;
    }
    if (!next) {
      setTitle(saved);
      setError("Title can't be empty.");
      return;
    }
    const res = await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't rename. Try again.");
      return;
    }
    setError(null);
    setSaved(next);
    setTitle(next);
    onRenamed(next);
  }

  if (!editable) return <h1 className="mb-1 text-3xl font-semibold tracking-tight">{initial}</h1>;

  return (
    <div className="mb-1">
      <input
        aria-label="Document title"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setTitle(saved);
            setError(null);
          }
        }}
        className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 -mx-1 text-3xl font-semibold tracking-tight hover:border-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none"
      />
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
