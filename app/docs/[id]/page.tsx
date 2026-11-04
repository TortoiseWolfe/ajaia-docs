import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DocEditor } from "@/components/DocEditor";
import { canRead, getRole } from "@/lib/access";
import { db } from "@/lib/db/neon";
import { getDocument, listShares, listUsers } from "@/lib/db/repo";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const { id } = await params;
  const q = db();
  const role = await getRole(q, user.id, id);
  // Strangers get the same 404 as a missing document.
  if (!canRead(role)) notFound();
  const doc = await getDocument(q, id);
  if (!doc) notFound();

  const isOwner = role === "owner";
  const [shares, users] = isOwner ? await Promise.all([listShares(q, id), listUsers(q)]) : [[], []];

  return (
    <>
      <AppHeader user={user} />
      <DocEditor
        doc={{ id: doc.id, title: doc.title, content: doc.content, version: doc.version, ownerName: doc.owner_name }}
        role={role}
        initialShares={shares}
        shareCandidates={users.filter((u) => u.id !== user.id)}
      />
    </>
  );
}
