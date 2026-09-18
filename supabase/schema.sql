-- Boostify Lead CRM schema. Run in Supabase SQL editor.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text,
  city text,
  status text not null default 'New'
    check (status in ('New','Assigned','Called','FollowUp','Converted','Lost')),
  assigned_to uuid references profiles(id) on delete set null,
  notes text,
  followup_date date,
  last_called_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('called','note','status')),
  body text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists leads_status_idx on leads(status);
create index if not exists leads_assigned_idx on leads(assigned_to);
create index if not exists leads_followup_idx on leads(followup_date);
create index if not exists activities_lead_idx on lead_activities(lead_id);

alter table profiles enable row level security;
alter table leads enable row level security;
alter table lead_activities enable row level security;

-- ponytail: flat team, any authenticated user can read/write all. Tighten when roles needed.
drop policy if exists "auth all" on profiles;
create policy "auth all" on profiles for all to authenticated using (true) with check (true);
drop policy if exists "auth all" on leads;
create policy "auth all" on leads for all to authenticated using (true) with check (true);
drop policy if exists "auth all" on lead_activities;
create policy "auth all" on lead_activities for all to authenticated using (true) with check (true);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
