# Configuration Supabase — Admin Actualités Agri-tech

Ce guide décrit la configuration Supabase nécessaire pour `admin.html` : Auth, Database, RLS et Storage.

## 1. Créer le projet et récupérer les clés publiques

1. Créez un projet sur Supabase.
2. Dans **Project Settings → API**, copiez :
   - `SUPABASE_URL` : format `https://xxxxx.supabase.co` ;
   - une clé frontend : **Publishable key** `sb_publishable_xxx` ou ancienne clé **anon public**.
3. Collez ces valeurs dans `js/config/supabase-config.js`.

> Important : la Publishable key / anon public key est acceptable côté frontend. La sécurité vient des policies RLS, pas du fait de cacher cette clé publique.
>
> Ne jamais utiliser dans le frontend : `sb_secret_xxx`, `service_role key`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET` ou une clé privée.

## 2. SQL complet à exécuter dans Supabase SQL Editor

```sql
create extension if not exists pgcrypto;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null,
  excerpt text,
  cover_image_url text,
  author text default 'Agri-tech',
  content text not null,
  status text not null default 'draft',
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz,
  constraint articles_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists articles_slug_idx on public.articles (slug);
create index if not exists articles_status_idx on public.articles (status);
create index if not exists articles_published_at_idx on public.articles (published_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();

alter table public.articles enable row level security;

drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles"
on public.articles
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Authenticated admins can read all articles" on public.articles;
create policy "Authenticated admins can read all articles"
on public.articles
for select
to authenticated
using (true);

drop policy if exists "Authenticated admins can create articles" on public.articles;
create policy "Authenticated admins can create articles"
on public.articles
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated admins can update articles" on public.articles;
create policy "Authenticated admins can update articles"
on public.articles
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can delete articles" on public.articles;
create policy "Authenticated admins can delete articles"
on public.articles
for delete
to authenticated
using (true);
```

### Explication des policies RLS

- Le public (`anon`) peut lire seulement les lignes `status = 'published'`.
- Les utilisateurs connectés via Supabase Auth peuvent lire tous les articles pour l’admin.
- Les créations, modifications et suppressions sont réservées aux utilisateurs authentifiés.
- Aucune écriture publique n’est autorisée.

## 3. Bucket Storage `article-images`

1. Ouvrez **Storage → New bucket**.
2. Nom : `article-images`.
3. Pour des images publiques d’actualité, vous pouvez choisir un bucket public.
4. Policies recommandées si le bucket est public en lecture :

```sql
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = true;

create policy "Public can read article images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'article-images');

create policy "Authenticated admins can upload article images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'article-images');

create policy "Authenticated admins can update article images"
on storage.objects
for update
to authenticated
using (bucket_id = 'article-images')
with check (bucket_id = 'article-images');

create policy "Authenticated admins can delete article images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'article-images');
```

L’admin refuse les fichiers non images et les images de plus de 4 Mo. Les fichiers sont nommés avec un timestamp, le slug de l’article et une extension propre.

## 4. Supabase Auth

1. Dans **Authentication → Providers**, activez **Email/Password**.
2. Dans **Authentication → Users**, créez l’utilisateur admin.
3. Confirmez l’email si votre projet exige la confirmation.
4. Vérifiez que l’utilisateur appartient au même projet que `SUPABASE_URL` et la Publishable key.

## 5. Test rapide

1. Lancez un serveur local statique : `python3 -m http.server 8000`.
2. Ouvrez `http://localhost:8000/admin.html`.
3. Vérifiez le panneau diagnostic : configuré Oui, projet visible, client initialisé Oui.
4. Connectez-vous avec l’utilisateur Supabase Auth.
5. Créez un brouillon, publiez-le, puis vérifiez `actualites.html` et `article.html?slug=...`.
