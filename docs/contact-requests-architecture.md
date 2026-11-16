# Stockage des demandes Agri-tech — proposition à valider

Audit du 16 novembre 2026. Proposition uniquement : aucun nouveau parcours
frontend, aucune migration exécutée, aucune fonction créée ou déployée.
La PR 166 reste en Draft. Ce document ajuste la cible du chantier 04 ;
`emails-newsletter.md` décrit les corrections déjà présentes, pas cette cible.

## A. État réel et périmètre

Vérifications : PR 166 ouverte, Draft, non fusionnée ; branche
`fix/emails-newsletter-fiabilite` au commit `84a3d47`, issue de `main` après
fusion de la PR 165 (`6c54402`). Dernier `origin/main` vérifié identique.
Aucun accès aux tableaux de bord EmailJS, Supabase ou Apps Script : leurs
réglages, politiques effectives, volumes, abonnements et quotas restants sont
inconnus. La configuration Supabase publique existe pour les articles, mais
cela ne prouve pas l’existence de `contact_requests` ou d’une Edge Function.
Le SQL d’articles dans `SUPABASE_SETUP.md` est documentaire, pas un inventaire
certifié de production. Il ne sera pas réutilisé pour autoriser les contacts.

### Code actuellement dans la PR

- Contact : validation nom, email, téléphone, besoin et consentement au recontact ;
  message obligatoire sauf formation (texte fixe), maximum 1 200 caractères ;
  honeypot `website`, bouton/verrou logique et messages accessibles.
- `js/components/contact-form.js` appelle EmailJS : service `service_z856n3l`,
  notification `template_pzsnmea`. Variables : `from_name`, `from_email`, `phone`,
  `need`, `message`, `consent`, `source`, `SOURCE`, `TYPE_CONTACT`, `date`.
- Destinataire documenté : `contact@agritech509ht.com`, défini dans le template,
  pas dans le JS. Reply-To attendu : email du visiteur. Destinations réelles et
  éventuelle réponse liée non vérifiées. Aucun identifiant changé.
- `autoReplyTemplateId` vide et `autoReplyVerified: false` : autoréponse inactive.
  Si activée après validation, elle suit la notification sans annuler son succès.
- Ensuite seulement : Apps Script existant, POST URLSearchParams `no-cors`,
  timeout quinze secondes. Le résultat reste non confirmé, même si fetch résout.
  Si notification échoue, ni autoréponse ni Apps Script ne sont tentés.
- Pas d’écriture Supabase de demandes actuellement. Le succès EmailJS prouve
  une prise en charge API, pas la livraison ni la conservation en base.
- Newsletter : même service de notification puis Apps Script, traitement partagé
  sur sept pages, case volontaire, texte/version/date/source transmis, stockage
  toujours non confirmé. Un échec conserve les champs.
- Verrous mémoire et empreintes salées en sessionStorage limitent les renvois
  acceptés dans le même onglet ; aucune garantie durable ou entre appareils.

Zoho Mail reste la boîte de réception et l’outil de réponse manuelle.
L’envoi EmailJS continue d’utiliser son service connecté actuel : audit manuel
nécessaire pour connaître ce service, sans introduire de nouvel accès SMTP/API
Zoho ni changer le fournisseur connecté dans ce chantier.

## B. Architecture et schéma proposés

### Recommandation

**Site statique → une Edge Function Supabase publique → transaction PostgreSQL →
EmailJS via son API REST existante.** Le stockage est confirmé avant tout email.
La fonction constitue le seul point d’entrée pour les demandes ; elle contrôle
les champs, l’anti-abus et les transitions d’état. Le site reste HTML/CSS/JS,
sans serveur Node.js, framework ou changement d’hébergement.

L’appel REST depuis la fonction conserve EmailJS, ses templates et variables.
Il déplace l’exécution du contact vers un environnement contrôlé afin que la
fermeture de l’onglet ne soit plus le seul responsable de l’envoi et que le
navigateur ne puisse pas déclarer lui-même une notification réussie.
Ce déplacement fait partie de l’architecture soumise à validation ; il n’est
pas implémenté. Compatibilité du compte EmailJS avec les appels hors navigateur
et clé privée à vérifier avant activation. Aucun appel SMTP/API Zoho prévu.

### Alternatives évaluées

| Option | Avantage | Limite | Avis |
|---|---|---|---|
| INSERT direct anonyme, RLS sans SELECT | Peu de code, confidentialité des lignes possible | L’API publique contourne le JS et permet spam/consommation ; consentement et statut à protéger aussi côté SQL | Écartée pour cette collecte publique |
| RPC publique PostgreSQL seule | Validation et idempotence transactionnelles | Anti-abus réseau/CAPTCHA plus difficile ; envoi navigateur et états invérifiables, ou ajout d’autres composants | Possible sous contraintes, moins simple à sécuriser ici |
| Edge stockage, puis EmailJS navigateur | Changement limité d’EmailJS | Fermeture d’onglet et états déclarés par le client ; stockage sans notification possible | Repli à valider si REST serveur indisponible, pas un remplacement automatique |
| Edge stockage et orchestration EmailJS | Un point de contrôle, états durables, secrets hors navigateur | Gestion des quotas, secrets et exécution partielle | Recommandée |

### Données métier proposées

| Champ | Type/contrainte | Motif |
|---|---|---|
| `id` | UUID primaire, créé avant la première tentative | Idempotence stable sur nouvelle tentative |
| `full_name` | text, 1–150 caractères après trim | Nom du formulaire |
| `email` | text, 3–254, validation serveur | Réponse transactionnelle, pas marketing |
| `phone` | text, 1–40, nettoyage identique au formulaire | Champ existant obligatoire ; pas un nombre SQL |
| `request_type` | text, 1–200 | Conserve le libellé réel du besoin/service/formation |
| `message` | text, 1–1200 | Description ou texte fixe formation |
| `consent_at` | timestamptz, heure serveur | Réception d’un consentement explicite au recontact |
| `consent_scope` | text constant `contact-recontact-v1` | Version du texte « J’accepte d’être recontacté par Agri-tech » |
| `status` | text `new`, `in_progress`, `closed` ; défaut `new` | Traitement métier, jamais choisi par le visiteur |
| `created_at` | timestamptz, heure serveur | Historique |

`consent_at` n’est pas l’heure exacte du clic ni une vérification d’identité :
c’est l’heure de réception par le serveur du booléen explicitement accepté.
Le serveur rejette une valeur absente/fausse et impose lui-même la portée.
Aucun consentement newsletter déduit. Pas de compte client, pièce jointe,
adresse postale, user-agent ou IP brute dans la demande.

Champs techniques justifiés : `payload_hash` (HMAC serveur du contenu normalisé),
`receipt_token_hash` (SHA-256 d’un jeton aléatoire de 256 bits),
`notification_state`, `reply_state` et deux horodatages de tentative.
Ils permettent de reconnaître les tentatives, protéger les accusés techniques
et éviter de renvoyer un email déjà tenté. Les états d’email sont distincts du
statut métier. Pas de corps de réponse fournisseur ni d’erreur personnelle stocké.

### Esquisse SQL à relire après validation — NE PAS EXÉCUTER

```sql
begin;
create table public.contact_requests (
  id uuid primary key,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 150),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(btrim(phone)) between 1 and 40),
  request_type text not null check (char_length(btrim(request_type)) between 1 and 200),
  message text not null check (char_length(btrim(message)) between 1 and 1200),
  consent_at timestamptz not null default now(),
  consent_scope text not null default 'contact-recontact-v1'
    check (consent_scope = 'contact-recontact-v1'),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  receipt_token_hash text not null check (receipt_token_hash ~ '^[0-9a-f]{64}$'),
  notification_state text not null default 'pending'
    check (notification_state in ('pending', 'attempting', 'accepted', 'failed', 'unknown')),
  reply_state text not null default 'disabled'
    check (reply_state in ('disabled', 'pending', 'attempting', 'accepted', 'failed', 'unknown')),
  notification_attempted_at timestamptz,
  reply_attempted_at timestamptz
);
create index contact_requests_status_created_idx
  on public.contact_requests (status, created_at desc);
create index contact_requests_payload_created_idx
  on public.contact_requests (payload_hash, created_at desc);
alter table public.contact_requests enable row level security;
revoke all on table public.contact_requests from public, anon, authenticated;
grant select, insert, update on table public.contact_requests to service_role;
commit;
```

Esquisse, pas migration finalisée : la validation email complète est dans la
fonction ; des contraintes de cohérence états/horodatages et les RPC atomiques
seront ajoutées et testées localement après accord. Pas d’index email unique :
un même client doit pouvoir faire plusieurs demandes légitimes. Pas de SELECT
public, pas d’INSERT public, pas d’UPDATE/DELETE public, pas de policy de
lecture pour tous les utilisateurs connectés. Aucun accès Realtime/publication,
vue ou RPC publique ne doit révéler les lignes. Ne rien changer aux articles.

## C. Sécurité et anti-abus

- Les visiteurs n’ont pas besoin de compte Supabase Auth. Une clé publique
  n’authentifie pas une personne et n’est pas une protection anti-spam.
  La fonction est explicitement publique selon la configuration Supabase retenue ;
  ne désactiver aucun contrôle global des autres fonctions. Pour cette seule
  fonction, accès sans JWT utilisateur avec contrôles applicatifs obligatoires.
- La fonction emploie un client privilégié séparé, secret Supabase uniquement
  dans ses secrets d’environnement ; jamais de jeton utilisateur copié dans ce
  client, ni secret dans le frontend, le dépôt ou les logs. La clé privilégiée
  contourne RLS : le code de la fonction doit donc être strictement limité.
- API fermée à des opérations nommées : soumettre/rejouer une demande ; aucun
  nom de table, destinataire, template, statut métier ou filtre arbitraire fourni
  par le navigateur. Réponse limitée à référence et états, sans coordonnées,
  message ni recherche/liste publique. Pas de GET par UUID seul.
- Méthode POST JSON, taille maximale 16 Kio, validation UTF-8/types/longueurs,
  rejet des propriétés inattendues, email sans CR/LF, nettoyage téléphone,
  trim et contrôle serveur des besoins. Accepter les libellés de catalogue et
  un besoin libre borné pour préserver les liens historiques `?need=...`.
  Échapper les variables de template, pas de HTML brut ni en-têtes pilotables.
- CORS sur origines exactes de production et environnement autorisé ; gestion
  OPTIONS, `Vary: Origin`, aucune réponse mise en cache. CORS ne bloque pas un bot
  HTTP : ce n’est pas une authentification ni un contrôle anti-abus suffisant.
- Conserver le honeypot, les verrous et limitations existantes jusqu’au
  remplacement validé ; les contrôles client ne sont jamais la seule défense.
- Prévoir des compteurs **atomiques PostgreSQL**, partagés entre instances Edge,
  dans une petite table technique privée avec expiration : proposition initiale
  5 nouvelles demandes/15 min/source, 3/h/email et plafond global journalier
  ajusté aux quotas réels. Les tentatives sont aussi limitées, pas seulement les
  insertions. Ne pas stocker une IP brute : HMAC avec secret dédié et rotation,
  purge sous 24 h. Les empreintes restent des données pseudonymisées.
- L’origine IP doit provenir d’un en-tête de passerelle dont la fiabilité est
  vérifiée ; ne pas faire confiance à un X-Forwarded-For arbitraire du client.
  Si cette propriété n’est pas établie, la limite IP ne peut pas être revendiquée.
  Les seuils peuvent bloquer des visiteurs partageant une connexion : à ajuster.
- Les compteurs/RPC techniques n’ont aucun droit d’appel pour PUBLIC, anon ou
  authenticated. Appels réservés au service privilégié ; fonctions SQL avec
  search_path fixé et paramètres bornés, pas de SQL dynamique. Idempotence,
  quota et insertion doivent se décider dans la même transaction.
- Limite de base ne protège pas contre la consommation d’invocations Edge ou un
  bot distribué. Prévoir un CAPTCHA vérifié côté serveur si l’exposition/abus
  l’exige ; aucun fournisseur CAPTCHA n’est choisi ou activé ici. Si nécessaire,
  son choix et sa configuration feront l’objet d’une validation distincte.
- Accès métier initial via le Dashboard Supabase réservé aux responsables
  autorisés, sans nouvel écran CRM ni extension automatique des droits admin
  articles. Définir durée de conservation, purge, sauvegarde/restauration et
  traitement des demandes d’effacement avant mise en service.

## D. Parcours, idempotence et succès partiels

1. Le navigateur valide et génère UUID et jeton de reçu aléatoires **une seule
   fois** avant le premier POST. Il conserve ces identifiants et une empreinte
   locale du contenu en session, pas le texte personnel. Même contenu/réessai :
   mêmes identifiants ; contenu changé : nouvelle demande. Si le stockage local
   est refusé, repli mémoire et avertissement sur la limite après rechargement.
2. La fonction valide les champs/consentement, le honeypot et les limites.
   Une transaction utilise la PK pour empêcher deux insertions concurrentes.
   Même UUID + même jeton + même contenu : résultat existant ; contenu différent
   sous le même UUID : conflit 409, pas de remplacement. Le jeton brut n’est
   conservé ni dans la table ni dans les logs.
3. Si une nouvelle clé reprend le même contenu, contrôle court par HMAC de
   contenu sur une fenêtre proposée de 15 min, avec verrou transactionnel par
   empreinte pour couvrir la concurrence. Réponse générique sans exposer la
   référence/les états d’un tiers ; aucun nouvel email. Le détail ne revient
   qu’avec le reçu d’origine. Ce contrôle peut supprimer une répétition légitime
   identique très proche ; la fenêtre doit être validée. Une clé changée avec
   contenu changé ou une nouvelle demande hors fenêtre n’est pas un doublon.
4. Après commit réussi : demande durable confirmée ; puis revendication atomique
   de l’état notification `pending → attempting` avant l’appel EmailJS.
   Un seul appelant peut obtenir ce droit. Stocker un horodatage avant envoi.
5. Appeler la notification avec les identifiants existants et données validées.
   Réponse API acceptée : `accepted`, sans promettre la livraison.
   Rejet explicite : `failed` ; timeout/perte de connexion : `unknown`.
   Si crash après envoi avant écriture de l’état, `attempting` devient incertain,
   jamais une autorisation de renvoi automatique par expiration d’un verrou.
6. Autoréponse uniquement après notification acceptée et configuration validée.
   Même revendication atomique séparée. Échec sans remettre en cause le stockage
   ou la notification. Aucune nouvelle tentative automatique d’email après
   tentative partielle ; vérification par le propriétaire dans l’historique.
7. Résultat UI structuré : stockage d’abord, puis état email connu. Une nouvelle
   soumission identique interroge/rejoue le reçu, sans envoyer les emails déjà
   tentés. Si panne pendant le commit : résultat incertain, conserver champs et
   identifiants ; réessayer avec le même reçu, jamais générer une nouvelle UUID.

La réponse de stockage ne peut être `stored: true` qu’après commit vérifié.
Un HTTP 200 générique ou un état client ne suffit pas. Réponse réseau perdue :
le client ne revendique pas une réception, même si le serveur a pu terminer.

| État réel | Message proposé / comportement |
|---|---|
| Validation/stockage refusé de façon certaine | « Votre demande n’a pas été enregistrée. Vos champs sont conservés. » Aucun email |
| Stockage incertain | « L’enregistrement n’a pas pu être confirmé. Réessayez cette même demande sans la recréer. » Même reçu |
| Stockage confirmé, notification échouée/incertaine | « Votre demande est enregistrée. La notification email n’a pas pu être confirmée. Ne renvoyez pas votre demande. » |
| Stockage et notification acceptés, réponse échouée | « Votre demande est enregistrée et la notification a été prise en charge. L’accusé de réception n’a pas pu être confirmé. » |
| Stockage et appels EmailJS acceptés | « Votre demande est enregistrée. Les emails ont été pris en charge par le service d’envoi. » Pas de promesse de livraison |
| Rejeu authentifié par reçu | Même référence/états ; aucune duplication |

### Exécution et limitation EmailJS

L’API EmailJS indique une limite de 1 requête/seconde. Un simple timeout local
ou verrou mémoire Edge n’est pas un régulateur partagé : prévoir un créneau
atomique global en base pour les appels contact, y compris autoréponse, avec
espacement supérieur à une seconde. Si aucun créneau n’est disponible dans le
budget d’exécution, laisser la notification `pending` et confirmer seulement
le stockage. Pas de boucle de renvoi ni file/worker supplémentaire dans V1.
La newsletter navigateur utilise encore le même compte : son trafic externe
ne sera pas couvert par ce verrou. Un 429 doit rester une notification échouée,
sans perdre la demande ni promettre un envoi ultérieur automatique.

La fonction n’est pas une file durable : interruption avant l’appel peut laisser
une demande enregistrée avec notification en attente. Revue régulière des états
`pending`, `failed`, `unknown` par le propriétaire ; traitement/reprise contrôlée
après vérification, pas par le visiteur. Une automatisation de reprise garantie
nécessiterait un chantier distinct. Aucune garantie « exactement une fois »
entre PostgreSQL et EmailJS, car il n’y a pas de transaction distribuée ni de
clé d’idempotence EmailJS documentée dans l’API consultée.

## E. EmailJS, autoréponse et newsletter

**Notification** : garder `service_z856n3l` / `template_pzsnmea`, variables
existantes, destinataire professionnel fixe ; ajouter `request_id` seulement
comme variable de corrélation si le propriétaire souhaite l’afficher.
Jamais de template/destinataire choisi par le client de la fonction.

**Deux possibilités de réponse, exclusives** :

- Réponse liée dans le tableau de bord EmailJS : un template peut déclencher
  un autre template. Plus simple côté appelant, mais la réponse principale ne
  prouve pas indépendamment le résultat du second email. L’état doit rester
  « géré par EmailJS, non vérifié », jamais `accepted` déduit du premier appel.
- Deux appels distincts depuis la fonction : permet de suivre deux résultats et
  limiter séparément les renvois. **Recommandation pour le suivi demandé**, à
  condition de vérifier et désactiver une éventuelle réponse liée concurrente.

Point critique : contact et newsletter utilisent actuellement le MÊME template.
Activer une autoréponse liée sur ce template pourrait aussi l’envoyer pour les
newsletters. Ne pas l’activer globalement sans vérifier ce comportement et
séparer les usages si nécessaire (nouvel identifiant uniquement réel et validé).
Aucun mécanisme de réponse n’est activé dans cette proposition.

Pour le contenu et les To/Reply-To : `EMAILJS_GUIDE.md`. Destinataire réponse :
email validé du visiteur ; Reply-To : boîte professionnelle vérifiée ; aucune
promesse de délai, réservation ou acceptation. La déclaration d’adresse par un
visiteur n’est pas une preuve qu’il en est propriétaire : les limites anti-abus
sont nécessaires avant toute autoréponse vers une adresse libre.

EmailJS REST hors navigateur exige une vérification du réglage Account/Security.
Clé privée éventuelle stockée uniquement comme secret Edge ; ne pas fabriquer
un Origin pour contourner une restriction. Vérifier l’effet de tout réglage
sécurité au niveau du compte sur la newsletter navigateur avant modification.
Ne pas retirer une protection globale existante pour débloquer les appels Edge.

**Newsletter indépendante** : maintien du chemin actuel EmailJS + Apps Script,
avec non-confirmation tant que l’écriture n’est pas vérifiable. Lors du futur
basculement du contact, retirer son POST Apps Script afin d’éviter une double
base de demandes ; conserver le POST newsletter. Ne pas recopier automatiquement
les anciennes demandes depuis Sheets ; migration de données hors périmètre.
Aucune table d’abonnés proposée/créée ici, aucun abonnement marketing implicite.
Persistance du consentement et procédure de désinscription Apps Script restent
à inspecter ; pas de basculement automatique vers Supabase.

## F. Coûts, dépendances et actions du propriétaire

Pages officielles consultées le 16 novembre 2026 :

- Supabase Free : 500 Mo de base, 500 000 invocations Edge incluses ; un projet
  gratuit peut être mis en pause après une semaine d’inactivité.
  Le petit volume de textes prévu paraît compatible, sous réserve de l’usage
  déjà consommé par les articles et autres fonctions. Pas de garantie de coût
  nul ni de disponibilité déduite du dépôt.
- EmailJS Free : 200 requêtes mensuelles, 2 templates ; une autoréponse liée
  consomme une requête supplémentaire. Budgéter deux requêtes par demande avec
  réponse, plus newsletter/autres usages : ordre de grandeur de 100 demandes
  au maximum si rien d’autre ne consomme ce quota. Quota réel et solde inconnus.
  La liste de domaines autorisés n’est pas incluse dans Free selon la grille
  affichée : vérifier le plan réel au lieu de promettre ce contrôle gratuitement.
- Les secrets/RPC/limites proposés utilisent le projet existant, sans Redis,
  fournisseur d’emails supplémentaire ni nouvel abonnement imposé. Des requêtes
  abusives peuvent malgré tout épuiser les ressources. Aucun changement de plan
  automatique : réduction/arrêt des envois et décision du propriétaire si quota.

Ordre de mise en service APRÈS validation de l’architecture :

1. Vérifier projet, plan, région, quotas, sauvegarde, politiques effectives et
   droits des responsables dans le Dashboard ; fixer rétention et seuils.
2. Finaliser et relire la migration limitée aux nouveaux objets contact/rate
   limit/RPC ; exécuter les tests en environnement local isolé. Aucun changement
   des articles, de leurs politiques ou des rôles existants.
3. Préparer fonction et frontend sous configuration inactive, avec tous les
   appels externes simulés ; vérifier confidentialité et scénarios ci-dessous.
4. Le propriétaire approuve séparément l’application SQL, puis le déploiement
   Edge. Secrets attendus : accès privilégié Supabase déjà disponible côté Edge,
   secret HMAC, secret pour empreintes anti-abus, identifiants EmailJS existants
   et éventuelle clé privée EmailJS. Aucun secret à coller dans le chat/repo.
5. Vérifier EmailJS : service connecté, boîte destinataire, Reply-To, templates,
   réponse liée éventuelle, accès hors navigateur, quotas et limites. Aucun
   changement de fournisseur/service Zoho ni remplacement d’identifiants sans accord.
6. Effectuer un contrôle réel seulement après autorisation distincte, sur des
   coordonnées du propriétaire ; vérifier la ligne, les états et les deux boîtes.
   Tous les tests automatisés restent sans écriture/email de production.
7. Approuver ensuite le basculement frontend et la publication. Avant cela,
   désactiver l’ancien envoi contact et son POST Sheets dans le nouveau chemin
   pour éviter le double circuit. Newsletter conservée. Revue après basculement
   et suivi manuel des notifications non confirmées.
8. Retour arrière : désactiver le nouveau point d’entrée/présenter une voie de
   contact manuelle si panne ; ne pas réactiver automatiquement un circuit
   EmailJS sans stockage prioritaire ni supprimer les demandes déjà reçues.

## G. Tests à prévoir après validation

- Validation serveur : types, champs absents, consentement faux, email invalide,
  longueurs, corps trop grand, CR/LF, HTML, champs de statut/template/destinataire
  injectés, libellés formation/partenariat et honeypot.
- SQL local : anon ET authenticated ne peuvent ni lire, ni insérer directement,
  ni mettre à jour, ni supprimer ; aucun RPC privilégié accessible publiquement.
  Contrôler vues, Realtime et privilèges hérités, et absence de changement articles.
- Concurrence réelle sur PostgreSQL local : même UUID simultanée → une ligne ;
  même contenu/nouvelles clés pendant fenêtre → une ligne/notification ; nouvelle
  demande légitime hors fenêtre ; conflit même UUID/contenu différent ; faux reçu.
- Commit échoué : zéro email. Commit accepté/réponse perdue : rejeu même reçu,
  une seule ligne et aucun renvoi déjà tenté. Pas de fuite de contenu sur doublon.
- Notification refusée, timeout, 429, réponse perdue, crash avant/après appel ;
  état durable fidèle. Autoréponse absente, refusée ou incertaine ; réponse liée
  vérifiée exclusive. Limite globale EmailJS testée entre plusieurs instances.
- Rate limits transactionnels IP/email/global, IP non fiable, rotation/purge des
  empreintes, échec du contrôle anti-abus bloquant toute nouvelle insertion ;
  CORS et appels directs hors navigateur, budget mémoire et taille du corps.
- Navigateur isolé : double clic, données conservées, boutons et aria-busy remis,
  messages selon chaque état, rechargement/rejeu avec reçu, stockage local refusé,
  absence de secret et de données personnelles dans logs/réponses.
- Régressions publication/articles/uploads/SEO et newsletter indépendante.
  EmailJS, Supabase et Apps Script simulés ; tests SQL seulement sur base locale
  jetable avec valeurs fictives, jamais sur le projet de production.

Cet ajustement ne change que la documentation. Aucun nouveau test de fonction
ou de sécurité SQL n’est prétendu exécuté : l’architecture attend validation.
Les 53 tests et contrôles Chromium déjà rapportés concernent la PR existante,
pas le futur stockage Supabase. Le diff documentaire est contrôlé séparément.

## Décision sollicitée

Valider la cible : Edge Function publique contrôlée, table contact fermée aux
rôles publics, stockage avant EmailJS REST orchestré côté Edge, deux appels
transactionnels séparés avec autoréponse désactivée jusqu’à vérification,
idempotence durable et limites atomiques, newsletter inchangée dans son circuit.
Cette validation autorisera la préparation de l’implémentation inactive et des
tests ; elle ne vaudra ni autorisation SQL de production, ni déploiement,
ni activation EmailJS, ni fusion/publication.

## Sources officielles

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/pricing
- https://supabase.com/docs/guides/functions/pricing
- https://www.emailjs.com/docs/rest-api/send/
- https://www.emailjs.com/docs/user-guide/auto-reply/
- https://github.com/emailjs-com/emailjs-nodejs (réglage hors navigateur ; pas de serveur Node proposé)
- https://www.emailjs.com/pricing/
