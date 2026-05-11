# Configuration analytics légère — Agri-Tech

Ce site reste statique. Les outils analytics sont préparés dans `index.html`, mais ils ne se chargent pas tant que les placeholders `GA_MEASUREMENT_ID` et `CLARITY_PROJECT_ID` ne sont pas remplacés par de vrais identifiants.

## 1. Créer un compte Google Analytics 4

1. Aller sur <https://analytics.google.com/>.
2. Se connecter avec le compte Google qui doit gérer les statistiques du site.
3. Cliquer sur **Admin**.
4. Créer un **compte** si nécessaire.
5. Créer une **propriété** Google Analytics 4 pour Agri-Tech.
6. Choisir le fuseau horaire et la devise adaptés à l’activité.
7. Créer un flux de données **Web** pour le domaine public du site.

## 2. Trouver le Measurement ID GA4

1. Dans Google Analytics, aller dans **Admin**.
2. Ouvrir **Flux de données**.
3. Sélectionner le flux **Web** du site.
4. Copier le **Measurement ID** au format `G-XXXXXXXXXX`.

## 3. Remplacer le placeholder GA4 dans le code

Dans `index.html`, chercher :

```html
gaMeasurementId: 'GA_MEASUREMENT_ID'
```

Remplacer uniquement `GA_MEASUREMENT_ID` par le vrai Measurement ID, par exemple :

```html
gaMeasurementId: 'G-XXXXXXXXXX'
```

Le code actuel charge GA4 de manière légère :

- le script GA4 est ajouté en `async` ;
- il ne se charge pas si le placeholder est encore présent ;
- aucun événement personnalisé n’est ajouté pour l’instant ;
- le `page_view` standard de GA4 reste disponible.

## 4. Configurer Google Search Console

1. Aller sur <https://search.google.com/search-console/>.
2. Ajouter une propriété pour le domaine du site.
3. Choisir de préférence la propriété **Domaine** si l’accès DNS est disponible.
4. Valider la propriété avec l’enregistrement DNS demandé par Google.
5. Si la validation DNS n’est pas possible, utiliser la propriété **Préfixe de l’URL** et une méthode compatible avec l’hébergement.
6. Après validation, soumettre le sitemap :

```text
https://agritech509ht.com/sitemap.xml
```

7. Vérifier que `robots.txt` est accessible :

```text
https://agritech509ht.com/robots.txt
```

## 5. Configurer Microsoft Clarity

1. Aller sur <https://clarity.microsoft.com/>.
2. Se connecter avec le compte Microsoft qui doit gérer le projet.
3. Créer un nouveau projet pour Agri-Tech.
4. Renseigner le nom du site et son domaine public.
5. Choisir l’installation manuelle du script.

## 6. Trouver le Project ID Clarity

Dans Microsoft Clarity :

1. Ouvrir le projet.
2. Aller dans **Settings** / **Setup**.
3. Copier le **Project ID** affiché dans le script Clarity.

## 7. Remplacer le placeholder Clarity dans le code

Dans `index.html`, chercher :

```html
clarityProjectId: 'CLARITY_PROJECT_ID'
```

Remplacer uniquement `CLARITY_PROJECT_ID` par le vrai Project ID, par exemple :

```html
clarityProjectId: 'abcd1234ef'
```

Le code actuel charge Clarity uniquement si le Project ID a été remplacé.

## 8. Vérifier que les outils fonctionnent

### Vérification GA4

1. Déployer le site.
2. Ouvrir le site dans un navigateur.
3. Dans Google Analytics, aller dans **Rapports en temps réel**.
4. Vérifier qu’une visite apparaît après quelques secondes.
5. Dans les outils développeur du navigateur, onglet **Network**, vérifier qu’une requête vers `googletagmanager.com` ou `google-analytics.com` apparaît après activation.

### Vérification Search Console

1. Ouvrir Search Console.
2. Utiliser l’outil **Inspection de l’URL** sur la page d’accueil.
3. Vérifier que Google peut explorer la page.
4. Vérifier que le sitemap soumis est lu sans erreur.

### Vérification Clarity

1. Déployer le site avec le vrai Project ID.
2. Visiter le site.
3. Retourner dans Microsoft Clarity.
4. Vérifier que le projet indique avoir reçu des données.
5. Attendre quelques minutes si aucune donnée n’apparaît immédiatement.

## 9. Événements à suivre plus tard

Ne pas les ajouter maintenant. Quand la stratégie de mesure sera validée, suivre uniquement les événements utiles :

- clic WhatsApp ;
- soumission formulaire ;
- clic bouton réservation ;
- clic formulaire/contact.

Recommandation : documenter le nom exact de chaque événement avant de l’ajouter, puis tester dans GA4 DebugView pour éviter les doublons ou un tracking excessif.
