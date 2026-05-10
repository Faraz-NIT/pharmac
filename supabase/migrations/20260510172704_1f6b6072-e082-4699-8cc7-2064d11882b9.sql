
alter publication supabase_realtime add table public.pipeline_runs;
alter publication supabase_realtime add table public.signals;
alter table public.pipeline_runs replica identity full;
alter table public.signals replica identity full;
