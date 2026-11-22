# Newsletter Agri-tech V1.2

GitHub Pages sert les formulaires et la page `/newsletter/`. Les formulaires
appellent la même Edge Function Supabase. Supabase stocke les abonnements et
les envois. Resend expédie les deux e-mails. Les formulaires de contact
conservent EmailJS et leur traitement existant.

## Comportement

- La case volontaire et spécifique à la newsletter est obligatoire. Une
  transaction enregistre l’abonnement `active` et programme la bienvenue et
  la notification administrative. La base conserve la source, la date et la
  version du consentement (`newsletter-direct-v1`). Le module ne collecte
  ni nom, ni téléphone, ni adresse IP pour ce parcours.
- Une demande répétée pour une adresse active ou désinscrite ne crée aucun
  envoi. La réponse publique est neutre. Les quotas globaux sont de 30
  demandes par heure et de 60 par jour UTC. Sans vérification de propriété,
  une adresse de tiers peut encore être inscrite. Le premier message
  indique comment se désinscrire ou joindre Agri-tech. Un abus peut épuiser
  le quota et bloquer temporairement les demandes légitimes.
- La désinscription exige un lien personnel signé et un clic explicite sur
  la page de gestion. Le passage à `unsubscribed` est idempotent.
  Les anciennes signatures restent valides à secret inchangé. Les futures
  listes de diffusion doivent sélectionner uniquement `active`. Une demande
  publique ne réactive jamais une adresse désinscrite.
- L’invitation reste au seuil d’environ 55 % de lecture, au plus une fois
  par session d’onglet, avec au moins sept jours entre affichages. Le
  navigateur mémorise une réponse favorable pour arrêter les invitations,
  sans pouvoir en déduire le statut de l’adresse. Le footer reste disponible.

## Mise à jour du projet existant

Les deux premières migrations et les six secrets Edge (`NEWSLETTER_SITE_URL`,
`NEWSLETTER_LINK_SECRET`, `NEWSLETTER_WORKER_SECRET`, `RESEND_API_KEY`,
`NEWSLETTER_FROM`, `NEWSLETTER_ADMIN`) sont déjà en place, d’après
l’état communiqué. Utiliser la [troisième migration SQL](../supabase/migrations/202611220002_newsletter_direct_opt_in.sql)
et le [fichier unique index.ts](https://github.com/walterdarius100/Agritech01/blob/feature/newsletter-article/supabase/functions/newsletter/index.ts).
Prévoir une courte interruption des inscriptions entre la mise à jour SQL,
celle de la fonction et la publication des formulaires correspondants.

1. Dans **Supabase → Cron**, suspendre le job existant `newsletter-mail`.
   Laisser les appels actifs se terminer et attendre l’expiration des baux
   en cours (deux minutes). Dans **Edge Functions → newsletter**, utiliser
   **Download** pour sauvegarder la version déployée.
2. Dans **SQL Editor**, appliquer uniquement
   `202611220002_newsletter_direct_opt_in.sql`. La migration conserve les
   abonnements et l’historique. Elle annule les tâches de confirmation
   encore à traiter et les notifications administratives en attente pour
   les anciennes demandes `pending`. Ces adresses restent inactives.
   Une nouvelle soumission avec la case cochée est nécessaire pour les
   activer. La nouvelle notification signale alors l’activation, et
   l’éventuelle notification historique de demande en attente est conservée.
3. Dans **Edge Functions → newsletter → Code**, ouvrir **Raw** sur GitHub
   et remplacer le seul `index.ts` par son contenu entier. Cliquer sur
   **Deploy updates** en gardant le nom et l’URL existants. Vérifier dans
   **Details** que la vérification JWT héritée est désactivée. Les secrets
   existants restent nécessaires, en particulier `NEWSLETTER_LINK_SECRET`
   pour les liens de désinscription déjà envoyés.
4. Dans **Test**, envoyer un POST à la route principale avec l’en-tête
   `Origin` réglé sur l’origine exacte de `NEWSLETTER_SITE_URL` et
   `Content-Type: application/json`. Le corps
   `{"action":"subscribe","email":"invalide","source":"footer","consent":true}`
   répond `400 invalid`. Un e-mail de forme valide sans `consent:true`
   répond `400 consent_required`. Ces essais n’écrivent aucune inscription
   et ne programment aucun message.
5. Vérifier la file et **réactiver le même job Cron**. Garder l’URL
   `/process`, le header `X-Newsletter-Worker-Token` et les secrets Vault
   existants. Les tâches antérieures encore à reprendre gardent leur modèle
   et leur clé Resend pour éviter qu’un même identifiant soit réutilisé
   avec un contenu différent. Les tâches nouvelles utilisent le branding
   actuel. Un appel autorisé à `/process` peut expédier les tâches en attente.
6. Quand les pages statiques correspondantes sont publiées, essayer les
   deux formulaires avec des boîtes contrôlées et la désinscription depuis
   `/newsletter/`. En cas d’incident, suspendre Cron et diagnostiquer.
   Restaurer seulement l’ancienne fonction ne suffit pas, car son ancienne
   RPC d’inscription est retirée par la migration.

Pour un projet de test isolé, appliquer les trois migrations dans l’ordre,
configurer les six secrets Edge, puis publier le même `index.ts`. Utiliser
un expéditeur Resend vérifié et des boîtes contrôlées. Régler
`NEWSLETTER_SITE_URL` sur l’origine de la copie statique et adapter
`NEWSLETTER_SITE_ORIGIN` et `NEWSLETTER_API_URL` dans
`js/config/newsletter-config.js` de cette copie. La plateforme fournit
`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.

## File et aperçus

La table privée `newsletter_mail` conserve l’état, les tentatives et
l’identifiant fournisseur. Le worker reprend les erreurs temporaires dans
la fenêtre de 20 heures, pour un maximum de cinq tentatives. Un échec ou
un résultat ambigu après ce délai demande de vérifier le tableau de bord
Resend avant tout nouvel envoi. `accepted` signifie accepté par Resend.
Vérifier la réception et les rebonds séparément. Une désinscription annule
la bienvenue encore en file, mais un courriel déjà en cours peut arriver.

En Vercel Preview, utiliser `/api/newsletter?previewMail=welcome` ou
`/api/newsletter?previewMail=admin`. L’aperçu de l’invitation utilise
toujours `previewNewsletter=1` sur un article. Les aperçus utilisent des
données fictives et ne déclenchent pas d’inscription ou d’envoi. Certains
clients de messagerie masquent les images distantes. Le nom Agri-tech est
également présent en texte.

Le navigateur doit envoyer l’origine exacte autorisée par la fonction.
En cas d’erreur du formulaire réel, relever le code et la réponse dans
l’onglet Réseau et vérifier l’origine et la version des fichiers statiques.
Le test Supabase Dashboard n’exerce pas le trajet navigateur réel.

## Tests automatisés

```sh
node --test tests/*.test.mjs
npm install --prefix /tmp/agritech-newsletter --no-save playwright @electric-sql/pglite
NODE_PATH=/tmp/agritech-newsletter/node_modules node tests/newsletter-db.mjs
NODE_PATH=/tmp/agritech-newsletter/node_modules node tests/newsletter-browser.mjs
deno check supabase/functions/newsletter/index.ts
```

Les trois migrations sont exécutées dans PostgreSQL embarqué. Supabase
hébergé et Resend sont simulés. Chromium vérifie les formulaires statiques
et les modèles aux largeurs mobile et ordinateur. Les envois réels et
le rendu dans les clients e-mail restent à vérifier par Agri-tech.
