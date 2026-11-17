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
le formulaire est vidé même si les emails échouent. `accepted` signifie accepté par
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

Aucune URL de déploiement de branche n'est configurée dans les workflows du dépôt.
Ne pas utiliser le site officiel pour tester du code de branche. Servir cette branche
avec l'hébergement de prévisualisation habituel, ou localement :

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
