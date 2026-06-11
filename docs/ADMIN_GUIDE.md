# Guide d’utilisation de l’espace admin Actualités

L’espace admin permet à Agri-tech de gérer les articles sans modifier le code du site.

## Accéder à l’admin

1. Ouvrez `admin.html` depuis le site publié, par exemple `https://votre-domaine/admin.html`.
2. Connectez-vous avec l’email et le mot de passe du compte créé dans Supabase Auth.
3. Si Supabase n’est pas configuré, l’écran affiche un message demandant de compléter `js/config/supabase-config.js`.

## Créer un article

1. Cliquez sur **Nouvel article**.
2. Renseignez le titre, la catégorie, le résumé, l’auteur et le contenu.
3. Le slug est généré automatiquement depuis le titre. Vous pouvez le modifier avant l’enregistrement.
4. Sélectionnez une image de couverture ou collez une URL d’image.
5. Cliquez sur **Enregistrer comme brouillon** pour garder l’article privé.

## Publier un article

1. Ouvrez un brouillon ou créez un nouvel article.
2. Vérifiez le titre, le slug, l’image et le contenu.
3. Cliquez sur **Publier** ou choisissez le statut **Publié**, puis **Mettre à jour**.
4. L’article devient visible sur `actualites.html` et `article.html?slug=...`.

## Mettre un article à la une

1. Ouvrez l’article dans l’éditeur.
2. Cochez **Article à la une**.
3. Enregistrez.

Un seul article peut être à la une. Quand un article est marqué à la une, les autres sont automatiquement remis à `featured = false`. Si aucun article n’est coché, la page Actualités met en avant le plus récent article publié.

## Modifier un article

1. Dans la liste, cliquez sur **Modifier**.
2. Ajustez les champs nécessaires.
3. Cliquez sur **Mettre à jour**.

## Archiver ou supprimer

- **Archiver** : retire l’article de la partie publique sans le supprimer de la base. C’est l’option recommandée pour conserver l’historique.
- **Supprimer** : efface définitivement l’article après confirmation. À utiliser seulement si l’article ne doit plus exister.

## Bonnes pratiques pour les titres et slugs

- Utilisez des titres clairs et utiles pour les lecteurs.
- Gardez un slug court, en minuscules, sans accents et sans caractères spéciaux.
- Évitez de changer le slug après publication si le lien a déjà été partagé.

## Bonnes pratiques pour les images

- Utilisez des images horizontales, idéalement proches de 1200 × 800 px.
- Compressez les images avant upload.
- Le frontend refuse les fichiers non images et les fichiers de plus de 4 Mo.
- Donnez un titre explicite à l’article : il sert aussi de texte alternatif pour l’image de couverture.

## Bonnes pratiques pour le contenu

Le contenu est saisi dans un textarea sécurisé. Le site n’affiche pas de HTML brut venant de l’admin.

Formats simples acceptés :

```text
## Titre de section

Paragraphe avec du texte.

- Premier point
- Deuxième point
```

Séparez les paragraphes par une ligne vide pour obtenir un rendu propre dans `article.html`.
