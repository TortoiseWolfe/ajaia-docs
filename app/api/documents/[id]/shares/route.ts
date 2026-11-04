import { canRead, getRole, isOwner } from "@/lib/access";
import { db } from "@/lib/db/neon";
import { deleteShare, getUser, listShares, upsertShare } from "@/lib/db/repo";
import { forbidden, json, notFound, parseBody, unauthorized } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { shareSchema, unshareSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Only the owner manages sharing. Anyone else with access gets 403; a
// stranger gets 404 so the route never confirms the document exists.
async function ownerGate(ctx: Ctx) {
  const user = await currentUser();
  if (!user) return { res: unauthorized() };
  const { id } = await ctx.params;
  const role = await getRole(db(), user.id, id);
  if (!canRead(role)) return { res: notFound() };
  if (!isOwner(role)) return { res: forbidden("Only the owner can manage sharing.") };
  return { id, user };
}

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await ownerGate(ctx);
  if ("res" in gate) return gate.res;
  return json({ shares: await listShares(db(), gate.id) });
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await ownerGate(ctx);
  if ("res" in gate) return gate.res;
  const body = await parseBody(req, shareSchema);
  if (!body.ok) return body.res;
  if (body.data.userId === gate.user.id) return json({ error: "You already own this document." }, 400);
  const q = db();
  if (!(await getUser(q, body.data.userId))) return json({ error: "Unknown user." }, 400);
  await upsertShare(q, gate.id, body.data.userId, body.data.role);
  return json({ shares: await listShares(q, gate.id) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const gate = await ownerGate(ctx);
  if ("res" in gate) return gate.res;
  const body = await parseBody(req, unshareSchema);
  if (!body.ok) return body.res;
  const q = db();
  await deleteShare(q, gate.id, body.data.userId);
  return json({ shares: await listShares(q, gate.id) });
}
