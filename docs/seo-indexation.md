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
  noindex et retrait de canonical/schema dans les erreurs et sans slug ; titre
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
| `/article.html?slug=…`, publié | Oui après rendu | En attente de décision | Non | Slug publié, sans tracking | Non |
| Article absent, brouillon, archivé ou sans slug | Non après rendu | Non | Oui | Aucune | Lectures privées : RLS/auth |
| Article indisponible (panne) | Non pendant l'erreur rendue | Non ajouté | Oui | Aucune | Non |
| `/admin.html` | Non | Non | Oui, existant | Non nécessaire | Oui, Auth + RLS existants |
| Test/prévisualisation | Aucune page dédiée trouvée | Non | À imposer si ajout | Non | Oui si contenu privé |

Les pages légales sont conservées dans le sitemap : informations publiques
utiles à la transparence, déjà indexables, sans motif établi pour les exclure.
Les données privées doivent être protégées côté Supabase ; robots et noindex
ne sont jamais une protection. Les scripts de test dans `tests/` ne sont pas
des pages de prévisualisation ni des données de production.

## D. Sitemap : livraison partielle et décision requise

Aucun générateur ni workflow de synchronisation n'est ajouté. Le sitemap actuel
reste un inventaire de pages fixes ; il n'est pas présenté comme une solution
complète à la découverte des articles. Aucun article n'est ajouté depuis le JSON
local ni depuis une liste dont le statut actuel n'aurait pas été vérifié.

Options à valider avant implémentation :

1. **Génération manuelle avant publication du site** : outil ponctuel lisant
   uniquement Supabase avec le rôle public et les RLS existantes, sélection de
   `status=published`, pagination complète, puis remplacement atomique du sitemap.
   Aucun secret privilégié ; chaque publication, dépublication et suppression
   impose une nouvelle génération puis une mise à jour du fichier hébergé.
   Coût minimal mais risque d'oubli humain.
2. **GitHub Actions planifiée et déclenchable manuellement** : même lecture,
   validation puis PR contenant le sitemap régénéré. Requiert choix de fréquence,
   permissions GitHub et procédure de fusion/publication. Retraits retardés par
   la fréquence et le délai de revue. Aucun couplage automatique avec l'admin.

Dans les deux options, régénérer l'ensemble retire naturellement les anciennes
URL dépubliées/supprimées ; dédupliquer les slugs, conserver les URL historiques,
encoder les paramètres puis échapper XML (`&` → `&amp;`, etc.). Une réponse
incomplète ou une panne doit interrompre la génération sans écraser le fichier
précédent. Ne pas inventer lastmod ni traiter une panne comme une liste vide.
Une ancienne copie du sitemap peut rester périmée pendant une panne ; les RLS
et le service public demeurent responsables du contrôle de publication.
**Validation du propriétaire nécessaire avant de choisir et implémenter l'option.**

## E. Articles : gains et limites

Les métadonnées SEO spécifiques existantes sont maintenues. La canonical ne
pointe plus tous les articles vers le même shell HTML avant lecture. Les erreurs
rendent noindex sans proposer une URL canonique d'article absent. Les brouillons
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
(soft 404) ; noindex n'est pas un vrai statut HTTP 404/503. Une panne prolongée
peut entraîner une désindexation temporaire ; le prochain rendu réussi rétablit
index/follow. Les images et titres du corps demandent toujours une revue
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
  Aucun générateur d'URL d'articles n'étant ajouté, l'échappement des futures
  entrées dynamiques devra être testé avec son implémentation validée.
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
Le sitemap d'articles reste le point ouvert principal, soumis à validation.
Aucune migration, fusion, modification sociale ni déploiement dans ce chantier.
