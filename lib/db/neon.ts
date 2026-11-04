import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Query } from "./types";

let cached: Query | null = null;

/** Neon over HTTP: one round trip per query, no pool to manage on serverless. */
export function db(): Query {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  cached = (async (text: string, params: unknown[] = []) => sql.query(text, params)) as Query;
  return cached;
}
