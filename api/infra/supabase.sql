-- run once in supabase: sql editor, new query, paste, run
-- the region model scores a tile against every moon and mars region at once, so target_id is gone
-- old rows came from the stub model and are safe to drop
drop table if exists scores;
create table scores (
  tile_id text not null,
  model_version text not null,
  result jsonb not null,
  explanation jsonb,
  created_at timestamptz not null default now(),
  primary key (tile_id, model_version)
);
alter table scores enable row level security;
drop policy if exists "anon read" on scores;
create policy "anon read" on scores for select to anon using (true);
-- no insert or update policy on purpose, only the service role key (render, bake scripts) can write
