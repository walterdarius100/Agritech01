# Configuration analytics légère — Agri-Tech

Ce document décrit l’intégration analytics actuellement en place sur le site statique Agri-Tech. Les identifiants Google Analytics 4 et Microsoft Clarity sont déjà renseignés dans `index.html` :

- **GA4 Measurement ID** : `G-XJ8ZJX3128` ;
- **Microsoft Clarity Project ID** : `wpmfu7lkb1`.

L’objectif de cette intégration est volontairement limité : mesurer les visites et les sessions sans modifier le design, sans transformer le site en application dynamique et sans ajouter de tracking complexe.

## 1. État actuel de l’intégration

### Google Analytics 4

La configuration GA4 se trouve en bas de `index.html`, juste avant les scripts applicatifs :

```html
window.ANALYTICS_CONFIG = {
  gaMeasurementId: 'G-XJ8ZJX3128',
  clarityProjectId: 'wpmfu7lkb1'
};
```

Le chargement GA4 est encapsulé dans une fonction isolée :

- le Measurement ID est lu depuis `window.ANALYTICS_CONFIG.gaMeasurementId` ;
- le script externe `https://www.googletagmanager.com/gtag/js?id=...` est créé dynamiquement ;
- le script est chargé avec `async` ;
- `window.dataLayer` et `window.gtag` sont initialisés avant l’ajout du script distant ;
- l’appel `gtag('config', measurementId, { anonymize_ip: true })` déclenche le `page_view` standard ;
- aucun événement personnalisé n’est envoyé pour le moment.

Le garde-fou actuel empêche le chargement uniquement si l’identifiant est absent ou si le placeholder `GA_MEASUREMENT_ID` est encore présent. Avec l’ID réel `G-XJ8ZJX3128`, GA4 est donc autorisé à se charger.

### Microsoft Clarity

La configuration Clarity utilise le même objet global `window.ANALYTICS_CONFIG` :

- le Project ID est lu depuis `window.ANALYTICS_CONFIG.clarityProjectId` ;
- le script externe `https://www.clarity.ms/tag/wpmfu7lkb1` est injecté dynamiquement ;
- le script est chargé avec `async` ;
- le snippet Clarity garde sa file d’attente interne si l’objet `window.clarity` n’est pas encore disponible ;
- aucun événement personnalisé Clarity n’est configuré.

Le garde-fou actuel empêche le chargement uniquement si l’identifiant est absent ou si le placeholder `CLARITY_PROJECT_ID` est encore présent. Avec l’ID réel `wpmfu7lkb1`, Clarity est donc autorisé à se charger.

## 2. Vérifications effectuées

### Vérifications statiques du code

- Le Measurement ID GA4 est présent une seule fois dans la configuration centrale.
- Le Project ID Clarity est présent une seule fois dans la configuration centrale.
- Le script GA4 est injecté une seule fois par le bloc analytics dédié.
- Le script Clarity est injecté une seule fois par le bloc analytics dédié.
- Aucun Meta Pixel n’est présent.
- Aucun gestionnaire de tags lourd n’a été ajouté.
- Le site reste statique : les scripts analytics sont de simples scripts côté navigateur, sans backend et sans étape de build.
- Les scripts analytics sont placés en fin de page, après le contenu HTML principal, afin de limiter l’impact sur le rendu initial.

### Vérifications fonctionnelles locales

Les contrôles locaux ont porté sur les points suivants :

- parsing de `index.html` sans erreur HTML bloquante détectée par les contrôles automatisés utilisés ;
- présence d’un seul bloc `window.ANALYTICS_CONFIG` ;
- absence de doublon `gtag/js` dans le code source ;
- absence de doublon `clarity.ms/tag` dans le code source ;
- conservation du chargement `defer` de `script.js` ;
- conservation des ancres principales : `#services`, `#cours`, `#processus`, `#preuves`, `#temoignages`, `#contact` ;
- conservation des éléments nécessaires aux carousels de formations, témoignages et partenariats ;
- conservation des champs et du bouton du formulaire ;
- absence de modification CSS, donc aucun changement volontaire du design ou du responsive.

### Points corrigés pendant la vérification

Les identifiants réels étaient bien renseignés, mais les garde-fous de chargement comparaient encore les valeurs aux identifiants réels au lieu de les comparer aux placeholders. Résultat : GA4 et Clarity pouvaient rester désactivés malgré la présence des bons IDs.

Le correctif appliqué est minimal :

- GA4 est maintenant bloqué uniquement si `gaMeasurementId` vaut `GA_MEASUREMENT_ID` ;
- Clarity est maintenant bloqué uniquement si `clarityProjectId` vaut `CLARITY_PROJECT_ID` ;
- les IDs réels existants n’ont pas été changés ;
- aucun design, formulaire, carousel, style ou refactor global n’a été modifié.

## 3. Bonnes pratiques respectées

- **Chargement asynchrone** : GA4 et Clarity sont chargés en `async`, ce qui limite le blocage du rendu.
- **Configuration centralisée** : les deux identifiants sont regroupés dans `window.ANALYTICS_CONFIG`.
- **Garde-fous anti-placeholder** : les scripts ne se chargent pas si un placeholder documenté est encore présent.
- **Tracking léger** : seul le suivi standard de page/session est actif.
- **Pas de tracking redondant** : aucune double inclusion directe des scripts GA4 ou Clarity n’a été détectée.
- **Compatibilité site statique** : aucun framework, routeur, backend ni build step n’est nécessaire.
- **Séparation des responsabilités** : les scripts analytics restent séparés de `script.js`, qui gère l’interface, le formulaire, les carousels et la navigation.

## 4. Points à surveiller

- **Consentement et conformité** : selon les marchés ciblés et la réglementation applicable, ajouter une bannière de consentement ou un mode consentement peut devenir nécessaire.
- **Bloqueurs de publicité** : certains navigateurs, extensions ou réglages de confidentialité peuvent bloquer GA4 ou Clarity ; ce comportement est normal et ne doit pas être considéré comme une erreur du site.
- **Données en temps réel** : GA4 et Clarity peuvent avoir un délai d’affichage. GA4 est généralement plus rapide dans le rapport temps réel ; Clarity peut nécessiter quelques minutes.
- **Environnements de test** : éviter d’interpréter les visites locales comme du trafic réel si le site est testé sur un domaine public temporaire.
- **Événements futurs** : documenter chaque événement avant de l’ajouter afin d’éviter les doublons, les noms incohérents et le tracking excessif.
- **Formulaire** : le formulaire utilise déjà EmailJS et un endpoint Google Apps Script. Ne pas mélanger l’envoi du formulaire avec des événements analytics tant qu’une stratégie de mesure n’est pas validée.

## 5. Tester que GA4 fonctionne

### Dans le navigateur

1. Déployer le site sur le domaine public.
2. Ouvrir une fenêtre privée ou un navigateur sans bloqueur de publicité.
3. Ouvrir les DevTools.
4. Aller dans l’onglet **Network**.
5. Filtrer sur `gtag`, `googletagmanager` ou `google-analytics`.
6. Recharger la page.
7. Vérifier qu’une requête vers `https://www.googletagmanager.com/gtag/js?id=G-XJ8ZJX3128` apparaît.
8. Vérifier qu’aucune erreur JavaScript liée à `gtag`, `dataLayer` ou `ANALYTICS_CONFIG` n’apparaît dans la console.

### Dans Google Analytics

1. Aller sur <https://analytics.google.com/>.
2. Ouvrir la propriété GA4 du site.
3. Aller dans **Rapports** → **Temps réel**.
4. Visiter le site depuis un navigateur non bloqué.
5. Attendre quelques secondes.
6. Vérifier qu’au moins un utilisateur actif ou un `page_view` apparaît.

### Avec DebugView GA4 si nécessaire

Pour un diagnostic plus avancé :

1. Activer l’extension Google Analytics Debugger ou utiliser un environnement de debug contrôlé.
2. Ouvrir GA4 → **Admin** → **DebugView**.
3. Recharger la page.
4. Vérifier que le `page_view` standard apparaît une seule fois par chargement de page.

## 6. Tester que Microsoft Clarity fonctionne

### Dans le navigateur

1. Déployer le site sur le domaine public.
2. Ouvrir une fenêtre privée ou un navigateur sans bloqueur de publicité.
3. Ouvrir les DevTools.
4. Aller dans l’onglet **Network**.
5. Filtrer sur `clarity` ou `clarity.ms`.
6. Recharger la page.
7. Vérifier qu’une requête vers `https://www.clarity.ms/tag/wpmfu7lkb1` apparaît.
8. Vérifier qu’aucune erreur JavaScript liée à `clarity` ou `ANALYTICS_CONFIG` n’apparaît dans la console.

### Dans Microsoft Clarity

1. Aller sur <https://clarity.microsoft.com/>.
2. Ouvrir le projet Agri-Tech.
3. Consulter **Dashboard** pour les métriques globales.
4. Consulter **Recordings** pour vérifier que des sessions sont enregistrées.
5. Consulter **Heatmaps** après accumulation de trafic suffisant.
6. Attendre quelques minutes si aucune donnée n’apparaît immédiatement après une visite de test.

## 7. Où regarder les données

### Google Analytics 4

- **Rapports → Temps réel** : vérifier rapidement que le trafic arrive.
- **Rapports → Engagement → Pages et écrans** : voir les pages consultées.
- **Rapports → Acquisition** : comprendre les sources de trafic.
- **Admin → Flux de données** : vérifier le Measurement ID, le domaine et l’état du flux web.
- **Admin → DebugView** : diagnostiquer les événements pendant les tests.

### Microsoft Clarity

- **Dashboard** : suivre les sessions, pages vues, comportements agrégés et indicateurs UX.
- **Recordings** : revoir des sessions anonymisées selon les paramètres Clarity.
- **Heatmaps** : analyser les clics, scrolls et zones d’attention.
- **Settings → Setup** : vérifier le Project ID et le statut d’installation.

## 8. Limitations actuelles du tracking léger

- Le tracking actuel mesure surtout les chargements de page et les sessions.
- Aucun événement personnalisé n’est envoyé pour les clics WhatsApp, les clics réseaux sociaux, les clics CTA, les soumissions de formulaire ou les interactions de carousels.
- Le site est une page statique : il n’y a pas de suivi spécifique de routes SPA.
- Les conversions ne sont pas encore configurées dans GA4.
- Les tests peuvent être affectés par les bloqueurs de scripts, la navigation privée, les restrictions navigateur ou les délais des plateformes.
- L’anonymisation IP est demandée côté GA4 via `anonymize_ip`, mais la conformité complète dépend aussi des paramètres de propriété, de consentement et des obligations légales applicables.

## 9. Recommandations futures

Ne pas ajouter de tracking supplémentaire tant que les objectifs de mesure ne sont pas validés. Si un suivi plus fin devient nécessaire, commencer par une liste courte et documentée :

- soumission réussie du formulaire ;
- clic WhatsApp ;
- clic sur un bouton principal de consultation ;
- clic vers les formations ;
- clic vers les réseaux sociaux si réellement utile.

Avant toute extension :

1. définir le nom exact de chaque événement ;
2. préciser le déclencheur ;
3. tester dans GA4 DebugView ;
4. vérifier l’absence de doublons ;
5. documenter le changement dans ce fichier ;
6. éviter les données personnelles dans les paramètres analytics.
