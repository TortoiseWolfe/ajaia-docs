"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewDocButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end">
      <button
        disabled={busy}
        className="rounded-md bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/documents", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
            });
            if (!res.ok) throw new Error(String(res.status));
            const { id } = await res.json();
            router.push(`/docs/${id}`);
          } catch {
            setBusy(false);
            setError("Couldn't create a document. Try again.");
          }
        }}
      >
        {busy ? "Creating…" : "New document"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
