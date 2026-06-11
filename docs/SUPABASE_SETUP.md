# Configuration Supabase pour l’espace admin Actualités

Ce guide configure Supabase Auth, Database et Storage pour gérer les articles du site statique Agri-tech hébergé sur GitHub Pages.

> Important : n’utilisez jamais la clé `service_role` dans le frontend. Le site doit uniquement recevoir `SUPABASE_URL` et `SUPABASE_ANON_KEY`.

## 1. Créer le projet Supabase

1. Connectez-vous à <https://supabase.com>.
2. Créez un nouveau projet.
3. Notez l’URL du projet et la clé publique `anon` dans **Project Settings > API**.
4. Créez le compte admin dans **Authentication > Users**.

## 2. Créer la table `articles`

Ouvrez **SQL Editor** et exécutez ce script complet :

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

create index if not exists articles_status_published_at_idx
  on public.articles (status, published_at desc);

create index if not exists articles_featured_idx
  on public.articles (featured)
  where featured = true;
```

## 3. Mettre à jour automatiquement `updated_at`

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();
```

## 4. Garantir un seul article à la une

Le frontend admin remet déjà les autres articles à `featured = false` quand un nouvel article est marqué à la une. Pour ajouter une protection côté base de données, exécutez aussi :

```sql
create or replace function public.ensure_single_featured_article()
returns trigger
language plpgsql
as $$
begin
  if new.featured = true then
    update public.articles
    set featured = false
    where id <> new.id
      and featured = true;
  end if;
  return new;
end;
$$;

drop trigger if exists articles_single_featured on public.articles;
create trigger articles_single_featured
after insert or update of featured on public.articles
for each row
when (new.featured = true)
execute function public.ensure_single_featured_article();
```

Si aucun article n’est marqué à la une, `actualites.html` utilise automatiquement le plus récent article publié comme article principal.

## 5. Activer Row Level Security

```sql
alter table public.articles enable row level security;
```

## 6. Politiques RLS

Lecture publique des articles publiés uniquement :

```sql
create policy "Public can read published articles"
on public.articles
for select
to anon
using (status = 'published');
```

Lecture admin de tous les articles pour les utilisateurs authentifiés :

```sql
create policy "Authenticated users can read all articles"
on public.articles
for select
to authenticated
using (true);
```

Création réservée aux utilisateurs authentifiés :

```sql
create policy "Authenticated users can create articles"
on public.articles
for insert
to authenticated
with check (true);
```

Modification réservée aux utilisateurs authentifiés :

```sql
create policy "Authenticated users can update articles"
on public.articles
for update
to authenticated
using (true)
with check (true);
```

Suppression réservée aux utilisateurs authentifiés :

```sql
create policy "Authenticated users can delete articles"
on public.articles
for delete
to authenticated
using (true);
```

Ces politiques n’autorisent aucune écriture publique : les visiteurs anonymes peuvent seulement lire les articles dont `status = 'published'`.

## 7. Configurer Supabase Storage

1. Allez dans **Storage**.
2. Créez un bucket nommé `article-images`.
3. Pour des images publiques, cochez **Public bucket** ou créez les politiques ci-dessous.
4. Le frontend limite les uploads à des fichiers image de 4 Mo maximum et génère des noms avec slug, timestamp et UUID.

Politiques Storage recommandées si vous gérez les accès par SQL :

```sql
create policy "Public can read article images"
on storage.objects
for select
to anon
using (bucket_id = 'article-images');

create policy "Authenticated users can upload article images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'article-images' and owner = auth.uid());

create policy "Authenticated users can update article images"
on storage.objects
for update
to authenticated
using (bucket_id = 'article-images' and owner = auth.uid())
with check (bucket_id = 'article-images' and owner = auth.uid());

create policy "Authenticated users can delete article images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'article-images' and owner = auth.uid());
```

## 8. Ajouter la configuration frontend

Modifiez `js/config/supabase-config.js` :

```js
export const SUPABASE_CONFIG = {
  url: 'https://votre-projet.supabase.co',
  anonKey: 'votre-cle-anon-publique',
};
```

À ne pas faire :

```js
// Interdit côté frontend
serviceRoleKey: '...'
```

La clé `service_role` contourne les règles RLS. Elle doit rester strictement côté serveur, jamais dans GitHub Pages, jamais dans JavaScript public et jamais dans un dépôt Git.
