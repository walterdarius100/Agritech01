begin;

create table public.project_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.project_admins enable row level security;
revoke all on public.project_admins from public, anon, authenticated;

create function public.is_project_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_admins where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_project_admin() from public, anon, authenticated;
grant execute on function public.is_project_admin() to authenticated;

create function public.valid_project_photos(photos jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case when jsonb_typeof(photos) <> 'array' then false else
    jsonb_array_length(photos) <= 4
    and not exists (
      select 1 from jsonb_array_elements(photos) as photo
      where jsonb_typeof(photo) <> 'object'
        or coalesce(photo->>'key', '') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
        or jsonb_typeof(photo->'alt') is distinct from 'string'
        or char_length(btrim(coalesce(photo->>'alt', ''))) not between 1 and 180
    )
  end;
$$;

create table public.projects (
  id uuid primary key,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  summary text not null default '' check (char_length(summary) <= 350),
  details text not null default '' check (char_length(details) <= 12000),
  location text not null default '' check (char_length(location) <= 140),
  period text not null default '' check (char_length(period) <= 140),
  domain text not null default '' check (char_length(domain) <= 140),
  photos jsonb not null default '[]' check (public.valid_project_photos(photos)),
  published_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  constraint published_project_has_text check (
    published_at is null or (btrim(summary) <> '' and btrim(details) <> '')
  )
);
create index projects_publication_idx on public.projects (published_at desc, id desc)
  where published_at is not null;

create function public.touch_project()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger project_updated_at before update on public.projects
  for each row execute function public.touch_project();

alter table public.projects enable row level security;
revoke all on public.projects from public, anon, authenticated;
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

create policy "Read published projects" on public.projects
  for select to anon, authenticated using (published_at is not null);
create policy "Project administrators read all projects" on public.projects
  for select to authenticated using ((select public.is_project_admin()));
create policy "Project administrators create projects" on public.projects
  for insert to authenticated with check ((select public.is_project_admin()));
create policy "Project administrators update projects" on public.projects
  for update to authenticated using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));
create policy "Project administrators delete projects" on public.projects
  for delete to authenticated using ((select public.is_project_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('project-photos', 'project-photos', false, 750000, array['image/webp']);

create policy "Read photographs of published projects" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'project-photos' and exists (
      select 1 from public.projects p cross join lateral jsonb_array_elements(p.photos) photo
      where p.published_at is not null and p.id::text = split_part(name, '/', 1)
        and split_part(name, '/', 2) in ((photo->>'key') || '-640.webp', (photo->>'key') || '-1440.webp')
        and length(name) - length(replace(name, '/', '')) = 1
    )
  );

create policy "Project administrators read photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'project-photos' and (select public.is_project_admin())
  );
create policy "Project administrators upload photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'project-photos' and (select public.is_project_admin())
    and name ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}-(640|1440)\.webp$'
  );

commit;
