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
