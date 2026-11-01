-- S1-23: the temporary CV bucket is private, and the browser roles have no way into it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is((select public from storage.buckets where id = 'uploads-tmp'), false,
  'uploads-tmp exists and is not public');
select is((select file_size_limit from storage.buckets where id = 'uploads-tmp'), 5242880::bigint,
  'storage itself refuses files over 5 MB');
select is((select count(*)::int from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and (qual ilike '%uploads-tmp%' or with_check ilike '%uploads-tmp%')), 0,
  'no storage policy mentions uploads-tmp: only the service role reaches it');

-- A logged-in candidate tries anyway.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into storage.objects (bucket_id, name, owner)
  values ('uploads-tmp', '00000000-0000-0000-0000-00000000000a/cv.pdf', '00000000-0000-0000-0000-00000000000a');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated", "app_metadata": {"role": "candidate"}}';
select is((select count(*)::int from storage.objects where bucket_id = 'uploads-tmp'), 0,
  'the owner of a file still cannot list it');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('uploads-tmp', 'x/evil.pdf')$$,
  '42501', null, 'a candidate cannot put a file in the bucket directly');

select * from finish();
rollback;
