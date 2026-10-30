begin;
select plan(3);
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000040', 'candidate-role@test.local', '{"role":"admin"}');
select is((select raw_app_meta_data ->> 'role' from auth.users where id = '00000000-0000-0000-0000-000000000040'), 'candidate', 'user metadata cannot choose an elevated role');
insert into auth.users (id, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-000000000041', 'company-role@test.local', '{"role":"company"}');
select is((select raw_app_meta_data ->> 'role' from auth.users where id = '00000000-0000-0000-0000-000000000041'), 'company', 'server-provisioned company role is preserved');
insert into auth.users (id, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-000000000042', 'admin-role@test.local', '{"role":"admin"}');
select is((select raw_app_meta_data ->> 'role' from auth.users where id = '00000000-0000-0000-0000-000000000042'), 'admin', 'server-provisioned admin role is preserved');
select * from finish();
rollback;
