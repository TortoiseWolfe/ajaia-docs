import { NextResponse } from "next/server";
import type { z } from "zod";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const unauthorized = () => json({ error: "Sign in first." }, 401);
export const notFound = () => json({ error: "Document not found." }, 404);
export const CONFLICT_MESSAGE =
  "This document was changed by someone else. Your edit was kept in History. Reload to see the latest.";

export const forbidden = (msg = "You don't have permission to do that.") => json({ error: msg }, 403);

export async function parseBody<T extends z.ZodType>(req: Request, schema: T) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false as const, res: json({ error: "Body must be JSON." }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
    return { ok: false as const, res: json({ error: msg }, 400) };
  }
  return { ok: true as const, data: parsed.data as z.infer<T> };
}
