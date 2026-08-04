-- Backoffice do site Licor Dª Graça
-- Executar uma vez no SQL Editor do projeto Supabase usado pela marca.

create table if not exists public.site_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into public.site_admins (email)
values
  ('beatrizsousa.200404@gmail.com'),
  ('licor.donagraca@gmail.com')
on conflict (email) do nothing;

alter table public.site_admins enable row level security;

drop policy if exists "site_admins_read_self" on public.site_admins;
create policy "site_admins_read_self"
  on public.site_admins
  for select
  to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

create table if not exists public.site_content (
  id text primary key,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read"
  on public.site_content
  for select
  to anon, authenticated
  using (id = 'main');

drop policy if exists "site_content_admin_insert" on public.site_content;
create policy "site_content_admin_insert"
  on public.site_content
  for insert
  to authenticated
  with check (public.is_site_admin() and id = 'main');

drop policy if exists "site_content_admin_update" on public.site_content;
create policy "site_content_admin_update"
  on public.site_content
  for update
  to authenticated
  using (public.is_site_admin() and id = 'main')
  with check (public.is_site_admin() and id = 'main');

grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;
grant select on public.site_admins to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_assets_public_read" on storage.objects;
create policy "site_assets_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'site-assets');

drop policy if exists "site_assets_admin_insert" on storage.objects;
create policy "site_assets_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'site-assets' and public.is_site_admin());

drop policy if exists "site_assets_admin_update" on storage.objects;
create policy "site_assets_admin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'site-assets' and public.is_site_admin())
  with check (bucket_id = 'site-assets' and public.is_site_admin());

drop policy if exists "site_assets_admin_delete" on storage.objects;
create policy "site_assets_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'site-assets' and public.is_site_admin());
