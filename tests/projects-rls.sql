-- Run against a disposable Supabase database after the projects migration.
begin;

insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.project_admins (user_id) values ('10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
begin
  if not public.is_project_admin() then raise exception 'Admin access expected'; end if;
end;
$$;
insert into public.projects (id, title, summary, details, photos, published_at) values
  ('20000000-0000-0000-0000-000000000001', 'Test visible', 'Description', 'Détails',
    '[{"key":"30000000-0000-0000-0000-000000000001","alt":"Photo test"}]', now()),
  ('20000000-0000-0000-0000-000000000002', 'Test brouillon', '', '',
    '[{"key":"30000000-0000-0000-0000-000000000001","alt":"Photo brouillon"}]', null);
insert into storage.objects (bucket_id, name) values
  ('project-photos', '20000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001-640.webp'),
  ('project-photos', '20000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000002-640.webp'),
  ('project-photos', '20000000-0000-0000-0000-000000000002/30000000-0000-0000-0000-000000000001-640.webp');

reset role;
set local role anon;
do $$
begin
  if (select count(*) from public.projects where id::text like '20000000-0000-0000-0000-00000000000%') <> 1 then
    raise exception 'Anonymous project visibility is wrong';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'project-photos' and name like '20000000-%') <> 1 then
    raise exception 'A draft or unreferenced photo is visible';
  end if;
  begin
    insert into public.projects (id, title) values (gen_random_uuid(), 'Unauthorized');
    raise exception 'Anonymous insert accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
begin
  if public.is_project_admin() then raise exception 'Unexpected admin access'; end if;
  if (select count(*) from public.projects where id::text like '20000000-0000-0000-0000-00000000000%') <> 1 then
    raise exception 'Non-admin can read drafts';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'project-photos' and name like '20000000-%') <> 1 then
    raise exception 'Non-admin can read private photos';
  end if;
  begin
    insert into public.projects (id, title) values (gen_random_uuid(), 'Unauthorized');
    raise exception 'Non-admin insert accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values
      ('project-photos','20000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000003-640.webp');
    raise exception 'Non-admin photo upload accepted';
  exception when insufficient_privilege then null;
  end;
  update public.projects set title = 'Unauthorized' where id = '20000000-0000-0000-0000-000000000001';
  if found then raise exception 'Non-admin update accepted'; end if;
  delete from public.projects where id = '20000000-0000-0000-0000-000000000001';
  if found then raise exception 'Non-admin delete accepted'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
update public.projects set published_at = null where id = '20000000-0000-0000-0000-000000000001';
delete from public.projects where id = '20000000-0000-0000-0000-000000000002';

reset role;
set local role anon;
do $$
begin
  if exists (select 1 from public.projects where id::text like '20000000-0000-0000-0000-00000000000%')
    or exists (select 1 from storage.objects where bucket_id = 'project-photos' and name like '20000000-%') then
    raise exception 'Withdrawn project or photos remain accessible';
  end if;
end;
$$;
rollback;
