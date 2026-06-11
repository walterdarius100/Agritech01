# Diagnostic Supabase Auth — Admin Agri-tech

## Vérifier que `admin.html` charge correctement

1. Ouvrez `/admin.html`.
2. Le formulaire de connexion doit être visible si aucune session n’est active.
3. Le dashboard doit être caché avant connexion.
4. Le panneau diagnostic doit afficher : configuration, projet, client initialisé et session.

## Console navigateur

Dans DevTools → Console, cherchez :

- `Supabase config loaded` ;
- `Supabase SDK loaded` ;
- `Supabase client initialized` ;
- `Supabase config missing` si les placeholders sont encore présents ;
- `Supabase key rejected: secret key detected` si une clé interdite a été collée.

La clé complète ne doit jamais apparaître dans la console.

## Network

Dans DevTools → Network :

- vérifiez que `admin.html`, `js/pages/admin.js`, `js/services/supabase-client.js`, `js/services/articles-service.js` ne sont pas en 404 ;
- vérifiez que les requêtes vers `https://xxxxx.supabase.co` utilisent le bon projet ;
- sur Vercel Preview, forcez un redéploiement si les anciens scripts sont encore servis.

## Configuration Supabase

- `SUPABASE_URL` doit ressembler à `https://xxxxx.supabase.co`.
- La clé frontend peut être `sb_publishable_xxx` ou l’ancienne anon public key.
- L’utilisateur Auth doit appartenir au même projet que l’URL et la clé.
- Email/Password doit être activé dans Authentication → Providers.
- Confirmez l’email si la confirmation est exigée.

## Différence entre les clés

- Publishable key `sb_publishable_xxx` : clé frontend publique moderne, acceptable avec RLS.
- Anon public key : ancienne clé publique frontend, acceptable avec RLS.
- Secret key `sb_secret_xxx` : clé privée serveur, interdite côté frontend.
- Service role key : contourne RLS, interdite côté frontend.

La sécurité ne consiste pas à cacher la clé publique : elle vient de Supabase Auth et des policies RLS.

## Erreurs fréquentes

- `Invalid login credentials` : mauvais email, mauvais mot de passe ou mauvais projet Supabase.
- `Email not confirmed` : confirmez l’utilisateur dans Supabase Auth.
- `Supabase client not configured` : placeholders encore présents ou URL invalide.
- `Failed to fetch` : réseau, URL Supabase incorrecte, CDN bloqué ou preview obsolète.
- `404 script not found` : chemin de script incorrect ou déploiement incomplet.
- `Cannot use import statement outside a module` : le script doit être chargé avec `type="module"`.
- `RLS policy violation` : policies manquantes ou utilisateur non authentifié.
- Mauvais projet Supabase : l’URL et la clé ne correspondent pas au projet où l’utilisateur existe.
- Mauvaise clé : secret key ou service role copiée au lieu de la clé publique.
- Vercel Preview pas à jour : redeploy puis vider le cache navigateur.
- Scripts non chargés : vérifier Network et la casse des noms de fichiers.

## Checklist de validation

- [ ] `/admin.html` s’ouvre.
- [ ] Le formulaire login est visible hors session.
- [ ] Le dashboard est caché hors session.
- [ ] Le diagnostic n’affiche aucun secret.
- [ ] Supabase configuré = Oui.
- [ ] Client initialisé = Oui.
- [ ] Connexion Auth réussie.
- [ ] Session active = Oui après login.
- [ ] Lecture admin de tous les articles fonctionne.
- [ ] Création brouillon fonctionne.
- [ ] Publication fonctionne.
- [ ] Upload image fonctionne.
- [ ] `actualites.html` affiche seulement les articles publiés.
- [ ] `article.html?slug=...` affiche l’article publié.
- [ ] Aucune `service_role key` ni `sb_secret_xxx` n’est présente dans la configuration frontend.
