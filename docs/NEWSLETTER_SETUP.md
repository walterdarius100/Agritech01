# Newsletter Agri-tech V1.2

GitHub Pages sert le site et la page statique `/newsletter/`. Les deux
formulaires appellent l’Edge Function Supabase `newsletter` en HTTPS, sans
fonction Node ni clé secrète dans le navigateur. L’URL publique et l’origine
du site se trouvent dans `js/config/newsletter-config.js`. La fonction
Vercel sert uniquement l’aperçu visuel `previewNewsletter=1` sur un article,
en Preview ou avec `vercel dev`. L’aperçu simule l’envoi et ne touche pas au
stockage du navigateur. Les formulaires de contact gardent EmailJS et leur
traitement existant. La newsletter n’écrit pas dans Google Sheets.

## Parcours et confidentialité

- Une première demande crée `pending` et programme deux envois indépendants
  dans la même transaction. Le message administrateur donne l’adresse, la date
  UTC, la source de la première demande et le statut à l’enregistrement.
  L’autre message contient le lien de confirmation.
- Un bouton sur `/newsletter/` valide un lien de confirmation signé, valable
  24 h après la demande. L’activation consomme le lien et programme un seul
  message de bienvenue. L’ouverture de la page seule ne réalise aucune action.
- Le lien personnel de désinscription peut annuler une demande en attente
  ou mettre un abonnement actif à `unsubscribed`. Il reste valable pour cette
  génération de l’abonnement. Une nouvelle soumission publique ne réactive pas
  cette adresse. Si un parcours de réactivation est introduit, il doit recueillir
  un nouveau consentement, vérifier l’adresse et renouveler le nonce de
  désinscription. Le contact Agri-tech reste disponible. Toute future diffusion
  doit sélectionner uniquement les lignes `active`.
- Les réponses publiques des deux formulaires sont identiques pour une demande
  nouvelle ou une adresse déjà connue, quel que soit son statut. CORS autorise
  uniquement l’origine configurée. Les écritures publiques passent par des RPC
  réservées au serveur. Supabase impose 30 demandes par heure au total et au
  plus un lien par adresse en attente par période de validité de 24 h. Une
  adresse désinscrite ne reçoit aucun nouveau message. Le quota global peut
  temporairement bloquer des demandes légitimes pendant un abus. Il n’utilise
  aucune adresse IP transmise par le client. Si le volume ou les abus le
  justifient, ajouter une protection avant l’Edge Function.
- La fenêtre conserve son seuil de lecture d’environ 55 %, une apparition
  par session d’onglet et au moins 7 jours entre deux affichages dans le
  navigateur. La confirmation sur ce navigateur arrête les invitations
  automatiques. Le footer reste disponible.

## Mettre à jour depuis le Dashboard Supabase

**Fichier unique à copier** :
[`supabase/functions/newsletter/index.ts`](https://github.com/walterdarius100/Agritech01/blob/feature/newsletter-article/supabase/functions/newsletter/index.ts).
Ouvrir **Raw** dans GitHub et copier le fichier entier. Le fichier utilise les
API intégrées de Deno et lit les secrets au démarrage. Il n’a aucun import ni
fichier compagnon. Les tests utilisent ce même fichier.

1. Ouvrir le projet Agri-tech, puis **Edge Functions**. Si `newsletter`
   existe, ouvrir sa fiche et noter son nom et son URL. Utiliser **Download**
   pour sauvegarder la version déployée avant édition. Conserver cette
   sauvegarde. L’éditeur n’offre pas de restauration intégrée.
2. Dans l’onglet **Code**, remplacer le contenu du fichier racine
   `index.ts` avec le fichier GitHub. Sa dernière partie doit contenir
   `Deno.serve(createNewsletterHandler(...))`. L’ancien `handler.mjs`
   n’est plus référencé. Si l’éditeur permet de retirer sans ambiguïté les
   deux entrées `handler.mjs` du **brouillon de code**, retirer seulement
   ces entrées. Vérifier que le brouillon affiche un unique `index.ts`.
   Si l’éditeur laisse des doublons persistants ou si la suppression
   proposée porte sur la fonction entière, quitter sans publier. Garder
   la fonction et sa sauvegarde. Si besoin, utiliser l’assistance Supabase
   pour assainir la liste plutôt que supprimer la fonction existante.
3. Si la liste **Edge Functions** confirme que `newsletter` n’existe pas,
   choisir **Deploy a new function** → **Via Editor**, nommer la fonction
   exactement `newsletter` et remplacer le contenu du seul `index.ts`.
   En cas de mise à jour, conserver le même nom et la même URL.
4. Quand le propriétaire est prêt à publier, utiliser **Deploy updates**
   pour la fonction existante ou **Deploy function** pour la création.
   Dans **Details**, vérifier que la vérification JWT héritée est désactivée
   pour cette fonction. Le réglage du dépôt `verify_jwt = false` doit être
   vérifié dans le Dashboard lors d’un déploiement manuel. L’origine
   publique est vérifiée par la fonction, les liens exigent une signature
   et `/process` exige son propre secret.
5. Dans **Test**, envoyer un `POST` à la route principale avec
   `Origin: https://agritech509ht.com` (ou l’origine exacte de
   `NEWSLETTER_SITE_URL`), `Content-Type: application/json` et le corps
   `{"action":"subscribe","email":"invalide","source":"footer"}`.
   Attendre `400` avec `{"outcome":"invalid"}` et
   `Access-Control-Allow-Origin` correspondant. Cette requête ne crée
   aucune inscription ni tâche d’envoi. Pour un contrôle négatif, remplacer
   l’origine par une origine différente et attendre `403`.
6. Avant d’activer Cron, vérifier dans Vault que `newsletter_worker_url`
   correspond à l’URL de cette fonction suivie de `/process`, et que
   `newsletter_worker_secret` correspond exactement au secret Edge
   `NEWSLETTER_WORKER_SECRET`. Comparer les valeurs uniquement dans
   Supabase. Si un job `newsletter-mail` existe déjà, vérifier son état et
   sa cible avant d’en créer un. Un appel autorisé à `/process` peut expédier
   les e-mails déjà en attente. Vérifier la configuration Resend et
   contrôler la file avant cette étape. Pour tester ensuite l’envoi depuis
   le projet réel, utiliser une boîte sous le contrôle d’Agri-tech.
   L’ouverture du lien de confirmation suppose que la page statique
   `/newsletter/` est déjà servie à l’origine configurée.

Les deux migrations et les secrets sont déjà configurés sur le projet
Agri-tech, d’après son état communiqué. Les étapes ci-dessous servent à
configurer un environnement séparé le cas échéant.

## Installer dans un projet de test

1. Créer ou sélectionner un projet Supabase **de test**. Appliquer d’abord
   `202611210001_newsletter_subscribers.sql`, puis
   `202611220001_newsletter_double_opt_in.sql` dans l’éditeur SQL. Si la
   première migration est déjà appliquée, passer directement à la seconde.
   Les éventuelles lignes actives issues de l’ancien parcours sont remises en
   attente, faute de preuve de confirmation. Une prochaine demande vérifie
   leur adresse. Ne pas importer les anciennes lignes Sheets sans contrôle du
   consentement et de la provenance.
2. Côté Resend, vérifier un domaine d’envoi autorisé par Agri-tech et publier
   ses enregistrements DNS demandés par Resend. Créer une clé d’envoi limitée
   au domaine si le compte le permet. Utiliser une adresse de test autorisée
   et des boîtes contrôlées. Désactiver le suivi des clics pour les messages
   de la newsletter afin que les liens personnels restent directs.
3. Dans les secrets Edge Functions du **projet de test**, définir les valeurs
   ci-dessous. La plateforme injecte `SUPABASE_URL` et
   `SUPABASE_SERVICE_ROLE_KEY` pour sa propre base.

   | Secret | Valeur attendue |
   | --- | --- |
   | `NEWSLETTER_SITE_URL` | Origine statique de test exacte, par exemple `https://staging.example.org`, sans chemin. Sert à CORS et aux liens des e-mails. |
   | `NEWSLETTER_LINK_SECRET` | Secret de signature aléatoire, par exemple généré avec `openssl rand -hex 32`. |
   | `NEWSLETTER_WORKER_SECRET` | Second secret aléatoire indépendant, réservé au traitement planifié. |
   | `RESEND_API_KEY` | Clé d’envoi Resend autorisée. |
   | `NEWSLETTER_FROM` | Expéditeur vérifié, par exemple `Agri-tech <newsletter@domaine-verifie.example>`. |
   | `NEWSLETTER_ADMIN` | Adresse qui reçoit les notifications administratives. |

4. Publier le seul `index.ts` depuis le Dashboard du projet de test en suivant
   la procédure ci-dessus, puis vérifier le réglage JWT de la fonction.
5. Servir une copie **statique** du site sur l’origine de test. Dans cette
   copie uniquement, régler `NEWSLETTER_SITE_ORIGIN` à cette origine et
   `NEWSLETTER_API_URL` à
   `https://REF_DU_PROJET_DE_TEST.supabase.co/functions/v1/newsletter`.
   Servir aussi `/newsletter/index.html` à l’URL `/newsletter/`.
   La prévisualisation Vercel habituelle reste indépendante des essais d’envoi.

## Activer la reprise minimale

La table privée `newsletter_mail` porte une ligne par envoi, avec dates,
tentatives, statut et identifiant fournisseur. Il faut un seul passage
planifié pour les trois types de messages. Activer **Supabase Cron** et
l’extension **pg_net** dans le projet de test. Créer dans **Vault**
`newsletter_worker_url` avec l’URL complète de la fonction suivie de
`/process`, et `newsletter_worker_secret` avec la même valeur que le secret
Edge `NEWSLETTER_WORKER_SECRET`. Dans l’éditeur SQL du projet de test,
programmer ce passage chaque minute :

```sql
select cron.schedule('newsletter-mail', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_worker_url'),
    headers := jsonb_build_object(
      'X-Newsletter-Worker-Token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'newsletter_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
$job$);
```

La tâche réserve les envois atomiquement. Les erreurs temporaires sont reprises
au plus cinq fois, dans les 20 heures du premier essai, avec la même clé
d’idempotence Resend. Un résultat ambigu au-delà de cette fenêtre, ou un refus
permanent, reste en échec pour vérification. Contrôler ces lignes et le tableau
de bord Resend avant une correction ou un renvoi manuel. Ne pas réinitialiser
`first_attempt_at` pour contourner cette limite. Le statut `accepted` signifie
que Resend a accepté l’envoi. Consulter l’identifiant fournisseur pour vérifier
la livraison ou un rebond. Un changement de secret de signature invalide les
liens existants. Prévoir le recours au contact et éviter de modifier le domaine,
l’expéditeur ou le modèle d’un envoi pendant sa période de reprise. Un
désabonnement annule les envois de confirmation ou de bienvenue encore
en attente. Un courriel déjà accepté ou en cours d’envoi peut arriver ensuite.

Pour surveiller la reprise, consulter les statuts dans `newsletter_mail` et
les exécutions de `newsletter-mail` dans le tableau de bord Cron. Si nécessaire,
désactiver cette tâche dans le tableau de bord du projet de test.

## Vérifier avant fusion

- Soumettre une adresse contrôlée depuis le footer et une autre depuis un
  article long, sur ordinateur et mobile. Vérifier le statut `pending`,
  la source et la notification administrative réelle. Soumettre de nouveau
  la même adresse et vérifier l’absence de nouvelle ligne ou de nouveau message.
- Recevoir effectivement la confirmation puis ouvrir le lien. Vérifier que
  l’ouverture seule ne change rien, que le bouton active la ligne et que le
  message de bienvenue arrive ensuite. Vérifier le lien de désinscription,
  l’exclusion de la liste active et le refus de réactivation publique.
- Contrôler les droits publics, les erreurs et les quotas. Tester un échec
  temporaire sur une configuration de test et vérifier la reprise. Vérifier
  l’acceptation et la livraison dans Resend ou dans la boîte destinataire.
  Les prévisualisations et les simulations locales ne valident ni les
  réglages Supabase hébergés ni la réception réelle.
- En production, la migration, la configuration des secrets, le domaine
  expéditeur, le déploiement Edge et l’activation de Cron doivent faire l’objet
  d’une intervention séparée et approuvée. La publication GitHub Pages ne
  déploie pas ces composants.

```sh
node --test tests/*.test.mjs
npm install --prefix /tmp/agritech-newsletter --no-save playwright @electric-sql/pglite
NODE_PATH=/tmp/agritech-newsletter/node_modules node tests/newsletter-db.mjs
NODE_PATH=/tmp/agritech-newsletter/node_modules node tests/newsletter-browser.mjs
```

Le test SQL exécute les deux migrations dans PostgreSQL embarqué. Il appelle
le gestionnaire Edge avec le transport HTTP simulé et contrôle le suivi des
envois. Le test Chromium sert des fichiers statiques et simule Supabase,
Vercel et EmailJS. Adapter `CHROMIUM_PATH` à l’exécutable local si nécessaire.
