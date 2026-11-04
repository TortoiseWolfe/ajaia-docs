/**
 * The data layer only needs "run this SQL with these params, give me rows".
 * Production hands it Neon; tests hand it PGlite running the same schema.sql.
 */
export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export type Role = "owner" | "editor" | "viewer" | "none";
export type ShareRole = "viewer" | "editor";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface DocSummary {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  updated_at: string;
  role: Role;
}

export interface Doc {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  content: unknown;
  version: number;
  updated_at: string;
}

export interface Share {
  user_id: string;
  name: string;
  email: string;
  role: ShareRole;
}
