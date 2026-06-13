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
5. Choisissez le statut : brouillon ou publié.
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

## Brouillon, publication ou suppression

- **Brouillon** : l’article reste dans Supabase mais n’est pas visible publiquement.
- **Publié** : l’article devient visible sur `actualites.html` et `article.html?slug=...`.
- **Supprimer** : l’article est supprimé définitivement après confirmation.

## Uploader une image

1. Sélectionnez une image depuis votre ordinateur.
2. Formats image acceptés par le navigateur : JPG, PNG, WebP, etc.
3. Taille maximale : 4 Mo.
4. L’image principale est envoyée dans le bucket Supabase Storage `article-images`, chemin `articles/{article-id}/cover/`, et l’URL est enregistrée dans `cover_image_url`.
5. Les images insérées via TinyMCE sont envoyées dans `article-images`, chemin `articles/{article-id}/content/`, puis insérées dans `content` sous forme d’URL Supabase.
6. Les images en base64 ne doivent pas être utilisées.

## Bonnes pratiques éditoriales

- Titre : clair, court et orienté bénéfice lecteur.
- Slug : sans accents, en minuscules, avec tirets.
- Résumé : 1 à 2 phrases qui expliquent l’intérêt de l’article.
- Image : carrée ou paysage, nette, légère, cohérente avec l’agriculture en Haïti.
- Contenu : utilisez TinyMCE pour les titres, listes, citations, liens et images. Le rendu public nettoie `content` avec DOMPurify avant injection dans le DOM.
