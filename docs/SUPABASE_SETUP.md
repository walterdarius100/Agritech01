# Configuration Supabase — espace admin Agri-tech

Ce guide décrit la configuration Supabase nécessaire pour gérer les articles depuis `admin.html` sur un site statique GitHub Pages ou prévisualisation de test.

## 1. Créer le projet et récupérer les valeurs publiques

1. Créez un projet dans Supabase.
2. Dans **Project Settings → Data API**, copiez :
   - `SUPABASE_URL` : format attendu `https://xxxxx.supabase.co` ;
   - la **Publishable key** `sb_publishable_xxx` ou l’ancienne clé **anon public**.
3. Renseignez uniquement ces valeurs dans `js/config/supabase-config.js`.

> Important : la Publishable key / anon public key peut être utilisée côté frontend. La sécurité ne vient pas du fait de cacher cette clé publique : elle vient de Supabase Auth et des policies RLS ci-dessous.

N’utilisez jamais dans le frontend : clé `sb_secret_xxx`, clé `service_role`, `DATABASE_URL`, `JWT_SECRET` ou toute clé privée.

## 2. SQL complet pour la table `articles`

À exécuter dans **Supabase → SQL Editor**.

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
```

## 3. Activer RLS et créer les policies

```sql
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

### Explication des policies

- Le public (`anon`) peut seulement lire les articles dont `status = 'published'`.
- Un utilisateur connecté avec Supabase Auth (`authenticated`) peut lire tous les articles, y compris les brouillons et archives.
- Les créations, modifications et suppressions sont réservées aux utilisateurs authentifiés.
- Aucune écriture publique n’est autorisée.

## 4. Article à la une

Le frontend remet les autres articles à `featured = false` lorsqu’un nouvel article est marqué à la une. Si aucun article n’est marqué à la une, le site public utilise automatiquement l’article publié le plus récent.

## 5. Bucket Supabase Storage `article-images`

1. Ouvrez **Storage → New bucket**.
2. Nom : `article-images`.
3. Pour une première version simple, créez un bucket public afin que `getPublicUrl()` serve les images directement sur GitHub Pages.
4. Ajoutez des policies Storage adaptées : lecture publique, écriture réservée aux utilisateurs authentifiés.

Exemple SQL si vous gérez les policies Storage manuellement :

```sql
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read article images" on storage.objects;
create policy "Public can read article images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'article-images');

drop policy if exists "Authenticated admins can upload article images" on storage.objects;
create policy "Authenticated admins can upload article images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'article-images');

drop policy if exists "Authenticated admins can update article images" on storage.objects;
create policy "Authenticated admins can update article images"
on storage.objects
for update
to authenticated
using (bucket_id = 'article-images')
with check (bucket_id = 'article-images');

drop policy if exists "Authenticated admins can delete article images" on storage.objects;
create policy "Authenticated admins can delete article images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'article-images');
```

L’admin refuse les fichiers non images et les images de plus de 4 Mo. Les fichiers sont nommés avec un timestamp, le slug de l’article et l’extension.

## 6. Supabase Auth

1. Ouvrez **Authentication → Providers**.
2. Activez **Email / Password**.
3. Créez un utilisateur dans **Authentication → Users**.
4. Si la confirmation email est activée, confirmez l’email avant de tester la connexion.
5. Vérifiez que l’utilisateur est dans le même projet Supabase que l’URL et la clé publique utilisées dans `js/config/supabase-config.js`.

## 7. Test de l’admin

1. Ouvrez `/admin.html` en local ou après publication GitHub Pages.
2. Le panneau diagnostic doit afficher :
   - Supabase configuré : Oui ;
   - Projet Supabase : `xxxxx.supabase.co` ;
   - Client initialisé : Oui ;
   - Session active : Non avant login, Oui après login.
3. Connectez-vous avec l’utilisateur Supabase Auth.
4. Créez un brouillon, publiez-le, mettez-le à la une, uploadez une image, archivez et supprimez si nécessaire.
5. Vérifiez `actualites.html`, `article.html?slug=...` et la section Actualités de `index.html`.
