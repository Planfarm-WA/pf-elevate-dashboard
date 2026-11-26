-- =============================================================================
-- Staff admin screen ("Manage businesses" in the app)
--
-- Staff create, rename and delete businesses, and remove client links, straight
-- through the tables: the RLS policies in 000_initial_schema.sql already allow
-- that. Listing who is linked, and linking a login by its email, need
-- auth.users, which the browser can't read. These two staff-only functions do
-- that:
--   client_logins()               every business's client logins, with emails
--   link_client(business, email)  give an existing login access to a business
--
-- Logins themselves are still created in the Supabase dashboard
-- (Authentication -> Users -> Add user).
--
-- Check it on the local stack with supabase/checks/staff_admin.sql.
-- =============================================================================

begin;

create function public.client_logins()
returns table (business_id uuid, user_id uuid, email text, linked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only Planfarm staff can see client logins.'
      using errcode = 'insufficient_privilege';
  end if;
  -- Qualify every column: the output columns above are also variables in here.
  -- auth.users.email is varchar(255), so cast it to match "email text".
  return query
    select c.business_id, c.user_id, u.email::text, c.created_at
    from public.clients c
    join auth.users u on u.id = c.user_id
    order by c.business_id, lower(u.email);
end;
$$;
comment on function public.client_logins() is
  'Staff only: every client link (business_id, user_id) with the login''s email. Used by the Manage businesses screen.';

create function public.link_client(p_business_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Only Planfarm staff can link client logins.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'This business no longer exists.';
  end if;

  -- Match the email ignoring letter case and surrounding spaces.
  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email));

  if v_user_id is null then
    raise exception 'There is no login with the email %. Create it in Supabase first (Authentication → Users → Add user), then link it here.',
      btrim(p_email);
  end if;

  insert into public.clients (business_id, user_id)
  values (p_business_id, v_user_id)
  on conflict (business_id, user_id) do nothing;
end;
$$;
comment on function public.link_client(uuid, text) is
  'Staff only: give an existing login (found by email, any letter case) access to a business. Linking twice does nothing.';

-- Supabase's default privileges let anon run new functions in public. Only
-- signed-in users may call these, and the functions then require staff.
revoke execute on function public.client_logins()         from public, anon;
revoke execute on function public.link_client(uuid, text) from public, anon;
grant  execute on function public.client_logins()         to authenticated;
grant  execute on function public.link_client(uuid, text) to authenticated;

commit;
