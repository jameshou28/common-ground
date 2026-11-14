-- run once in supabase: sql editor, new query, paste, run
create table if not exists scores (
  tile_id text not null,
  target_id text not null,
  model_version text not null,
  result jsonb not null,
  explanation jsonb,
  created_at timestamptz not null default now(),
  primary key (tile_id, target_id, model_version)
);
alter table scores enable row level security;
drop policy if exists "anon read" on scores;
create policy "anon read" on scores for select to anon using (true);
-- no insert or update policy on purpose, only the service role key (render, bake scripts) can write
