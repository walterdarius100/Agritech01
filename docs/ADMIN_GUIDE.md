# Guide d’administration des actualités Agri-tech

## Accès à l’admin

- Local : lancez `python3 -m http.server 8000`, puis ouvrez `http://localhost:8000/admin.html`.
- Vercel Preview : ouvrez `https://<preview-vercel>/admin.html`.
- GitHub Pages après merge : ouvrez `https://<domaine-ou-pages>/admin.html`.

`admin.html` est marqué `noindex,nofollow` et utilise Supabase Auth. L’accès réel est contrôlé par Supabase Auth et RLS.

## Connexion

1. Vérifiez le panneau diagnostic.
2. Saisissez l’email et le mot de passe du compte Supabase Auth.
3. Cliquez sur **Se connecter**.
4. Après connexion, le dashboard s’affiche et la session active passe à **Oui**.

## Créer un article

1. Cliquez sur **Nouvel article**.
2. Renseignez titre, catégorie, résumé, auteur et contenu.
3. Le slug est généré automatiquement depuis le titre, mais reste modifiable.
4. Ajoutez une image de couverture si disponible : JPG, PNG, WebP ou GIF, 4 Mo maximum.
5. Choisissez le statut.

## Brouillon, publication et mise à jour

- **Enregistrer comme brouillon** : enregistre sans rendre public.
- **Publier** : met le statut `published` et renseigne une date de publication si elle est absente.
- **Mettre à jour** : sauvegarde les champs avec le statut sélectionné.

Un article publié apparaît sur `actualites.html`, sur `article.html?slug=...` et peut apparaître dans les 3 derniers articles de la page d’accueil.

## Article à la une

Cochez **Article à la une** avant d’enregistrer. Lorsqu’un nouvel article devient à la une, les autres articles sont remis à `featured = false`. Si aucun article n’est marqué à la une, le site utilise automatiquement le plus récent article publié.

## Modifier, archiver ou supprimer

- **Modifier** : ouvre le formulaire avec les données existantes.
- **Archiver** : demande confirmation et retire l’article du public.
- **Supprimer** : demande confirmation et supprime définitivement la ligne Supabase.
- **Voir l’article** : disponible seulement pour les articles publiés.

## Bonnes pratiques éditoriales

- Titre : clair, concret, avec le sujet principal au début.
- Slug : court, sans accents, en minuscules, séparé par des tirets.
- Extrait : 1 à 2 phrases qui résument la valeur de l’article.
- Image : paysage, légère, idéalement moins de 1 Mo, maximum 4 Mo.
- Contenu : un paragraphe par bloc de texte ; évitez de coller du HTML brut.
- Statut : utilisez `draft` pour préparer, `published` pour rendre visible, `archived` pour retirer sans supprimer.
