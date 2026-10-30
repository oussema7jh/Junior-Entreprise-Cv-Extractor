-- S1-26: default self-service accounts to candidate, before the first JWT is issued.
-- raw_user_meta_data is editable by the user; never trust it for authorization.
-- Service-role provisioning can still explicitly create company/admin accounts.
create function public.set_default_candidate_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') = '' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || '{"role":"candidate"}'::jsonb;
  end if;
  return new;
end;
$$;
revoke all on function public.set_default_candidate_role() from public, anon, authenticated;
create trigger set_default_candidate_role
  before insert on auth.users
  for each row execute function public.set_default_candidate_role();
