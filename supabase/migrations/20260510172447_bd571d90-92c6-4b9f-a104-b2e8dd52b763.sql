
create table public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  drug text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  reports_total integer not null default 0,
  drug_reports integer not null default 0,
  signals_count integer not null default 0,
  error text
);

create index pipeline_runs_drug_started_idx on public.pipeline_runs (drug, started_at desc);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  drug text not null,
  reaction text not null,
  a integer not null,
  b integer not null,
  c integer not null,
  d integer not null,
  prr numeric not null,
  prr_low numeric not null,
  prr_high numeric not null,
  ror numeric not null,
  ror_low numeric not null,
  ror_high numeric not null,
  chi_sq numeric not null,
  level text not null,
  computed_at timestamptz not null default now()
);

create index signals_drug_idx on public.signals (drug, computed_at desc);
create index signals_run_idx on public.signals (run_id);

alter table public.pipeline_runs enable row level security;
alter table public.signals enable row level security;

create policy "Public can view pipeline runs"
  on public.pipeline_runs for select
  using (true);

create policy "Public can view signals"
  on public.signals for select
  using (true);
