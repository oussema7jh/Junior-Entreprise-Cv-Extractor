-- S2-16: deleting an account leaves nothing, and a re-upload changes the live profile only on approval.
-- The deletion check doesn't trust the cascade: it counts the rows left in every table that points
-- at auth.users, and fails if a table added later forgets ON DELETE CASCADE.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ── every table cascades from the auth user ─────────────────────────────
select is(
  (select count(*)::int from pg_constraint
    where contype = 'f' and confrelid = 'auth.users'::regclass
      and connamespace = 'public'::regnamespace and confdeltype <> 'c'),
  0, 'every foreign key from public to auth.users is ON DELETE CASCADE');

select set_eq(
  $$ select table_name from public.leftover_rows('00000000-0000-0000-0000-000000000000') $$,
  array['profiles', 'profile_drafts', 'companies', 'extraction_jobs'],
  'leftover_rows() checks every table that holds a user''s rows');

-- ── a candidate with everything: a live profile with its embedding, a draft, jobs ─
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gone@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'stays@test.local');
insert into public.profiles (user_id, status, looking_for, data, embedding, approved_at)
select id, 'approved', 'pfe', '{"basics": {"name": "Test"}}', array_fill(0.03125, array[1024])::extensions.vector, now()
  from auth.users where email in ('gone@test.local', 'stays@test.local');
insert into public.profile_drafts (user_id, data, provider)
values ('00000000-0000-0000-0000-0000000000d1', '{"looking_for": "job"}', 'gemini');
insert into public.extraction_jobs (user_id, kind, file_path, looking_for)
values ('00000000-0000-0000-0000-0000000000d1', 'extract', '00000000-0000-0000-0000-0000000000d1/x.pdf', 'job'),
       ('00000000-0000-0000-0000-0000000000d1', 'embed', null, null);

select is((select sum(row_count)::int from public.leftover_rows('00000000-0000-0000-0000-0000000000d1')), 4,
  'before: leftover_rows() sees the profile, the draft and the 2 jobs');

delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';

select is((select sum(row_count)::int from public.leftover_rows('00000000-0000-0000-0000-0000000000d1')), 0,
  'after deletion: no row about the candidate is left in any table');
select is((select count(*)::int from public.profiles where user_id = '00000000-0000-0000-0000-0000000000d2'), 1,
  'another candidate''s profile is untouched');

-- ── re-upload: the live profile changes only when the candidate approves ─
insert into public.profile_drafts (user_id, data, provider)
values ('00000000-0000-0000-0000-0000000000d2', '{"basics": {"name": "New"}, "looking_for": "job"}', 'gemini');
select is((select looking_for || ' ' || (data -> 'basics' ->> 'name') from public.profiles
            where user_id = '00000000-0000-0000-0000-0000000000d2'), 'pfe Test',
  'while the new draft waits, the live profile is the old one');

select isnt(public.approve_profile('00000000-0000-0000-0000-0000000000d2',
  '{"basics": {"name": "New"}, "looking_for": "job"}',
  (select updated_at from public.profile_drafts where user_id = '00000000-0000-0000-0000-0000000000d2')),
  null, 'approving the new draft works on an already-approved profile');
select is((select looking_for || ' ' || (data -> 'basics' ->> 'name') from public.profiles
            where user_id = '00000000-0000-0000-0000-0000000000d2'), 'job New',
  'after approval: the new data and the new looking_for are live');
select is((select count(*)::int from public.extraction_jobs
            where user_id = '00000000-0000-0000-0000-0000000000d2' and kind = 'embed'), 1,
  'and a new embedding is queued');

-- ── only the server runs the check ──────────────────────────────────────
select is(has_function_privilege('authenticated', 'public.leftover_rows(uuid)', 'execute'), false,
  'a logged-in user cannot run leftover_rows');
select is(has_function_privilege('service_role', 'public.leftover_rows(uuid)', 'execute'), true,
  'the server (service role) can');

select * from finish();
rollback;
