"use client";

import { useState } from "react";
import type { Share, ShareRole, User } from "@/lib/db/types";

interface Props {
  docId: string;
  initialShares: Share[];
  candidates: User[];
  onClose: () => void;
}

export function ShareDialog({ docId, initialShares, candidates, onClose }: Props) {
  const [shares, setShares] = useState(initialShares);
  const available = candidates.filter((u) => !shares.some((s) => s.user_id === u.id));
  const [userId, setUserId] = useState(available[0]?.id ?? "");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE", body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/shares`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return false;
      }
      setShares(data.shares);
      return data.shares as Share[];
    } catch {
      setError("Couldn't reach the server. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!userId) return;
    const next = await call("POST", { userId, role });
    if (next) {
      const left = candidates.filter((u) => !next.some((s) => s.user_id === u.id));
      setUserId(left[0]?.id ?? "");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-24"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="share-title" className="text-lg font-semibold">
            Share document
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Close">
            ✕
          </button>
        </div>

        <p className="mt-1 text-sm text-stone-500">Viewers can read. Editors can read and edit. Only you can share or delete.</p>

        {available.length > 0 ? (
          <div className="mt-4 flex gap-2">
            <select
              aria-label="Person"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            >
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as ShareRole)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              onClick={add}
              disabled={busy}
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Share
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-500">Everyone in the workspace already has access.</p>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500">People with access</h3>
        <ul className="mt-2 divide-y divide-stone-100">
          {shares.length === 0 && <li className="py-2 text-sm text-stone-500">Only you.</li>}
          {shares.map((s) => (
            <li key={s.user_id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="block font-medium">{s.name}</span>
                <span className="block text-xs text-stone-500">{s.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <select
                  aria-label={`Role for ${s.name}`}
                  value={s.role}
                  disabled={busy}
                  onChange={(e) => call("POST", { userId: s.user_id, role: e.target.value })}
                  className="rounded-md border border-stone-300 px-1.5 py-1 text-sm"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  disabled={busy}
                  onClick={() => call("DELETE", { userId: s.user_id })}
                  className="rounded px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
