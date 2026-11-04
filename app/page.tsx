import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NewDocButton } from "@/components/NewDocButton";
import { RoleBadge } from "@/components/RoleBadge";
import { UploadButton } from "@/components/UploadButton";
import { db } from "@/lib/db/neon";
import { listOwnedDocs, listSharedDocs } from "@/lib/db/repo";
import type { DocSummary } from "@/lib/db/types";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

function DocList({ docs, empty, showOwner }: { docs: DocSummary[]; empty: string; showOwner: boolean }) {
  if (docs.length === 0) return <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">{empty}</p>;
  return (
    <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
      {docs.map((d) => (
        <li key={d.id}>
          <Link href={`/docs/${d.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50">
            <span className="min-w-0">
              <span className="block truncate font-medium">{d.title}</span>
              <span className="block text-xs text-stone-500">
                {showOwner ? `Owned by ${d.owner_name} · ` : ""}Edited {fmt.format(new Date(d.updated_at))}
              </span>
            </span>
            <RoleBadge role={d.role} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const q = db();
  const [owned, shared] = await Promise.all([listOwnedDocs(q, user.id), listSharedDocs(q, user.id)]);

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <div className="flex flex-wrap items-start gap-3">
            <UploadButton />
            <NewDocButton />
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">My documents</h2>
          <DocList docs={owned} empty="No documents yet. Create one or upload a file." showOwner={false} />
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Shared with me</h2>
          <DocList docs={shared} empty="Nothing has been shared with you yet." showOwner />
        </section>
      </main>
    </>
  );
}
