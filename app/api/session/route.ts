import { db } from "@/lib/db/neon";
import { getUser } from "@/lib/db/repo";
import { json, parseBody } from "@/lib/http";
import { endSession, startSession } from "@/lib/session";
import { sessionSchema } from "@/lib/validation";

// Mocked sign-in: pick one of the seeded users. No password, by design.
export async function POST(req: Request) {
  const body = await parseBody(req, sessionSchema);
  if (!body.ok) return body.res;
  const user = await getUser(db(), body.data.userId);
  if (!user) return json({ error: "Unknown user." }, 400);
  await startSession(user.id);
  return json({ user });
}

export async function DELETE() {
  await endSession();
  return json({ ok: true });
}
