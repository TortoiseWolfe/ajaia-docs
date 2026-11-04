import { canEdit, canRead, getRole, isUuid } from "@/lib/access";
import { db } from "@/lib/db/neon";
import { getVersion, restoreVersion } from "@/lib/db/repo";
import { forbidden, json, notFound, parseBody, unauthorized } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { restoreSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

const versionNotFound = () => json({ error: "Version not found." }, 404);

async function authorize(ctx: Ctx) {
  const user = await currentUser();
  if (!user) return { res: unauthorized() };
  const { id, versionId } = await ctx.params;
  const q = db();
  const role = await getRole(q, user.id, id);
  if (!canRead(role)) return { res: notFound() };
  if (!canEdit(role)) return { res: forbidden("Only owners and editors can see version history.") };
  if (!isUuid(versionId)) return { res: versionNotFound() };
  return { user, id, versionId, q };
}

/** One version, with its content, for the read-only preview. */
export async function GET(_req: Request, ctx: Ctx) {
  const a = await authorize(ctx);
  if ("res" in a) return a.res;
  const version = await getVersion(a.q, a.id, a.versionId);
  return version ? json(version) : versionNotFound();
}

/** Restore this version. Body: { version } = the document version the editor is on (optimistic check). */
export async function POST(req: Request, ctx: Ctx) {
  const a = await authorize(ctx);
  if ("res" in a) return a.res;
  const body = await parseBody(req, restoreSchema);
  if (!body.ok) return body.res;
  const r = await restoreVersion(a.q, a.id, a.versionId, body.data.version, a.user.id);
  if (r.ok) return json({ version: r.version, updated_at: r.updated_at, content: r.content });
  if (r.reason === "missing") return versionNotFound();
  return json(
    {
      error: "This document was changed by someone else while you were looking. Reload, then restore again.",
      currentVersion: r.currentVersion,
    },
    409,
  );
}
