-- S2-16: re-uploading a CV, and deleting an account.
--
-- Re-upload: companies must keep seeing the approved profile, unchanged, while the new CV is
-- extracted and reviewed. The new draft already lives apart (profile_drafts), but the upload used to
-- write the new looking_for straight onto the live profile, so a company filtering on "PFE" lost the
-- candidate before they approved anything. Now the choice travels with the job, then in the draft's
-- data, and reaches the live profile only when the candidate approves.
alter table public.extraction_jobs
  add column looking_for text check (looking_for in ('pfe', 'internship', 'job'));  -- extract jobs only

-- Same as S1-32, plus: the approved data's looking_for becomes the live one.
create or replace function public.approve_profile(p_user_id uuid, p_data jsonb, p_draft_updated_at timestamptz)
returns text
language plpgsql set search_path = '' as $$
declare
  v_public_id text;
begin
  delete from public.profile_drafts
   where user_id = p_user_id and updated_at = p_draft_updated_at;
  if not found then
    return null;
  end if;

  update public.profiles
     set data = p_data, status = 'approved', approved_at = now(),
         looking_for = coalesce(p_data ->> 'looking_for', looking_for)
   where user_id = p_user_id
  returning public_id into v_public_id;
  if v_public_id is null then
    raise exception 'no profile row for %', p_user_id;   -- rolls the draft deletion back too
  end if;

  -- Search finds the profile by meaning once the worker has computed its embedding (S1-33).
  insert into public.extraction_jobs (user_id, kind) values (p_user_id, 'embed');
  return v_public_id;
end $$;

revoke execute on function public.approve_profile(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.approve_profile(uuid, jsonb, timestamptz) to service_role;

-- Deletion: POST /api/candidate/delete removes the files, then the auth user. Every table holding a
-- user's rows references auth.users ON DELETE CASCADE, so the database removes the rest.
-- supabase/tests/08_account_deletion.test.sql fails if a table is added later without it, and
-- leftover_rows() is the SQL check that nothing about a deleted user is left.

-- Every row in the public schema that still points at this user, table by table.
-- It finds the tables itself (every column referencing auth.users), so a table added later is
-- checked too, cascade or not.
create function public.leftover_rows(p_user_id uuid)
returns table (table_name text, row_count bigint)
language plpgsql stable set search_path = '' as $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass::text as tbl, t.relname::text as name, a.attname as col
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
       and c.connamespace = 'public'::regnamespace
  loop
    table_name := fk.name;
    execute format('select count(*) from %s where %I = $1', fk.tbl, fk.col) into row_count using p_user_id;
    return next;
  end loop;
end $$;

revoke execute on function public.leftover_rows(uuid) from public, anon, authenticated;
grant execute on function public.leftover_rows(uuid) to service_role;
