"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "@/lib/db/types";

export function SignInPicker({ users }: { users: User[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    if (!res.ok) {
      setBusy(null);
      setError("Couldn't sign in. Try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => choose(u.id)}
          disabled={busy !== null}
          className="flex items-center justify-between rounded-lg border border-stone-300 bg-white px-4 py-3 text-left hover:border-stone-500 disabled:opacity-60"
        >
          <span>
            <span className="block font-medium">Continue as {u.name}</span>
            <span className="block text-sm text-stone-500">{u.email}</span>
          </span>
          <span className="text-stone-400">{busy === u.id ? "…" : "→"}</span>
        </button>
      ))}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
