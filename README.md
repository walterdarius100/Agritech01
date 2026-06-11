# Agri-Tech — Site GitHub Pages

Site vitrine Agri-Tech pour présenter les services agricoles, les formations, les témoignages et le formulaire de contact.

## Structure principale

- `index.html` : page d’accueil actuelle, conservée comme point d’entrée GitHub Pages.
- `css/main.css` : point d’entrée CSS qui importe les fichiers organisés.
- `css/variables.css` : tokens de couleurs, ombres et variables globales.
- `css/layout.css` : styles de base, navigation et primitives de mise en page.
- `css/components.css` : boutons, cartes, formulaires, carrousels et animations réutilisables.
- `css/pages/home.css` : sections propres à la page d’accueil et règles responsive.
- `js/app.js` : bootstrap de la page d’accueil et orchestration des modules.
- `js/config.js` : configuration EmailJS et endpoint Google Sheets existants.
- `js/data/` : données services, formations et témoignages.
- `js/components/` : rendu des services, formations, témoignages et helpers composants.
- `js/utils/` : fonctions de sanitisation et de validation.
- `data/` : emplacement réservé aux futurs contenus structurés.
- `assets/images/services/`, `assets/images/formations/`, `assets/images/articles/` : dossiers prêts pour les prochaines pages.

## Fonctionnalités conservées

- Page d’accueil et identité visuelle existantes.
- EmailJS avec les identifiants existants.
- Endpoint Google Sheets existant.
- Formulaire de contact avec validation, honeypot anti-spam et consentement.
- Newsletter du footer.
- Menu mobile.
- Carrousels formations, témoignages et partenariats.
- Animations d’apparition au scroll.
- Tests console intégrés au bootstrap.

## Préparation des prochaines pages

L’architecture est prête pour ajouter progressivement :

- `services.html` ou une route dédiée Services avec ses données dans `js/data/services.js` ou `data/`.
- `formations.html` avec les formations dans `js/data/formations.js`.
- `actualites.html` avec les articles et images dans `assets/images/articles/`.
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
