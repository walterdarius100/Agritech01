begin;

alter table public.projects
  drop constraint published_project_has_text,
  add constraint project_portfolio_requirements check (
    jsonb_array_length(photos) <= 3 and (
      published_at is null or (
        details ~ '[^[:space:]]'
        and domain ~ '[^[:space:]]'
        and jsonb_array_length(photos) >= 1
        and coalesce(photos->0->>'slot', '0') = '0'
      )
    )
  ) not valid;

-- Keep legacy rows untouched, including their summaries and media references.
-- The constraint applies to new rows and to existing rows when saved again.
commit;
