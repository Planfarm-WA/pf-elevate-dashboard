-- Checks the Manage businesses access rules (001_staff_admin.sql) on the LOCAL Supabase stack, as
-- staff, as a client and as anon (not logged in). Apply the migrations first
-- (`pnpm supabase migration up`), then:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/checks/staff_admin.sql
--
-- Everything runs in one transaction that is rolled back, so it leaves nothing behind. A failing
-- check stops with "ERROR: FAIL: ..."; a clean run ends with "staff admin checks passed".

begin;

-- Throwaway logins and businesses (as postgres). The client's email has capitals on purpose.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'check-staff@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'Check-Client@Example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'check-other@example.test');
insert into public.staff (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.businesses (id, name) values
  ('00000000-0000-4000-8000-0000000000b1', 'Check Farm'),
  ('00000000-0000-4000-8000-0000000000b2', 'Other Farm');
insert into public.clients (business_id, user_id) values
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a3');

-- ---- Staff ----
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';

do $$
declare
  farm_id   constant uuid := '00000000-0000-4000-8000-0000000000b1';
  other_id  constant uuid := '00000000-0000-4000-8000-0000000000b2';
  client_id constant uuid := '00000000-0000-4000-8000-0000000000a2';
  new_id uuid;
  n int;
begin
  -- Linking ignores letter case and spaces; linking twice changes nothing.
  perform public.link_client(farm_id, '  CHECK-client@example.TEST ');
  perform public.link_client(farm_id, 'check-client@example.test');
  select count(*) into n from public.client_logins() l where l.business_id = farm_id;
  if n <> 1 then raise exception 'FAIL: Check Farm should have 1 client login, not %', n; end if;
  if not exists (select 1 from public.client_logins() l
                 where l.business_id = other_id and l.email = 'check-other@example.test') then
    raise exception 'FAIL: staff should see Other Farm''s client login';
  end if;

  -- Clear messages for an unknown email and a missing business.
  begin
    perform public.link_client(farm_id, 'nobody@example.test');
    raise exception 'FAIL: linking an unknown email should fail';
  exception when raise_exception then
    if sqlerrm not like 'There is no login with the email nobody@example.test.%' then raise; end if;
  end;
  begin
    perform public.link_client(gen_random_uuid(), 'check-client@example.test');
    raise exception 'FAIL: linking to a missing business should fail';
  exception when raise_exception then
    if sqlerrm <> 'This business no longer exists.' then raise; end if;
  end;

  -- What the app does through the tables: create (gets a blueprint), rename, unlink, delete.
  insert into public.businesses (name) values ('Check New') returning id into new_id;
  if not exists (select 1 from public.blueprints b where b.business_id = new_id) then
    raise exception 'FAIL: a new business should get a blueprint';
  end if;
  update public.businesses set name = 'Check Renamed' where id = new_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: staff should be able to rename a business'; end if;
  delete from public.clients where business_id = farm_id and user_id = client_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: staff should be able to remove a link'; end if;
  perform public.link_client(farm_id, 'check-client@example.test');
  delete from public.businesses where id = farm_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: staff should be able to delete a business'; end if;
  if exists (select 1 from public.clients c where c.business_id = farm_id) then
    raise exception 'FAIL: deleting a business should delete its client links';
  end if;
end $$;

-- ---- A client (linked to Other Farm only) ----
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a3';

do $$
declare
  other_id constant uuid := '00000000-0000-4000-8000-0000000000b2';
  n int;
begin
  begin
    perform 1 from public.client_logins();
    raise exception 'FAIL: a client could list client logins';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.link_client(other_id, 'check-client@example.test');
    raise exception 'FAIL: a client could link a login';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.businesses (name) values ('Made by a client');
    raise exception 'FAIL: a client could create a business';
  exception when insufficient_privilege then null;   -- RLS: new row violates policy
  end;
  begin
    insert into public.clients (business_id, user_id) values (other_id, '00000000-0000-4000-8000-0000000000a2');
    raise exception 'FAIL: a client could link a login through the table';
  exception when insufficient_privilege then null;
  end;
  -- RLS hides the rows from a client's writes: no error, nothing changed.
  update public.businesses set name = 'Renamed by a client' where id = other_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a client could rename a business'; end if;
  delete from public.clients where business_id = other_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a client could remove a link'; end if;
  delete from public.businesses where id = other_id;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a client could delete a business'; end if;
end $$;

-- ---- Not logged in (anon) ----
set local role anon;
set local request.jwt.claim.sub = '';

do $$
begin
  begin
    perform 1 from public.client_logins();
    raise exception 'FAIL: anon could call client_logins()';
  exception when insufficient_privilege then
    if sqlerrm not like 'permission denied for function%' then raise; end if;
  end;
  begin
    perform public.link_client('00000000-0000-4000-8000-0000000000b2', 'check-other@example.test');
    raise exception 'FAIL: anon could call link_client()';
  exception when insufficient_privilege then
    if sqlerrm not like 'permission denied for function%' then raise; end if;
  end;
  begin
    perform 1 from public.clients;
    raise exception 'FAIL: anon could read clients';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---- Back as postgres: unlinking and deleting businesses never delete logins ----
reset role;
do $$
begin
  if not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL: a login was deleted';
  end if;
end $$;

select 'staff admin checks passed' as result;
rollback;
