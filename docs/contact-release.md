# PR 166 — raccordement final du formulaire public

Le frontend est raccordé, dans cette PR, à :
`https://lxvegipzhkkujibexnkl.supabase.co/functions/v1/contact-request`.
`CONTACT_STORAGE_CONFIG.enabled` vaut désormais `true`. Le basculement du site
n’aura lieu qu’après fusion et publication confirmées par le propriétaire.

## Blocages corrigés et vérifications

Le code était encore en mode préparation : flag faux et endpoint vide. Le site
ne pouvait donc pas utiliser Supabase. Ces deux valeurs sont corrigées.
La configuration de dépôt de cette seule fonction passe à `verify_jwt=false`,
conformément au formulaire public et au comportement déjà observé à distance.
Ce changement de fichier ne reconfigure pas la fonction distante et ne touche
ni RLS, ni les droits des RPC, ni les autres fonctions.

Le propriétaire indique avoir appliqué la migration, déployé les trois fichiers
Edge et configuré les secrets. Aucun de ces fichiers Edge ni la migration ne
change dans cette finalisation : aucun nouveau SQL ou redéploiement requis par
le raccordement frontend.

Contrôles distants exécutés, sans coordonnées ni demande enregistrable :

- OPTIONS depuis l’origine `https://agritech509ht.com` : 204, origine/méthode et
  en-têtes CORS attendus autorisés.
- GET sans JWT : 405 `method`, réponse du handler et non rejet JWT.
- POST `{}` sans JWT : 400 `invalid`. Cette requête s’arrête à la validation,
  avant tout appel base/email dans le handler. Aucun vrai formulaire soumis.

Ces réponses confirment l’accès public au handler, l’origine autorisée et le
passage des verrous de configuration précédant la validation. Elles ne prouvent
ni l’écriture en base ni la configuration EmailJS. Aucun secret n’a été lu ou
modifié. Aucun paramètre distant n’a été changé, notamment Verify JWT.
La lecture du site lui-même est bloquée depuis cet environnement par le proxy
(CONNECT 403) ; ce refus n’établit pas une panne du site. Le parcours publié
complet sera testé par le propriétaire après publication.

## EmailJS et protections conservés

Le contact est stocké avant les emails. Il n’existe aucun repli navigateur vers
EmailJS/Sheets si Supabase échoue. Les reçus, verrous, limites et réservations
uniques restent inchangés. La newsletter garde son circuit indépendant.

Le fournisseur relié à EmailJS et les templates effectifs ne sont pas visibles
depuis le dépôt ni les sondes publiques. Aucune indépendance de Zoho ou réception
d’email n’est revendiquée. Les flags vérifiés et clés privées restent côté Edge.
Notification autorisée uniquement avec configuration complète, fournisseur et
absence de réponse liée vérifiés et budget contact positif. Autoréponse distincte
uniquement si son vrai template est configuré/vérifié ; jamais d’identifiant
inventé ou de réponse liée activée implicitement. Une configuration email
manquante n’empêche pas la conservation de la demande, mais ne donne pas de
confirmation email. Les quotas newsletter du même compte ne sont pas couverts
par la limite contact.

Si les secrets email ne sont pas déjà complets, le propriétaire doit confirmer
les réglages suivants avant de les modifier : `CONTACT_EMAIL_ENABLED=true`,
`EMAILJS_PROVIDER_VERIFIED=true`, fournisseur réel dans
`EMAILJS_CONNECTED_PROVIDER`, clés publique/privée et service/template notification
existants, `EMAILJS_LINKED_REPLY_DISABLED_VERIFIED=true`, budget mensuel contact
positif adapté au quota partagé. Pour la réponse uniquement : vrai
`EMAILJS_REPLY_TEMPLATE_ID` distinct et `EMAILJS_REPLY_VERIFIED=true` après
vérification To/Reply-To. Aucun flag de vérification ne remplace ces vérifications.

## Validation technique de cette finalisation

100 tests Node réussis. Chromium utilise maintenant la configuration de livraison
sans modifier son flag ni son URL pour tester le nouveau parcours ; seule la
réponse distante est simulée. L’ancien chemin désactivé explicitement dans le
test et la newsletter sont également vérifiés. PostgreSQL jetable sans réseau :
droits, concurrence, stockage, quotas, commit perdu et reprise sans doublons.
Deno sans réseau : type-check de l’entrée, aucun serveur démarré. Régressions
Chromium SEO et administration simulée, syntaxe et diff contrôlés.
Aucun email réel ni écriture Supabase/Apps Script de production pendant ces tests.

## Dernières étapes — sans scripts supplémentaires

1. Confirmer la fusion de la PR 166 et la publication du site.
2. Seulement si les emails ne sont pas déjà configurés : confirmer les réglages
   EmailJS/flags Edge ci-dessus. L’accès public Supabase et CORS sont déjà
   observés fonctionnels ; aucun nouveau changement JWT n’est demandé.
3. Envoyer une seule demande avec les coordonnées du propriétaire depuis
   `https://agritech509ht.com/index.html#leadForm` ; le message doit confirmer
   l’enregistrement, puis vérifier la notification et la réponse si activées.

Aucune fusion ni publication effectuée par Codex. Les modifications de
configuration de production restent à confirmer par le propriétaire.
