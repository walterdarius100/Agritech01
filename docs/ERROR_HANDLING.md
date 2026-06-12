# Gestion sécurisée des erreurs

Les messages d’erreur affichés sur le site Agri-tech doivent rester utiles pour l’utilisateur sans révéler de détails techniques internes.

## Principes

- Afficher dans l’interface des messages simples, professionnels et orientés action.
- Conserver les détails techniques uniquement dans la console développeur lorsque cela aide au diagnostic.
- Ne jamais injecter dans le DOM une erreur brute provenant de Supabase, EmailJS, du réseau ou d’un objet JavaScript.
- Masquer ou réduire les logs qui pourraient contenir une clé, un jeton, une URL sensible ou un payload utilisateur complet.

## Message utilisateur vs log développeur

Un message utilisateur explique quoi faire ensuite : réessayer, vérifier la connexion, se reconnecter ou contacter le responsable du site.

Un log développeur peut contenir un nom d’erreur, un code ou un statut afin d’aider au debug, mais il ne doit pas exposer de secret ou de données sensibles.

Exemple recommandé :

```js
logClientError('admin sauvegarde article', error);
setMessage(messageBox, getSafeErrorMessage('save-article', error), 'error');
```

## Exemples de messages sécurisés

- `Identifiants incorrects. Vérifiez votre email et votre mot de passe.`
- `Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez.`
- `Action impossible pour le moment. Vérifiez vos droits d’accès ou réessayez.`
- `Impossible de charger les articles. Vérifiez la connexion ou réessayez.`
- `Article introuvable ou indisponible.`
- `Le message n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.`
- `L’image n’a pas pu être envoyée. Vérifiez le fichier puis réessayez.`

## Règle stricte

Ne jamais afficher dans l’interface :

- une erreur brute (`error`, `err`, `error.message`, `JSON.stringify(error)`) ;
- des détails de tables, colonnes, policies, requêtes ou stack traces ;
- des détails EmailJS ou Supabase internes ;
- des chemins internes, clés API, jetons ou payloads sensibles.

Le panneau diagnostic admin peut mentionner l’état général de Supabase, mais il ne doit pas afficher d’erreur brute ni de valeur sensible.
