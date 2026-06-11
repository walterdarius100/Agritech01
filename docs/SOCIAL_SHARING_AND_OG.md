# Partage social et Open Graph

Ce document décrit la logique de partage social du site Agri-tech et la limite technique liée aux articles affichés via `article.html?slug=...` sur un site statique GitHub Pages.

## Bouton de partage des articles

La page `article.html` affiche un bouton de partage directement sur l’image principale de l’article complet.

- Le bouton est rendu côté navigateur dans `js/pages/article-page.js`, au moment où l’article public est chargé depuis Supabase ou depuis le fallback local.
- Il est positionné sur l’image principale avec les styles de `css/pages/content.css`.
- Il utilise `aria-label="Partager cet article"` et possède un état de focus visible pour l’accessibilité clavier.
- Au clic, la logique prépare les données suivantes :
  - titre : titre de l’article ;
  - texte : extrait de l’article ou résumé généré depuis le contenu ;
  - URL : URL courante de la page, incluant le `slug`.
- Si `navigator.share` est disponible, le partage natif du navigateur est utilisé.
- Si `navigator.share` n’est pas disponible, l’URL est copiée dans le presse-papiers.
- Un message discret confirme l’action : `Article partagé`, `Lien copié` ou `Partage indisponible`.

## Balises SEO, Open Graph et Twitter Card

Les balises de base sont définies directement dans les fichiers HTML principaux :

- `index.html`
- `services.html`
- `formations.html`
- `actualites.html`
- `article.html`
- `politique-confidentialite.html`
- `mentions-legales.html`

Chaque page principale contient au minimum :

- un `<title>` clair ;
- une meta description ;
- `og:title` ;
- `og:description` ;
- `og:image` ;
- `og:url` ;
- `twitter:card` ;
- `twitter:title` ;
- `twitter:description` ;
- `twitter:image`.

Pour `article.html`, les balises de base sont présentes dans le HTML initial, puis la fonction `updateArticleMeta(article)` met à jour côté navigateur :

- `document.title` ;
- `meta[name="description"]` ;
- `meta[property="og:title"]` ;
- `meta[property="og:description"]` ;
- `meta[property="og:image"]` ;
- `meta[property="og:url"]` ;
- `meta[name="twitter:title"]` ;
- `meta[name="twitter:description"]` ;
- `meta[name="twitter:image"]`.

Les textes injectés sont nettoyés, réduits à un texte simple sans HTML et limités à environ 155 caractères pour les descriptions.

## Image de prévisualisation par défaut

L’image par défaut utilisée pour les pages générales et pour les articles sans image est :

```text
assets/images/irrigation.jpg
```

Dans les balises Open Graph et Twitter Card statiques, elle est référencée avec une URL absolue :

```text
https://agritech509ht.com/assets/images/irrigation.jpg
```

Pour les articles, `article.coverImage` / `cover_image_url` est prioritaire. Si aucun visuel n’est disponible, la page utilise `assets/images/irrigation.jpg`.

## Limite technique avec `article.html?slug=...`

Le site est statique et prévu pour GitHub Pages. Les articles publics sont chargés dynamiquement dans le navigateur via une URL du type :

```text
article.html?slug=mon-article
```

Cette architecture fonctionne pour l’affichage utilisateur, mais elle a une limite importante pour les aperçus de liens sur Facebook, WhatsApp, LinkedIn, X/Twitter et d’autres plateformes :

- beaucoup de robots sociaux lisent uniquement le HTML initial renvoyé par le serveur ;
- ils n’attendent pas toujours l’exécution complète du JavaScript ;
- les métadonnées injectées par `updateArticleMeta(article)` peuvent donc ne pas être prises en compte pour créer l’aperçu article par article.

Conséquence : les pages d’articles peuvent afficher correctement leurs métadonnées dans le navigateur après chargement, mais certains réseaux sociaux peuvent continuer à utiliser les balises génériques de `article.html`.

## Solution future plus robuste

Pour obtenir des aperçus sociaux fiables et personnalisés pour chaque article, il faudra fournir aux robots sociaux un HTML initial déjà personnalisé. Les options recommandées sont :

1. **Générer une page statique par article**  
   Exemple : créer automatiquement des fichiers comme `articles/mon-article.html`, chacun contenant ses propres balises Open Graph et Twitter Card.

2. **Mettre en place un pré-rendu**  
   Un outil de build peut récupérer les articles depuis Supabase, générer le HTML final avant publication, puis déployer ces pages sur GitHub Pages.

3. **Créer des routes propres du type `/articles/slug.html`**  
   Cette approche améliore la lisibilité des URLs et facilite l’association d’un article à un jeu de métadonnées statiques.

La solution actuelle applique donc la meilleure amélioration possible sans remplacer l’architecture existante : balises de base dans le HTML, métadonnées dynamiques côté navigateur et bouton de partage natif/fallback.
