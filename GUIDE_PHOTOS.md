# Guide photos

Ce guide sert à préparer des images légères, nettes et adaptées au site avant de les placer dans :

`assets/images/`

Pour remplacer une image existante sans modifier le site, garde exactement le même nom de fichier que celui utilisé aujourd’hui.

> Important : le site actuel référence surtout des fichiers `.jpg` et le logo en `.png`. Le format WebP est recommandé pour alléger le site, mais il faut l’utiliser uniquement si le fichier appelé par le site porte aussi l’extension `.webp` ou si une version WebP est ajoutée dans le code plus tard.

## Images utilisées actuellement

### Services

- `poulet-chair.jpg`
- `poule-pondeuse.jpg`
- `incubateur.jpg`
- `cuniculture.jpg`
- `porcherie.jpg`
- `pepiniere.jpg`
- `apiculture.jpg`
- `pisciculture.jpg`
- `gabionnage.jpg`
- `irrigation.jpg`
- `biogaz.jpg`
- `cloture-metallique.jpg`

### Formations

- `formation-cuniculture.jpg`
- `formation-poulet.jpg`
- `formation-apiculture.jpg`

Certaines cartes de formation réutilisent aussi des images de services, par exemple `poule-pondeuse.jpg` et `pisciculture.jpg`.

### Témoignages

- `temoignage-1.jpg`
- `temoignage-2.jpg`
- `temoignage-3.jpg`

### Logo

- `logo-agritech.png`

### Partenariats

La section partenariats réutilise actuellement :

- `irrigation.jpg`
- `pepiniere.jpg`
- `apiculture.jpg`

## Tableau de recommandations par catégorie

| Catégorie d’image | Utilisation | Largeur recommandée | Hauteur recommandée | Format conseillé | Qualité recommandée | Poids maximal conseillé | Remarques |
|---|---|---:|---:|---|---|---:|---|
| Image hero / bannière principale | Grande image d’accueil ou visuel très large en haut de page, si une bannière est ajoutée plus tard | 1600 px | 900 px | WebP | 75 à 82 % | 250 Ko | Recadrer en format paysage 16:9. Éviter les détails importants sur les bords, car l’image peut être recadrée sur mobile. Prévoir une image nette, lumineuse et professionnelle. |
| Cartes de services | Images des domaines d’intervention : poulet, poule pondeuse, incubateur, cuniculture, porcherie, pépinière, apiculture, pisciculture, gabionnage, irrigation, biogaz, clôture métallique | 1200 px | 800 px | WebP si le site est adapté, sinon JPG optimisé | 72 à 80 % | 180 Ko | Format paysage 3:2. C’est le format le plus utilisé par les cartes du site. Ne pas téléverser une image prise directement au téléphone sans redimensionnement. |
| Cartes de formations | Images des cours en ligne et formations | 1200 px | 800 px | WebP si le site est adapté, sinon JPG optimisé | 72 à 80 % | 180 Ko | Utiliser des images claires, avec un sujet lisible même en petit. Éviter les textes intégrés dans l’image, car ils peuvent devenir illisibles sur mobile. |
| Images partenariats | Visuels du carrousel de partenariats, actuellement basés sur irrigation, pépinière et apiculture | 1200 px | 800 px | WebP si le site est adapté, sinon JPG optimisé | 72 à 80 % | 200 Ko | Prévoir une image assez large et esthétique. Une zone sombre est ajoutée par le design, donc choisir une photo lumineuse et simple. |
| Galerie photo | Photos de réalisations, projets, avant/après ou terrain, si une galerie est ajoutée | 1200 px | 800 px | WebP | 70 à 78 % | 160 Ko | Garder une série cohérente : même orientation, même style, bonne lumière. Pour une galerie nombreuse, viser plutôt 100 à 140 Ko par image. |
| Images d’articles | Images d’illustration pour actualités, conseils ou articles de blog, si une section articles est ajoutée | 1200 px | 675 px | WebP | 72 à 80 % | 180 Ko | Format paysage 16:9 pratique pour le partage et les aperçus. Choisir une image qui illustre directement le sujet de l’article. |
| Photos de profil / témoignages | Portraits des personnes dans les témoignages | 400 px | 400 px | WebP si le site est adapté, sinon JPG optimisé | 75 à 82 % | 60 Ko | Format carré obligatoire. Centrer le visage. Éviter les photos floues, sombres ou trop éloignées. Le site les affiche en rond. |
| Logo principal | Logo dans l’en-tête, le pied de page et les aperçus de partage | 512 px | 512 px ou proportion originale nette | PNG ou SVG, WebP possible pour certains usages | PNG optimisé sans perte, ou SVG si disponible | 80 Ko | Garder un fond transparent si nécessaire. Ne pas compresser fortement un logo : les bords doivent rester nets. Éviter les captures d’écran du logo. |
| Icônes simples | Pictogrammes, réseaux sociaux, éléments décoratifs, si des icônes image sont ajoutées | 64 px | 64 px | SVG de préférence, sinon WebP ou PNG optimisé | Sans perte pour SVG/PNG, 80 à 90 % pour WebP | 20 Ko | Préférer SVG pour les icônes : c’est léger et net sur tous les écrans. Ne pas utiliser de grandes photos comme icônes. |
| Image Open Graph / partage social | Image affichée lors du partage du site sur WhatsApp, Facebook, LinkedIn ou X | 1200 px | 630 px | JPG optimisé ou WebP selon compatibilité de la plateforme | 75 à 82 % | 250 Ko | Format recommandé pour les réseaux sociaux. Inclure peu de texte, avec une composition lisible même dans un petit aperçu. |

## Règles rapides à suivre

- Utiliser une image déjà recadrée aux bonnes dimensions avant de la téléverser.
- Éviter les images de plus de 1600 px de large, sauf besoin exceptionnel.
- Viser moins de 180 Ko pour les images de cartes et moins de 60 Ko pour les portraits.
- Garder des noms de fichiers simples : pas d’espace, pas d’accent, pas de majuscule inutile.
- Pour remplacer une image existante sans toucher au code, garder le nom exact du fichier actuel.
- Vérifier l’image sur mobile : le sujet doit rester lisible en petit format.

## Pourquoi éviter les images trop grandes ?

Une image trop grande ralentit le chargement du site, surtout sur téléphone ou avec une connexion mobile instable. Par exemple, une photo de 4000 px de large prise directement avec un téléphone peut peser plusieurs mégaoctets, alors que le site n’a souvent besoin que de 1200 px de large. Le visiteur doit alors télécharger beaucoup de données inutiles, ce qui peut rendre le site lent et donner une mauvaise première impression.

## Pourquoi convertir les images en WebP ?

Le WebP permet généralement d’obtenir une image plus légère qu’un JPG ou un PNG, tout en gardant une bonne qualité visuelle. C’est particulièrement utile pour les photos de services, de formations, de galerie et de partenariats. Une image WebP bien compressée peut souvent réduire le poids du fichier de manière importante sans différence visible pour la majorité des visiteurs.

Attention : si le site appelle actuellement `poulet-chair.jpg`, il faut soit garder un fichier JPG optimisé avec ce nom, soit modifier le site pour appeler `poulet-chair.webp`. Ne change pas seulement l’extension du fichier sans vérifier que le site utilise le même nom.

## Trouver le bon équilibre entre qualité et poids

L’objectif n’est pas d’avoir l’image la plus compressée possible, mais l’image la plus légère qui reste belle à l’écran. Pour la plupart des photos du site, une qualité entre 72 % et 80 % suffit. Si l’image contient beaucoup de détails, comme des feuillages, des animaux ou des textures, il peut être nécessaire de monter vers 80 %. Si l’image est simple, avec peu de détails, 70 % à 75 % peut suffire.

Avant d’ajouter une image, il est conseillé de comparer rapidement l’original et la version compressée. Si la version compressée reste nette, naturelle et sans gros blocs visibles, elle est assez bonne pour le web.

## Bonnes pratiques de compression

1. Recadrer d’abord l’image selon son usage : paysage pour les cartes, carré pour les témoignages, large pour une bannière.
2. Redimensionner ensuite l’image à la largeur et à la hauteur recommandées dans le tableau.
3. Exporter en WebP lorsque le site le permet ; sinon exporter en JPG optimisé pour les photos.
4. Utiliser une qualité autour de 75 % comme point de départ.
5. Vérifier le poids final du fichier et recommencer avec une qualité légèrement plus basse si le fichier reste trop lourd.
6. Éviter d’augmenter artificiellement la taille d’une petite image : cela la rend floue sans améliorer la qualité.
7. Garder une copie de l’image originale séparée, puis publier seulement la version optimisée dans `assets/images/`.

## Erreurs à éviter avant d’ajouter une image au site

- Téléverser une photo directement depuis un téléphone sans la redimensionner.
- Utiliser une image de plusieurs mégaoctets pour une petite carte.
- Changer le nom ou l’extension d’un fichier sans vérifier que le site appelle le même nom.
- Utiliser des photos floues, sombres, mal cadrées ou avec un sujet trop petit.
- Ajouter du texte important dans une image, car il peut être illisible sur mobile.
- Compresser tellement l’image que les détails deviennent sales, pixellisés ou artificiels.
- Utiliser un PNG lourd pour une photo classique : le PNG est surtout utile pour les logos, transparences et éléments graphiques.
- Mélanger des formats incohérents dans une même section, par exemple des cartes tantôt horizontales, tantôt verticales.
