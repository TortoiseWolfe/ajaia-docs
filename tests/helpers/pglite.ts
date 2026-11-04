import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { seedDatabase } from "../../lib/db/seed";
import type { Query } from "../../lib/db/types";

/** Fresh in-memory Postgres with the real schema and seed data. */
export async function makeDb(): Promise<{ q: Query; close: () => Promise<void> }> {
  const pg = new PGlite();
  const q = (async (text: string, params: unknown[] = []) =>
    (await pg.query(text, params)).rows) as Query;
  await seedDatabase(q, readFileSync(join(process.cwd(), "db/schema.sql"), "utf8"));
  return { q, close: () => pg.close() };
}
