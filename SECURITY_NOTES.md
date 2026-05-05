# Notes sécurité

## Ce qui est corrigé

- Le formulaire n’utilise plus `mailto`
- Les champs dynamiques sont échappés avec `escapeHtml`
- Un champ caché anti-spam simple est présent
- Le bouton est désactivé pendant l’envoi
- EmailJS doit être configuré avant tout envoi réel
- Les images sont locales pour réduire la dépendance externe

## Limites

- EmailJS côté front expose une clé publique. C’est normal, mais il faut limiter les domaines autorisés dans EmailJS.
- Google Apps Script doit être surveillé : ne publie pas de données sensibles.
- Pour un vrai niveau entreprise, il faudra un backend sécurisé plus tard.
