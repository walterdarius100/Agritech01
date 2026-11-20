# Projets Agri-tech

## Mise en service après validation

1. Appliquer [la migration projets](../supabase/migrations/20261120_projects.sql) dans un environnement Supabase de test. Elle ajoute une table de projets, une liste d’administrateurs et un bucket privé dédié. Appliquer ensuite [la migration du portfolio](../supabase/migrations/20261121_project_portfolio.sql).
2. Dans **Authentication → Users**, copier l’UUID d’un compte administrateur existant. Dans le SQL Editor, autoriser ce compte pour les projets en remplaçant l’UUID ci-dessous. Répéter pour chaque compte autorisé.

   ```sql
   insert into public.project_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000'::uuid)
   on conflict do nothing;
   ```

3. Ouvrir `admin.html` avec la connexion habituelle, puis **Projets → Nouveau projet**. Le titre suffit pour un brouillon. Pour publier, renseigner le domaine, une description détaillée et la photo principale, choisir **Publié**, puis enregistrer.
4. En visite privée, vérifier le portfolio et la galerie d’accueil. Sélectionner **Brouillon** dans l’administration, enregistrer et vérifier que le projet a disparu du portfolio. Répéter ces étapes après autorisation de l’installation en production.

## Photos et publication

- Trois photos au maximum par projet. La photo principale sert de couverture. Les descriptions se saisissent en texte simple, avec une ligne vide entre les paragraphes. Renseigner un texte alternatif pour chaque photo importée. L’interface produit deux tailles WebP dans le navigateur.
- L’accueil choisit d’abord la couverture de chacun des trois projets illustrés les plus récemment publiés. S’il manque des photos, il prend les photos complémentaires de ces projets dans le même ordre, puis affiche des emplacements « Photo à venir ».
- Les URL des photos sont signées pour cinq minutes. Un retrait bloque immédiatement les nouvelles lectures et signatures publiques. Les liens signés déjà délivrés peuvent fonctionner jusqu’à leur expiration, et une copie déjà téléchargée reste sur l’appareil qui l’a reçue.
- Le remplacement et la suppression du projet retirent les références aux fichiers privés. Les anciens fichiers et ceux laissés par un échec d’enregistrement restent dans Storage. Un opérateur peut supprimer les fichiers devenus orphelins via l’API ou la console Storage, après vérification des références de tous les projets, brouillons inclus, et en l’absence de modification en cours.

Les anciennes lignes restent accessibles. Les anciens résumés restent dans la base. Une ancienne quatrième photo est ignorée dans le portfolio et son fichier demeure dans Storage. Les anciens projets doivent satisfaire les nouvelles conditions lors du prochain enregistrement en statut publié.

## Vérifications

`node --test tests/*.test.mjs` couvre notamment la sélection des photos et les requêtes publiques. Exécuter aussi [le contrôle RLS](../tests/projects-rls.sql) sur une base Supabase de test après migration. Ce script utilise une transaction annulée et vérifie la visibilité et les droits d’écriture pour les visiteurs, les comptes ordinaires et les administrateurs de projets.
