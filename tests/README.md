# Contrôles des publications

Depuis la racine du dépôt, avec Node.js 24 :

```sh
node --test tests/articles-publication.test.mjs
```

Le test utilise le vrai service de lecture avec un client Supabase simulé. Il ne
contacte aucun service externe et ne modifie aucune donnée. Le workflow
`articles-publication.yml` exécute ce contrôle sur les PR et sur `main`, sans
déploiement. Son statut n'est bloquant pour une fusion que si les règles GitHub
du dépôt l'exigent.

`data/articles.json` est maintenu manuellement : aucun générateur n'a été trouvé
dans le dépôt. Il ne doit contenir que des contenus destinés au public. Le test
refuse les brouillons et archives, même s'ils seraient filtrés à l'affichage.

Les lectures publiques utilisent uniquement Supabase. Une réponse vide produit
une absence ; une erreur réseau, d'autorisation, de configuration ou de SDK est
propagée vers l'état d'erreur des pages. Le JSON n'est plus téléchargé par ces
lectures : son absence ou son invalidité ne déclenche donc pas d'erreur runtime.
Les anciennes options `useFallback` n'activent plus de secours local.

Ce choix privilégie le contrôle éditorial : pendant une panne, aucune ancienne
copie locale ne peut confirmer qu'un article est encore publié. Il réduit la
disponibilité hors ligne, sans assurer la révocation de copies déjà téléchargées
ou de caches externes. Supabase RLS reste responsable des autorisations serveur.

## Images et administration

`node --test tests/*.test.mjs` inclut les tests du chantier 02 sans dépendance
supplémentaire. Le protocole, les échecs partiels et le contrôle Chromium
facultatif sont décrits dans [admin-uploads-save.md](../docs/admin-uploads-save.md).

## SEO (chantier 03)

`node --test tests/*.test.mjs` inclut les contrôles SEO et utilise aussi Python 3
standard pour analyser réellement le XML (disponible sur ubuntu-latest).
`node tests/seo-browser.mjs` est un contrôle Chromium facultatif avec Playwright,
comme le test navigateur admin ; `CHROMIUM_PATH` peut adapter son exécutable.
Toutes les requêtes externes y sont bloquées et les lectures d'articles simulées.
Voir [le rapport et les limites](../docs/seo-indexation.md).

Le sitemap répertorie uniquement les six pages fixes. Les articles publiés restent
accessibles par les liens du site, sans garantie d'indexation. La publication
via l'administration ne demande aucune intervention dans le code, le sitemap
ou GitHub. Node.js sert aux contrôles de développement, sans être nécessaire
au fonctionnement éditorial. Le sitemap des articles est reporté à V2.

## Emails et newsletter (chantier 04)

`node --test tests/*.test.mjs` inclut `forms.test.mjs` avec EmailJS et fetch
simulés. `node tests/forms-browser.mjs` contrôle les formulaires réels avec
Playwright/Chromium, bloque tous les services externes et simule EmailJS.
Voir [audit, actions externes et limites](../docs/emails-newsletter.md).

## Stockage contact préparé, inactif

`node --test tests/*.test.mjs` inclut `contact-edge.test.mjs` et
`stored-contact.test.mjs`, sans serveur, email ou base distant. Le handler utilise
les mêmes modules web standards qu’en Edge, avec adaptateurs simulés.
`node tests/forms-browser.mjs` vérifie aussi le chemin nouveau en interceptant
UNIQUEMENT la configuration du test ; le flag du dépôt reste faux.

Pour les droits SQL et la concurrence réels, avec Docker disponible :

```sh
docker pull postgres:17-alpine
node tests/contact-db.mjs
```

Le runner refuse de télécharger l’image lui-même. Il crée uniquement un
PostgreSQL jetable `--network none`, sans port publié, applique la migration dans
ce conteneur, crée des rôles témoins locaux et simule EmailJS. Il ne prend ni URL
Supabase, ni connexion distante, ni fichier `.env` en argument. Le conteneur et
son stockage temporaire sont supprimés en fin de test.

Pour la vérification de l’entrée Deno, sans démarrer de fonction :

```sh
docker pull denoland/deno:alpine
node tests/contact-deno.mjs
```

Le conteneur Deno ne dispose d’aucun réseau ; il reçoit seulement les trois
fichiers de fonction et exécute `deno check --no-remote`. Aucun serveur public
n’est lancé et aucun secret n’est copié. Docker/Deno ne sont pas des dépendances
du site statique ni un serveur Node en production.

Voir [préparation, limites et checklist manuelle](../docs/contact-requests-architecture.md).
