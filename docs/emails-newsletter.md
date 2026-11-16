# Chantier 04 — audit et fiabilisation V1.2

## A. État initial démontré dans le dépôt

PR 165 fusionnée sur GitHub : commit `6c544022be23f8ca065705419eb83418b66b6281`,
présent au sommet de `origin/main` vérifié avant création de branche.

`js/app.js` gérait le contact de l’accueil et sa newsletter ;
`js/pages/footer-newsletter.js` recopiait le traitement sur les six autres
pages publiques. Aucun double chargement des deux gestionnaires dans les HTML
actuels. Les formulaires admin utilisent Supabase, sans EmailJS : hors chantier.
Le seul template appelé était `template_pzsnmea` sur `service_z856n3l` pour le
contact ET la newsletter. `autoReplyTemplateId` vide : aucune autoréponse active.
Le destinataire professionnel est documenté comme `contact@agritech509ht.com`,
non codé dans le payload : seul le tableau de bord peut le confirmer.

Contact : nom, email, téléphone nettoyé, besoin, message (ou texte formation),
consentement au recontact, source, type et date ISO. Newsletter : email,
nom générique et textes fixes newsletter, consentement artificiellement « Oui ».
Après EmailJS, les deux tentaient le même endpoint Apps Script existant via
POST URLSearchParams en `no-cors`. Aucun code Apps Script ni schéma de feuille
n’est présent. Aucune preuve de stockage, de dédoublonnage, de consentement
persisté ou de désinscription automatique. La politique mentionne une demande
d’arrêt auprès d’Agri-tech, sans mécanisme automatisé démontré.

## B. Problèmes

Le succès API EmailJS ne prouve pas la livraison. L’autoréponse future partageait
le try/catch principal : un échec secondaire aurait incité à renvoyer la demande.
Le throttle global pouvait bloquer le deuxième email immédiat. Apps Script
avalait ses erreurs ; une réponse opaque était traitée comme un stockage réussi.
La newsletter annonçait une inscription confirmée, puis effaçait l’adresse.
Aucun verrou logique ni mémorisation des opérations acceptées. Les boutons seuls
ne protégeaient pas des soumissions programmatiques/concurrentes. Les erreurs
externes pouvaient contenir des données personnelles dans les logs.

## C. Modifications

- `js/components/contact-form.js` : service partagé, notification prioritaire,
  autoréponse verrouillée, résultats distincts, erreurs sans données personnelles,
  stockage explicitement non confirmé, timeout réseau de quinze secondes.
- `js/app.js` : verrou de soumission, champs conservés, messages persistants
  exacts, restauration des boutons/aria-busy, suppression du reset différé.
- `js/components/newsletter-form.js` et `js/pages/footer-newsletter.js` : même
  traitement pour les sept pages, garde contre une double initialisation,
  validation/consentement, aucun reset et aucune fausse réussite.
- Sept HTML : case newsletter obligatoire non précochée, lien confidentialité
  et information sur la demande de désinscription.
- `js/config.js` : verrou explicite d’autoréponse, texte historique corrigé.
- Tests unitaires et Chromium isolés ; guides actualisés.

## D. Accusé de réception

Voir `../EMAILJS_GUIDE.md` : variables, exemple français, destinataire, Reply-To,
origines autorisées, désactivation d’une éventuelle réponse liée déjà existante.
Aucun nouveau template ni destinataire externe activé. Même si l’API de réponse
échoue après notification acceptée, le visiteur est invité à ne pas renvoyer.

## E. Newsletter et consentement

L’infrastructure reste EmailJS puis Apps Script existant. La case explicite
est validée avant toute transmission. Le payload inclut `consent: Oui`,
`consent_text`, `consent_version: newsletter-v1`, date ISO et source. Ce sont des
éléments transmis, pas une preuve conservée : le script externe peut les ignorer.
Contact et newsletter sont distincts ; aucun abonnement implicite depuis contact.
L’adresse reste affichée pour permettre sa correction. Une notification acceptée
est mise en mémoire ; une deuxième soumission identique ne renvoie rien.

## F. Tests

`node --test tests/*.test.mjs` : anciens contrôles publication, sauvegarde et SEO,
plus simulations notification, autoréponse, configuration absente/non vérifiée,
concurrence, nouvelle tentative, panne réseau/stockage et réponse opaque.
`node tests/forms-browser.mjs` : contact valide/incomplet/email invalide, double
soumission, erreur puis tentative réussie, champs conservés, boutons restaurés ;
newsletter accueil et page secondaire : email, consentement, échec Apps Script,
non-confirmation et dédoublonnage. Tous les services externes sont bloqués ;
EmailJS et lectures d’articles simulés. Aucun email réel ni écriture externe.

## G. Actions manuelles nécessaires

1. Vérifier dans EmailJS la notification existante et les réglages décrits dans
   le guide ; préparer l’autoréponse distincte sans l’activer sans validation.
2. Inspecter le code et le déploiement Apps Script : feuille cible, permissions,
   conservation réelle des champs de consentement, gestion d’erreur et quotas.
3. Pour une confirmation fiable, le propriétaire doit faire exposer par
   l’infrastructure existante une réponse lisible par le navigateur après
   écriture effective, corrélée à une demande, avec dédoublonnage atomique et
   contrôle des entrées/anti-abus. Vérifier les capacités CORS réelles du
   déploiement Apps Script, y compris les redirections : un simple JSON retourné
   ne suffit pas. Tant que cela n’est pas prouvé, garder la non-confirmation.
   Aucun passage automatique à `cors`, proxy, fournisseur ou table Supabase.
4. Vérifier une politique opérationnelle d’abonnement, conservation du consentement
   et suppression à la demande. Confirmation d’adresse/double opt-in et lien de
   désinscription restent des dépendances à mettre en place avant exploitation
   d’une liste fiable ; ils ne sont pas fournis ici.

## H. Risques restants

Le frontend ne garantit pas une transaction ni l’idempotence de systèmes externes.
Une erreur réseau peut cacher une opération acceptée. Les tentatives après échec
principal restent possibles avec avertissement, sans nouvelle tentative automatique.
Le verrou mémoire couvre les appels concurrents de la page. Des empreintes
SHA-256 salées par session et les seuls états des opérations acceptées sont
conservés dans sessionStorage pour couvrir navigation et rechargement dans le
même onglet. Aucun champ brut n’y est conservé. Si le stockage navigateur est
refusé ou la cryptographie indisponible, seul le verrou mémoire reste actif.
Autres onglets, appareils et nouvelles sessions exigent une déduplication externe.
Les empreintes sont des données pseudonymisées, pas une anonymisation garantie.
Les états enregistrés avant les opérations secondaires empêchent leur renvoi
après navigation, même si l’autoréponse ou le stockage sont restés incertains.

La notification principale conservée permet une vérification manuelle par
Agri-tech ; elle ne garantit ni abonnement ni livraison. Si EmailJS échoue,
Apps Script n’est pas tenté, afin de préserver le circuit actuel et limiter les
états partiels : l’interface ne confirme rien. Si Apps Script échoue après la
notification, l’inscription reste non confirmée et la notification n’est pas
renvoyée dans le même onglet si sessionStorage est disponible. Pour contact, le stockage auxiliaire non confirmé
n’annule pas la notification acceptée. Aucun changement RLS, hébergement, CRM,
administration ou coût. Aucun déploiement ni fusion.

Résultats exécutés : 53 tests automatisés réussis ; contrôles Chromium formulaires,
SEO et administration réussis. Syntaxe des modules modifiés et `git diff --check`
validés. Le contrôle formulaires couvre aussi le rechargement dans le même onglet
sans nouvel envoi et l’absence des emails bruts dans sessionStorage.

## I. Livraison Git

Branche indépendante : `fix/emails-newsletter-fiabilite`, issue du dernier `main`
contenant la fusion de la PR 165. Livraison en PR Draft vers `main` ; identifiant
et commit consignés dans le rapport de livraison du chat. Configuration externe
à vérifier avant activation ; aucune fusion ni aucun déploiement demandé.

## Ajustement d’architecture demandé après cette livraison

Le stockage prioritaire des demandes dans Supabase et la conservation d’EmailJS
font l’objet d’un [audit et d’une proposition à valider](contact-requests-architecture.md).
Le comportement décrit ci-dessus reste celui du code actuel. Le futur parcours
Supabase n’est ni implémenté ni activé ; SQL de production, déploiement Edge et
basculement frontend attendent des validations distinctes.
