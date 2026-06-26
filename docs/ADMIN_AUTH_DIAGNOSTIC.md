# Diagnostic Auth Admin — Agri-tech

## Vérifier que `admin.html` charge correctement

1. Ouvrez `/admin.html`.
2. Vérifiez le bloc vert **Agri-tech Admin** en haut de page.
3. Vérifiez que le formulaire email/mot de passe apparaît si vous n’êtes pas connecté.
4. Le dashboard ne doit pas apparaître avant connexion.

## Vérifier la console

Ouvrez DevTools → Console. Logs utiles attendus :

- `Supabase config loaded`
- `Supabase SDK loaded`
- `Supabase client initialized`
- `Supabase config missing` si les placeholders sont encore présents
- `Supabase key rejected: secret key detected` si une clé privée est placée par erreur dans le frontend

La clé complète ne doit jamais être affichée. Si une clé est affichée, elle doit être masquée.

## Vérifier Network

Dans DevTools → Network :

- `admin.html` doit répondre 200.
- `css/pages/admin.css` doit répondre 200.
- `js/pages/admin.js` doit répondre 200.
- `js/services/supabase-client.js` doit répondre 200.
- `js/services/articles-service.js` doit répondre 200.
- Le SDK Supabase CDN doit répondre 200.

Une erreur `404 script not found` indique un mauvais chemin ou une prévisualisation de test pas à jour.

## Vérifier la configuration Supabase

Dans `js/config/supabase-config.js` :

- `SUPABASE_URL` doit ressembler à `https://xxxxx.supabase.co`.
- `SUPABASE_ANON_KEY` doit être une Publishable key `sb_publishable_xxx` ou une ancienne clé anon public.
- Les placeholders `YOUR_SUPABASE_URL` et `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` doivent être remplacés.
- Ne placez jamais de `sb_secret_xxx`, clé `service_role`, `DATABASE_URL` ou `JWT_SECRET`.

## Différences entre les clés

- **Publishable key `sb_publishable_xxx`** : clé publique moderne acceptable côté frontend avec RLS.
- **Ancienne anon public key** : clé publique historique acceptable côté frontend avec RLS.
- **Secret key `sb_secret_xxx`** : clé privée interdite côté frontend.
- **Service role key** : clé serveur qui contourne RLS, interdite côté frontend.

La Publishable key est acceptable dans un site statique parce que les droits réels sont contrôlés par Supabase Auth et RLS. Les clés secret/service role sont interdites car elles peuvent donner des droits serveur ou contourner les protections.

## Créer un utilisateur admin

1. Supabase → Authentication → Providers : activez Email/Password.
2. Supabase → Authentication → Users : créez l’utilisateur admin.
3. Confirmez l’email si la confirmation est activée.
4. Vérifiez que l’utilisateur appartient au même projet que `SUPABASE_URL` et la clé utilisée.

## Erreurs fréquentes

- `Invalid login credentials` : email/mot de passe faux, utilisateur dans le mauvais projet ou email non confirmé selon la configuration.
- `Email not confirmed` : confirmez l’utilisateur dans Authentication.
- `Supabase client not configured` : placeholders non remplacés, URL invalide ou clé refusée.
- `Failed to fetch` : réseau, URL Supabase incorrecte, CDN bloqué ou preview obsolète.
- `404 script not found` : chemin JS/CSS incorrect ou déploiement de test pas à jour.
- `Cannot use import statement outside a module` : la balise script doit avoir `type="module"`.
- `RLS policy violation` : RLS activé mais policies manquantes ou utilisateur non authentifié.
- Mauvais projet Supabase : l’utilisateur existe dans un projet différent de celui des clés.
- Mauvaise clé : clé secret ou service role refusée, clé anon/publishable d’un autre projet.
- prévisualisation de test pas à jour : redéployez la preview.
- Scripts non chargés : vérifiez Network et les chemins relatifs.

## Checklist de validation

- [ ] `/admin.html` répond 200.
- [ ] `admin.css`, `admin.js`, `supabase-client.js`, `articles-service.js` répondent 200.
- [ ] Le panneau diagnostic affiche le projet `xxxxx.supabase.co` sans secret.
- [ ] Client initialisé : Oui.
- [ ] Session active : Non avant login.
- [ ] Login Supabase Auth réussi.
- [ ] Session active : Oui après login.
- [ ] La liste des articles se charge sans erreur RLS.
- [ ] Création, modification, publication, archivage et suppression fonctionnent.
- [ ] Upload Storage vers `article-images` fonctionne.
- [ ] Aucun secret n’est affiché dans la console.
