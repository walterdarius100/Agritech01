# Guide d’utilisation — Admin Agri-tech

## Accéder à l’admin

- Local : démarrez un serveur statique à la racine du projet puis ouvrez `http://localhost:8000/admin.html`.
- Vercel Preview : ouvrez `https://<preview-vercel>/admin.html`.
- GitHub Pages après merge : ouvrez `https://<domaine-ou-pages>/admin.html`.

L’admin est une page statique. La sécurité repose sur Supabase Auth et RLS, pas sur le masquage de la page.

## Connexion

1. Ouvrez `admin.html`.
2. Vérifiez le panneau diagnostic : Supabase doit être configuré et le client initialisé.
3. Saisissez l’email et le mot de passe créés dans Supabase Auth.
4. Cliquez sur **Se connecter**.
5. Après connexion, le dashboard apparaît et le panneau indique **Session active : Oui**.

## Créer un article

1. Cliquez sur **Nouvel article**.
2. Renseignez le titre. Le slug est généré automatiquement, par exemple `Comment lancer un projet avicole en Haïti` devient `comment-lancer-un-projet-avicole-en-haiti`.
3. Le slug reste modifiable manuellement.
4. Ajoutez catégorie, résumé, auteur, contenu et éventuellement image.
5. Choisissez le statut : brouillon, publié ou archivé.
6. Cochez **Article à la une** si cet article doit être mis en avant.

## Enregistrer un brouillon

Cliquez sur **Enregistrer comme brouillon**. Le brouillon reste visible dans l’admin pour les utilisateurs connectés, mais n’apparaît pas sur le site public.

## Publier un article

Cliquez sur **Publier**. Si aucune date de publication n’est saisie, la date courante est utilisée. L’article publié devient visible dans `actualites.html`, `article.html?slug=...` et la section Actualités de la page d’accueil.

## Modifier un article

1. Dans la liste, cliquez sur **Modifier**.
2. Ajustez les champs.
3. Cliquez sur **Mettre à jour**, **Publier** ou **Enregistrer comme brouillon** selon le besoin.

## Mettre un article à la une

Cochez **Article à la une** dans le formulaire. Quand un nouvel article est enregistré à la une, les autres articles sont automatiquement remis à `featured = false`. Si aucun article n’est marqué à la une, le site public met automatiquement en avant l’article publié le plus récent.

## Archiver ou supprimer

- **Archiver** : l’article ne s’affiche plus publiquement mais reste dans la base.
- **Supprimer** : l’article est supprimé définitivement après confirmation.

## Uploader une image

1. Sélectionnez une image depuis votre ordinateur.
2. Formats image acceptés par le navigateur : JPG, PNG, WebP, etc.
3. Taille maximale : 4 Mo.
4. L’image est envoyée dans le bucket Supabase Storage `article-images` et l’URL est enregistrée dans `cover_image_url`.

## Bonnes pratiques éditoriales

- Titre : clair, court et orienté bénéfice lecteur.
- Slug : sans accents, en minuscules, avec tirets.
- Résumé : 1 à 2 phrases qui expliquent l’intérêt de l’article.
- Image : carrée ou paysage, nette, légère, cohérente avec l’agriculture en Haïti.
- Contenu : paragraphes courts, titres structurés, liens utiles et listes lisibles. Le HTML riche est nettoyé avant sauvegarde et avant affichage public pour éviter les injections XSS.


## Éditeur d’articles

L’admin utilise TinyMCE pour rédiger les articles.
Le contenu riche est nettoyé avant sauvegarde/affichage et reste stocké dans le champ existant `content`.
Les statuts existants restent : `draft`, `published`, `archived`.

## Images dans le contenu des articles

L’éditeur TinyMCE permet d’insérer des images dans le corps de l’article.
Les images sont envoyées dans Supabase Storage, bucket `article-images`.
Elles sont ensuite insérées dans le contenu sous forme d’URL publique.
Les images base64 ne doivent pas être utilisées.
Poids recommandé : moins de 1 Mo.
Poids maximum : 4 Mo.


## Légendes et crédits photo

Lorsqu’une image est insérée dans le contenu d’un article, ajoutez une légende sous l’image pour expliquer le visuel ou indiquer le crédit photo.

Exemples :
- `Photo : Agri-tech.`
- `Crédit photo : Nom de la source.`
- `Image utilisée à titre illustratif.`

Les légendes sont enregistrées dans le contenu de l’article avec la structure HTML `figure` / `figcaption`.
