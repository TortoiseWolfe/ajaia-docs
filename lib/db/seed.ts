import { htmlToDoc } from "../import";
import type { Query } from "./types";

export const SEED_USERS = [
  { id: "alice", name: "Alice Chen", email: "alice@example.com" },
  { id: "bob", name: "Bob Martinez", email: "bob@example.com" },
  { id: "carol", name: "Carol Okafor", email: "carol@example.com" },
];

export const SEED_DOCS = {
  welcome: "11111111-1111-4111-8111-111111111111",
  launch: "22222222-2222-4222-8222-222222222222",
  offsite: "33333333-3333-4333-8333-333333333333",
};

/** Split a schema file into single statements (Neon's HTTP driver runs one at a time). */
export function splitStatements(schema: string): string[] {
  return schema
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

export async function seedDatabase(q: Query, schema: string): Promise<void> {
  for (const stmt of splitStatements(schema)) await q(stmt);

  for (const u of SEED_USERS) {
    await q("insert into users (id, name, email) values ($1, $2, $3) on conflict (id) do nothing", [
      u.id,
      u.name,
      u.email,
    ]);
  }

  const docs: Array<[string, string, string, string]> = [
    [
      SEED_DOCS.welcome,
      "alice",
      "Welcome to Ajaia Docs",
      `<h1>Welcome to Ajaia Docs</h1>
       <p>This is a <strong>small collaborative editor</strong>. Try the toolbar: <em>italic</em>, <u>underline</u>, headings and lists.</p>
       <h2>What you can do</h2>
       <ul><li>Create and rename documents</li><li>Upload .txt, .md or .docx files</li><li>Share with Bob or Carol as a viewer or editor</li></ul>
       <p>Changes save automatically about a second after you stop typing.</p>`,
    ],
    [
      SEED_DOCS.launch,
      "alice",
      "Q4 launch plan",
      `<h1>Q4 launch plan</h1>
       <p>Shared with <strong>Bob</strong> as an editor.</p>
       <h2>Milestones</h2>
       <ol><li>Beta to five design partners</li><li>Pricing page live</li><li>Public launch post</li></ol>
       <h3>Open questions</h3>
       <ul><li>Do we need SSO for the first enterprise pilot?</li></ul>`,
    ],
    [
      SEED_DOCS.offsite,
      "carol",
      "Team offsite notes",
      `<h1>Team offsite notes</h1>
       <p>Shared with <strong>Alice</strong> as a viewer, so Alice can read but not edit.</p>
       <ul><li>Venue: the riverside studio</li><li>Agenda draft due Friday</li></ul>`,
    ],
  ];
  for (const [id, owner, title, html] of docs) {
    await q(
      "insert into documents (id, owner_id, title, content) values ($1, $2, $3, $4::jsonb) on conflict (id) do nothing",
      [id, owner, title, JSON.stringify(htmlToDoc(html))],
    );
  }

  const shares: Array<[string, string, string]> = [
    [SEED_DOCS.launch, "bob", "editor"],
    [SEED_DOCS.offsite, "alice", "viewer"],
  ];
  for (const [doc, user, role] of shares) {
    await q(
      "insert into document_shares (document_id, user_id, role) values ($1, $2, $3) on conflict do nothing",
      [doc, user, role],
    );
  }
}
