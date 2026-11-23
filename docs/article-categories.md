# Catégories et recommandations des articles

## Audit

Le schéma des articles est documenté dans `docs/SUPABASE_SETUP.md`. Il déclare
`category text not null`, un slug unique, un contrôle des statuts et un
déclencheur de mise à jour de `updated_at`. Le dépôt ne définissait aucun
contrôle des valeurs de `category`. Vérifier le schéma effectif avec les
requêtes ci-dessous avant intervention.

Le formulaire d’administration acceptait un libellé libre. Le service
retirait les espaces en début et fin avant l’écriture. La page
publique proposait les libellés bruts, et les suggestions prenaient les trois
premiers autres articles du flux publié.

Le frontend partage désormais la liste officielle. En lecture, casse, accents
et espaces sont normalisés pour retrouver les libellés officiels. Le filtre
« Tous » conserve les anciennes publications visibles. Une URL historique
continue de filtrer les anciennes lignes encore présentes. Une fois celles-ci
reclassées, les liens des quatre anciens libellés observés pointent vers le
filtre officiel correspondant, sans redirection. Les autres paramètres de
catégorie inconnus reviennent à « Tous » si aucune ligne ne correspond.

Les suggestions privilégient la catégorie officielle de l’article courant et
complètent par récence. Les dates de publication manquantes ou invalides sont
classées en fin de groupe et le slug départage les dates identiques. Pour les
anciennes catégories qui ne correspondent à aucun libellé officiel, le
classement repose sur la date.

## Inventaire public et correspondances à confirmer

La lecture anonyme du 23 novembre 2026 a retourné 14 articles publiés. Elle ne
permet pas de vérifier les brouillons, les archives ou les contraintes du
schéma réel.

| Libellé observé | Publiés | Destination proposée |
| --- | ---: | --- |
| Production végétale | 1 | Production végétale |
| Actualité | 5 | Actualités et analyses |
| Apiculture | 3 | Production animale |
| Aviculture | 1 | Production animale |
| Cuniculture | 4 | Production animale |

Les cinq titres sous « Actualité » évoquent des entretiens, des initiatives ou
des analyses sectorielles. Les sujets laitiers, de figue-banane et de riz
méritent une validation selon l’angle du texte. Les trois anciens libellés
d’élevage sont des thèmes explicitement couverts par « Production animale ».

| Ancien libellé | Article | Identifiant |
| --- | --- | --- |
| Actualité | Développer la filière laitière en Haïti : les pistes du Dr Michel Chancy | `6bb3b2f9-e9b4-4434-800a-e6e5af5b92f4` |
| Actualité | Forum Kreyatè 2.0 : l’agriculture comme terrain d’innovation | `40cc298e-1c61-48d9-b9e0-32fd80010584` |
| Actualité | La figue-banane à Fondwa : une filière locale fragilisée par l’insécurité | `be97fdb2-044f-4a6b-9fb0-d4e28e19e6c9` |
| Actualité | Première édition du Startup Challenge : la SCEC décroche la première place | `4eb50b69-0cfd-4832-9fc6-0f506a52d5f8` |
| Actualité | Riz de l’Artibonite : que disent vraiment les partenariats du ministère de l’Agriculture ? | `e57a445a-eab8-41bf-b6f3-b50e547e358a` |
| Apiculture | Augmenter la durée de vie de vos ruches en bois | `a5d74ead-c7fa-43e3-87eb-6abc003f1d99` |
| Apiculture | Pourquoi vos abeilles désertent-elles la ruche ? Voici les principales causes | `7753116c-e672-4acc-9219-993e3fcf62f4` |
| Apiculture | Visite de ruche : quel rôle joue la fumée sur les abeilles ? | `e1a9e781-65e3-4543-b95b-a78ffdd40ffb` |
| Aviculture | Mauvaise odeur dans le poulailler : causes et solutions | `a35f1d66-b323-4819-9294-b7e58a0c7868` |
| Cuniculture | Accouplement des lapins : comment choisir les reproducteurs et préparer la saillie ? | `db308f30-ea45-4a88-b2c3-456ae2d50786` |
| Cuniculture | Gale chez le lapin : comment la reconnaître et y remédier ? | `c66b0342-f3ff-49b6-8196-b49efef7d296` |
| Cuniculture | Réussir son élevage de lapins en 7 étapes | `5a3e99eb-e761-43e7-bb5b-3da54b7ee393` |
| Cuniculture | Tout sur la gestation des lapines, de la saillie au sevrage. | `6542fc42-1332-40b7-8433-259ab87c66f9` |

## Diagnostic dans le SQL Editor

Ces requêtes couvrent tous les statuts, y compris les archives et les brouillons.

```sql
begin read only;

select data_type, is_nullable, column_default, collation_name
from information_schema.columns
where table_schema = 'public' and table_name = 'articles' and column_name = 'category';

select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.articles'::regclass
order by conname;

-- Inventaire exact. quote_nullable rend les espaces et les NULL visibles.
select quote_nullable(category collate "C") as libelle_exact,
       count(*) as total,
       count(*) filter (where status = 'published') as publies,
       count(*) filter (where status = 'draft') as brouillons,
       count(*) filter (where status = 'archived') as archives
from public.articles
group by category collate "C"
order by total desc, libelle_exact;

-- Variantes possibles par casse, espaces et accents français.
with labels as (
  select category collate "C" as category,
         btrim(regexp_replace(
           translate(lower(normalize(category)),
             'àâäçéèêëîïôöùûüÿ', 'aaaceeeeiioouuuy'),
           '[[:space:]]+', ' ', 'g')) collate "C" as cle
  from public.articles
)
select cle, array_agg(distinct category order by category) as variantes, count(*) as total
from labels
group by cle
having count(distinct category) > 1 or cle is null or cle = ''
order by total desc, cle;

-- File à réviser avant migration. Inclut les valeurs vides et NULL.
select id, title, slug, status, quote_nullable(category) as libelle_exact
from public.articles
where category is null
   or category collate "C" not in (
     'Actualités et analyses', 'Production végétale', 'Production animale'
   )
order by category collate "C" nulls first, title, id;

commit;
```

## Ordre de mise en production

1. Pendant la révision, exécuter le diagnostic et consigner les correspondances
   approuvées par identifiant, avec l’ancienne valeur exacte et la nouvelle
   catégorie. Résoudre tout conflit avec une contrainte existante. Un éventuel
   défaut de colonne doit produire une valeur autorisée ou laisser le choix
   explicite au client.
2. Après approbation de la PR, mettre en ligne le frontend via le processus
   GitHub Pages habituel. Vérifier la présence du menu sur le site et recharger
   les onglets admin ouverts avant de reprendre les écritures.
3. Appliquer les reclassements validés. Une modification limitée à la catégorie
   dans l’administration écrit uniquement `category`. Pour une correction
   manuelle en SQL, limiter chaque écriture aux identifiants approuvés et
   vérifier que la valeur existante correspond toujours au relevé. Le
   déclencheur existant actualise `updated_at` lors du reclassement.
4. Relancer le diagnostic jusqu’à obtenir zéro ligne à reclasser. Depuis le SQL
   Editor, appliquer `supabase/migrations/202611230001_article_categories.sql`
   pendant une période de faible activité. Le verrou garantit que l’audit et
   l’ajout de la contrainte portent sur les mêmes données. La migration arrête
   la transaction si une valeur reste invalide et signale une contrainte
   homonyme lors d’une réexécution.
5. Relancer les requêtes de schéma et d’inventaire. Vérifier que
   `articles_category_check` est validée (`convalidated = true`), que la
   liste à reclasser est vide et que les comptes par statut correspondent
   à l’inventaire, en tenant compte des éventuelles opérations éditoriales
   intervenues entre les deux contrôles. Vérifier le formulaire et un filtre
   ouvert par une ancienne URL.

La fenêtre entre les étapes 2 et 4 peut présenter moins de filtres officiels
si des articles restent à reclasser. Les anciennes catégories restent visibles
sur les cartes. Une fois les reclassements faits, les anciennes URL des
sous-thèmes animaliers couvrent la catégorie « Production animale » dans son
ensemble. Les onglets d’administration chargés avant la mise en ligne peuvent
devenir incompatibles avec le contrôle SQL tant qu’ils ne sont pas rechargés.

## Contrôles locaux

- `node --test tests/*.test.mjs` exécute la suite du dépôt et les scénarios de recommandation.
- `node tests/admin-browser.mjs` vérifie le formulaire avec Chromium et Supabase simulé.
  Le test utilise les scripts CDN habituels. La variable `LOCAL_TEST_ASSETS`
  permet de les servir depuis un dossier de paquets npm de test.
- `node tests/seo-browser.mjs` vérifie aussi les filtres, l’historique, la
  pagination, la une et les suggestions à 1280 et 390 pixels, avec des articles
  simulés.
- `node tests/article-categories-db.mjs` utilise PGlite comme moteur PostgreSQL
  local et rejoue le schéma versionné des articles. L’installation de PGlite
  peut être isolée du dépôt et exposée via `NODE_PATH`.
