"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import type { Version, VersionSummary } from "@/lib/db/types";
import { extensions } from "@/lib/editor/extensions";

interface Props {
  docId: string;
  /** Restore only from a settled editor; otherwise a pending save would race the restore. */
  canRestore: boolean;
  /** Returns an error message, or null when the restore landed (the editor then closes this panel). */
  onRestore: (versionId: string) => Promise<string | null>;
  onClose: () => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function label(v: VersionSummary) {
  const who = v.author_name ?? "Someone";
  return v.kind === "conflict" ? `Unsaved edit by ${who}` : who;
}

export function HistoryPanel({ docId, canRestore, onRestore, onClose }: Props) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [selected, setSelected] = useState<Version | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/documents/${docId}/versions`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) throw new Error(body.error ?? "Couldn't load history.");
        setVersions(body.versions);
      })
      .catch((e: Error) => live && setError(e.message || "Couldn't load history."));
    return () => {
      live = false;
    };
  }, [docId]);

  async function open(v: VersionSummary) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/versions/${v.id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't open that version.");
      setSelected(body);
    } catch (e) {
      setError((e as Error).message || "Couldn't open that version.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const err = await onRestore(selected.id);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 id="history-title" className="text-lg font-semibold">
            Version history
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Close">
            ✕
          </button>
        </div>

        {error && (
          <p className="mx-5 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
            <button onClick={() => setSelected(null)} className="self-start text-sm text-stone-600 hover:text-stone-900">
              ← All versions
            </button>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-medium">{label(selected)}</span>
              {selected.kind === "conflict" && <ConflictBadge />}
            </div>
            <p className="text-xs text-stone-500">{when(selected.saved_at)}</p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
              <VersionPreview key={selected.id} content={selected.content} />
            </div>
            <button
              onClick={restore}
              disabled={busy || !canRestore}
              className="mt-4 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Restore this version
            </button>
            <p className="mt-2 text-xs text-stone-500">
              {canRestore
                ? "The current text is kept in history first, so you can undo a restore."
                : "Wait until the document says Saved, then restore."}
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="text-xs text-stone-500">
              A version is kept when someone else starts editing, after a 5-minute pause, and whenever a save is refused
              because someone else saved first.
            </p>
            <ul className="mt-3 divide-y divide-stone-100">
              <li className="py-2.5 text-sm">
                <span className="font-medium">Current version</span>
                <span className="block text-xs text-stone-500">What&apos;s in the editor now</span>
              </li>
              {versions === null && !error && <li className="py-2.5 text-sm text-stone-500">Loading…</li>}
              {versions?.length === 0 && <li className="py-2.5 text-sm text-stone-500">No earlier versions yet.</li>}
              {versions?.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => open(v)}
                    disabled={busy}
                    className="flex w-full items-start justify-between gap-2 rounded-md px-1 py-2.5 text-left text-sm hover:bg-stone-50 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{label(v)}</span>
                      <span className="block text-xs text-stone-500">{when(v.saved_at)}</span>
                    </span>
                    {v.kind === "conflict" && <ConflictBadge />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function ConflictBadge() {
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      Kept after a conflict
    </span>
  );
}

/** Read-only render through the editor's own schema (never innerHTML), so a preview looks exactly like the document. */
function VersionPreview({ content }: { content: unknown }) {
  const editor = useEditor({
    extensions,
    content: content as object,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "ProseMirror", "aria-label": "Version preview" } },
  });
  return <EditorContent editor={editor} />;
}
