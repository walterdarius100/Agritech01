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

Le générateur manuel est testé par `sitemap-generator.test.mjs` avec fetch simulé,
sans lecture Supabase réelle. La commande opérationnelle est
`node scripts/generate-sitemap.mjs --generate` après chaque publication,
dépublication ou suppression ; elle n'est jamais appelée par les tests.
La procédure complète et ses limites figurent dans le rapport SEO.
