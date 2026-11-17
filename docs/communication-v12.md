# Communication V1.2 — navigateur EmailJS et stockage Supabase

## Choix retenu et comparaison

| | Navigateur retenu | Correction minimale serveur |
| --- | --- | --- |
| Notification | SDK EmailJS public qui fonctionnait avant le chantier | REST EmailJS avec clé privée et accès API serveur autorisé |
| Configuration EmailJS dans Edge | Aucune clé ni identifiant EmailJS nécessaire | Clés publique/privée, service, templates et vérifications serveur existantes |
| Stockage et réservations | Edge et RPC privés existants | Identiques |
| Fiabilité après fermeture de l'onglet | Les envois restants peuvent être interrompus | L'exécution Edge peut finir sans l'onglet, dans les limites du runtime |
| Statuts email dans la base | Rapportés par le navigateur, pas une attestation serveur du fournisseur | Rapportés par Edge d'après la réponse fournisseur |
| Appels Edge habituels | 5 : stockage puis réservation/confirmation de chacun des 2 emails | 1 soumission |
| Templates/quota | 1 notification partagé avec newsletter + 1 accusé distinct ; 2 envois/contact complet | Même besoin en templates et quota |

Le navigateur est retenu pour retrouver le chemin public connu et éviter de dépendre
de l'accès serveur EmailJS actuellement non confirmé. Il ne garantit pas la livraison.
La correction minimale serveur consisterait à conserver le code REST, confirmer
l'autorisation des appels non navigateur dans EmailJS Account > Security et vérifier
les deux clés du même compte. `accessToken` est déjà le champ REST de clé privée ;
le renommer en `privateKey` ou simuler un Origin navigateur ne corrige pas cette autorisation.
Un état failed établit un HTTP 4xx, sans prouver la cause exacte. L'absence d'historique
EmailJS n'exclut pas un rejet avant création d'un email.

Le mode serveur reste disponible explicitement (`CONTACT_EMAIL_TRANSPORT=server`)
pour cette alternative. Aucun basculement automatique ni envoi par les deux chemins.
Les diagnostics serveur sûrs du correctif précédent restent disponibles dans ce mode.

## Parcours et protections

1. Le formulaire valide les champs, le consentement et le piège antirobot existants.
2. Edge enregistre la demande dans contact_requests avant tout email.
3. Le navigateur demande une réservation atomique notification à la même fonction.
4. Une réservation confirmée autorise un unique appel SDK navigateur au template
   administration existant : `service_z856n3l` / `template_pzsnmea`.
5. Le navigateur rapporte accepted/failed/unknown à la fonction, sans toucher directement
   aux tables. Accepted signifie réponse 200 du SDK, pas livraison effective.
6. Après notification accepted, l'accusé distinct peut réserver son propre envoi.
   Sa configuration, son absence ou son échec ne bloque jamais la notification administrative.

L'accusé est indépendant par son template, sa réservation et sa gestion d'erreur.
Il reste conditionné à l'acceptation de la notification par la RPC existante ; il ne
part donc pas si la notification échoue. Lever aussi cette condition nécessiterait
une modification SQL : elle n'est pas ajoutée à ce correctif de simplification.

Aucune table supprimée ou modifiée, aucune migration exécutée. Les trois RPC existantes
contact_submit/contact_claim_email/contact_finish_email sont réutilisées avec leurs
privilèges serveur et reçus opaques. Le fichier de migration présent dans la branche
reste la référence historique ; ne pas le réappliquer. Les coordonnées ne sont jamais
stockées dans sessionStorage ni dans les logs de diagnostic.

Chaque action vérifie le reçu, les mêmes champs et leur empreinte via contact_submit.
Les limites existantes restent 3 nouvelles demandes/adresse/heure, 100/jour et 30
appels de soumission/minute ; les actions réservation/confirmation comptent dans ce
dernier plafond. Le créneau global de 1100 ms et le budget mensuel réservent chaque
tentative atomiquement, avant le SDK. Le SDK contact utilise un délai de 1100 ms
pour ne pas hériter de l'ancien plafond local de 10 secondes entre les deux emails.
Le budget compte les réservations, même si le navigateur ferme avant l'envoi :
choix conservateur pour protéger le quota.

Un double clic est bloqué et les requêtes identiques partagent la même opération.
Les reçus et résultats terminaux sont réutilisés en session ; une reprise ne crée
pas de ligne ni d'envoi supplémentaire. Les envois attempting/unknown/failed ne sont
jamais retentés automatiquement, même si l'onglet a fermé avant l'appel SDK : choix
pour éviter les doublons. Une réservation refusée ou un SDK absent laisse pending,
sans email ; une reprise ultérieure peut continuer les seuls envois non réservés.
Après HTTP 429, une pause locale de 60 secondes évite les rafales. Elle ne garantit
pas la fin de la fenêtre horaire/journalière. Ne pas vider les compteurs pour tester.

Les restrictions de domaine EmailJS, son quota et ses protections restent indispensables :
un attaquant disposant des identifiants publics peut tenter d'appeler EmailJS directement,
en dehors de notre parcours. La réservation Supabase ne constitue pas un jeton vérifiable
par EmailJS. CORS n'est pas une authentification de robot. Les statuts rapportés par un
navigateur ne prouvent pas que le fournisseur a accepté le message. Le mode serveur
constitue la meilleure alternative si cette attestation et ce contrôle sont prioritaires.

## Templates disponibles et newsletter

La newsletter conserve strictement son code, son template actuel et son chemin SDK.
Le contact ne crée aucun abonné newsletter. Ne jamais lier une autoréponse à
`template_pzsnmea`, partagé avec les inscriptions : elle partirait aussi aux abonnés.

Le quota de templates est distinct du quota d'envois. Le nombre actuel de templates,
le forfait et les consommations du compte n'ont pas pu être inspectés depuis cet
espace de travail ; aucune capacité supplémentaire n'est supposée. Consulter EmailJS
Dashboard > Email Templates et le forfait/usage du compte. Si le forfait autorise
2 templates, le template partagé et un seul accusé distinct suffisent, à condition
que ce second emplacement soit disponible. Si les emplacements sont déjà occupés,
réutiliser un template d'accusé compatible avec votre accord ou adapter le forfait.
Ne pas supprimer ni détourner un autre template. Sans emplacement, la notification
et le stockage fonctionnent ; l'accusé reste désactivé explicitement.

Un contact complet consomme 2 envois, une newsletter 1. Le budget contact Supabase
ne connaît pas la consommation newsletter. Garder une marge sur le quota EmailJS
réel ; aucune limite chiffrée de forfait n'est présumée. Un envoi newsletter simultané
peut encore provoquer un rejet fournisseur malgré les réservations contact.
Références à vérifier selon le compte : https://www.emailjs.com/pricing/ et
https://www.emailjs.com/docs/ (SDK navigateur, auto-reply et sécurité).

## Configuration finale, après accord et avant un seul test réel

Aucun déploiement Edge ni changement du compte EmailJS effectué pour ce correctif.
Une mise à jour de la fonction est nécessaire : le frontend exige la réponse
`transport=browser` et une réservation confirmée. Une ancienne fonction serveur
sans cette réponse ne provoque aucun second envoi navigateur.

Valeurs Edge nécessaires au mode retenu :

| Variable | Valeur |
| --- | --- |
| CONTACT_ENABLED | `true` |
| CONTACT_EMAIL_TRANSPORT | `browser` (également le défaut du nouveau code) |
| CONTACT_ALLOWED_ORIGINS | origines exactes existantes et origine de prévisualisation, sans slash final |
| CONTACT_HMAC_SECRET | conserver le secret existant, au moins 32 caractères |
| CONTACT_MONTHLY_EMAIL_BUDGET | conserver ou ajuster au quota disponible, entier positif ; exemple documentaire 100 réservations, pas une garantie sur votre forfait |
| CONTACT_BROWSER_REPLY_ENABLED | `false` tant que le template client manque ; `true` quand il est configuré |

SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY restent fournis par le runtime. Aucune
clé privée EmailJS, EMAILJS_PROVIDER_VERIFIED ou autre secret EmailJS n'est requis
pour le mode navigateur ; les anciennes valeurs peuvent rester inutilisées. Les
retirer du compte n'est pas nécessaire au test et n'est pas fait automatiquement.

Dans js/config.js, conserver publicKey, serviceId et templateId existants. Renseigner
`EMAILJS_CONFIG.autoReplyTemplateId` uniquement avec l'ID réel du template client,
différent de template_pzsnmea. Aucun ID n'a été inventé : cette valeur reste vide.
Vérifier que le template notification n'a pas d'autoréponse liée. Son destinataire
professionnel reste inchangé ; Reply-To `{{from_email}}`.

Template client distinct :

- To Email : `{{from_email}}` ; To Name : `{{from_name}}`.
- From Name : `Agri-tech` ; From Email : adresse par défaut du service connecté.
- Reply-To : adresse professionnelle existante (`contact@agritech509ht.com` selon le guide du dépôt).
- Objet : `Confirmation de réception de votre demande — Agri-tech`.
- Aucune autoréponse liée. Corps avec variables ordinaires échappées :

```text
Bonjour {{from_name}},

Nous avons bien reçu votre demande concernant {{need}}.
Notre équipe prendra connaissance des informations transmises et vous contactera pour discuter de votre projet.
Merci de votre intérêt pour Agri-tech.

Cordialement,
L'équipe Agri-tech
```

Variables disponibles : from_name, from_email, phone, need, message, consent, source,
SOURCE, TYPE_CONTACT, date, request_id. Ne pas utiliser d'interpolation HTML brute.

Prévisualisation :
https://agritech01-git-feat-communication-v12-walterdarius100s-projects.vercel.app/index.html#leadForm

Origine à autoriser dans Supabase et EmailJS :
`https://agritech01-git-feat-communication-v12-walterdarius100s-projects.vercel.app`.
Conserver aussi `https://agritech509ht.com`. La prévisualisation doit utiliser la
fonction mise à jour avant validation du mode navigateur. Le déploiement automatique
du frontend par l'intégration Vercel ne déploie pas Edge et ne valide pas les emails.

Après configuration approuvée, faire une seule nouvelle demande avec vos coordonnées,
puis vérifier sa ligne Supabase et la réception réelle dans les deux boîtes. Le reçu
existant est conservé ; une ancienne ligne failed n'est pas relancée automatiquement.
Après des essais répétés, attendre la prochaine heure UTC si les 3 demandes/adresse
ont été consommées (ou le prochain jour UTC si plafond journalier atteint).
Ne pas multiplier les modifications de message pour tenter de contourner la limite.

## Alternative serveur : configuration existante

Pour choisir explicitement server, conserver les variables historiques :
CONTACT_EMAIL_ENABLED=true, EMAILJS_PROVIDER_VERIFIED=true,
EMAILJS_CONNECTED_PROVIDER=nom réel vérifié, EMAILJS_PUBLIC_KEY,
EMAILJS_PRIVATE_KEY (serveur uniquement), EMAILJS_SERVICE_ID=service_z856n3l,
EMAILJS_NOTIFICATION_TEMPLATE_ID=template_pzsnmea,
EMAILJS_LINKED_REPLY_DISABLED_VERIFIED=true ; EMAILJS_REPLY_TEMPLATE_ID=ID réel
et EMAILJS_REPLY_VERIFIED=true uniquement si l'accusé est prêt. Le mode server
ignore les actions navigateur ; aucun envoi ne peut être demandé par les deux chemins.
Ne pas changer de transport au milieu d'une demande dont un envoi est attempting.

## Validation isolée

`node --test tests/*.test.mjs` couvre les deux transports, les réservations, les
pannes SDK, l'accusé absent/invalide, les reçus, les limites et les diagnostics sûrs.
`node tests/contact-browser.mjs` teste le vrai formulaire et les deux envois SDK
simulés, avec réseau externe bloqué. Aucun email réel ni donnée de production modifiée.
Les vérifications PostgreSQL antérieures restent pertinentes pour les RPC inchangées ;
aucune migration n'a été réexécutée pendant ce correctif.
