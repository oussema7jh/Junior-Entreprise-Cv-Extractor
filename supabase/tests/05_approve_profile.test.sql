-- S1-32: only the server may approve. If the browser roles could run approve_profile, a candidate
-- could approve any data they like, skipping the schema check in POST /api/profile/approve.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(has_function_privilege('anon', 'public.approve_profile(uuid, jsonb, timestamptz)', 'execute'), false,
  'a logged-out visitor cannot run approve_profile');
select is(has_function_privilege('authenticated', 'public.approve_profile(uuid, jsonb, timestamptz)', 'execute'), false,
  'a logged-in user cannot run approve_profile');
select is(has_function_privilege('service_role', 'public.approve_profile(uuid, jsonb, timestamptz)', 'execute'), true,
  'the server (service role) can');

select * from finish();
rollback;
