begin;

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  source text not null check (source in ('article', 'footer')),
  status text not null default 'active' check (status in ('active', 'pending', 'unsubscribed')),
  constraint newsletter_normalized_email check (
    email = lower(btrim(email)) and length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

create table public.newsletter_request_limits (
  window_start timestamptz not null,
  bucket text not null,
  attempts integer not null,
  primary key (window_start, bucket)
);

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_request_limits enable row level security;
revoke all on public.newsletter_subscribers, public.newsletter_request_limits
  from public, anon, authenticated;
grant select, insert on public.newsletter_subscribers to service_role;
grant select, insert, update, delete on public.newsletter_request_limits to service_role;

create function public.subscribe_newsletter(p_email text, p_source text, p_bucket text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
  current_window timestamptz := date_trunc('hour', statement_timestamp());
  existing_status text;
begin
  if normalized_email is null or length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_source is null or p_source not in ('article', 'footer')
    or p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then
    return 'invalid';
  end if;

  -- Rotate hourly buckets and drop older pseudonymous identifiers.
  delete from public.newsletter_request_limits where window_start < current_window;

  insert into public.newsletter_request_limits as limits (window_start, bucket, attempts)
    values (current_window, p_bucket, 1)
    on conflict (window_start, bucket) do update set attempts = limits.attempts + 1
    where limits.attempts < 5;
  if not found then return 'limited'; end if;

  insert into public.newsletter_request_limits as limits (window_start, bucket, attempts)
    values (current_window, 'global', 1)
    on conflict (window_start, bucket) do update set attempts = limits.attempts + 1
    where limits.attempts < 120;
  if not found then return 'limited'; end if;

  insert into public.newsletter_subscribers (email, source)
    values (normalized_email, p_source) on conflict (email) do nothing;
  if found then return 'subscribed'; end if;

  select status into existing_status from public.newsletter_subscribers
    where email = normalized_email;
  if existing_status = 'active' then return 'already_subscribed'; end if;
  if existing_status = 'pending' then return 'pending'; end if;

  -- A public request cannot reactivate a previously opted-out address.
  return 'contact_required';
end;
$$;

revoke all on function public.subscribe_newsletter(text, text, text)
  from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text, text) to service_role;

commit;
