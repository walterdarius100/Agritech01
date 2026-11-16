# Guide EmailJS — Agri-tech V1.2

Le formulaire principal `index.html#leadForm` conserve le service
`service_z856n3l`, la clé publique existante et la notification
`template_pzsnmea`. La documentation historique indique le destinataire
`contact@agritech509ht.com` ; sa configuration effective est dans EmailJS et
n’a pas été vérifiée depuis le dépôt. Aucun identifiant de production changé.

## Notification principale

Conserver les variables `from_name`, `from_email`, `phone`, `need`, `message`,
`consent`, `source`, `date`, ainsi que les alias `SOURCE`, `TYPE_CONTACT`.
Destinataire professionnel fixe à vérifier dans le tableau de bord ; Reply-To
`{{from_email}}`. Une réponse API acceptée indique une prise en charge, pas une
livraison dans la boîte de réception. Les demandes ne constituent pas un
consentement newsletter.

## Autoréponse : action manuelle avant activation

`autoReplyTemplateId` reste vide et `autoReplyVerified` reste `false`.
Le propriétaire doit créer et vérifier un template distinct :

- To Email : `{{from_email}}` (adresse validée du visiteur).
- To Name : `{{from_name}}`.
- From : identité Agri-tech et expéditeur authentifié du service EmailJS.
- Reply-To : `contact@agritech509ht.com`, après vérification de cette boîte.
- Objet : « Agri-tech — réception de votre demande ».
- Variables de contenu : `{{from_name}}`, `{{need}}` ; les variables principales
  restent disponibles, mais ne pas recopier inutilement les coordonnées/message.

Exemple de corps en français :

> Bonjour {{from_name}},
>
> Nous accusons réception de votre demande concernant « {{need}} ».
> Agri-tech prendra contact avec vous pour échanger sur votre demande.
> Cet accusé de réception ne vaut ni acceptation de la demande, ni confirmation
> de service ou de réservation.
>
> L’équipe Agri-tech
> https://agritech509ht.com

Vérifier l’échappement des variables dans le rendu du template (aucun HTML brut
issu des champs). Vérifier les quotas, la protection anti-abus et les domaines
origin autorisés : domaine de production réellement utilisé, variante www
uniquement si utilisée ; environnement de test uniquement si approuvé.
Ne mettre aucune clé privée dans le frontend.

Vérifier également que la notification principale n’a pas déjà une autoréponse
EmailJS liée : il faut un seul mécanisme de réponse pour éviter deux emails.
Après vérification des destinations et d’un test contrôlé sur une adresse du
propriétaire, renseigner l’identifiant réel et passer `autoReplyVerified` à
`true` dans une modification revue et autorisée. Aucune activation dans ce
chantier. Les tests automatisés simulent tous les appels.

La notification est prioritaire ; son échec bloque les opérations secondaires.
L’autoréponse utilise un compartiment de limitation distinct pour ne pas être
bloquée par le throttle global de dix secondes ; `blockHeadless` reste actif.
L’échec de réponse ne transforme pas une notification acceptée en échec global.
Le stockage est ensuite tenté indépendamment, avec limite de quinze secondes.
Les erreurs ne journalisent ni coordonnées ni corps de message.

## Parcours contact Supabase raccordé pour publication

Le frontend de la PR active maintenant Supabase : la demande est enregistrée
avant toute notification et EmailJS est appelé côté Edge selon ses réglages
vérifiés. Le chemin navigateur décrit plus haut concerne le fonctionnement
historique avec le flag faux et la newsletter. Aucun réglage EmailJS réel ni
identifiant de production n’a été modifié. La [courte checklist finale](docs/contact-release.md)
remplace les étapes de préparation déjà effectuées par le propriétaire.

**Le fournisseur connecté à `service_z856n3l` est inconnu.** EmailJS peut utiliser
Zoho ou un autre transport : ne pas revendiquer d’indépendance vis-à-vis de Zoho.
La checklist Dashboard, les verrous fournisseur/templates, les secrets Edge,
les quotas partagés avec la newsletter et les validations de mise en service
figurent dans [l’architecture préparée](docs/contact-requests-architecture.md).
Contact et newsletter partagent actuellement `template_pzsnmea` : vérifier ses
réponses liées avant tout futur changement ; n’en activer aucune ici.
