begin;

-- Sérialiser la vérification et l’ajout par rapport aux écritures concurrentes.
lock table public.articles in access exclusive mode;

do $$
declare
  invalid_count bigint;
begin
  select count(*) into invalid_count
  from public.articles
  where category is null
     or category collate "C" not in (
       'Actualités et analyses', 'Production végétale', 'Production animale'
     );

  if invalid_count > 0 then
    raise exception '% article(s) à reclasser avant validation de la contrainte.', invalid_count
      using hint = 'Exécuter le diagnostic des catégories et valider les correspondances éditoriales.';
  end if;
end
$$;

alter table public.articles
  add constraint articles_category_check check (
    category is not null and category collate "C" in (
      'Actualités et analyses', 'Production végétale', 'Production animale'
    )
  );

commit;
