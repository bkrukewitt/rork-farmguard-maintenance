-- ============================================
-- FarmGuard Supabase Migration
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Profiles table (auto-created on signup)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Organizations
create table if not exists public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Organization Members
create table if not exists public.organization_members (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member')) not null default 'member',
  joined_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- 4. Equipment
create table if not exists public.equipment (
  id text primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  type text not null,
  make text default '',
  model text default '',
  year integer default 0,
  serial_number text default '',
  purchase_date text default '',
  current_hours numeric default 0,
  oil_capacity text,
  image_url text,
  warranty_expiry text,
  notes text,
  attachments jsonb default '[]'::jsonb,
  version integer default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Maintenance Logs
create table if not exists public.maintenance_logs (
  id text primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  equipment_id text not null,
  date text not null,
  hours_at_service numeric default 0,
  type text not null,
  description text default '',
  consumables_used jsonb default '[]'::jsonb,
  performed_by text default 'owner',
  performed_by_name text,
  downtime_hours numeric,
  notes text,
  attachments jsonb default '[]'::jsonb,
  version integer default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Maintenance Intervals
create table if not exists public.maintenance_intervals (
  id text primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  equipment_id text not null,
  name text not null,
  interval_hours numeric,
  interval_days integer,
  last_performed_hours numeric,
  last_performed_date text,
  notes text,
  version integer default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Consumables
create table if not exists public.consumables (
  id text primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  part_number text default '',
  category text not null,
  supplier text,
  supplier_part_number text,
  quantity numeric default 0,
  low_stock_threshold numeric default 0,
  compatible_equipment jsonb default '[]'::jsonb,
  image_url text,
  notes text,
  version integer default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Service Routines
create table if not exists public.service_routines (
  id text primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  equipment_types jsonb default '[]'::jsonb,
  checklist_items jsonb default '[]'::jsonb,
  version integer default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 9. Inspection Routines
create table if not exists public.inspection_routines (
  id text primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  description text,
  equipment_types jsonb default '[]'::jsonb,
  checklist_items jsonb default '[]'::jsonb,
  version integer default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 10. Audit Logs
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  user_email text,
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_name text,
  details jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security Policies
-- ============================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.equipment enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.maintenance_intervals enable row level security;
alter table public.consumables enable row level security;
alter table public.service_routines enable row level security;
alter table public.inspection_routines enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can view org member profiles" on public.profiles
  for select using (
    id in (
      select om2.user_id from public.organization_members om1
      join public.organization_members om2 on om1.organization_id = om2.organization_id
      where om1.user_id = auth.uid()
    )
  );

-- Organizations
create policy "Members can view their org" on public.organizations
  for select using (
    id in (select organization_id from public.organization_members where user_id = auth.uid())
  );
create policy "Authenticated users can create orgs" on public.organizations
  for insert with check (auth.uid() = created_by);
create policy "Owners can update org" on public.organizations
  for update using (
    id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Allow anyone to look up an org by invite code (for joining)
create policy "Anyone can lookup org by invite code" on public.organizations
  for select using (true);

-- Organization Members
create policy "Members can view org members" on public.organization_members
  for select using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );
create policy "Users can insert themselves as members" on public.organization_members
  for insert with check (user_id = auth.uid());
create policy "Owners/admins can update members" on public.organization_members
  for update using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
create policy "Owners can delete members" on public.organization_members
  for delete using (
    user_id = auth.uid() or
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Helper function to check org membership
create or replace function public.user_is_org_member(org_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_uuid and user_id = auth.uid()
  );
$$ language sql security definer;

-- Equipment policies
create policy "Org members can view equipment" on public.equipment
  for select using (public.user_is_org_member(org_id));
create policy "Org members can insert equipment" on public.equipment
  for insert with check (public.user_is_org_member(org_id));
create policy "Org members can update equipment" on public.equipment
  for update using (public.user_is_org_member(org_id));
create policy "Org admins can delete equipment" on public.equipment
  for delete using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Maintenance Logs policies
create policy "Org members can view logs" on public.maintenance_logs
  for select using (public.user_is_org_member(org_id));
create policy "Org members can insert logs" on public.maintenance_logs
  for insert with check (public.user_is_org_member(org_id));
create policy "Org members can update logs" on public.maintenance_logs
  for update using (public.user_is_org_member(org_id));
create policy "Org admins can delete logs" on public.maintenance_logs
  for delete using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Maintenance Intervals policies
create policy "Org members can view intervals" on public.maintenance_intervals
  for select using (public.user_is_org_member(org_id));
create policy "Org members can insert intervals" on public.maintenance_intervals
  for insert with check (public.user_is_org_member(org_id));
create policy "Org members can update intervals" on public.maintenance_intervals
  for update using (public.user_is_org_member(org_id));
create policy "Org admins can delete intervals" on public.maintenance_intervals
  for delete using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Consumables policies
create policy "Org members can view consumables" on public.consumables
  for select using (public.user_is_org_member(org_id));
create policy "Org members can insert consumables" on public.consumables
  for insert with check (public.user_is_org_member(org_id));
create policy "Org members can update consumables" on public.consumables
  for update using (public.user_is_org_member(org_id));
create policy "Org admins can delete consumables" on public.consumables
  for delete using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Service Routines policies
create policy "Org members can view service routines" on public.service_routines
  for select using (public.user_is_org_member(org_id));
create policy "Org members can insert service routines" on public.service_routines
  for insert with check (public.user_is_org_member(org_id));
create policy "Org members can update service routines" on public.service_routines
  for update using (public.user_is_org_member(org_id));
create policy "Org admins can delete service routines" on public.service_routines
  for delete using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Inspection Routines policies
create policy "Org members can view inspection routines" on public.inspection_routines
  for select using (public.user_is_org_member(org_id));
create policy "Org members can insert inspection routines" on public.inspection_routines
  for insert with check (public.user_is_org_member(org_id));
create policy "Org members can update inspection routines" on public.inspection_routines
  for update using (public.user_is_org_member(org_id));
create policy "Org admins can delete inspection routines" on public.inspection_routines
  for delete using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Audit Logs policies
create policy "Org admins can view audit logs" on public.audit_logs
  for select using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
create policy "Org members can insert audit logs" on public.audit_logs
  for insert with check (public.user_is_org_member(org_id));

-- ============================================
-- Indexes for performance
-- ============================================
create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org on public.organization_members(organization_id);
create index if not exists idx_equipment_org on public.equipment(org_id);
create index if not exists idx_maintenance_logs_org on public.maintenance_logs(org_id);
create index if not exists idx_maintenance_logs_equipment on public.maintenance_logs(equipment_id);
create index if not exists idx_intervals_org on public.maintenance_intervals(org_id);
create index if not exists idx_intervals_equipment on public.maintenance_intervals(equipment_id);
create index if not exists idx_consumables_org on public.consumables(org_id);
create index if not exists idx_service_routines_org on public.service_routines(org_id);
create index if not exists idx_inspection_routines_org on public.inspection_routines(org_id);
create index if not exists idx_audit_logs_org on public.audit_logs(org_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
create index if not exists idx_equipment_updated on public.equipment(updated_at);
create index if not exists idx_maintenance_logs_updated on public.maintenance_logs(updated_at);
create index if not exists idx_consumables_updated on public.consumables(updated_at);
