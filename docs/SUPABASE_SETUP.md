# Configuration Supabase — blog Agri-tech

Ce guide décrit la configuration Supabase attendue par l’admin statique `admin.html` : les articles sont stockés dans **Supabase Database** et les images dans **Supabase Storage**. Le frontend utilise uniquement l’URL du projet et la clé anon/publishable publique configurées dans `js/config/supabase-config.js`.

> Ne mettez jamais une `service_role key`, une clé `sb_secret_*`, `DATABASE_URL`, `JWT_SECRET` ou une autre clé privée dans le frontend.

## 1. Table `articles`

À exécuter dans **Supabase → SQL Editor**. Cette version utilise `content_html` pour le HTML contrôlé produit par TinyMCE et `author_id` pour l’utilisateur Supabase Auth connecté.

```sql
create extension if not exists pgcrypto;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content_html text not null,
  cover_image_url text,
  category text not null,
  status text not null default 'draft',
  author_id uuid references auth.users(id) on delete set null,
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_status_check check (status in ('draft', 'published'))
);

create index if not exists articles_slug_idx on public.articles (slug);
create index if not exists articles_status_idx on public.articles (status);
create index if not exists articles_published_at_idx on public.articles (published_at desc);
create index if not exists articles_author_id_idx on public.articles (author_id);

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

### Migration si vous aviez l’ancienne table

Si votre ancienne table utilisait `content` au lieu de `content_html`, exécutez cette migration avant d’appliquer les contraintes :

```sql
alter table public.articles add column if not exists content_html text;
update public.articles
set content_html = coalesce(content_html, content, '')
where content_html is null;
alter table public.articles alter column content_html set not null;

alter table public.articles add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.articles add column if not exists featured boolean not null default false;

update public.articles set status = 'draft' where status not in ('draft', 'published');
alter table public.articles drop constraint if exists articles_status_check;
alter table public.articles add constraint articles_status_check check (status in ('draft', 'published'));
```

## 2. Fonction d’autorisation admin

La policy ci-dessous réserve la gestion du blog aux utilisateurs dont `raw_app_meta_data.role` vaut `admin` ou `blog_admin`. Cette métadonnée doit être définie côté Supabase Dashboard / serveur, jamais par l’utilisateur depuis le frontend.

```sql
create or replace function public.is_blog_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'blog_admin'), false);
$$;
```

Pour un petit projet interne, vous pouvez remplacer `public.is_blog_admin()` par `(select auth.uid()) is not null`, mais c’est moins strict car tout utilisateur authentifié pourrait écrire.

## 3. RLS Database

Supabase recommande d’activer RLS sur les tables exposées au navigateur. Les policies suivantes permettent au public de lire uniquement les articles publiés et réservent les brouillons/écritures aux admins.

```sql
alter table public.articles enable row level security;

drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles"
on public.articles
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Blog admins can read all articles" on public.articles;
create policy "Blog admins can read all articles"
on public.articles
for select
to authenticated
using (public.is_blog_admin());

drop policy if exists "Blog admins can create articles" on public.articles;
create policy "Blog admins can create articles"
on public.articles
for insert
to authenticated
with check (public.is_blog_admin() and author_id = (select auth.uid()));

drop policy if exists "Blog admins can update articles" on public.articles;
create policy "Blog admins can update articles"
on public.articles
for update
to authenticated
using (public.is_blog_admin())
with check (public.is_blog_admin() and author_id = (select auth.uid()));

drop policy if exists "Blog admins can delete articles" on public.articles;
create policy "Blog admins can delete articles"
on public.articles
for delete
to authenticated
using (public.is_blog_admin());
```

## 4. Bucket Supabase Storage `article-images`

L’implémentation attend le bucket existant **public** `article-images`. Ne créez pas de bucket séparé pour TinyMCE : les URLs publiques retournées par Supabase sont sauvegardées dans `cover_image_url` et dans `content_html`.

Structure utilisée par le code :

```text
article-images/articles/{article-id}/cover/{timestamp}-{slug}-{filename}.ext
article-images/articles/{article-id}/content/{timestamp}-{slug}-{filename}.ext
```

Vérification/création du bucket via SQL si votre projet ne l’a pas encore :

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-images',
  'article-images',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

## 5. RLS Storage

```sql
drop policy if exists "Public can read blog images" on storage.objects;
create policy "Public can read blog images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'article-images');

drop policy if exists "Blog admins can upload blog images" on storage.objects;
create policy "Blog admins can upload blog images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'article-images'
  and public.is_blog_admin()
  and name like 'articles/%'
);

drop policy if exists "Blog admins can update blog images" on storage.objects;
create policy "Blog admins can update blog images"
on storage.objects
for update
to authenticated
using (bucket_id = 'article-images' and public.is_blog_admin())
with check (bucket_id = 'article-images' and public.is_blog_admin());

drop policy if exists "Blog admins can delete blog images" on storage.objects;
create policy "Blog admins can delete blog images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'article-images' and public.is_blog_admin());
```

## 6. Tests fonctionnels

1. **Connexion admin** : ouvrir `/admin.html`, se connecter avec un utilisateur Supabase Auth ayant `app_metadata.role = 'admin'` ou `blog_admin`.
2. **Création d’un brouillon** : créer un article, choisir `brouillon`, enregistrer. Vérifier la ligne dans `public.articles` avec `status = 'draft'` et `content_html` rempli.
3. **Image principale** : sélectionner une image dans “Image principale à uploader”. Vérifier que le fichier apparaît dans `Storage → article-images → articles/{article-id}/cover/` et que `cover_image_url` contient l’URL publique.
4. **Image TinyMCE** : utiliser le bouton image de TinyMCE et choisir un fichier. Vérifier que l’image est uploadée dans `articles/{article-id}/content/` et que le HTML contient une URL Supabase, pas du base64.
5. **Publication** : cliquer “Publier”. Vérifier `status = 'published'` et `published_at` non nul.
6. **Affichage public** : ouvrir `article.html?slug=...`; l’article publié doit s’afficher avec le HTML nettoyé.
7. **Brouillon non public** : créer un second brouillon puis ouvrir son URL publique. La page doit afficher “Article introuvable”.

## 7. Limites connues

- Le nettoyage HTML côté frontend protège le rendu public, mais vous pouvez ajouter une Edge Function ou un trigger backend pour refaire une sanitation côté serveur si plusieurs clients écrivent dans la table.
- Les fichiers supprimés d’un article ne sont pas encore automatiquement nettoyés dans Storage.
- Le rôle admin repose ici sur `app_metadata.role`; adaptez la fonction `public.is_blog_admin()` si vous utilisez une table de rôles dédiée.
