import "server-only";
import { cookies } from "next/headers";
import { db } from "./db/neon";
import { getUser } from "./db/repo";
import type { User } from "./db/types";
import { makeToken, readToken } from "./session-token";

export const SESSION_COOKIE = "ajaia_session";

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const userId = readToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return getUser(db(), userId);
}

export async function startSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
