# Communication V1.2 — préparation du test unique

Branche indépendante créée depuis `main` (6c54402). La PR 166 n'est pas la base Git.
Ses composants serveur et son protocole de reçu ont été réutilisés après examen pour
rester compatibles avec la migration déjà appliquée. Aucun déploiement ni changement
EmailJS, donnée ou permission de production n'a été effectué.

## Fonctionnement

Le contact appelle `contact-request`, qui enregistre via `contact_submit`, réserve
chaque envoi atomiquement, puis appelle EmailJS : notification, puis accusé distinct.
Service conservé : `service_z856n3l`. Template administration : `template_pzsnmea`.
Le destinataire professionnel reste configuré dans ce template (guide existant :
`contact@agritech509ht.com`). Les variables historiques sont conservées.
La newsletter conserve son chemin navigateur et son template actuel ; elle ne passe
pas dans contact_requests et le contact n'inscrit personne à la newsletter.
Le contact n'est plus envoyé à l'ancien endpoint Google Sheets.

Les reçus opaques en session permettent de rejouer une demande identique après une
coupure sans nouvelle ligne ni nouvel email. Aucun champ personnel n'est stocké dans
sessionStorage. Le bouton bloque les soumissions concurrentes. Après stockage confirmé,
le formulaire est vidé uniquement si la notification est acceptée et l’accusé accepté
ou désactivé. Les échecs partiels conservent les champs. Les résultats terminaux
confirmés sont mémorisés sans données personnelles pour éviter des appels identiques
inutiles, y compris après rechargement dans la même session. `accepted` signifie accepté par
EmailJS, jamais livré dans la boîte du destinataire. Un envoi incertain n'est pas
réessayé automatiquement : vérifier manuellement le Dashboard et EmailJS avant toute
intervention. Les états `pending` peuvent être repris en rejouant la même demande ;
`attempting`, `unknown` ou `failed` ne déclenchent aucun renvoi automatique.

## Supabase — vérifications avant activation (avec accord du propriétaire)

Projet : `lxvegipzhkkujibexnkl`. Depuis Supabase Dashboard, vérifier le schéma existant
contre `supabase/migrations/202611160001_contact_requests.sql`. Ce fichier est la
référence de la migration existante, pas une nouvelle migration à réappliquer.
Ne pas exécuter CREATE TABLE sur la table déjà présente. Toute divergence doit être
corrigée par une migration ciblée, relue et approuvée avant son application.

Vérifications SQL en lecture seule dans SQL Editor :

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema='public' and table_name='contact_requests'
order by ordinal_position;
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid='public.contact_requests'::regclass;
select relname, relrowsecurity from pg_class
where oid in ('public.contact_requests'::regclass,'contact_internal.limits'::regclass);
select * from pg_policies
where tablename in ('contact_requests','limits');
select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='contact_requests';
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
and p.proname in ('contact_submit','contact_claim_email','contact_finish_email');
select p.proname, role_name,
 has_function_privilege(role_name,p.oid,'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
where n.nspname='public'
and p.proname in ('contact_submit','contact_claim_email','contact_finish_email');
```

Attendu : RLS actif ; aucune policy publique sur ces deux tables ; aucun accès direct
pour anon/authenticated/service_role ; RPC exécutables uniquement par service_role
(et rôles propriétaires), jamais anon/authenticated. Dashboard propriétaire garde
l'accès aux demandes. Champs métier : id, full_name, email, phone, request_type,
message, created_at, status (`new`, `in_progress`, `closed`). Les champs de reçu et
états d'envoi sont nécessaires aux RPC existants ; ne pas les retirer.

Vérifier la fonction déployée contre les trois fichiers dans
`supabase/functions/contact-request/`. Si différente, déploiement uniquement après
accord : `supabase functions deploy contact-request --project-ref lxvegipzhkkujibexnkl`.
`supabase/config.toml` désactive uniquement la vérification JWT de cette fonction
publique ; les RPC restent privés. Aucun secret serveur ne doit entrer dans le JS public.

Secrets/variables de la fonction à vérifier dans Dashboard > Edge Functions > Secrets :

| Nom | Valeur requise |
| --- | --- |
| CONTACT_ENABLED | `true` |
| CONTACT_ALLOWED_ORIGINS | origines exactes séparées par virgules, sans slash final : `https://agritech509ht.com`, ajouter l'origine de prévisualisation autorisée |
| CONTACT_HMAC_SECRET | conserver le secret existant, au moins 32 caractères ; ne pas le renouveler pendant les reprises |
| CONTACT_EMAIL_ENABLED | `true` |
| CONTACT_MONTHLY_EMAIL_BUDGET | entier > 0 compatible avec le quota restant du compte, par exemple `100` pour un budget contact de 100 emails/mois (2 par demande) |
| EMAILJS_CONNECTED_PROVIDER | nom réel du fournisseur connecté à service_z856n3l, lu dans EmailJS |
| EMAILJS_PROVIDER_VERIFIED | `true` après vérification du service et de l'autorisation d'appel serveur |
| EMAILJS_PUBLIC_KEY | clé publique existante de js/config.js |
| EMAILJS_PRIVATE_KEY | clé privée EmailJS du compte, serveur seulement |
| EMAILJS_SERVICE_ID | `service_z856n3l` |
| EMAILJS_NOTIFICATION_TEMPLATE_ID | `template_pzsnmea` |
| EMAILJS_LINKED_REPLY_DISABLED_VERIFIED | `true` après avoir vérifié que le template partagé n'a aucune autoréponse liée |
| EMAILJS_REPLY_TEMPLATE_ID | identifiant réel du nouveau template, fourni par EmailJS |
| EMAILJS_REPLY_VERIFIED | `true` après vérification du template distinct |

SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par le runtime Supabase.
Le budget compte uniquement les emails contact ; réserver une marge newsletter dans
le quota EmailJS partagé. Limites existantes : 30 tentatives/minute globalement,
100 nouvelles demandes/jour et 3/heure/adresse normalisée. Les origines CORS ne sont
pas une protection contre les robots ; validation, limites atomiques et budget
bornent les abus. Pas de CAPTCHA ajouté. Les demandes restent consultables si un
budget empêche les emails ; `pending` ne signifie pas envoyé.

## EmailJS — template distinct à créer (avec accord)

Ne pas inventer d'ID ni remplir autoReplyTemplateId dans js/config.js : le contact
est désormais envoyé côté fonction, une seule fois. Ne pas activer d'autoréponse
liée au template partagé avec la newsletter. Si elle existe, examiner et désactiver
cette liaison avec accord avant activation, sinon la newsletter recevrait aussi un accusé.

Créer un template utilisant le service existant :

- To Email : `{{from_email}}`.
- To Name : `{{from_name}}`.
- From Name : `Agri-tech`.
- From Email : adresse par défaut du service connecté (ne jamais mettre l'adresse du visiteur).
- Reply-To : `contact@agritech509ht.com` (vérifier le destinataire professionnel existant).
- Subject : `Confirmation de réception de votre demande — Agri-tech`.
- Aucune autoréponse liée à ce template.
- Corps (variables ordinaires échappées, sans interpolation HTML brute) :

```text
Bonjour {{from_name}},

Nous avons bien reçu votre demande concernant {{need}}.

Notre équipe prendra connaissance des informations transmises et vous contactera pour discuter de votre projet.

Merci de votre intérêt pour Agri-tech.

Cordialement,
L'équipe Agri-tech
```

Copier l'ID réel vers EMAILJS_REPLY_TEMPLATE_ID côté Supabase. Variables transmises :
from_name, from_email, phone, need, message, consent, source, SOURCE, TYPE_CONTACT,
date, request_id. Notification existante : conserver To Email professionnel fixe et
Reply-To `{{from_email}}`. Vérifier dans les réglages de sécurité EmailJS l'autorisation
des appels API serveur/non navigateur avec clé privée ; conserver les restrictions
domaines pour les appels newsletter navigateur. Vérifier aussi les quotas et limites
EmailJS ; la fonction espace ses deux envois de 1100 ms. Un appel newsletter simultané
peut encore provoquer un rejet fournisseur ; la demande reste conservée.

## Prévisualisation et test manuel unique

Vercel a généré la prévisualisation de cette branche :
https://agritech01-git-feat-communication-v12-walterdarius100s-projects.vercel.app/index.html#leadForm

Ajouter exactement `https://agritech01-git-feat-communication-v12-walterdarius100s-projects.vercel.app`
à CONTACT_ALLOWED_ORIGINS avec accord avant le test réel. Cette page utilise le
vrai endpoint Supabase ; ne rien soumettre avant vérification de la configuration
serveur et autorisation du test. Le statut Vercel Ready ne valide pas les emails.
Si Vercel affiche une protection d'accès, utiliser le compte propriétaire autorisé.
Ne pas utiliser le site officiel pour tester du code de branche. Alternative locale :

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8000/index.html#leadForm`. Pour un test réel depuis cette
origine, ajouter exactement `http://127.0.0.1:8000` à CONTACT_ALLOWED_ORIGINS avec
accord ; la retirer après le test. L'URL locale n'est pas un hébergement public.
Ne pas fusionner tant que la configuration externe n'est pas vérifiée : cette branche
ne revient pas à l'envoi seul si le stockage est indisponible.

Après configuration et accord pour ce seul test réel : soumettre une seule demande
avec vos propres coordonnées. Dans Dashboard > Table Editor > contact_requests,
vérifier nom/email/téléphone/type/message, date, statut `new`, puis les états d'envoi.
Vérifier les deux boîtes email (y compris spam) et le Reply-To de la notification.
Une acceptation API ne remplace pas cette vérification de réception. Aucun abonné
newsletter ne doit être créé. Fusionner seulement après validation de ces trois résultats.

## Tests reproductibles sans production

```sh
node --test tests/*.test.mjs
node tests/contact-browser.mjs
# PostgreSQL jetable ; téléchargement explicite de l'image au préalable :
docker pull postgres:17-alpine
node tests/contact-db.mjs
```

Les tests navigateur bloquent tout réseau externe ; Supabase et EmailJS y sont
simulés. Les tests DB utilisent un vrai PostgreSQL 17 jetable sans réseau, appliquent
la migration de référence, contrôlent privilèges/RLS/concurrence et intègrent le vrai
handler avec EmailJS simulé. Aucun test automatisé ne prouve la configuration ni la
livraison de Supabase/EmailJS en production.


## Correctif après le test réel — diagnostic des rejets

Constat établi par le code : `notification_state=failed` est enregistré uniquement
quand l'appel EmailJS reçoit HTTP 4xx. L'ancien adaptateur jetait le corps d'erreur,
ce qui empêchait d'identifier la cause. `reply_state=pending` reste bloqué tant que
la notification n'est pas `accepted` (même condition dans le handler et la RPC).
L'absence d'historique EmailJS ne permet pas d'exclure un rejet avant création d'un
email. Aucun élément disponible ne prouve à lui seul une mauvaise clé ou une
interdiction d'accès serveur. Le champ REST `accessToken` porte déjà la clé privée ;
il ne faut pas le remplacer par un champ SDK `privateKey`, ni ajouter une fausse
origine navigateur pour contourner les autorisations serveur.

L'adaptateur lit désormais au plus 4096 octets de la réponse d'erreur pour produire
un code fixe. Il ne journalise ni le texte fournisseur, ni la requête, ni les secrets,
ni les coordonnées, ni l'identifiant ou le reçu de la demande. Exemple dans
Dashboard Supabase > Edge Functions > contact-request > Logs après déploiement
**manuel approuvé** du correctif :

```json
{"event":"contact_email","kind":"notification","status":403,"code":"server_access_disabled"}
```

| Code | Vérification à effectuer une fois |
| --- | --- |
| `server_access_disabled` | EmailJS Account > Security : autoriser les appels API serveur/non navigateur ; le simple ajout d'une origine CORS Supabase ne suffit pas |
| `public_key` | EMAILJS_PUBLIC_KEY doit être la clé publique du compte propriétaire du service |
| `private_key` | EMAILJS_PRIVATE_KEY doit être la clé privée du même compte, transmise dans accessToken côté serveur uniquement |
| `authorization` | Rejet 401/403 non spécifique : vérifier clés, sécurité et autorisations du compte, sans conclure arbitrairement |
| `service` | EMAILJS_SERVICE_ID doit référencer le service connecté du même compte |
| `template` | Vérifier le template notification ou accusé selon kind, et son appartenance au compte |
| `quota` | Quota/crédits EmailJS épuisés : attendre la remise à disposition ou corriger le quota du compte |
| `rate_limit` | HTTP 429 EmailJS sans indication explicite de quota mensuel : fréquence fournisseur |
| `provider_unavailable` / `network_unknown` | Résultat incertain ; aucun renvoi automatique |
| `provider_rejected` | Autre rejet ; ne pas deviner sa cause à partir du statut seul |

Ces catégories sont des indications tirées du message fournisseur, pas une preuve
sur la configuration du compte. Elles restent dans les logs serveur, pas dans la
réponse publique. Les espaces de début/fin des variables d'environnement sont
supprimés au chargement, notamment pour les clés et identifiants collés depuis le
Dashboard. Aucun envoi de diagnostic séparé ni endpoint public supplémentaire.

Distinguer les deux limites : une réponse **HTTP 429 du formulaire** avec
`code=rate_limited` vient de contact_submit, avant EmailJS. Un 429 EmailJS produit
une demande déjà enregistrée et un log contact_email `rate_limit` ou `quota` ; la
réponse du formulaire reste HTTP 200 avec notification failed. Les limites existantes
restent : 3 nouvelles demandes/adresse/heure, 100/jour et 30 tentatives/minute.
La RPC ne précise pas quelle fenêtre est épuisée. La pause locale de 60 secondes
évite les rafales ; elle ne promet pas que la fenêtre horaire/journalière est libérée.
Modifier le message crée une nouvelle demande et consomme la limite correspondante.

Pour le propriétaire : ne pas multiplier les soumissions pour chercher la cause.
Après déploiement approuvé, utiliser un seul essai et consulter le code fixe dans
les logs pour corriger la configuration une fois. Si la limite horaire est déjà
épuisée, attendre la prochaine heure UTC (les fenêtres SQL sont fixes) ; une limite
journalière nécessite la prochaine journée UTC. Ne pas vider les compteurs ni
modifier les tables pour tester. Une demande failed existante ne sera pas renvoyée
après correction : ses réservations restent terminales pour éviter les doublons.
Après correction et disponibilité du quota, un seul nouvel essai explicitement
identifié suffit pour contrôler les deux emails. Aucun déploiement, migration,
modification de table ou envoi réel n'a été effectué pour préparer ce correctif.
