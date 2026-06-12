# Rapport d’audit complet du site Agri-tech

## 2. Informations générales

* **Date de l’audit :** 11 juin 2026.
* **Branche auditée :** `work`.
* **Pages auditées :**
  * `index.html` — page d’accueil, services en aperçu, formations en aperçu, actualités en aperçu, contact, newsletter et footer.
  * `services.html` — page services et filtres.
  * `formations.html` — page formations et préinscription.
  * `actualites.html` — liste publique des articles publiés.
  * `article.html` — page détail d’article chargée par slug.
  * `admin.html` — espace d’administration des actualités.
  * `politique-confidentialite.html` — page légale confidentialité.
  * `mentions-legales.html` — page mentions légales.
  * `robots.txt` et `sitemap.xml` — indexation et découverte SEO.
* **Technologies concernées :** HTML, CSS, JavaScript, Supabase, EmailJS, Vercel, GitHub Pages.

## 3. Résumé exécutif

* **État général du site :** le site est bien structuré pour une publication vitrine, avec plusieurs pages publiques, une navigation cohérente, des pages légales, des métadonnées SEO de base, un sitemap, un robots.txt, un formulaire EmailJS, une newsletter et une intégration Supabase pour les actualités.
* **Niveau de préparation à la publication :** **prêt sous conditions**. Les pages publiques peuvent être publiées après vérification finale en navigateur, mais la publication officielle dépend surtout de la validation Supabase/RLS, de l’accès admin, des formulaires publics et de l’absence d’erreurs console critiques.
* **Risques principaux :**
  * accès Supabase public dépendant entièrement des règles RLS ;
  * espace admin accessible par URL même si protégé par Supabase Auth ;
  * clés publiques et endpoints visibles côté client, à contrôler strictement côté fournisseurs ;
  * upload d’images à sécuriser au niveau Supabase Storage ;
  * formulaires publics exposés au spam malgré honeypot et limite EmailJS ;
  * rendu HTML dynamique à surveiller pour éviter toute régression XSS ;
  * sitemap statique insuffisant pour les slugs d’articles réels.
* **Recommandation globale :** publier uniquement après une passe de validation fonctionnelle complète et après confirmation écrite que les policies RLS Supabase empêchent la lecture des brouillons et toutes les écritures non autorisées.

## 4. Problèmes détectés

### Problème 1 — RLS Supabase non vérifié dans le dépôt

* **Page/fichier concerné :** `js/services/articles-service.js`, `js/config/supabase-config.js`, documentation Supabase.
* **Gravité :** critique.
* **Impact :** si les policies RLS sont absentes ou trop permissives, un visiteur peut potentiellement lire des brouillons ou tenter des écritures via la clé publique.
* **Cause probable :** les règles de sécurité sont configurées dans Supabase, donc elles ne sont pas prouvées uniquement par le code frontend.
* **Solution recommandée :** vérifier dans Supabase que RLS est activé sur `articles` et `blog-images`, que la lecture publique filtre uniquement `status = 'published'`, et que les opérations insert/update/delete nécessitent un utilisateur authentifié autorisé.
* **Effort estimé :** moyen.

### Problème 2 — Configuration Supabase exposée côté client

* **Page/fichier concerné :** `js/config/supabase-config.js`.
* **Gravité :** élevée.
* **Impact :** l’URL du projet et une clé publique Supabase sont visibles dans le navigateur. C’est normal pour une clé anon/publishable, mais dangereux si une clé secrète ou service role est ajoutée par erreur.
* **Cause probable :** site statique sans backend, configuration nécessaire côté frontend.
* **Solution recommandée :** conserver uniquement une clé publique masquée dans la documentation, ne jamais commiter `service_role`, `sb_secret_*`, `DATABASE_URL` ou `JWT_SECRET`, et migrer vers une clé publishable moderne si possible. Toute clé mentionnée dans la documentation doit rester masquée, par exemple `eyJhbGci…****`.
* **Effort estimé :** faible.

### Problème 3 — Administration accessible par URL publique

* **Page/fichier concerné :** `admin.html`, `js/pages/admin.js`.
* **Gravité :** élevée.
* **Impact :** la page admin est découvrable. La sécurité repose sur Supabase Auth et RLS ; si les policies sont incorrectes, l’interface peut faciliter des actions non autorisées.
* **Cause probable :** architecture statique compatible GitHub Pages/Vercel.
* **Solution recommandée :** conserver `noindex,nofollow`, vérifier Supabase Auth, limiter les domaines autorisés, réserver les opérations admin à un rôle/claim spécifique et envisager une protection serveur si le trafic augmente.
* **Effort estimé :** moyen.

### Problème 4 — Upload d’images dépendant des règles Storage

* **Page/fichier concerné :** `admin.html`, `js/services/articles-service.js`.
* **Gravité :** élevée.
* **Impact :** si le bucket accepte des écritures publiques, des fichiers indésirables peuvent être téléversés ; si les types MIME ne sont pas filtrés, des contenus risqués peuvent être stockés.
* **Cause probable :** contrôle principal côté Supabase Storage, seulement taille/type de base côté formulaire.
* **Solution recommandée :** limiter l’upload aux utilisateurs admin, imposer les types `image/jpeg`, `image/png`, `image/webp`, limiter la taille, refuser les extensions dangereuses et servir les images depuis un bucket avec règles maîtrisées.
* **Effort estimé :** moyen.

### Problème 5 — Formulaires publics exposés au spam

* **Page/fichier concerné :** `index.html`, footer newsletter, `js/app.js`, `js/pages/footer-newsletter.js`, `js/config.js`.
* **Gravité :** moyenne.
* **Impact :** des robots peuvent soumettre le formulaire de contact ou la newsletter, consommer les quotas EmailJS ou polluer Google Sheets.
* **Cause probable :** formulaires publics frontend, protection limitée à un honeypot, `blockHeadless` et une limite de débit EmailJS.
* **Solution recommandée :** ajouter une protection anti-abus plus robuste côté fournisseur ou backend/serverless : CAPTCHA léger, validation serveur, quotas par IP, allowlist de domaines EmailJS et surveillance des erreurs.
* **Effort estimé :** moyen.

### Problème 6 — Endpoint Google Apps Script visible

* **Page/fichier concerné :** `js/config.js`.
* **Gravité :** moyenne.
* **Impact :** l’endpoint peut être appelé directement par des tiers, ce qui peut générer du spam ou des écritures non désirées.
* **Cause probable :** stockage lead déclenché depuis le navigateur en `no-cors`.
* **Solution recommandée :** contrôler les entrées côté Apps Script, ajouter un jeton public à rotation si acceptable, journaliser les abus, filtrer les domaines et envisager une fonction serverless intermédiaire.
* **Effort estimé :** moyen.

### Problème 7 — Sitemap statique sans slugs d’articles

* **Page/fichier concerné :** `sitemap.xml`, `article.html`, `data/articles.json`, Supabase.
* **Gravité :** moyenne.
* **Impact :** les articles réels chargés par `?slug=` ne sont pas listés individuellement, ce qui réduit la découvrabilité SEO.
* **Cause probable :** site statique sans génération automatique du sitemap.
* **Solution recommandée :** générer `sitemap.xml` à partir des articles publiés, avec une URL par slug, ou utiliser des URLs réécrites si Vercel est choisi.
* **Effort estimé :** moyen.

### Problème 8 — Meta SEO de la page article peu spécifique avant rendu JS

* **Page/fichier concerné :** `article.html`, `js/pages/article-page.js`.
* **Gravité :** moyenne.
* **Impact :** certains crawlers ou aperçus sociaux peuvent lire seulement les métadonnées génériques avant exécution JavaScript.
* **Cause probable :** page article unique rendue côté client.
* **Solution recommandée :** générer des pages statiques par article, utiliser Vercel avec rendu/pré-génération, ou injecter Open Graph dynamiques côté serveur.
* **Effort estimé :** élevé.

### Problème 9 — Dépendances CDN sans stratégie CSP documentée

* **Page/fichier concerné :** pages HTML, EmailJS, Supabase SDK, Google Fonts.
* **Gravité :** moyenne.
* **Impact :** en cas d’injection future, l’absence de Content Security Policy limite la défense en profondeur.
* **Cause probable :** site statique sans headers de sécurité centralisés.
* **Solution recommandée :** définir des headers CSP, `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy` sur Vercel ; sur GitHub Pages, documenter les limites et minimiser les scripts externes.
* **Effort estimé :** moyen.

### Problème 10 — Validation téléphone peu stricte

* **Page/fichier concerné :** `js/utils/sanitize.js`, `js/app.js`.
* **Gravité :** faible.
* **Impact :** des numéros incomplets ou mal formés peuvent être envoyés.
* **Cause probable :** sanitisation simple plutôt que validation métier.
* **Solution recommandée :** imposer une longueur minimale et un format attendu, ou ajouter une validation adaptée aux numéros haïtiens/internationaux.
* **Effort estimé :** faible.

### Problème 11 — Console smoke tests non suffisants pour la CI

* **Page/fichier concerné :** `js/app.js`.
* **Gravité :** faible.
* **Impact :** les assertions navigateur aident au debug mais ne protègent pas automatiquement les merges.
* **Cause probable :** absence de pipeline de tests automatisés.
* **Solution recommandée :** ajouter au minimum un check HTML, un linter JS/CSS et un test Playwright de navigation/formulaire en CI.
* **Effort estimé :** moyen.

### Problème 12 — Images et ressources à optimiser avant trafic réel

* **Page/fichier concerné :** `assets/images/`, pages publiques, CSS.
* **Gravité :** faible.
* **Impact :** chargement mobile potentiellement plus lent si les images ne sont pas compressées ou dimensionnées.
* **Cause probable :** site vitrine riche en visuels.
* **Solution recommandée :** compresser les images, vérifier les dimensions réelles, utiliser WebP/AVIF lorsque possible et prioriser l’image hero.
* **Effort estimé :** moyen.

## 5. Vulnérabilités et risques de sécurité

### Supabase

* La configuration frontend doit uniquement contenir une URL publique et une clé anon/publishable.
* Le client charge le SDK Supabase côté navigateur ; toute règle de sécurité doit donc être appliquée côté Supabase, pas seulement dans JavaScript.
* Les erreurs Supabase basculent vers un fallback local pour les lectures publiques, ce qui est utile pour la disponibilité mais peut masquer un problème de configuration pendant les tests.

### RLS

* RLS doit être activé sur toutes les tables exposées au navigateur.
* La table `articles` doit autoriser la lecture publique uniquement pour `status = 'published'`.
* Les statuts `draft` ne doivent jamais être lisibles publiquement.
* Les opérations de création, modification, retour en brouillon, suppression et mise à la une doivent être réservées à des comptes admin authentifiés.

### Clés publiques / clés secrètes

* La clé Supabase visible dans le dépôt doit rester une clé publique anon/publishable. Aucune clé secrète ne doit être ajoutée.
* Si une clé est documentée, elle doit être masquée : `eyJhbGci…****` ou `sb_publishable_…****`.
* Les clés `service_role`, `sb_secret_*`, `DATABASE_URL`, `JWT_SECRET`, tokens SMTP ou tokens GitHub ne doivent jamais être présents côté client.

### Auth admin

* L’interface admin indique que les identifiants ne sont pas codés dans le site, ce qui est positif.
* L’accès réel dépend de Supabase Auth ; il faut tester connexion, déconnexion, expiration de session et accès direct à `admin.html`.
* Recommandation : limiter les droits admin à une liste d’utilisateurs ou à un rôle dédié plutôt qu’à tout utilisateur authentifié.

### Rendu des articles

* Les titres, résumés, catégories, auteurs, URLs et paragraphes sont échappés avant injection HTML, ce qui réduit fortement le risque XSS.
* Le contenu d’article est rendu en paragraphes texte, sans Markdown/HTML brut. C’est une bonne protection.
* Toute future prise en charge de HTML enrichi ou Markdown devra passer par une sanitisation stricte.

### Upload images

* Le formulaire limite l’intention utilisateur à des fichiers image et mentionne 4 Mo maximum.
* La validation critique doit rester côté Supabase Storage : type MIME, taille, authentification et chemin de stockage.
* Les URLs d’images de couverture saisies manuellement doivent être surveillées pour éviter du contenu tiers non maîtrisé.

### EmailJS

* La clé EmailJS est une clé publique côté frontend ; elle ne doit pas être considérée comme secrète.
* Il faut restreindre les domaines autorisés dans EmailJS, surveiller les quotas et vérifier que les templates ne permettent pas l’injection de contenu dangereux.
* Le formulaire utilise `blockHeadless` et une limite de débit, mais cela ne remplace pas une protection serveur.

### Formulaires publics

* Les formulaires contact et newsletter sont publics et peuvent recevoir du spam.
* Les champs obligatoires, l’email regex, le consentement et le honeypot sont utiles mais insuffisants contre des abus ciblés.
* Ajouter une protection anti-bot ou une validation serveur avant une campagne publique.

### XSS potentiel

* Risque actuel : faible à moyen grâce à `escapeHtml` sur les rendus dynamiques.
* Risque futur : élevé si un éditeur ajoute du HTML brut dans les articles, ou si des attributs dynamiques non échappés sont introduits.
* Recommandation : interdire HTML brut dans Supabase ou utiliser un sanitizer robuste si contenu riche nécessaire.

### Spam

* Risque moyen sur contact/newsletter et endpoint Google Apps Script.
* Surveiller les quotas EmailJS, les logs Apps Script et les taux d’échec.
* Ajouter des limites côté backend/fournisseur si les volumes augmentent.

### Exposition d’informations sensibles

* Ne pas afficher de message d’erreur technique complet aux visiteurs publics.
* Ne pas exposer dans les logs navigateur des secrets, tokens ou données personnelles.
* Les diagnostics admin doivent rester utiles mais ne doivent jamais afficher une clé complète.

## 6. Audit navigation

* **Navbar :** navigation principale cohérente entre les pages publiques ; menu mobile prévu avec bouton et `aria-expanded`.
* **Footer :** liens de contact, newsletter et pages légales présents ; vérifier que toutes les pages utilisent le même footer et que les liens ne divergent pas.
* **Liens CTA :** les CTA vers `index.html#contact` et les paramètres `?need=` sont utiles pour préremplir le formulaire ; tester chaque CTA après modification des services/formations.
* **Pages légales :** `politique-confidentialite.html` et `mentions-legales.html` existent et sont listées dans le README/sitemap.
* **Pages Actualités :** `actualites.html` liste les articles publiés, filtre par catégorie et pagine les résultats.
* **Page Article :** `article.html?slug=...` charge un article publié ; si le slug manque ou est invalide, une page introuvable est affichée.
* **Admin :** `admin.html` est séparé, noindex et protégé fonctionnellement par Supabase Auth ; accès réel à tester avec un compte valide.
* **Ancres :** `#contact`, `#top` et les liens internes doivent être testés sur mobile et desktop.
* **Liens cassés :** aucun lien cassé évident dans la structure principale, mais une vérification automatisée est recommandée avant merge.

## 7. Audit UX/UI

* **Page d’accueil :** claire, orientée conversion, avec services, formations, actualités, témoignages, partenariats et formulaire. Le préremplissage du besoin améliore l’expérience.
* **Services :** page dédiée utile, filtres et CTA cohérents. Vérifier la lisibilité mobile des cartes et l’ordre des catégories.
* **Formations :** bonne séparation entre formations disponibles/à venir et CTA de préinscription. Vérifier que les libellés envoyés au formulaire restent compréhensibles.
* **Actualités :** liste, article à la une, pagination et filtres améliorent la navigation. Prévoir un état vide clair si Supabase/local ne retourne aucun article.
* **Article :** rendu simple et lisible, avec image, byline et articles liés. Limite actuelle : pas de contenu enrichi ni de sommaire pour longs articles.
* **Admin :** interface lisible avec diagnostic, login, liste et formulaire. À améliorer : feedback de progression upload, confirmation avant suppression, et indicateurs plus détaillés sur RLS/policies.
* **Mobile :** menu mobile, carrousels et lazy loading sont prévus ; test réel requis sur petits écrans.
* **Cohérence graphique :** identité verte/crème cohérente, composants réutilisables, typographie Inter homogène.

## 8. Audit performance

* **Images :** plusieurs images sont chargées avec `loading="lazy"` et dimensions déclarées ; compresser les assets et vérifier le poids total mobile.
* **Lazy loading :** utilisé sur les cartes articles et plusieurs images ; l’image principale hero doit rester prioritaire si elle influence le LCP.
* **Scripts :** JavaScript modulaire, chargé en modules. Le SDK Supabase est importé dynamiquement uniquement au besoin.
* **CSS :** CSS organisé en fichiers (`main`, variables, layout, composants, pages). Vérifier la taille finale et supprimer les styles morts si le site grandit.
* **Chargement Supabase :** si Supabase échoue, les articles peuvent basculer vers les données locales ; attention à ne pas masquer des pannes en production.
* **Favicon :** favicon SVG présent avec version query, positif pour cache busting.
* **Mobile :** carrousels et images peuvent impacter les performances ; tester Lighthouse mobile après compression.

## 9. Audit SEO

* **Title :** titres présents sur les pages principales.
* **Meta description :** descriptions présentes sur les pages principales.
* **H1/H2 :** structure globale correcte ; vérifier qu’une seule balise H1 principale existe par page après rendu dynamique.
* **Sitemap :** `sitemap.xml` existe mais doit être enrichi avec les URLs d’articles publiés.
* **Robots :** `robots.txt` autorise l’indexation et pointe vers le sitemap.
* **Open Graph :** la page d’accueil dispose d’Open Graph plus complet ; étendre OG/Twitter aux pages services, formations, actualités et articles.
* **Alt images :** les rendus dynamiques utilisent des alt basés sur les titres ; vérifier les images décoratives avec `alt=""`.
* **Slugs :** génération de slug propre côté JS. Ajouter une contrainte unique côté Supabase.
* **Pages articles :** page article client-side moins optimale pour les crawlers et partages sociaux. Prévoir génération statique ou rendu serveur pour une stratégie SEO forte.

## 10. Audit accessibilité

* **Contraste :** palette globalement lisible ; vérifier les badges, boutons secondaires et textes sur images avec un outil de contraste.
* **Labels :** formulaires admin/contact/newsletter ont des labels ou messages. Vérifier tous les champs après changements.
* **Navigation clavier :** boutons et liens sont accessibles, carrousels gèrent le focus en pause ; tester au clavier complet.
* **Focus visible :** à vérifier sur tous les composants personnalisés, notamment filtres, dots de carrousel et boutons admin.
* **Alt text :** alt dynamiques présents pour les articles ; garder `alt=""` pour images strictement décoratives.
* **Structure sémantique :** usage de sections, articles, header/footer/main globalement bon.
* **Lisibilité mobile :** tester taille des textes, espacements, zones tactiles et formulaires sur 320–390 px.

## 11. Priorisation des corrections

## Priorité 1 — À corriger avant publication officielle

* Vérifier et documenter les policies RLS Supabase pour `articles` et `blog-images`.
* Tester que seuls les articles `published` sont visibles publiquement.
* Tester que les brouillons ne sont jamais visibles via `actualites.html` ou `article.html?slug=...`.
* Tester l’accès admin avec un compte autorisé et avec un utilisateur non autorisé.
* Confirmer qu’aucune clé secrète Supabase, EmailJS, Google, GitHub ou Vercel n’est exposée.
* Tester EmailJS contact + newsletter avec domaines autorisés.
* Vérifier la console navigateur sur toutes les pages publiques et admin.
* Vérifier les liens internes, CTA et pages légales.

## Priorité 2 — À corriger rapidement après publication

* Ajouter des protections anti-spam renforcées pour contact/newsletter.
* Ajouter une confirmation avant suppression d’article.
* Ajouter une validation téléphone plus stricte.
* Ajouter des headers sécurité sur Vercel ou documenter les limites GitHub Pages.
* Ajouter un test automatisé simple de navigation et de publication article.

## Priorité 3 — Améliorations utiles

* Générer un sitemap incluant chaque article publié.
* Ajouter Open Graph/Twitter dynamiques ou pages statiques par article.
* Optimiser/comprimer toutes les images.
* Ajouter un indicateur de progression upload image.
* Ajouter un état admin plus détaillé : RLS testé, bucket accessible, domaine autorisé.

## Priorité 4 — Optimisations futures

* Migrer l’admin vers une app protégée côté serveur si l’activité augmente.
* Mettre en place CI avec lint HTML/CSS/JS et tests Playwright.
* Ajouter une génération statique complète des articles.
* Ajouter une CSP stricte et des headers de sécurité complets.
* Ajouter monitoring erreurs frontend et suivi de performance.

## 12. Checklist finale avant merge vers main

- [ ] Admin accessible
- [ ] Connexion Supabase fonctionnelle
- [ ] Création article fonctionnelle
- [ ] Articles publiés visibles publiquement
- [ ] Brouillons non visibles publiquement
- [ ] Brouillons non visibles publiquement
- [ ] RLS vérifié
- [ ] Aucune clé secrète exposée
- [ ] Formulaire EmailJS testé
- [ ] Pages responsive testées
- [ ] Console sans erreur critique
- [ ] Liens internes vérifiés
- [ ] SEO de base vérifié
- [ ] Pages légales accessibles

## 13. Recommandations finales

* **Ce qui peut bloquer la publication :**
  * RLS non confirmé ou policies Supabase trop larges ;
  * admin incapable de créer/publier un article ;
  * brouillons visibles publiquement ;
  * clé secrète exposée dans le dépôt ou dans le navigateur ;
  * formulaire EmailJS inutilisable ou domaines non restreints ;
  * erreurs console critiques sur les pages principales.
* **Ce qui peut attendre :**
  * génération statique des articles ;
  * Open Graph dynamique par article ;
  * optimisation avancée d’images ;
  * tests end-to-end complets ;
  * monitoring et analytics avancés.
* **Ordre recommandé des prochaines corrections :**
  1. Valider Supabase Auth, RLS et Storage.
  2. Tester le workflow admin complet : connexion, création, publication, retour en brouillon, suppression, upload.
  3. Tester le site public : accueil, services, formations, actualités, article, pages légales, mobile.
  4. Tester EmailJS et l’endpoint de stockage lead.
  5. Corriger les erreurs console et liens cassés.
  6. Optimiser SEO articles, sitemap et images.
* **Décision recommandée :** **prêt sous conditions**. Le site public est proche d’une publication, mais l’officialisation doit attendre la validation des points de sécurité et de fonctionnement listés en priorité 1.
