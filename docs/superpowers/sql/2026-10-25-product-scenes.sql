create table if not exists product_scenes (
  product_id text primary key references products(id) on delete cascade,
  scene jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
