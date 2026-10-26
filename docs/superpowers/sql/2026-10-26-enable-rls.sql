-- Enable Row Level Security on every application table.
-- The server talks to Supabase with the service-role key, which bypasses RLS,
-- so no policies are added: anonymous and authenticated PostgREST clients get no access.
-- Run once in the Supabase SQL editor; safe to re-run.

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users',
    'app_sessions',
    'products',
    'product_images',
    'generation_attempts',
    'merchant_followers',
    'wishlists',
    'system_settings',
    'feature_flags',
    'product_scenes',
    'room_asset_categories',
    'room_assets',
    'room_asset_versions',
    'room_asset_access'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- Verify: every row should show rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
