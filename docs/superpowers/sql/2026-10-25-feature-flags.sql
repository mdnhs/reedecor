create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
