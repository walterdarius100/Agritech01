# Newsletter Agri-tech V1.2

Les deux formulaires envoient l’adresse et la source à `POST /api/newsletter`.
Vercel valide la requête et appelle une fonction Supabase. Les rôles
`anon` et `authenticated` n’ont aucun droit sur les tables ni sur la fonction.
EmailJS continue de traiter les demandes de contact depuis l’accueil.
Les anciennes inscriptions qui ont transité par le formulaire de contact ne
sont pas reprises automatiquement. Un éventuel import doit être validé à part,
en vérifiant le consentement newsletter d’origine.

## Préparer une prévisualisation isolée

1. Ouvrir un projet Supabase de test, puis exécuter le
   [fichier SQL de migration](../supabase/migrations/202611210001_newsletter_subscribers.sql)
   dans son éditeur SQL. Les écritures et les autorisations sont définies dans
   une seule transaction.
2. Dans Vercel, importer le dépôt et utiliser sa racine avec le preset **Other**
   pour servir les fichiers HTML et détecter la fonction Node dans `api/`.
   Utiliser l’environnement **Preview** et renseigner les variables serveur
   suivantes. L’URL et la clé doivent pointer vers le projet **de test**.

   | Variable | Valeur |
   | --- | --- |
   | `SUPABASE_URL` | URL du projet Supabase de test |
   | `SUPABASE_SERVICE_ROLE_KEY` | Clé JWT `service_role` du même projet, réservée à Vercel |
   | `NEWSLETTER_RATE_LIMIT_SECRET` | Secret aléatoire indépendant, par exemple généré avec `openssl rand -hex 32` |

3. Déployer la branche en Preview. Pour essayer l’invitation, ouvrir un article
   publié suffisamment long. La lecture des articles utilise la configuration
   publique Supabase existante et ne change pas de projet avec ces variables
   serveur. Saisir une adresse de test depuis l’article puis le footer.
   Vérifier que la prévisualisation enregistre une seule ligne dans le projet
   de test, avec la source de la première inscription.
4. Dans le projet de test, vérifier qu’avec une clé publique et sans session,
   une lecture de `newsletter_subscribers` et un appel direct à
   `subscribe_newsletter` sont refusés.

Le site est documenté comme hébergé sur GitHub Pages, qui ne peut pas exécuter
la fonction Node. Avant une mise en ligne, le domaine public doit servir le
site depuis Vercel ou acheminer `/api/newsletter` sur la même origine vers la
fonction Vercel. Valider séparément le raccordement et la provenance de
l’adresse client avec cette architecture. Configurer les variables **Production**
et exécuter la migration sur le projet de production après validation explicite.

## Limitation des abus et désinscription

Le serveur utilise l’IP fournie par Vercel via `x-vercel-forwarded-for` et
l’associe à un identifiant HMAC renouvelé chaque heure. Supabase limite les
tentatives à cinq par adresse IP et à 120 pour l’ensemble du site par heure.
Les anciens compteurs sont supprimés lors de la première requête valide d’une
nouvelle heure. Un réseau partagé peut atteindre le quota par IP. Le message
d’adresse déjà inscrite révèle le statut d’une adresse précise soumise au
formulaire, dans les limites de ce quota. La confirmation par e-mail reste une
étape distincte si Agri-tech souhaite vérifier la possession de l’adresse.

Le formulaire propose une demande de désinscription par e-mail à
`contact@agritech509ht.com`. À réception, une personne autorisée vérifie la
demande puis passe la ligne de l’adresse concernée au statut `unsubscribed`
dans l’éditeur de tables Supabase. Les futures listes d’envoi doivent utiliser
uniquement le statut `active`. Une réinscription après désinscription passe
par le même contact, avec vérification de la demande avant réactivation.

Le navigateur enregistre la date d’affichage et retient la confirmation
d’inscription. Un article dont le corps mesure moins de 800 px ou moins d’un
écran ne déclenche pas d’invitation. Le pied de page reste utilisable sans
stockage local.

## Contrôles locaux

```sh
node --test tests/*.test.mjs
npm install --prefix /tmp/agritech-newsletter --no-save playwright @electric-sql/pglite
NODE_PATH=/tmp/agritech-newsletter/node_modules node tests/newsletter-db.mjs
NODE_PATH=/tmp/agritech-newsletter/node_modules node tests/newsletter-browser.mjs
```

Le test SQL exécute la migration dans PostgreSQL embarqué et appelle le véritable
gestionnaire Vercel avec un transport Supabase simulé. Le test navigateur bloque
les requêtes externes, simule les articles et le service d’inscription, et
utilise Chromium installé localement. Adapter `CHROMIUM_PATH` si nécessaire.
