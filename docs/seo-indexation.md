# Chantier 03 — SEO et indexation Agri-tech V1.2

## A. État initial vérifié

Dépôt `walterdarius100/Agritech01`, branche distante par défaut `main`.
Le 16 novembre 2026, HEAD distant et copie Cloud :
`d4e17aa63611e5865b853dff01af0907b19bcdc4` (fusion PR 164).
La PR 163 (`6f65a1c`) et la PR 164 sont présentes dans cet historique.
Copie initiale propre ; branche dédiée créée depuis `origin/main` après fetch.

Constats confirmés :
- Les six pages fixes publiques ont déjà des titres et descriptions uniques,
  canonical correctes, langue française, un H1 puis des H2/H3 cohérents.
- Les images HTML fixes ont des attributs alt ; les logos accompagnés du nom
  et les répétitions décoratives ont un alt vide. Les cartes dynamiques utilisent
  leur titre. Le texte alternatif des images éditoriales dépend de la saisie :
  aucune description technique n'est inventée par ce chantier.
- L'article avait une canonical générique sans slug dans le HTML initial,
  remplacée après chargement, et conservait `index, follow` dans les erreurs.
- Titre, description, H1 spécifiques et vrais liens vers les articles liés
  existaient déjà. Le service Supabase impose les publications depuis la PR 163.
- Le sitemap ne contient que six pages fixes, avec la même date lastmod sans
  preuve d'une modification de chacune de ces pages à cette date.
- Les liens accueil → formations ciblent trois identifiants inexistants.
- L'administration possède déjà noindex. robots.txt autorise les ressources
  et référence correctement le sitemap ; aucune correction nécessaire.

## B. Modifications et fichiers

- `article.html` : retrait de la canonical générique ; aucune directive noindex
  globale initiale, qui risquerait d'empêcher le rendu des publications.
- `js/pages/article-page.js` : canonical créée après lecture publiée réussie,
  noindex pour les absences confirmées et sans slug ; index/follow lors des pannes ; retrait de canonical/schema dans les deux états ; titre
  et description d'erreur explicites ; JSON-LD Article uniquement pour une
  publication chargée. Le code social existant est conservé à l'identique.
- `js/data/formations.js`, `js/pages/formations-page.js` : identifiants stables
  sur les trois cartes ciblées et navigation au fragment après leur insertion.
- `sitemap.xml` : conservation des six URL, suppression des dates non prouvées
  et des indications facultatives changefreq/priority sans valeur établie.
- `tests/seo.test.mjs`, `tests/seo-browser.mjs`, `tests/README.md` : contrôles
  statiques et navigateur isolé. Architecture et parcours commerciaux conservés.

## C. Inventaire et politique d'indexation

Toutes les pages HTML du dépôt sont couvertes ci-dessous.

| Page / état | Indexable | Sitemap actuel | noindex | Canonical | Authentification |
|---|---|---|---|---|---|
| `/` (`index.html`) | Oui | Oui | Non | `/` | Non |
| `/services.html` | Oui | Oui | Non | Elle-même | Non |
| `/formations.html` | Oui | Oui | Non | Elle-même | Non |
| `/actualites.html` | Oui | Oui | Non | Elle-même | Non |
| Actualités avec page/category | Oui, variantes | Non | Non | Liste principale, existante | Non |
| `/mentions-legales.html` | Oui | Oui | Non | Elle-même | Non |
| `/politique-confidentialite.html` | Oui | Oui | Non | Elle-même | Non |
| `/article.html?slug=…`, publié | Oui après rendu | Oui après génération manuelle | Non | Slug publié, sans tracking | Non |
| Article absent, brouillon, archivé ou sans slug | Non après rendu | Non | Oui | Aucune | Lectures privées : RLS/auth |
| Erreur technique de lecture | Pas de demande de désindexation | Liste précédente conservée | Non | Aucune non vérifiée | Non |
| `/admin.html` | Non | Non | Oui, existant | Non nécessaire | Oui, Auth + RLS existants |
| Test/prévisualisation | Aucune page dédiée trouvée | Non | À imposer si ajout | Non | Oui si contenu privé |

Les pages légales sont conservées dans le sitemap : informations publiques
utiles à la transparence, déjà indexables, sans motif établi pour les exclure.
Les données privées doivent être protégées côté Supabase ; robots et noindex
ne sont jamais une protection. Les scripts de test dans `tests/` ne sont pas
des pages de prévisualisation ni des données de production.

## D. Sitemap : stratégie manuelle validée le 16 novembre 2026

L'option 1 est implémentée dans `scripts/generate-sitemap.mjs`, sans dépendance,
serveur ou workflow supplémentaire. Node.js 24 est utilisé ponctuellement.
Le script importe la configuration publique existante ; seules les clés
publishable et les JWT de rôle anon sont acceptés, avant toute requête.
Les JWT sont ensuite vérifiés par Supabase ; leur décodage local n'est pas
une validation cryptographique. Aucun utilisateur n'est connecté. Les seuls
appels sont des GET REST, soumis aux politiques RLS publiques existantes.
Aucune clé privilégiée, aucune écriture et aucun fallback JSON.

Lecture des champs id/slug/status, filtre published, tri stable par id, pages de
500 et `Prefer: count=exact`. Les plafonds serveur plus petits sont acceptés
en avançant selon la plage effectivement reçue. Chaque plage, longueur, total,
statut et identifiant est contrôlé. Une deuxième lecture complète doit renvoyer
exactement les mêmes id/slugs ; les incohérences interrompent la génération.
Les slugs sont encodés sans transformation, les URL XML échappées et dédupliquées.
Aucune date lastmod n'est ajoutée. Les six URL fixes restent en tête.
Les limites XML (50 000 URL et 50 Mio) sont vérifiées.

Le fichier temporaire est écrit dans le même répertoire puis renommé atomiquement
seulement après toutes les validations. Une panne, réponse invalide ou lecture
incomplète détectée conserve le fichier existant. Le script refuse les
redirections et impose un délai de 30 secondes par requête.

### Procédure après publication, dépublication ou suppression

1. Terminer les changements éditoriaux dans l'administration habituelle ; éviter
   les modifications simultanées pendant la génération.
2. Depuis la racine du dépôt, sur une branche de travail, exécuter explicitement :

   ```sh
   node scripts/generate-sitemap.mjs --generate
   git diff -- sitemap.xml
   node --test tests/*.test.mjs
   ```

   `--generate` effectue de vraies lectures publiques du Supabase configuré.
   Sans cet argument, aucune requête n'est effectuée. Le sitemap est écrit à la
   racine du dépôt, quel que soit le répertoire courant du terminal.
3. Vérifier les ajouts et retraits dans le diff : chaque génération reconstruit
   toute la liste ; les articles dépubliés, archivés ou supprimés disparaissent.
   En cas d'échec, garder l'ancien fichier et relancer après résolution ; ne pas
   remplacer manuellement par une liste partielle. Une liste publiée vide avec
   total exact zéro est valide et ne conserve que les six pages fixes.
4. Enregistrer le sitemap dans une PR, faire valider le diff, puis appliquer le
   processus de fusion/déploiement autorisé du site. La commande ne pousse,
   fusionne ni déploie rien. En l'absence de changement de liste, aucun commit
   sitemap n'est nécessaire. Après mise en ligne, contrôler Search Console.

Le générateur n'a PAS été exécuté contre la production dans ce chantier.
Les tests injectent des réponses simulées et écrivent dans des dossiers temporaires.

Limites : REST paginé n'offre pas de snapshot transactionnel entre requêtes.
Deux lectures identiques détectent de nombreux changements concurrents sans
pouvoir garantir l'absence de toute course (y compris après la dernière lecture).
Une RLS mal configurée qui masque des articles peut fournir un total cohérent
mais incomplet ; aucun accès public ne peut détecter les lignes invisibles.
Ne pas changer RLS pour contourner cela : vérifier humainement le diff, notamment
un retrait massif inattendu. Le fichier reste périmé jusqu'à la prochaine
exécution et mise en ligne ; cette discipline manuelle est nécessaire.

## E. Articles : gains et limites

Les métadonnées SEO spécifiques existantes sont maintenues. La canonical ne
pointe plus tous les articles vers le même shell HTML avant lecture. Les absences confirmées
rendent noindex sans proposer une URL canonique d'article absent. Les erreurs
techniques conservent index/follow sans canonical ni schema non vérifiés. Les brouillons
et archives restent refusés par le service existant, sans fallback JSON.

Le JSON-LD utilise titre, description, auteur disponible, URL et image fournie
valide (pas d'image de remplacement présentée comme éditoriale). Dates omises :
le modèle normalisé remplace parfois la publication par created_at ; la portée
éditoriale de updated_at n'a pas été établie. Aucune date n'est inventée.
La sérialisation JSON échappe `<` et l'insertion utilise textContent.

Le rendu reste JavaScript : aucune garantie d'exploration, d'indexation ni de
résultat enrichi. Sans exécution JS, le HTML générique conserve index/follow et
n'a pas de canonical spécifique, de H1 d'article ni de données structurées.
Une erreur de chargement du module empêche aussi l'application de noindex.
L'hébergement statique renvoie généralement HTTP 200 même pour un slug absent
(soft 404) ; noindex n'est pas un vrai statut HTTP 404/503. Une panne prolongée peut toujours conduire Google à classer l'écran HTTP 200
en soft 404 ou à retirer l'URL de l'index, même sans noindex. Index/follow n'est
pas une garantie de conservation. Le compromis évite uniquement d'ajouter un
signal explicite de désindexation sur la base d'une erreur technique.
Une vraie réponse HTTP 503 serait préférable pour une panne, et 404/410 pour
une absence durable, mais ce shell GitHub Pages ne peut pas les choisir selon
le résultat Supabase. Aucun faux statut n'est simulé dans le navigateur.
Un noindex initial global empêcherait potentiellement le rendu des articles
publiés ; il n'est pas ajouté. Aucun contenu périmé n'est servi en secours. Les images et titres du corps demandent toujours une revue
éditoriale : le sanitizeur autorise h2/h3/h4 mais n'impose pas leur ordre.
La pagination ne remplace pas un sitemap complet des articles.

## F. Validation

- `node --test tests/*.test.mjs` : 60 tests réussis, dont les régressions 163/164.
- `node tests/seo-browser.mjs` : Chromium réel, requêtes externes bloquées ;
  publication, absence, brouillon/archives simulés comme absences du service,
  panne, slug manquant, canonical historique sans tracking, JSON-LD parsable,
  liens associés et trois ancres. Aucun appel Supabase réel.
- Sitemap analysé avec le parseur XML Python standard, namespace, liste exacte,
  doublons et exclusion des pages privées/publications non vérifiées contrôlés.
  Générateur testé avec slugs spéciaux, XML réellement parsé, pagination au-delà
  de 1 000 lignes, déduplication, retraits, réponse vide, erreurs et conservation
  exacte du fichier précédent. Clés privilégiées refusées avant tout réseau.
- Métadonnées fixes, H1, alt, langue, robots et canonical contrôlés.
- Syntaxe de tous les JS/MJS et `git diff --check` contrôlés.

L'état réel des données Supabase, les autorisations de production, les robots
externes, l'index Google et Rich Results Test ne sont pas testés dans cette PR.
Aucune écriture distante, modification RLS/Storage/Cloudflare ou publication.

## G. Google Search Console après déploiement autorisé ultérieur

Soumettre ou resoumettre `https://agritech509ht.com/sitemap.xml`. Inspecter une
page fixe et plusieurs articles publiés (URL historique avec slug), vérifier le
HTML rendu, la canonical retenue et l'accès aux JS/CSS. Inspecter un slug absent
et confirmer noindex dans le rendu. Vérifier le JSON-LD dans Rich Results Test
sans attendre un affichage enrichi garanti. Surveiller soft 404, exclusions et
pages explorées non indexées ; après automatisation validée, contrôler ajouts
et retraits d'URL. Ces actions ne sont pas exécutées ici.

## H. Risques et dépendances

Dépendance inchangée au SDK/réseau/Supabase et au rendu JavaScript. Les ancres
dépendent de l'insertion des cartes, maintenant suivie d'un scroll explicite.
Les champs éditoriaux incomplets ne sont pas complétés artificiellement.
Le fonctionnement public réel du générateur reste à valider lors de sa première
exécution explicitement autorisée. Aucune décision architecturale n’est ouverte ;
le compromis SEO des pannes reste soumis à la validation de cette révision.
Aucune migration, fusion, modification sociale ni déploiement dans ce chantier.
