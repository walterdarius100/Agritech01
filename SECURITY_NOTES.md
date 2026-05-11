# Notes sécurité — Agri-Tech

Ce site est un site statique. Les recommandations ci-dessous servent à limiter les abus côté formulaire, analytics et automatisations externes, sans transformer le projet en application backend.

## 1. Recommandations EmailJS

- Utiliser une clé publique EmailJS dédiée à ce site uniquement.
- Ne jamais placer de clé privée, mot de passe email ou token sensible dans `index.html`, `script.js` ou tout autre fichier public.
- Garder les identifiants EmailJS dans la configuration prévue du formulaire, puis vérifier qu’ils ne donnent accès qu’au service nécessaire.
- Utiliser un template EmailJS strict : inclure seulement les champs utiles du formulaire, sans données sensibles inutiles.
- Activer les notifications EmailJS pour détecter rapidement une hausse anormale des envois.
- Vérifier régulièrement l’historique d’envoi EmailJS pour repérer les soumissions suspectes.

## 2. Restrictions de domaines autorisés

Dans le tableau de bord EmailJS :

- ajouter uniquement le domaine officiel de production dans les domaines autorisés ;
- ajouter éventuellement le domaine de préproduction si un environnement de test existe ;
- éviter les règles trop larges comme `*` ou des domaines temporaires oubliés ;
- retirer les domaines de test dès qu’ils ne sont plus utilisés.

Cette restriction est importante parce qu’une clé publique EmailJS reste visible dans le navigateur sur un site statique.

## 3. Quotas et limites d’usage

- Définir un quota EmailJS adapté au volume attendu de demandes.
- Surveiller les quotas mensuels et les pics inhabituels.
- Prévoir une adresse email de réception dédiée aux leads Agri-Tech.
- Éviter d’envoyer plusieurs emails pour une seule soumission tant que le besoin n’est pas confirmé.
- Conserver une copie minimale des demandes dans Google Sheets ou un outil équivalent, si l’intégration est activée.

## 4. Protection anti-abus du formulaire

Le formulaire dispose déjà de protections simples côté front :

- validation des champs requis ;
- validation du format email ;
- champ caché anti-spam de type honeypot ;
- désactivation du bouton pendant l’envoi ;
- messages d’erreur propres en cas de problème.

Recommandations complémentaires :

- ajouter plus tard une vérification serveur si le volume augmente ;
- envisager Turnstile, reCAPTCHA ou une alternative légère seulement si le spam devient un vrai problème ;
- ne pas bloquer agressivement les utilisateurs légitimes sur mobile ;
- limiter la longueur des champs si des abus apparaissent ;
- surveiller les répétitions d’envois depuis les mêmes coordonnées.

## 5. Recommandations Google Apps Script

Si Google Apps Script est utilisé pour enregistrer les demandes :

- ne pas exposer de secrets dans le code client ;
- limiter le script à l’écriture des champs strictement nécessaires ;
- valider et nettoyer les données reçues côté Apps Script ;
- éviter de retourner des informations internes dans les réponses ;
- surveiller les quotas Google Apps Script ;
- protéger le Google Sheet avec des droits d’accès limités ;
- séparer les comptes personnels et les comptes utilisés pour l’activité ;
- tester les permissions après chaque modification de déploiement ;
- documenter l’URL de déploiement active et supprimer les anciens déploiements inutiles.

## 6. Analytics et confidentialité

- GA4 et Microsoft Clarity sont préparés avec des placeholders et ne se chargent pas tant que les vrais identifiants ne sont pas ajoutés.
- Ne pas ajouter Meta Pixel dans ce projet.
- Ne pas suivre tous les clics par défaut.
- Ajouter plus tard uniquement les événements nécessaires : clic WhatsApp, soumission formulaire, clic bouton réservation et clic formulaire/contact.
- Mettre à jour la politique de confidentialité si le site commence à collecter des données analytics en production.

## 7. Limites de sécurité d’un site statique

Un site statique ne peut pas totalement protéger :

- les clés publiques visibles dans le navigateur ;
- les endpoints appelés côté client ;
- les validations faites uniquement en JavaScript ;
- les quotas de services tiers en cas d’abus automatisé ;
- les données envoyées à des services externes mal configurés.

Pour un niveau de sécurité plus élevé, il faudra plus tard ajouter un backend ou une fonction serverless capable de :

- valider les données côté serveur ;
- appliquer du rate limiting ;
- masquer les clés sensibles ;
- journaliser les abus ;
- centraliser les règles de sécurité.
