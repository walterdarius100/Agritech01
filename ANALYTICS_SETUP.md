# Analytics — état actuel Agri-tech V1

Le site live utilise actuellement Microsoft Clarity pour l’analyse comportementale.

## État actuel

- Microsoft Clarity est activé dans `js/analytics.js`.
- Cloudflare Web Analytics n’est pas activé pour le moment.
- Google Analytics n’est pas prioritaire actuellement.
- Aucun nouvel outil analytics ne doit être ajouté sans décision explicite.

## Objectif

Garder un suivi simple et stable : observer les parcours visiteurs, détecter les points de friction et éviter d’alourdir inutilement le site.

## Règles de maintenance

- Ne pas multiplier les outils analytics.
- Ne pas modifier l’identifiant Clarity si le suivi fonctionne.
- Vérifier la console navigateur après toute modification liée aux scripts tiers.
- Documenter tout nouvel événement avant de l’ajouter.
- Tester le site sur desktop et mobile après toute modification analytics.

## Outils non prioritaires

Google Analytics et Cloudflare Web Analytics pourront être réévalués plus tard, mais ils ne font pas partie de la configuration active documentée pour la V1.
