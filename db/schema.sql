-- Ajaia Docs schema. Idempotent: safe to run on every seed.
create table if not exists users (
  id    text primary key,
  name  text not null,
  email text not null unique
);

create table if not exists documents (
  id         uuid primary key default gen_random_uuid(),
  owner_id   text not null references users(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  content    jsonb not null,
  -- bumped on every content save; the optimistic-concurrency token
  version    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_owner_idx on documents (owner_id, updated_at desc);

create table if not exists document_shares (
  document_id uuid not null references documents(id) on delete cascade,
  user_id     text not null references users(id) on delete cascade,
  role        text not null check (role in ('viewer', 'editor')),
  created_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);
create index if not exists document_shares_user_idx on document_shares (user_id);

-- Who made the latest content save; null means the owner (rows from before this column).
alter table documents add column if not exists updated_by text references users(id) on delete set null;

-- Version history. 'edit' rows are snapshots of a document's earlier state, taken when a
-- different person starts editing or after a pause. 'conflict' rows hold a save the server
-- refused because someone else saved first, so that edit is kept instead of lost.
create table if not exists document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content     jsonb not null,
  doc_version integer not null,
  author_id   text references users(id) on delete set null,
  saved_at    timestamptz not null default now(),
  kind        text not null check (kind in ('edit', 'conflict'))
);
create index if not exists document_versions_doc_idx on document_versions (document_id, saved_at desc);
