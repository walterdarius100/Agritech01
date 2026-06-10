# Administration éditoriale des actualités

Cette étape prépare une structure CMS progressive pour les actualités agricoles sans remplacer le fonctionnement public actuel du site.

## Structure ajoutée

- `admin/index.html` charge Decap CMS côté navigateur.
- `admin/config.yml` décrit la collection **Actualités agricoles**.
- `content/actualites/` contient les articles sources en Markdown.
- `assets/images/blog/` est le dossier prévu pour les nouvelles images d’articles.
- `scripts/generate-blog-data.js` régénère le fichier public `data/blog-posts.json`.
- `.github/workflows/build-blog-data.yml` peut régénérer automatiquement le JSON quand les contenus Markdown changent.

## Stockage des articles

Chaque article est stocké dans `content/actualites/` avec un front matter YAML, puis le contenu en Markdown.

Champs attendus :

```yaml
---
title: "Titre de l’article"
slug: "titre-de-l-article"
excerpt: "Résumé court"
category: "Actualités"
type: "Actualité"
date: "2026-06-10"
author: "Équipe Agri-tech"
cover: "assets/images/blog/image.jpg"
featured: false
published: true
---

Contenu complet de l’article en Markdown.
```

Le champ `published: false` permet de garder un brouillon dans le dépôt. Le site public filtre aussi les articles non publiés.

## Générer `data/blog-posts.json`

Le site public continue de lire `data/blog-posts.json` depuis `blog.html`, `article.html`, `js/blog.js` et `js/article.js`.

Après modification d’un fichier Markdown, lancer :

```bash
node scripts/generate-blog-data.js
```

Le script :

1. lit les fichiers Markdown de `content/actualites/` ;
2. extrait le front matter ;
3. transforme le contenu Markdown en tableau de paragraphes compatible avec l’affichage actuel ;
4. ajoute les champs publics, dont `published` ;
5. trie les publications par date décroissante ;
6. écrit un JSON valide dans `data/blog-posts.json`.

## Tester localement

Depuis la racine du dépôt :

```bash
node scripts/generate-blog-data.js
python3 -m http.server 8000
```

Puis ouvrir :

- `http://localhost:8000/blog.html` pour la liste des actualités ;
- `http://localhost:8000/article.html?slug=hausse-cout-intrants-agricoles-impacts-petits-producteurs` pour un article ;
- `http://localhost:8000/admin/` pour vérifier le chargement de Decap CMS.

## Authentification Decap CMS à configurer séparément

Aucune authentification réelle n’est ajoutée dans cette étape.

Le fichier `admin/config.yml` ne contient ni token GitHub, ni `client_secret`, ni mot de passe. Pour rendre `/admin/` réellement utilisable en production, il faut configurer séparément un backend Decap sécurisé, par exemple :

- Netlify Identity avec Git Gateway ;
- GitHub OAuth via une application OAuth et un service d’authentification compatible ;
- un autre backend Decap officiellement supporté.

Cette configuration dépend de l’hébergeur et ne doit pas exposer de secret dans le dépôt public.

## Règles pour les images

- Placer les nouvelles images éditoriales dans `assets/images/blog/`.
- Utiliser des chemins publics relatifs, par exemple `assets/images/blog/mon-image.jpg`.
- Éviter les fichiers lourds ou inutiles.
- Les anciens articles peuvent continuer à référencer les images existantes dans `assets/images/`.

## Limites actuelles

- Decap CMS est préparé mais l’authentification de production reste à brancher.
- Le rendu public reste volontairement simple : le Markdown est converti en paragraphes texte pour préserver l’affichage actuel.
- Le site public ne consomme pas directement les fichiers Markdown ; il consomme uniquement `data/blog-posts.json`.
- Le workflow GitHub suppose que les GitHub Actions ont le droit d’écrire dans le dépôt pour committer le JSON généré.
