"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const ACCEPT = ".txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function UploadButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > 1024 * 1024) {
      setError("That file is larger than 1 MB.");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        setError(body.error ?? "Upload failed. Try again.");
        return;
      }
      router.push(`/docs/${body.id}`);
    } catch {
      setBusy(false);
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        disabled={busy}
        onClick={() => input.current?.click()}
        className="rounded-md border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-60"
      >
        {busy ? "Importing…" : "Upload file"}
      </button>
      <p className="mt-1 text-xs text-stone-500">.txt, .md or .docx · up to 1 MB · becomes a new document</p>
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
    </div>
  );
}
