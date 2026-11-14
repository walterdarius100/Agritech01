# Chantier 02 — Images et sauvegarde

Base vérifiée : `origin/main` à `6f65a1c` (fusion de la PR 163), copie initiale
à `7e903be`, propre avant création de `fix/admin-reliable-uploads`.

## Avant et après

Avant : pas de verrou de sauvegarde, contenu lu avant la fin des uploads,
champ fichier conservé, contexte d’erreur choisi selon la présence d’un fichier,
et ancienne une retirée avant confirmation de la nouvelle.

Après : verrou commun aux sauvegardes et actions de liste, champs et éditeur
bloqués pendant la sauvegarde, boutons explicites et restaurés en `finally`.
TinyMCE termine ses uploads avant la lecture du contenu ; les échecs,
interruptions et délais dépassant 60 secondes bloquent l’écriture. Les images
`blob:` ou `data:` encore présentes bloquent aussi la sauvegarde, y compris en
mode textarea. Le contenu n’est jamais réinitialisé par un échec.

Le fichier de couverture est vidé dès l’upload confirmé et son URL reste dans
le formulaire : une erreur Database peut être corrigée sans réenvoyer ce fichier.
Changer d’article vide aussi le champ fichier. L’ID est conservé immédiatement
après une écriture confirmée, même si la mise à la une ou le rafraîchissement
échoue. Une réponse de création incertaine bloque une nouvelle insertion dans
le même formulaire : consulter la liste et rechercher le slug avant de rouvrir
l’article ou de démarrer volontairement une nouvelle création.

La mise à la une écrit d’abord l’article cible puis retire les autres sélections.
Un échec secondaire remonte l’article déjà enregistré. L’action de liste utilise
une mise à jour limitée à `featured`, sans réécrire une copie ancienne du contenu.
Les états publication/archivage/une sont reportés dans le formulaire ouvert pour
le même article. La suppression confirmée de cet article réinitialise le formulaire.

## Validation

JPEG (`jpg`, `jpeg`), PNG, WebP et GIF : MIME exact, extension cohérente et
signature binaire du format, maximum **4 Mio = 4 194 304 octets**.
GIF reste accepté pour compatibilité avec les usages existants, dont les images
animées. SVG et les autres formats sont refusés pour les nouveaux uploads.
Les images déjà stockées restent intactes. Le nom fourni séparément par TinyMCE
est conservé lors de la conversion du Blob en File. Les chemins utilisent des
UUID pour éviter les collisions entre uploads simultanés.

Ce contrôle navigateur ne remplace ni une validation serveur ni un décodeur
complet : une signature correcte ne garantit pas un fichier sain. Les règles
RLS et la configuration Storage restent inchangées.

## Échecs partiels et limites

- Couverture envoyée puis Database en échec : URL conservée pour réutilisation.
- Certaines images du contenu réussies puis échec : URL réussies conservées dans
  TinyMCE, enregistrement bloqué jusqu’à résolution des images restantes.
- Écriture confirmée puis étape secondaire en échec : message de réussite partielle,
  ID retenu, prochaine sauvegarde effectuée en modification.
- Session expirée : message de reconnexion, contenu conservé. Une réponse perdue
  d’INSERT peut cacher une écriture réussie ; aucun retry automatique.

Aucune suppression Storage automatique : le navigateur ne peut pas prouver
l’absence de références dans tous les contenus. Un abandon, une réponse Storage
perdue ou une fermeture de page peut donc laisser des fichiers orphelins. Un
nettoyage sûr demanderait un inventaire des références et une validation serveur.
Le délai TinyMCE ne prétend pas annuler le transfert réseau : il peut finir plus
tard ; attendre sa résolution avant de réessayer.

Le verrou s’applique à cette page, pas aux autres onglets/utilisateurs. La mise
à la une comporte deux écritures, sans transaction : plusieurs unes peuvent
subsister si le nettoyage échoue ou si deux administrateurs agissent ensemble.
Une garantie globale demanderait une contrainte/RPC serveur hors périmètre.

## Vérifications

`node --test tests/*.test.mjs` exécute les tests Node avec Supabase, Storage,
éditeur et DOM simulés, y compris la suite de la PR 163. Aucune donnée externe.
Le workflow existant exécute désormais toutes ces suites.

`node tests/admin-browser.mjs` est un contrôle facultatif nécessitant Playwright
et Chromium (`CHROMIUM_PATH` pour adapter le chemin). Il sert le site localement,
remplace le client Supabase, bloque les requêtes externes sauf les bibliothèques
publiques de jsDelivr, et utilise le vrai TinyMCE. Il contrôle création,
modification avec le même ID, échec Database, contenu conservé et bouton réactivé.
Aucun upload, écriture ou suppression Supabase de production n’est effectué.
