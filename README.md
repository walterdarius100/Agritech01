# Agri-tech — site officiel V1

## Présentation du projet

Ce dépôt contient la V1 opérationnelle du site officiel d’Agri-tech, entreprise agricole haïtienne qui accompagne les porteurs de projets agricoles, producteurs, organisations et partenaires dans les domaines de l’agriculture, de l’élevage, de la formation et de l’accompagnement technique.

Domaine officiel : <https://agritech509ht.com>

Cette V1 est volontairement simple et stable : elle repose sur un site statique enrichi par JavaScript, avec Supabase pour les contenus dynamiques et EmailJS pour la transmission des demandes de contact.

## Architecture actuelle

La V1 actuelle utilise :

- HTML ;
- CSS ;
- JavaScript vanilla ;
- GitHub Pages pour l’hébergement public ;
- Cloudflare pour le domaine, le DNS et HTTPS ;
- Supabase pour les articles, les images et les données dynamiques ;
- EmailJS pour le formulaire de contact ;
- Microsoft Clarity pour l’analyse comportementale.

> Important : le site live actuel n’est pas une application Next.js, Clerk, Prisma ou Postgres externe. Ces technologies peuvent faire partie d’une vision future, mais elles ne décrivent pas l’état réel de la V1.

## Pages principales

- `index.html` : page d’accueil et formulaire principal.
- `services.html` : présentation des services.
- `formations.html` : présentation des formations et porte d’entrée vers la future Academy.
- `actualites.html` : liste des articles publiés.
- `article.html` : affichage complet d’un article par slug.
- `admin.html` : interface d’administration des articles.
- `mentions-legales.html` : mentions légales.
- `politique-confidentialite.html` : politique de confidentialité.

## Fonctionnalités principales

Le site permet actuellement :

- la présentation d’Agri-tech ;
- la présentation des services ;
- la présentation des formations ;
- la publication d’articles depuis l’admin ;
- l’affichage dynamique des articles publiés depuis Supabase ;
- l’affichage des articles complets ;
- l’utilisation d’un formulaire de contact ;
- l’envoi des messages via EmailJS ;
- la réception des messages sur `contact@agritech509ht.com` ;
- le suivi comportemental via Microsoft Clarity.

## Documentation du dépôt

Documentation maintenue :

- `README.md` : état réel du projet et règles de maintenance.
- `EMAILJS_GUIDE.md` : formulaire, EmailJS et champs à préserver.
- `ANALYTICS_SETUP.md` : état actuel des analytics.
- `SECURITY_NOTES.md` : notes de sécurité front-end et fournisseurs.
- `GUIDE_PHOTOS.md` : recommandations de visuels.
- `CHECKLIST.md` : checklist courte de vérification.
- `docs/ADMIN_GUIDE.md` : guide d’utilisation prudente de l’admin.
- `docs/ADMIN_AUTH_DIAGNOSTIC.md` : diagnostic de connexion admin.
- `docs/ERROR_HANDLING.md` : règles de messages d’erreur.
- `docs/SOCIAL_SHARING_AND_OG.md` : partage social et limites Open Graph.
- `docs/SUPABASE_SETUP.md` : configuration Supabase compatible avec la V1.

Documentation archivée :

- `docs/archive/AUDIT_SITE_AGRITECH.md` : ancien audit de la première landing page.
- `docs/archive/SITE_AUDIT_REPORT.md` : ancien rapport d’audit à consulter seulement comme historique.

## Supabase

### Table principale des articles

La table principale des articles utilise les champs existants suivants :

- `title`
- `slug`
- `category`
- `excerpt`
- `cover_image_url`
- `author`
- `content`
- `status`
- `featured`
- `published_at`
- `created_at`
- `updated_at`

Statuts utilisés :

- `draft`
- `published`
- `archived`

### Règles Supabase importantes

- Ne pas remplacer `content` par `content_html`.
- Ne pas ajouter `author_id` sans décision technique future.
- Ne pas supprimer le statut `archived`.
- Ne pas modifier le schéma Supabase sans sauvegarde, migration contrôlée et validation explicite.
- Les articles publiés sont lus depuis Supabase et affichés sur le site public.
- Les brouillons et archives ne doivent pas être exposés publiquement.

### Images d’articles

Les images d’articles peuvent être stockées via Supabase Storage, notamment dans le bucket utilisé par le code :

```text
article-images
```

Avant toute modification Storage, vérifier les policies de lecture publique et d’écriture authentifiée dans Supabase.

## Formulaire de contact et EmailJS

- Le formulaire principal se trouve sur la page d’accueil.
- L’id existant du formulaire est `leadForm`.
- Les liens directs vers le formulaire doivent utiliser :

```text
index.html#leadForm
```

ou en URL absolue :

```text
https://agritech509ht.com/index.html#leadForm
```

Le formulaire envoie les messages via EmailJS. L’adresse de réception actuelle est :

```text
contact@agritech509ht.com
```

Règles importantes :

- le destinataire est géré dans le template EmailJS ;
- le Reply-To doit rester l’email du visiteur ;
- les noms des champs envoyés à EmailJS ne doivent pas être changés sans vérifier le template ;
- EmailJS ne doit pas être modifié inutilement si le formulaire fonctionne.

## Domaine, DNS et déploiement

- Le site public est hébergé avec GitHub Pages.
- Le domaine officiel est géré chez Cloudflare.
- Le domaine principal est `agritech509ht.com`.
- Le fichier `CNAME` doit contenir exactement :

```text
agritech509ht.com
```

Configuration DNS recommandée :

- A `@` → `185.199.108.153`
- A `@` → `185.199.109.153`
- A `@` → `185.199.110.153`
- A `@` → `185.199.111.153`
- CNAME `www` → `walterdarius100.github.io`

Recommandation actuelle :

- garder les records GitHub Pages en `DNS only` dans Cloudflare ;
- utiliser SSL/TLS `Full` ;
- garder `Enforce HTTPS` activé dans GitHub Pages ;
- ne pas activer de règles Cloudflare agressives sans test.

## Analytics

- Microsoft Clarity est actuellement utilisé.
- Cloudflare Web Analytics n’est pas activé pour le moment.
- Google Analytics n’est pas prioritaire actuellement.
- L’objectif est de garder un suivi simple, stable et compréhensible.

Ne pas ajouter un nouvel outil analytics dans le code sans décision explicite.

## Maintenance prudente du site live

- Ne pas modifier directement la production.
- Créer une branche par changement.
- Faire de petites PR ciblées.
- Tester desktop et mobile.
- Vérifier la console navigateur.
- Vérifier le formulaire après toute modification liée au contact.
- Ne pas modifier Supabase sans sauvegarde et décision claire.
- Ne pas mélanger design, backend, formulaire et admin dans une seule PR.
- Garder la V1 stable pendant la préparation d’une future V2.

## Limites connues de la V1

1. Les articles sont chargés côté client depuis Supabase.
2. Les aperçus sociaux peuvent afficher l’image Open Graph par défaut plutôt que l’image spécifique de chaque article, car certains robots sociaux ne lisent pas JavaScript.
3. L’admin fonctionne, mais doit rester manipulé prudemment.
4. Le site est une V1 statique enrichie, pas encore une application moderne complète.
5. Agri-tech Academy n’est pas encore intégrée comme plateforme complète dans cette V1.
6. La future V2 pourra utiliser une architecture plus robuste, probablement Next.js + TypeScript + Supabase.

## Évolution future / V2

La V2 envisagée pourrait utiliser :

- Next.js ;
- TypeScript ;
- Supabase ;
- Vercel ;
- Cloudflare DNS ;
- Tailwind CSS ou CSS Modules ;
- authentification Supabase ;
- admin plus robuste ;
- génération SEO plus propre ;
- pages articles avec meta Open Graph dynamiques ;
- gestion des leads ;
- Agri-tech Academy ;
- comptes utilisateurs ;
- formations en ligne ;
- inscriptions ;
- espace étudiant ;
- paiements plus tard ;
- certificats plus tard.

Cette section décrit une vision future. Elle ne doit pas être lue comme l’architecture actuelle du site live.
