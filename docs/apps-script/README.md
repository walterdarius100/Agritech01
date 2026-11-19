# Accusés de réception des formulaires V1.2

## Projet Apps Script

Dans le classeur **AgriTech Leads**, ouvrez **Extensions → Apps Script**. Repérez le projet qui contient `doPost(e)`, `LEADS_SHEET_NAME` et `importerLeadsSiteVersPipeline()`. Il reçoit les formulaires du site et écrit dans **Leads site web**.

Remplacez uniquement la fonction `doPost(e)` existante par le contenu de [doPost.gs](doPost.gs), qui ajoute aussi `normalizeNewsletterValue_`. Conservez les constantes et les fonctions utilitaires du projet. Le script `onFormSubmit(e)` du Google Form du pipeline relève d’un autre projet.

Après accord, autorisez l’accès à l’envoi de courriels via MailApp si Google le demande, puis publiez une nouvelle version dans le **déploiement Web existant** pour conserver son URL. Si le projet déclare explicitement ses autorisations OAuth dans le manifeste, l’envoi requiert `https://www.googleapis.com/auth/script.send_mail`.

## Vérification EmailJS

Vérifiez dans `template_exmi0m6` que **To Email** utilise `{{to_email}}` ou `{{from_email}}`. Le site alimente les deux variables avec la même adresse saisie. La configuration effective du template reste à vérifier dans EmailJS.

## Validation après accord

La prévisualisation Vercel utilise le point d’entrée Sheets et la configuration EmailJS actuels. Une soumission réelle peut donc écrire dans le classeur et envoyer des courriels.

1. Avec une adresse de test encore absente de la newsletter, envoyer une demande de service sur le site. Envoyer ensuite deux inscriptions avec cette adresse, l’une depuis l’accueil et l’autre depuis un pied de page intérieur. Espacer les soumissions d’au moins dix secondes pour respecter le délai du formulaire EmailJS.
2. Dans **Leads site web**, compter une ligne de service et une ligne `Newsletter` pour cette adresse. La ligne newsletter doit porter le statut `Hors pipeline`.
3. Après l’exécution de `importerLeadsSiteVersPipeline()`, vérifier qu’un seul dossier lié à cette adresse a été créé pour la demande de service.
4. Dans la boîte administrative, vérifier les notifications habituelles pour les trois soumissions. Dans la boîte de test, vérifier un accusé de service et un seul email « Votre inscription à la newsletter Agri-tech », avec **Agri-tech** comme nom d’expéditeur et `contact@agritech509ht.com` comme adresse de réponse.

En simulation, le gestionnaire service appelle Sheets une fois même si l’accusé échoue. Le scénario Apps Script produit deux lignes et une seule ligne admissible à l’import selon le filtre de statut du script existant. Les simulations couvrent aussi un doublon historique, une seconde réception pendant l’envoi et l’échec de MailApp. Les résultats de Sheets, de l’import commercial réel et des boîtes mail restent à vérifier.
