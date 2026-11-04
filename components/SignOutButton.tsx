"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded border border-stone-300 px-2.5 py-1 hover:bg-stone-100"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        router.push("/signin");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
