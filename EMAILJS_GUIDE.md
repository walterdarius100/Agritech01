# Guide EmailJS

## Variables à créer dans ton template EmailJS

Utilise exactement ces variables :

```txt
{{from_name}}
{{from_email}}
{{phone}}
{{need}}
{{message}}
{{consent}}
{{source}}
{{date}}
```

## Dans script.js

Remplace :

```js
publicKey: 'VOTRE_PUBLIC_KEY',
serviceId: 'VOTRE_SERVICE_ID',
templateId: 'VOTRE_TEMPLATE_ID',
```

par les valeurs de ton compte EmailJS.

## Google Sheets

L’endpoint Google Sheets est déjà intégré :

```js
sheetEndpoint: 'https://script.google.com/macros/s/AKfycbw8az8ZK2FHqats3ukKjLgVu-90tkcv1CtoI8dyCmxm1Qg_Z2ucDWP89NBJUpc2CFYc/exec'
```

## Test obligatoire

1. Configure EmailJS.
2. Ouvre ton site.
3. Remplis le formulaire.
4. Vérifie l’email reçu.
5. Vérifie Google Sheets.
