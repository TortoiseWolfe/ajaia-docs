// Creates the schema and seeds three users plus a few documents.
// Idempotent: fixed ids + "on conflict do nothing", so re-running is safe.
//   npm run db:seed        (reads DATABASE_URL from .env.local)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { seedDatabase } from "../lib/db/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (run `vercel env pull .env.local`)");
  const sql = neon(url);
  const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
  await seedDatabase(async (text, params = []) => sql.query(text, params) as never, schema);
  const users = await sql.query("select count(*)::int as n from users");
  const docs = await sql.query("select count(*)::int as n from documents");
  console.log(`seeded: ${users[0].n} users, ${docs[0].n} documents`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
