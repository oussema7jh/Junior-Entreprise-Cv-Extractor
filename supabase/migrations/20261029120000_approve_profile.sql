-- S1-32: approving a profile, as one step that either fully happens or doesn't happen at all.
-- Called only by the server (POST /api/profile/approve), after it has checked the data against the
-- schema. The browser can't run it: a candidate could otherwise approve any data they like.
--
-- p_draft_updated_at is the draft version the candidate reviewed. If the draft changed since
-- (a new upload, another tab), nothing is approved and the function returns null: the candidate
-- never approves something they haven't seen.
create function public.approve_profile(p_user_id uuid, p_data jsonb, p_draft_updated_at timestamptz)
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
     set data = p_data, status = 'approved', approved_at = now()
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
