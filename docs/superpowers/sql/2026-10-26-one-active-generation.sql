-- Allow at most one queued/processing generation attempt per product.
-- The API inserts a "queued" row before calling Meshy; a concurrent second request
-- then fails on this index and gets a 409 instead of starting a second paid task.
-- Run once in the Supabase SQL editor; safe to re-run.

create unique index if not exists generation_attempts_one_active
  on public.generation_attempts (product_id)
  where status in ('queued', 'processing');
