# Agri-Tech — Site GitHub Pages

Site vitrine Agri-Tech pour présenter les services agricoles, les formations, les témoignages et le formulaire de contact.

## Structure principale

- `index.html` : page d’accueil actuelle, conservée comme point d’entrée GitHub Pages.
- `services.html` : page détaillée des services Agri-tech avec filtres, méthode et CTA vers le contact.
- `formations.html` : portail Agri-tech Academy avec formations disponibles, à venir, méthode pédagogique et CTA.
- `actualites.html` : liste des articles publiés avec filtres par catégorie.
- `article.html` : gabarit d’article complet chargé par slug dans l’URL.
- `politique-confidentialite.html` : page légale dédiée aux données personnelles, formulaires, newsletter et outils tiers.
- `mentions-legales.html` : page légale dédiée à l’éditeur, aux contenus, responsabilités et contacts.
- `css/main.css` : point d’entrée CSS qui importe les fichiers organisés.
- `css/variables.css` : tokens de couleurs, ombres et variables globales.
- `css/layout.css` : styles de base, navigation et primitives de mise en page.
- `css/components.css` : boutons, cartes, formulaires, carrousels et animations réutilisables.
- `css/pages/home.css` : sections propres à la page d’accueil et règles responsive.
- `js/app.js` : bootstrap de la page d’accueil, orchestration des modules et préremplissage du formulaire via `?need=`.
- `js/config.js` : configuration EmailJS et endpoint Google Sheets existants.
- `js/data/` : données services, formations et témoignages utilisées par l’accueil et les pages dédiées.
- `js/components/` : rendu des services, formations, témoignages et helpers composants.
- `js/utils/` : fonctions de sanitisation et de validation.
- `js/pages/` : scripts propres aux pages Services, Formations, Actualités et pages légales.
- `data/` : emplacement réservé aux futurs contenus structurés.
- `data/articles.json` : source des actualités publiées, prête pour une future connexion admin.
- `assets/images/services/`, `assets/images/formations/`, `assets/images/articles/` : dossiers prêts pour les prochaines pages.

## Fonctionnalités conservées

- Page d’accueil et identité visuelle existantes.
- Pages dédiées `services.html` et `formations.html` ajoutées avec le même design.
- Aperçus Services/Formations sur l’accueil avec CTA vers les pages complètes.
- Actualités publiées depuis `data/articles.json`, avec aperçu accueil, page liste, filtres et page article par slug.
- Footer harmonisé sur toutes les pages avec les mêmes contacts, réseaux sociaux et liens internes.
- Pages légales accessibles uniquement depuis le footer.
- EmailJS avec les identifiants existants.
- Endpoint Google Sheets existant.
- Formulaire de contact avec validation, honeypot anti-spam et consentement.
- Préremplissage automatique du type de demande depuis les pages dédiées via les liens `index.html?need=...#contact`.
- Newsletter footer active sur les pages dédiées via EmailJS et le même endpoint Google Sheets.
- Newsletter du footer.
- Menu mobile.
- Carrousels formations, témoignages et partenariats.
- Animations d’apparition au scroll.
- Tests console intégrés au bootstrap.

## Préparation des prochaines pages

L’architecture est prête pour ajouter progressivement :

- l’enrichissement de `services.html` depuis `js/data/services.js` ou `data/`.
- l’enrichissement de `formations.html` depuis `js/data/formations.js`.
- l’enrichissement d’`actualites.html` depuis `data/articles.json` et `assets/images/articles/`.
- une page `admin.html` ou un espace d’administration statique selon les besoins GitHub Pages.

## Configuration EmailJS et Google Sheets

La configuration se trouve maintenant dans `js/config.js` :

```js
export const EMAILJS_CONFIG = {
  publicKey: 'FIM6Dgp1FXsfD9fJf',
  serviceId: 'service_z856n3l',
  templateId: 'template_pzsnmea',
  autoReplyTemplateId: '',
  sheetEndpoint: 'https://script.google.com/macros/s/AKfycbw6LvUrYSGt7pyWOK9E4UY_bJpAP9FbhyvfSK5clxBfDSQUPuBVa750vS5y59ybFApJ/exec'
};
```

Ces valeurs ont été conservées pendant le refactor pour ne pas casser le formulaire, la newsletter ni le stockage Google Sheets.
