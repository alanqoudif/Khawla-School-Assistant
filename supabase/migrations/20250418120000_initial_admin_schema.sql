-- Khawla School Assistant: admin profiles, guide content, site settings, chat analytics
-- Run via Supabase SQL Editor or: supabase db push

-- ---------------------------------------------------------------------------
-- profiles (linked to auth.users; role drives admin UI access)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- guide_snapshots (published body is what loaders / APIs prefer)
-- ---------------------------------------------------------------------------
create table if not exists public.guide_snapshots (
  id uuid primary key default gen_random_uuid(),
  body text not null default '',
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists guide_snapshots_published_idx
  on public.guide_snapshots (is_published)
  where is_published = true;

-- ---------------------------------------------------------------------------
-- site_settings (key/value JSON for future CMS toggles)
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- chat_analytics_events (written from Next.js API with service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.chat_analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null,
  user_excerpt text,
  assistant_excerpt text,
  user_message_length int,
  assistant_response_length int,
  ok boolean not null default true,
  latency_ms int,
  error_hint text
);

create index if not exists chat_analytics_created_idx on public.chat_analytics_events (created_at desc);
create index if not exists chat_analytics_session_idx on public.chat_analytics_events (session_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.guide_snapshots enable row level security;
alter table public.site_settings enable row level security;
alter table public.chat_analytics_events enable row level security;

-- profiles: read own row only (no client updates; role changes via service role / SQL)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- guide_snapshots: admins only
drop policy if exists "guide_snapshots_admin_select" on public.guide_snapshots;
create policy "guide_snapshots_admin_select"
  on public.guide_snapshots for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "guide_snapshots_admin_insert" on public.guide_snapshots;
create policy "guide_snapshots_admin_insert"
  on public.guide_snapshots for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "guide_snapshots_admin_update" on public.guide_snapshots;
create policy "guide_snapshots_admin_update"
  on public.guide_snapshots for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "guide_snapshots_admin_delete" on public.guide_snapshots;
create policy "guide_snapshots_admin_delete"
  on public.guide_snapshots for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- site_settings: admins only
drop policy if exists "site_settings_admin_select" on public.site_settings;
create policy "site_settings_admin_select"
  on public.site_settings for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "site_settings_admin_insert" on public.site_settings;
create policy "site_settings_admin_insert"
  on public.site_settings for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update"
  on public.site_settings for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "site_settings_admin_delete" on public.site_settings;
create policy "site_settings_admin_delete"
  on public.site_settings for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- chat_analytics_events: admins can read; no anon/authenticated insert (service role bypasses RLS)
drop policy if exists "chat_analytics_admin_select" on public.chat_analytics_events;
create policy "chat_analytics_admin_select"
  on public.chat_analytics_events for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Auth: new user -> profile row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One empty published snapshot so admin UI can update immediately
insert into public.guide_snapshots (body, is_published)
select '', true
where not exists (
  select 1 from public.guide_snapshots g where g.is_published = true
);
