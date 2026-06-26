# Guide EmailJS — formulaire Agri-tech V1

Le formulaire principal est sur `index.html` et son id existant est :

```text
leadForm
```

Les liens directs vers le formulaire doivent utiliser :

```text
index.html#leadForm
```

ou :

```text
https://agritech509ht.com/index.html#leadForm
```

## Réception des messages

Les messages sont envoyés via EmailJS vers l’adresse professionnelle actuelle :

```text
contact@agritech509ht.com
```

Le destinataire est géré dans le template EmailJS. Ne pas modifier le template ou les identifiants si le formulaire fonctionne.

## Variables utilisées dans le template EmailJS

Conserver les noms de variables existants sauf vérification complète du template EmailJS :

```text
{{from_name}}
{{from_email}}
{{phone}}
{{need}}
{{message}}
{{consent}}
{{source}}
{{date}}
```

## Règles importantes

- Le Reply-To doit rester l’email du visiteur (`from_email`).
- Les noms des champs envoyés à EmailJS ne doivent pas être changés sans vérifier le template.
- La clé EmailJS visible côté frontend est une clé publique, mais les domaines autorisés doivent être restreints dans EmailJS.
- Ne pas modifier EmailJS inutilement si l’envoi fonctionne.
- Après toute modification liée au contact, tester une soumission réelle et vérifier la réception sur `contact@agritech509ht.com`.

## Test obligatoire après modification du formulaire

1. Ouvrir `index.html#leadForm`.
2. Remplir le formulaire avec un email de test.
3. Envoyer la demande.
4. Vérifier le message de succès côté navigateur.
5. Vérifier que l’email est reçu sur `contact@agritech509ht.com`.
6. Vérifier que le Reply-To correspond à l’email du visiteur.
