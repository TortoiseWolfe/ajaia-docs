import { canEdit, canRead, getRole, isOwner } from "@/lib/access";
import { db } from "@/lib/db/neon";
import { deleteDocument, getDocument, renameDocument, saveContent } from "@/lib/db/repo";
import { forbidden, json, notFound, parseBody, unauthorized } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { patchDocSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const q = db();
  const role = await getRole(q, user.id, id);
  if (!canRead(role)) return notFound();
  const doc = await getDocument(q, id);
  if (!doc) return notFound();
  return json({ ...doc, role });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const q = db();
  const role = await getRole(q, user.id, id);
  if (!canRead(role)) return notFound();
  if (!canEdit(role)) return forbidden("You have view-only access to this document.");

  const body = await parseBody(req, patchDocSchema);
  if (!body.ok) return body.res;

  if ("title" in body.data) {
    await renameDocument(q, id, body.data.title);
    return json({ title: body.data.title });
  }

  const result = await saveContent(q, id, body.data.content, body.data.version);
  if (result.ok) return json({ version: result.version, updated_at: result.updated_at });
  if (result.reason === "missing") return notFound();
  return json(
    {
      error: "This document was changed by someone else. Reload to see the latest.",
      currentVersion: result.currentVersion,
    },
    409,
  );
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const q = db();
  const role = await getRole(q, user.id, id);
  if (!canRead(role)) return notFound();
  if (!isOwner(role)) return forbidden("Only the owner can delete a document.");
  await deleteDocument(q, id);
  return json({ ok: true });
}
