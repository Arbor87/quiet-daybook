-- Run this in Supabase SQL Editor. RLS isolates every user's records.
create extension if not exists pgcrypto;
do $$ declare c text; begin
  foreach c in array array['tasks','ideas','expenses','budgets','balances'] loop
    execute format('create table if not exists public.%I (user_id uuid not null references auth.users(id) on delete cascade, id text not null, payload jsonb not null, updated_at timestamptz not null default now(), deleted_at timestamptz, primary key (user_id,id))', c);
    execute format('alter table public.%I enable row level security', c);
    execute format('drop policy if exists "own records" on public.%I', c);
    execute format('create policy "own records" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', c);
  end loop;
end $$;
