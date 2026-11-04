import Link from "next/link";
import type { User } from "@/lib/db/types";
import { SignOutButton } from "./SignOutButton";

export function AppHeader({ user }: { user: User }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Ajaia Docs
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-600">
            Signed in as <strong className="text-stone-900">{user.name}</strong>
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900" title="No password: pick any seeded user on the sign-in page.">
              mock sign-in
            </span>
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
