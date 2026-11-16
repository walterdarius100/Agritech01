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
| `/article.html?slug=…`, publié | Oui après rendu | Non (report V2) | Non | Slug publié, sans tracking | Non |
| Article absent, brouillon, archivé ou sans slug | Non après rendu | Non | Oui | Aucune | Lectures privées : RLS/auth |
| Erreur technique de lecture | Pas de demande de désindexation | Non | Non | Aucune non vérifiée | Non |
| `/admin.html` | Non | Non | Oui, existant | Non nécessaire | Oui, Auth + RLS existants |
| Test/prévisualisation | Aucune page dédiée trouvée | Non | À imposer si ajout | Non | Oui si contenu privé |

Les pages légales sont conservées dans le sitemap : informations publiques
utiles à la transparence, déjà indexables, sans motif établi pour les exclure.
Les données privées doivent être protégées côté Supabase ; robots et noindex
ne sont jamais une protection. Les scripts de test dans `tests/` ne sont pas
des pages de prévisualisation ni des données de production.

## D. Sitemap : uniquement les six pages fixes

`sitemap.xml` répertorie exclusivement l'accueil, les services, les formations,
les actualités, les mentions légales et la politique de confidentialité.
Les valeurs lastmod, changefreq et priority non justifiées sont supprimées.
Les articles ne figurent pas dans ce sitemap.

Les articles publiés restent accessibles par les liens du site : actualités,
accueil et articles associés. Leur publication et leur consultation continuent
via l'administration et Supabase exactement comme avant. Une publication,
dépublication ou suppression ne demande aucune intervention supplémentaire dans
le code, le sitemap ou GitHub. Aucune exécution locale de Node.js n'est requise
pour maintenir les URL d'articles. Node.js reste un outil de tests uniquement.

La génération et l'actualisation automatiques du sitemap des articles sont
reportées à Agri-tech V2. Aucun outil manuel ni mécanisme d'automatisation du
sitemap des articles n'est livré pour V1.2. L'absence d'articles dans le sitemap
n'empêche pas leur consultation, mais les liens et le rendu JavaScript ne
garantissent ni leur découverte complète ni leur indexation par les moteurs.

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

- `node --test tests/*.test.mjs` : 43 tests réussis, dont les régressions 163/164.
- `node tests/seo-browser.mjs` : Chromium réel, requêtes externes bloquées ;
  publication, absence, brouillon/archives simulés comme absences du service,
  panne, slug manquant, canonical historique sans tracking, JSON-LD parsable,
  liens associés et trois ancres. Aucun appel Supabase réel.
- Sitemap analysé avec le parseur XML Python standard, namespace, liste exacte,
  doublons et exclusion des pages privées/publications non vérifiées contrôlés.
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
pages explorées non indexées. Le sitemap soumis reste limité aux six pages fixes. Ces actions ne sont pas exécutées ici.

## H. Risques et dépendances

Dépendance inchangée au SDK/réseau/Supabase et au rendu JavaScript. Les ancres
dépendent de l'insertion des cartes, maintenant suivie d'un scroll explicite.
Les champs éditoriaux incomplets ne sont pas complétés artificiellement.
Les articles restent dépendants de leur découverte par les liens et du rendu JS,
sans garantie d'indexation. Aucune maintenance éditoriale dans GitHub n'est
nécessaire après publication depuis l'administration.

## I. Report explicite à Agri-tech V2

- Métadonnées de partage personnalisées Facebook, WhatsApp et autres réseaux.
- Génération ou actualisation automatique du sitemap des articles.
- Éventuel pré-rendu HTML des articles.
- Toute évolution majeure de l'architecture SEO.

Les métadonnées sociales existantes sont conservées. HTML, CSS, JavaScript natif,
Supabase et l'hébergement actuel restent en place. Aucun serveur, framework ou
service externe n'est ajouté. Administration, RLS, données Supabase et URL
historiques ne sont pas modifiées. Aucune fusion ni aucun déploiement.
