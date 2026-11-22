# Newsletter Agri-tech V1.2

GitHub Pages sert les formulaires et la page `/newsletter/`. Les formulaires
appellent la même Edge Function Supabase. Supabase stocke les abonnements et
les envois. Resend expédie les deux e-mails. Les formulaires de contact
conservent EmailJS et leur traitement existant.

## Comportement

- Le titre et le bouton indiquent la finalité de l’inscription. La politique
  de confidentialité reste accessible dans les liens du pied de page.
  Le clic sur « S’inscrire » y constitue l’action de consentement. Dans la fenêtre des articles, la case reste obligatoire. Une
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

Appliquer uniquement les migrations qui manquent, dans cet ordre :

- [Migration 4](../supabase/migrations/202611220003_newsletter_footer_and_templates.sql),
  si elle n’a pas encore été exécutée. Elle distingue le clic du footer du
  consentement avec case, et autorise les tâches version 3.
- [Migration 5](../supabase/migrations/202611220004_newsletter_welcome_signature.sql).
  Elle définit la version 4 pour les futures tâches. Leurs notifications
  administratives gardent le modèle version 3. Les tâches déjà enregistrées
  gardent leur version et leur contenu pour rester compatibles avec la
  même clé d’idempotence Resend.

1. Suspendre le job Cron existant `newsletter-mail`, laisser les appels se
   terminer et attendre l’expiration des baux actifs (deux minutes).
   Télécharger une sauvegarde de la fonction `newsletter`.
2. Exécuter les migrations manquantes dans **SQL Editor**. Garder Cron
   en pause jusqu’au remplacement de la fonction.
3. Dans **Edge Functions → newsletter → Code**, copier le
   [fichier unique index.ts](https://github.com/walterdarius100/Agritech01/blob/feature/newsletter-article/supabase/functions/newsletter/index.ts)
   en mode **Raw**, puis **Deploy updates**. Garder le nom, l’URL, les
   secrets existants et la vérification JWT désactivée.
4. Dans le test de la fonction, utiliser `Content-Type: application/json`
   et l’en-tête `Origin` exact défini par `NEWSLETTER_SITE_URL`. Un POST
   `article` avec adresse de forme valide sans `consent:true` doit
   répondre `400 consent_required`. Un POST `footer` avec une adresse
   invalide doit répondre `400 invalid`. Ces tests ne programment aucun envoi.
5. Vérifier la file et réactiver le même job Cron. L’URL `/process`,
   l’en-tête `X-Newsletter-Worker-Token` et les secrets Vault sont inchangés.
   Publier les pages statiques lors de la mise en service de la PR.
   En cas de retour à une ancienne fonction, garder Cron en pause tant
   que des tâches d’une version qu’elle ignore peuvent être traitées.

Pour un projet de test isolé, appliquer les cinq migrations dans l’ordre,
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

Les cinq migrations sont exécutées dans PostgreSQL embarqué. Supabase
hébergé et Resend sont simulés. Chromium vérifie les formulaires statiques
et les modèles aux largeurs mobile et ordinateur. Les envois réels et
le rendu dans les clients e-mail restent à vérifier par Agri-tech.
