create table if not exists room_asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists room_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references room_asset_categories(id),
  access_level text not null default 'free' check (access_level in ('free', 'pro', 'selected')),
  placement text not null default 'floor' check (placement in ('floor', 'wall')),
  hidden boolean not null default false,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists room_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references room_assets(id) on delete cascade,
  version int not null,
  glb_url text not null,
  storage_path text not null,
  preview_url text,
  width_cm numeric not null,
  depth_cm numeric not null,
  height_cm numeric not null,
  file_size_bytes int not null,
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create table if not exists room_asset_access (
  asset_id uuid not null references room_assets(id) on delete cascade,
  merchant_id text not null,
  primary key (asset_id, merchant_id)
);

create index if not exists room_assets_category_idx on room_assets(category_id);
create index if not exists room_asset_versions_asset_idx on room_asset_versions(asset_id);

alter table app_users
  add column if not exists plan text not null default 'free' check (plan in ('free', 'pro'));

alter table products add column if not exists thumbnail_url text;
