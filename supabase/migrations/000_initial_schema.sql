-- =============================================================================
-- Planfarm Elevate dashboard: Supabase schema
--
-- Mirrors the JSON written by exportData() in index.html (export version 3).
-- Run once in the Supabase SQL Editor (or as a Supabase CLI migration).
--
-- Mapping from the export:
--   blueprint.tenyear / purpose     -> blueprints
--   blueprint.values                -> core_values
--   blueprint.threeyear (+ Done)    -> three_year_items
--   blueprint.oneyear               -> one_year_targets
--   blueprint.issues                -> issues
--   periods120[] / .priorities[]    -> periods_120 / priorities_120
--   rounds[] / .tasks[]             -> rounds_30 / tasks_30
--   pendingPushes120 / pendingPushes-> pending_priorities_120 / pending_tasks_30
--   sessions[]                      -> coaching_sessions
--
-- Free-text dates ("TBC", "Jun 2026", "1 May 2026") are kept as text.
-- The export's "when" field is called by_when here, because WHEN is reserved in SQL.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.item_status as enum ('none', 'on-track', 'off-track', 'complete');
create type public.issue_kind  as enum ('issue', 'opportunity');

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Businesses and who can access them
-- -----------------------------------------------------------------------------
create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.businesses is 'One row per farm business; every dashboard table belongs to a business.';

-- Planfarm coaches / advisors: can see and edit every business.
create table public.staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
comment on table public.staff is 'Planfarm staff logins. Staff can see and edit all businesses.';

-- Client logins: can see and edit only the business(es) they belong to.
create table public.clients (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index clients_user_id_idx on public.clients (user_id);
comment on table public.clients is 'Client logins: links each login to the business(es) whose dashboard they can use.';

-- -----------------------------------------------------------------------------
-- Farm Blueprint
-- -----------------------------------------------------------------------------
create table public.blueprints (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  ten_year    text not null default '',   -- blueprint.tenyear (paragraphs separated by blank lines)
  purpose     text not null default '',   -- blueprint.purpose
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.blueprints is '10-Year Direction and Purpose. One row per business, created automatically with the business. Parent of the Blueprint lists (core_values, three_year_items, one_year_targets).';

-- Every business gets an empty blueprint, so the Blueprint lists below always
-- have a parent row to reference.
create function public.create_blueprint_for_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.blueprints (business_id) values (new.id);
  return new;
end;
$$;

create trigger create_blueprint after insert on public.businesses
  for each row execute function public.create_blueprint_for_business();

-- The Blueprint lists reference blueprints (whose key is business_id), not
-- businesses directly: deleting a blueprint clears its lists.
create table public.core_values (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.blueprints (business_id) on delete cascade,
  text        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index core_values_business_id_idx on public.core_values (business_id, sort_order);
comment on table public.core_values is 'Our Core Values (blueprint.values).';

create table public.three_year_items (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.blueprints (business_id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index three_year_items_business_id_idx on public.three_year_items (business_id, sort_order);
comment on table public.three_year_items is '3-Year Picture: one row per item (blueprint.threeyear + threeyearDone).';

create table public.one_year_targets (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.blueprints (business_id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index one_year_targets_business_id_idx on public.one_year_targets (business_id, sort_order);
comment on table public.one_year_targets is '1-Year Targets (Must Do) (blueprint.oneyear).';

create table public.issues (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind        public.issue_kind not null default 'issue',   -- 'opportunity' replaces the "OPPORTUNITY:" prefix
  text        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index issues_business_id_idx on public.issues (business_id, sort_order);
comment on table public.issues is 'Issues & Opportunities (blueprint.issues).';

-- -----------------------------------------------------------------------------
-- 120-Day Priorities
-- -----------------------------------------------------------------------------
create table public.periods_120 (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  label             text not null,                  -- e.g. "Period 1"
  period            text not null default '',       -- free-text date range
  is_current        boolean not null default false,
  one_year_targets  text[] not null default '{}',   -- targets entered when the period was created
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index periods_120_business_id_idx on public.periods_120 (business_id, sort_order);
create unique index periods_120_one_current_per_business on public.periods_120 (business_id) where is_current;
comment on table public.periods_120 is '120-day periods (periods120). At most one current period per business.';

create table public.priorities_120 (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references public.periods_120 (id) on delete cascade,
  what          text not null,
  who           text not null default '',
  by_when       text not null default '',             -- export: "when"
  status        public.item_status not null default 'none',
  pushed        boolean not null default false,        -- carried into the next period
  carried_from  text,                                  -- label of the period it came from
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index priorities_120_period_id_idx on public.priorities_120 (period_id, sort_order);
comment on table public.priorities_120 is 'Priority actions within a 120-day period.';

create table public.pending_priorities_120 (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  what          text not null,
  who           text not null default '',
  by_when       text not null default '',
  from_period   text not null default '',   -- label of the period it was pushed from
  created_at    timestamptz not null default now()
);
create index pending_priorities_120_business_id_idx on public.pending_priorities_120 (business_id, created_at);
comment on table public.pending_priorities_120 is 'Priorities pushed while no next period exists (pendingPushes120); added to the next period created.';

-- -----------------------------------------------------------------------------
-- 30-Day To-Dos
-- -----------------------------------------------------------------------------
create table public.rounds_30 (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  label       text not null,                -- e.g. "Round 1"
  period      text not null default '',     -- free-text date range
  is_current  boolean not null default false,
  notes       text not null default '',     -- coaching session notes for this round
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index rounds_30_business_id_idx on public.rounds_30 (business_id, sort_order);
create unique index rounds_30_one_current_per_business on public.rounds_30 (business_id) where is_current;
comment on table public.rounds_30 is '30-day rounds (rounds). At most one current round per business.';

create table public.tasks_30 (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references public.rounds_30 (id) on delete cascade,
  what          text not null,
  who           text not null default '',
  by_when       text not null default '',             -- export: "when"
  status        public.item_status not null default 'none',
  pushed        boolean not null default false,        -- carried into the next round
  carried_from  text,                                  -- label of the round it came from
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tasks_30_round_id_idx on public.tasks_30 (round_id, sort_order);
comment on table public.tasks_30 is 'Tasks within a 30-day round.';

create table public.pending_tasks_30 (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  what          text not null,
  who           text not null default '',
  by_when       text not null default '',
  from_round    text not null default '',   -- label of the round it was pushed from
  created_at    timestamptz not null default now()
);
create index pending_tasks_30_business_id_idx on public.pending_tasks_30 (business_id, created_at);
comment on table public.pending_tasks_30 is 'Tasks pushed while no next round exists (pendingPushes); added to the next round created.';

-- -----------------------------------------------------------------------------
-- Coaching Sessions
-- -----------------------------------------------------------------------------
create table public.coaching_sessions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  session_date  text not null,                -- export: "date" (free text, e.g. "1 May 2026")
  format        text not null default '',     -- e.g. "In-person", "Teams", "TBC"
  focus         text not null,
  notes         text not null default '',
  done          boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index coaching_sessions_business_id_idx on public.coaching_sessions (business_id, sort_order);
comment on table public.coaching_sessions is 'Upcoming / past coaching sessions (sessions).';

-- -----------------------------------------------------------------------------
-- Keep updated_at current
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.businesses        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.blueprints        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.core_values       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.three_year_items  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.one_year_targets  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.issues            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.periods_120       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.priorities_120    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rounds_30         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks_30          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.coaching_sessions for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
--   Staff (public.staff)     -> every business
--   Clients (public.clients) -> only their own business(es)
--   Not signed in (anon)                -> nothing
-- =============================================================================

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff where user_id = (select auth.uid())
  );
$$;

create function public.can_access_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
      or exists (
           select 1
           from public.clients
           where business_id = p_business_id
             and user_id = (select auth.uid())
         );
$$;

revoke execute on function public.is_staff()                 from public, anon;
revoke execute on function public.can_access_business(uuid)  from public, anon;
grant  execute on function public.is_staff()                 to authenticated;
grant  execute on function public.can_access_business(uuid)  to authenticated;

alter table public.businesses             enable row level security;
alter table public.staff                  enable row level security;
alter table public.clients                enable row level security;
alter table public.blueprints             enable row level security;
alter table public.core_values            enable row level security;
alter table public.three_year_items       enable row level security;
alter table public.one_year_targets       enable row level security;
alter table public.issues                 enable row level security;
alter table public.periods_120            enable row level security;
alter table public.priorities_120         enable row level security;
alter table public.pending_priorities_120 enable row level security;
alter table public.rounds_30              enable row level security;
alter table public.tasks_30               enable row level security;
alter table public.pending_tasks_30       enable row level security;
alter table public.coaching_sessions      enable row level security;

-- businesses: staff manage; clients can view their own
create policy "Staff and clients can view businesses" on public.businesses
  for select to authenticated using (public.can_access_business(id));
create policy "Staff can create businesses" on public.businesses
  for insert to authenticated with check (public.is_staff());
create policy "Staff can update businesses" on public.businesses
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Staff can delete businesses" on public.businesses
  for delete to authenticated using (public.is_staff());

-- staff: visible to staff; changed only from the SQL Editor
create policy "Staff can view staff" on public.staff
  for select to authenticated using (public.is_staff());

-- clients: staff manage; users can see their own client rows
create policy "Staff can manage clients" on public.clients
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Users can view own client rows" on public.clients
  for select to authenticated using (user_id = (select auth.uid()));

-- Dashboard tables with a business_id column
create policy "Business access" on public.blueprints
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.core_values
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.three_year_items
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.one_year_targets
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.issues
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.periods_120
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.pending_priorities_120
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.rounds_30
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.pending_tasks_30
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));
create policy "Business access" on public.coaching_sessions
  for all to authenticated using (public.can_access_business(business_id)) with check (public.can_access_business(business_id));

-- Child tables: access follows the parent period / round
create policy "Business access via period" on public.priorities_120
  for all to authenticated
  using      (public.can_access_business((select p.business_id from public.periods_120 p where p.id = priorities_120.period_id)))
  with check (public.can_access_business((select p.business_id from public.periods_120 p where p.id = priorities_120.period_id)));
create policy "Business access via round" on public.tasks_30
  for all to authenticated
  using      (public.can_access_business((select r.business_id from public.rounds_30 r where r.id = tasks_30.round_id)))
  with check (public.can_access_business((select r.business_id from public.rounds_30 r where r.id = tasks_30.round_id)));

-- -----------------------------------------------------------------------------
-- Table privileges: signed-in users only (RLS above decides which rows)
-- -----------------------------------------------------------------------------
revoke all on
  public.businesses, public.staff, public.clients,
  public.blueprints, public.core_values, public.three_year_items, public.one_year_targets, public.issues,
  public.periods_120, public.priorities_120, public.pending_priorities_120,
  public.rounds_30, public.tasks_30, public.pending_tasks_30,
  public.coaching_sessions
from anon;

grant select on public.staff to authenticated;
grant select, insert, update, delete on
  public.businesses, public.clients,
  public.blueprints, public.core_values, public.three_year_items, public.one_year_targets, public.issues,
  public.periods_120, public.priorities_120, public.pending_priorities_120,
  public.rounds_30, public.tasks_30, public.pending_tasks_30,
  public.coaching_sessions
to authenticated;

commit;

-- =============================================================================
-- After running: make yourself staff (create your login first under
-- Authentication -> Users, then run this with your email):
--
--   insert into public.staff (user_id)
--   select id from auth.users where email = 'you@example.com';
--
-- Give a client login access to a business:
--
--   insert into public.clients (business_id, user_id)
--   select b.id, u.id
--   from public.businesses b, auth.users u
--   where b.name = 'Business Name' and u.email = 'client@example.com';
-- =============================================================================
