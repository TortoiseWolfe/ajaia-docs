import { db } from "@/lib/db/neon";
import { createDocument, listOwnedDocs, listSharedDocs } from "@/lib/db/repo";
import { EMPTY_DOC } from "@/lib/editor/empty";
import { json, parseBody, unauthorized } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { createDocSchema } from "@/lib/validation";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const q = db();
  const [owned, shared] = await Promise.all([listOwnedDocs(q, user.id), listSharedDocs(q, user.id)]);
  return json({ owned, shared });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await parseBody(req, createDocSchema);
  if (!body.ok) return body.res;
  const doc = await createDocument(db(), user.id, body.data.title ?? "Untitled document", EMPTY_DOC);
  return json(doc, 201);
}
