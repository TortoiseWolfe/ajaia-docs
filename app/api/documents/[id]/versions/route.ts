import { canEdit, canRead, getRole } from "@/lib/access";
import { db } from "@/lib/db/neon";
import { listVersions } from "@/lib/db/repo";
import { forbidden, json, notFound, unauthorized } from "@/lib/http";
import { currentUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Version history is for people who can edit (as in Google Docs); viewers get 403, strangers 404. */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const q = db();
  const role = await getRole(q, user.id, id);
  if (!canRead(role)) return notFound();
  if (!canEdit(role)) return forbidden("Only owners and editors can see version history.");
  return json({ versions: await listVersions(q, id) });
}
