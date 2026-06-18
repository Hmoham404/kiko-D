create extension if not exists pgcrypto;

create table if not exists public.production_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  department text not null,
  week_label text not null,
  week_key text not null,
  shift text,
  part_number text,
  machine text,
  unit_of_production text,
  target integer not null default 0,
  weekly_target integer not null default 0,
  actual_production integer not null default 0,
  conform_qty integer not null default 0,
  scrap_qty integer not null default 0,
  progress numeric(10,4) not null default 0,
  gap integer not null default 0,
  scrap_rate numeric(10,4) not null default 0,
  status text not null default 'red',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, department)
);

create table if not exists public.sub_component_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  component text not null,
  week_key text not null,
  machine text,
  reference text,
  unit_of_production text,
  cover_code text,
  target integer not null default 0,
  weekly_target integer not null default 0,
  actual_production integer not null default 0,
  conform_qty integer not null default 0,
  scrap_qty integer not null default 0,
  progress numeric(10,4) not null default 0,
  gap integer not null default 0,
  scrap_rate numeric(10,4) not null default 0,
  status text not null default 'red',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, component)
);

create table if not exists public.weekly_targets (
  id uuid primary key default gen_random_uuid(),
  target_key text not null unique,
  value integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_metadata (
  meta_key text primary key,
  meta_value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_production_reports_updated_at on public.production_reports;
create trigger trg_production_reports_updated_at
before update on public.production_reports
for each row
execute function public.set_updated_at();

drop trigger if exists trg_sub_component_reports_updated_at on public.sub_component_reports;
create trigger trg_sub_component_reports_updated_at
before update on public.sub_component_reports
for each row
execute function public.set_updated_at();

drop trigger if exists trg_weekly_targets_updated_at on public.weekly_targets;
create trigger trg_weekly_targets_updated_at
before update on public.weekly_targets
for each row
execute function public.set_updated_at();

drop trigger if exists trg_dashboard_metadata_updated_at on public.dashboard_metadata;
create trigger trg_dashboard_metadata_updated_at
before update on public.dashboard_metadata
for each row
execute function public.set_updated_at();

alter table public.production_reports enable row level security;
alter table public.sub_component_reports enable row level security;
alter table public.weekly_targets enable row level security;
alter table public.dashboard_metadata enable row level security;

drop policy if exists "production_reports_read" on public.production_reports;
create policy "production_reports_read"
on public.production_reports
for select
using (true);

drop policy if exists "production_reports_write" on public.production_reports;
create policy "production_reports_write"
on public.production_reports
for all
using (true)
with check (true);

drop policy if exists "sub_component_reports_read" on public.sub_component_reports;
create policy "sub_component_reports_read"
on public.sub_component_reports
for select
using (true);

drop policy if exists "sub_component_reports_write" on public.sub_component_reports;
create policy "sub_component_reports_write"
on public.sub_component_reports
for all
using (true)
with check (true);

drop policy if exists "weekly_targets_read" on public.weekly_targets;
create policy "weekly_targets_read"
on public.weekly_targets
for select
using (true);

drop policy if exists "weekly_targets_write" on public.weekly_targets;
create policy "weekly_targets_write"
on public.weekly_targets
for all
using (true)
with check (true);

drop policy if exists "dashboard_metadata_read" on public.dashboard_metadata;
create policy "dashboard_metadata_read"
on public.dashboard_metadata
for select
using (true);

drop policy if exists "dashboard_metadata_write" on public.dashboard_metadata;
create policy "dashboard_metadata_write"
on public.dashboard_metadata
for all
using (true)
with check (true);
