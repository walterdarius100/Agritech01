# Newsletter Agri-tech V1.2

GitHub Pages sert les formulaires et la page `/newsletter/`. Les formulaires
appellent la même Edge Function Supabase. Supabase stocke les abonnements et
les envois. Resend expédie les deux e-mails. Les formulaires de contact
conservent EmailJS et leur traitement existant.

## Comportement

- Le footer affiche la finalité de l’inscription et un lien vers la politique
  de confidentialité. Le clic sur « S’inscrire » y constitue l’action de
  consentement. Dans la fenêtre des articles, la case reste obligatoire. Une
  transaction enregistre l’abonnement `active` et programme la bienvenue et
  la notification administrative. La base conserve la source, la date et la
  version du consentement (`newsletter-footer-submit-v1` pour le footer sans case,
  `newsletter-direct-v1` pour le consentement avec case). Le module ne collecte
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

Les trois premières migrations sont déjà en place sur le projet Agri-tech.
Prévoir une fenêtre de mise à jour. Appliquer uniquement la
[quatrième migration SQL](../supabase/migrations/202611220003_newsletter_footer_and_templates.sql)
et utiliser le [fichier unique index.ts](https://github.com/walterdarius100/Agritech01/blob/feature/newsletter-article/supabase/functions/newsletter/index.ts).

1. Dans **Supabase → Cron**, suspendre le job existant `newsletter-mail`.
   Laisser les appels se terminer et attendre l’expiration des baux actifs
   (deux minutes). Dans **Edge Functions → newsletter**, télécharger la
   version déployée.
2. Dans **SQL Editor**, exécuter seulement
   `202611220003_newsletter_footer_and_templates.sql`. Elle rend le champ
   de consentement facultatif pour `footer` et maintient son contrôle
   obligatoire pour `article`. Elle crée les futures tâches en version 3.
   Les abonnements et les tâches existants gardent leur historique et
   leur version d’e-mail.
3. Dans **Edge Functions → newsletter → Code**, remplacer `index.ts` par
   l’intégralité du fichier **Raw**, puis utiliser **Deploy updates**.
   Conserver le nom, l’URL, la vérification JWT désactivée et les secrets
   actuels. Un POST `article` avec adresse de forme valide sans
   `consent:true` doit répondre `400 consent_required`. Un POST `footer`
   avec adresse invalide doit répondre `400 invalid`. Utiliser
   `Content-Type: application/json` et l’en-tête `Origin` exact défini
   par `NEWSLETTER_SITE_URL`. Ces essais ne créent aucune tâche d’envoi.
4. Publier les pages et scripts statiques correspondants lors de la mise
   en service. Vérifier la file, puis **réactiver le même job Cron**.
   L’URL `/process`, le header `X-Newsletter-Worker-Token` et les secrets
   Vault restent identiques. Les reprises des tâches versions 1 et 2
   gardent le même contenu et la même clé d’idempotence Resend.
5. Tester ensuite avec des boîtes contrôlées. Vérifier le footer sans
   case, le popup avec case, le statut `active`, les deux e-mails et
   le lien de désinscription. En cas d’incident, suspendre Cron. La
   restauration de l’ancienne fonction seule ne doit pas être suivie
   d’une reprise du job, car elle ne connaît pas les tâches version 3.

Pour un projet de test isolé, appliquer les quatre migrations dans l’ordre,
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

Les quatre migrations sont exécutées dans PostgreSQL embarqué. Supabase
hébergé et Resend sont simulés. Chromium vérifie les formulaires statiques
et les modèles aux largeurs mobile et ordinateur. Les envois réels et
le rendu dans les clients e-mail restent à vérifier par Agri-tech.
