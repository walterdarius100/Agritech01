# Contact Supabase — architecture et protections

Le raccordement final, les contrôles distants sans écriture et la courte checklist
de publication sont dans [contact-release.md](contact-release.md).
Le propriétaire indique avoir exécuté la migration et déployé/configuré la
fonction. Cette finalisation ne modifie pas la base ni la fonction distante.
Branche conservée : `fix/emails-newsletter-fiabilite`, PR 166.

## État présent et séparation des parcours

Le frontend de la PR utilise désormais `CONTACT_STORAGE_CONFIG.enabled: true`
et l’URL de `contact-request` du projet `lxvegipzhkkujibexnkl`. Il ne sera publié
qu’après fusion/publication confirmées par le propriétaire. Le backend garde ses
flags d’activation explicites et ses protections ; aucun secret n’est exposé.
La configuration de cette seule fonction indique `verify_jwt=false`, alignée
sur l’accès public déjà constaté sans JWT (POST vide refusé par le handler).
RLS, privilèges privés des RPC, validation, reçus et limitations restent requis.

Le contact passe par Supabase puis EmailJS côté Edge, sans repli vers le chemin
EmailJS/Apps Script navigateur en cas de panne. Le flag peut être remis à faux
uniquement dans une modification revue si un retour à l’ancien parcours est
explicitement décidé. La newsletter conserve son circuit indépendant.
Les identifiants EmailJS existants, les articles et leurs politiques sont inchangés.

## Audit EmailJS : fournisseur connecté NON identifié

Le dépôt prouve seulement que `service_z856n3l` appelle `template_pzsnmea` pour
le contact et la newsletter. `contact@agritech509ht.com` est documenté comme
boîte destinataire ; les réglages effectifs sont externes et non inspectés.
`autoReplyTemplateId` est vide. Une clé publique EmailJS ne révèle pas le
fournisseur effectivement connecté.

**EmailJS ne doit pas être considéré indépendant de Zoho** tant que l’audit du
service n’a pas établi le fournisseur. S’il utilise déjà Zoho, le transport
actuel dépend de Zoho : cette préparation ne le remplace pas et n’ajoute aucun
accès direct Zoho. Un éventuel changement de transport exigerait une décision
séparée, pas une adaptation automatique du code.

Vérifications du propriétaire dans le Dashboard EmailJS, sans modification
requise à ce stade :

1. Email Services → ouvrir le service dont l’ID exact est `service_z856n3l` :
   relever son nom, son type/fournisseur réel (Zoho ou autre), la boîte connectée,
   l’expéditeur et l’état de connexion. Relever les plafonds/contraintes de ce
   fournisseur et l’expiration éventuelle de son autorisation. Ne pas transmettre
   mot de passe, jeton OAuth ou clé privée dans le chat.
2. Ouvrir `template_pzsnmea` : vérifier service utilisé, To fixe professionnel,
   From/identité, Reply-To `{{from_email}}`, CC/BCC, variables, protections et
   éventuel onglet Auto-Reply. Confirmer la boîte de réception réellement utilisée.
3. Vérifier si une autoréponse liée existe déjà. Le MÊME template sert à la
   newsletter : lier une réponse ici pourrait aussi répondre aux abonnements.
   Le nouveau code exige confirmation explicite de l’absence de réponse liée
   pour autoriser la notification. Ne rien désactiver/activer extérieurement
   sans validation. Une réponse liée trouvée reste un blocage à résoudre.
4. Si une autoréponse distincte est approuvée ultérieurement : vérifier son vrai
   ID, To `{{from_email}}`, nom `{{from_name}}`, Reply-To professionnel, absence
   de liens Auto-Reply en cascade, contenu français et échappement des variables.
   Ne pas inventer de template. Voir `EMAILJS_GUIDE.md` pour le texte proposé.
5. Account/Security : vérifier les appels REST hors navigateur et les modalités
   de clé privée, les restrictions de domaines du plan réel, CAPTCHA ou autres
   protections existantes. Vérifier l’impact des réglages de compte sur la
   newsletter navigateur avant tout changement. Ne pas fabriquer d’Origin ni
   retirer une protection globale pour contourner un refus des appels serveur.
6. Relever le plan, la date de remise à zéro, le quota utilisé/restant, les
   limitations par seconde et celles du service connecté. Allouer un budget
   contact en tenant compte de la newsletter, des autres usages et des demandes
   potentiellement déjà prises en charge mais incertaines.

Le code actuel de notification n’est pas modifié par cette vérification requise
pour le futur chemin. Aucune connexion de compte ni paramètre externe changé.

## Choix simplifiés pour V1.2

Deux tables seulement :

- `public.contact_requests` : demandes, consentement au recontact, reçu haché,
  empreinte HMAC du contenu, état métier et états des deux emails ;
- `contact_internal.limits` : compteurs atomiques sans email/IP brut, créneau
  d’envoi et compteur mensuel contact. Elle est nécessaire pour que plusieurs
  instances Edge partagent les mêmes limites ; pas de Redis ou nouvelle offre.

Trois fonctions SQL, exécutables seulement par `service_role` :

- `contact_submit` : validation SQL complémentaire, limites, insertion ou rejeu ;
- `contact_claim_email` : réserve une seule tentative et son créneau/budget ;
- `contact_finish_email` : confirme un état terminal sans pouvoir recommencer.

Un verrou transactionnel commun sérialise ces courtes décisions. Aucun verrou
ne reste tenu pendant un appel EmailJS. Un seul point d’entrée Edge, sans worker,
file, cron ou recherche de demandes publiques. Le faible volume V1 justifie ce
choix ; il ne convient pas à un système à très fort débit.

### Doublons : compromis retenu

Le navigateur crée une UUID v4 et un reçu aléatoire de 256 bits avant le POST.
Le même contenu reprend ces valeurs en mémoire/sessionStorage, y compris après
panne et rechargement du même onglet. Seuls identifiants, reçu et empreinte salée
locale sont enregistrés dans le navigateur, jamais les champs bruts.
Le reçu est une capacité sensible : pas de copie dans URL ou logs.

La PK et la transaction garantissent une seule ligne par UUID, même en
concurrence. Même UUID + reçu + contenu : résultat existant, sans écraser la
ligne. Reçu ou contenu différent sous cette UUID : conflit. Le serveur conserve
uniquement le hachage du reçu et un HMAC du contenu, pas le reçu brut.

**Retirés de la proposition initiale** : dédoublonnage de contenu sur fenêtre,
index du contenu, rotation de secrets IP, table/compteurs IP et fournisseur
CAPTCHA ajouté. Ces composants n’étaient pas nécessaires au double clic et au
réessai ordinaire et pouvaient bloquer des demandes identiques légitimes.

Limite assumée : une nouvelle UUID après perte/effacement de session, autre
onglet/appareil ou appel intentionnel peut créer une nouvelle demande identique.
Les limites email/globales bornent ce risque sans prétendre l’éliminer. Si le
stockage navigateur est refusé, le reçu ne survit que dans la page ouverte.
Un contenu modifié est une nouvelle demande. Ne pas faire passer une nouvelle
UUID pour un mécanisme de reprise après une panne incertaine.

## Schéma et permissions

Fichier de migration appliqué par le propriétaire selon sa confirmation ;
aucune nouvelle exécution ou modification de production par Codex :
`supabase/migrations/202611160001_contact_requests.sql`.

Champs métier : UUID, nom 1–150 caractères, email 3–254, téléphone 1–40,
libellé de besoin 1–200, message 1–1200, `consent_at` et `created_at` serveur,
`consent_scope = contact-recontact-v1`, statut `new/in_progress/closed`.
Le libellé est conservé pour les formations, services, partenariats et besoins
libres historiques, sans fabriquer une catégorie marketing.

La date de consentement correspond à la réception par le serveur du booléen
accepté, pas à une vérification d’identité ni à l’heure exacte du clic.
La portée est le texte « J’accepte d’être recontacté par Agri-tech » ; elle
n’autorise pas la newsletter. Une formation conserve le texte fixe du formulaire.

Champs techniques : hachages reçu/contenu et deux états/horodatages de tentative.
Un seul index métier `(status, created_at desc)` en plus de la PK.
Notification : `pending/attempting/accepted/failed/unknown` ; réponse ajoute
`disabled`. Ces états distinguent non tenté, tentative réservée, prise en charge
API, rejet explicite et résultat incertain. Aucun statut de livraison inventé.
`attempting` ne revient jamais automatiquement à `pending`, même après crash.

RLS activé sur les deux tables, aucune policy publique. Privilèges directs
révoqués pour PUBLIC, anon, authenticated et même service_role : le code Edge
utilise seulement les RPC à paramètres bornés. Les RPC SECURITY DEFINER ont un
search_path vide, des noms de tables qualifiés, aucun SQL dynamique et leur
EXECUTE est retiré à PUBLIC/anon/authenticated. Aucune fonction de liste, lecture
par UUID seul, modification de statut métier ou suppression publique.

Ces droits ne protègent pas d’un propriétaire de base ou d’un secret privilégié
compromis : garder les secrets uniquement côté Edge, sans réutiliser un client
Supabase connecté comme utilisateur. Le traitement initial se fait par les
responsables autorisés dans le Dashboard, pas par un nouvel écran admin.

## Validation, anti-abus et quotas : portée réelle

Edge : POST JSON uniquement, 16 Kio maximum lus en flux, validation types,
longueurs, email, téléphone, consentement, UUID/reçu, honeypot, absence de champs
inattendus et CR/LF dans les champs d’identité ; aucun destinataire, template ou
statut libre fourni par le visiteur. Contenu échappé avant envoi. Réponses sans
coordonnées, message, reçu, secret ou erreur SQL brute. Aucun log applicatif des
champs personnels. CORS exact et no-store ; CORS n’arrête pas un client HTTP bot.

Limites SQL fixes de préparation : 30 appels valides/minute au total (rejeux
inclus), 100 nouvelles demandes/jour, 3 nouvelles demandes/heure/email normalisé.
Fenêtres calendaires serveur ; possibles rafales à la frontière des fenêtres.
L’email est HMAC dans les compteurs, purgés opportunément après un jour pour ces
clés ; autres compteurs bornés à 32 jours. Pas de conservation d’IP brute ni de
confiance dans un X-Forwarded-For non vérifié. Les hachages ne constituent pas
une anonymisation garantie. Un changement de secret HMAC peut bloquer des reçus
existants : prévoir une stratégie de transition avant rotation.

Ces plafonds ne protègent pas le quota d’invocations Edge d’un bot ni d’un déni de
service distribué. Un attaquant peut aussi épuiser un plafond et bloquer des
visiteurs légitimes. Mesures proportionnées à réévaluer avant exposition réelle ;
aucun CAPTCHA/fournisseur supplémentaire n’est activé implicitement.

Pour les emails contact : budget mensuel explicite `CONTACT_MONTHLY_EMAIL_BUDGET`
(zéro par défaut), compté à la réservation, y compris si l’envoi reste incertain.
Une réservation atomique impose au moins 1,1 seconde entre tentatives contact.
Si budget/créneau indisponible : demande conservée, email `pending`, sans
promesse de reprise automatique. La pause entre notification et réponse ne
remplace pas le contrôle partagé SQL.

**Ces contrôles ne couvrent PAS la newsletter**, qui utilise encore le même
compte depuis le navigateur. Ils ne mesurent pas le solde réel EmailJS ni les
appels d’autres applications. Un 429 peut donc survenir et sera conservé comme
échec sans renvoi. Allouer un budget contact conservateur après audit des usages.
Les offres publiques consultées lors de l’audit indiquent notamment 200 requêtes
mensuelles et deux templates EmailJS Free ; une autoréponse consomme aussi une
requête. Le plan/solde effectifs et le fournisseur connecté restent inconnus.
Aucun changement de plan ou coût supplémentaire automatique.

## Séquence et états partiels

1. Validation frontend et reçu stable ; un seul appel en vol par reçu.
2. Validation Edge, contrôles SQL et commit. Avant confirmation de cette RPC,
   aucun email ne peut être tenté. Refus SQL confirmé : pas de notification.
3. Si envoi autorisé par configuration vérifiée : réservation atomique
   `pending → attempting`, puis EmailJS avec les identifiants existants.
4. HTTP 200 EmailJS : prise en charge `accepted`, pas livraison. HTTP 4xx :
   `failed` ; erreur réseau/5xx/réponse inattendue : `unknown`. Si confirmation SQL
   finale échoue : état UI incertain et réservation persistante sans renvoi.
5. Autoréponse distincte seulement après notification acceptée, template vérifié,
   absence de réponse liée vérifiée et budget/créneau disponible. Échec séparé.
6. Les champs restent conservés et le message reflète le stockage confirmé ou
   incertain, sans inciter à recréer une demande déjà reçue.

Un rejeu peut seulement essayer un email encore `pending`, jamais un email déjà
réservé, accepté, refusé ou incertain. Une réservation perdue avant l’appel peut
ainsi empêcher un email qui n’a finalement jamais été envoyé : compromis de
sécurité choisi contre le double envoi. Pas de reprise automatique de tentative,
expiration de verrou d’envoi ou transaction distribuée revendiquée.

La fonction peut être interrompue après commit : la demande reste dans la base,
les emails peuvent rester en attente/incertains. Prévoir une revue manuelle
régulière de ces états et de l’historique EmailJS par un responsable. Pas de file
ni garantie de livraison indépendante du cycle d’exécution. Les limites et la
coupure réseau peuvent rendre la réponse client incertaine même si le commit a
réussi : reprendre le même reçu, sans repli vers l’ancien chemin.

## Secrets et mise en service : validations encore nécessaires

`supabase/.env.example` décrit les noms sans valeurs réelles ; `.env` est ignoré.
Ne pas coller un secret dans le chat, le frontend, Git ou un corps de test réel.

- Runtime Edge : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` côté serveur.
- `CONTACT_HMAC_SECRET` : secret aléatoire d’au moins 32 caractères.
- `CONTACT_ENABLED`, `CONTACT_ALLOWED_ORIGINS` : activation et origines exactes.
- `CONTACT_EMAIL_ENABLED`, budget mensuel contact, clé publique et clé privée
  EmailJS serveur, service/template notification réels vérifiés.
- `EMAILJS_CONNECTED_PROVIDER`, `EMAILJS_PROVIDER_VERIFIED`,
  `EMAILJS_LINKED_REPLY_DISABLED_VERIFIED` : trace des vérifications manuelles,
  jamais une détection automatique du fournisseur.
- `EMAILJS_REPLY_TEMPLATE_ID`, `EMAILJS_REPLY_VERIFIED` : restent vide/faux.

Un booléen « vérifié » ne remplace pas l’audit du compte. Les flags sont des
verrous opérationnels, pas un mécanisme d’authentification du visiteur.

La migration et le déploiement sont déclarés effectués par le propriétaire.
Aucune commande automatique de migration/déploiement ni activation dans CI.
Il reste à confirmer fusion/publication et, si nécessaire, configuration email :
voir la checklist de livraison, sans réappliquer SQL ni multiplier les scripts.
La fonction est déjà accessible publiquement sans JWT pour l’origine du site ;
aucun changement distant de cette option n’a été effectué ici.
Rollback : désactiver le point d’entrée et afficher une voie de contact manuelle ;
conserver les demandes déjà enregistrées, ne pas réactiver un double circuit.

## Tests : exécutés et non exécutés

Exécutés en environnement isolé :

- Suite Node : validation, origines/méthodes/taille, verrous par défaut, séquence,
  erreurs de stockage, faux succès, concurrence, conflits, configuration absente,
  fournisseur non vérifié, notification/réponse, quotas, erreurs de confirmation,
  reçu stable après panne/rechargement, stockage navigateur refusé, aucun secret
  dans les nouveaux modules frontend ; anciens tests publication/upload/SEO.
- `tests/contact-db.mjs` : migration appliquée UNIQUEMENT dans PostgreSQL 17
  jetable Docker, sans réseau, sans port publié et sans URL de production.
  Refus des accès directs, refus des RPC pour anon/authenticated, RLS, articles
  témoins inchangés, dix soumissions concurrentes pour une ligne, conflit,
  limites email/créneau/budget et réservation unique. Intégration du vrai handler
  avec ces vraies transactions SQL et EmailJS simulé : panne après stockage,
  concurrence et rejeu sans renvoi. Conteneur supprimé après contrôle.
- Chromium formulaires : ancien parcours avec drapeau faux, puis activation
  de livraison inchangée, avec seulement la réponse Edge simulée.
  Double clic, panne/réessai avec même reçu, champs conservés, boutons remis,
  rechargement et newsletter indépendante, tous services externes bloqués/simulés.
- Contrôles Deno sans réseau et sans serveur public ; contrôles Chromium SEO et
  administration simulée ; syntaxe et diff contrôlés. Voir résultat chiffré du
  rapport de livraison associé à la PR.

Non exécutés par Codex : SQL sur Supabase distant, déploiement/activation distante,
vérification des privilèges réels de production, connexion réelle EmailJS/Zoho,
emails réels et stockage Apps Script réel. Les tests PostgreSQL standard ne
simulent pas toute la passerelle Supabase/PostgREST ni les droits hérités réels
du projet ; ceux-ci devront être contrôlés avant mise en service autorisée.

Commandes de tests isolés : `tests/README.md`. Aucun test ne lit un `.env` de
production. Aucun script SQL exécuté contre Supabase de production.

## Sources officielles déjà vérifiées lors de l’audit

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/pricing
- https://www.emailjs.com/docs/rest-api/send/
- https://www.emailjs.com/docs/user-guide/auto-reply/
- https://github.com/emailjs-com/emailjs-nodejs
- https://www.emailjs.com/pricing/

### Résultat de cette préparation

100 tests automatisés Node réussis. Le runner SQL/intégration sur PostgreSQL
jetable, le contrôle d’entrée Deno et les trois contrôles Chromium (formulaires,
SEO, administration) ont réussi. Syntaxe des modules modifiés et diff validés.
Aucune écriture de production, aucun email réel, aucune modification externe.
Le SQL a été exécuté seulement dans le conteneur de test détruit ensuite.
