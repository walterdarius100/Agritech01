begin;

-- Retire the endpoint that inserted active subscribers without confirmation.
drop function public.subscribe_newsletter(text, text, text);

alter table public.newsletter_subscribers
  alter column status set default 'pending',
  add column confirmation_nonce uuid,
  add column confirmation_expires_at timestamptz,
  add column confirmed_at timestamptz,
  add column unsubscribe_nonce uuid not null default gen_random_uuid(),
  add column unsubscribed_at timestamptz;

-- Legacy rows have no evidence of ownership. A subsequent request can verify them.
update public.newsletter_subscribers set status = 'pending' where status = 'active';

create table public.newsletter_mail (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  kind text not null check (kind in ('admin', 'confirm', 'welcome')),
  nonce uuid,
  status text not null default 'queued' check (status in ('queued', 'sending', 'accepted', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  next_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  attempts integer not null default 0,
  claim_id uuid,
  provider_id text,
  last_error text
);

create index newsletter_mail_due on public.newsletter_mail(next_at) where status in ('queued', 'sending');
create index newsletter_mail_subscriber on public.newsletter_mail(subscriber_id);
alter table public.newsletter_mail enable row level security;
revoke all on public.newsletter_mail from public, anon, authenticated;
grant select, insert, update on public.newsletter_mail to service_role;
grant update on public.newsletter_subscribers to service_role;

create function public.request_newsletter(p_email text, p_source text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  normalized text := lower(btrim(p_email));
  hour_start timestamptz := date_trunc('hour', statement_timestamp());
  subscriber public.newsletter_subscribers%rowtype;
  new_nonce uuid := gen_random_uuid();
begin
  if normalized is null or length(normalized) > 254
    or normalized !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
    or p_source is null or p_source not in ('article', 'footer') then
    return 'invalid';
  end if;

  delete from public.newsletter_request_limits where window_start < hour_start;
  insert into public.newsletter_request_limits as limits (window_start, bucket, attempts)
    values (hour_start, 'global', 1)
    on conflict (window_start, bucket) do update set attempts = limits.attempts + 1
    where limits.attempts < 30;
  if not found then return 'limited'; end if;

  insert into public.newsletter_subscribers (email, source, confirmation_nonce, confirmation_expires_at)
    values (normalized, p_source, new_nonce, now() + interval '24 hours')
    on conflict (email) do nothing returning * into subscriber;

  if found then
    insert into public.newsletter_mail (subscriber_id, kind, nonce)
      values (subscriber.id, 'admin', null), (subscriber.id, 'confirm', new_nonce);
  else
    -- At most one confirmation per address per 24 hours. The caller sees the same reply.
    update public.newsletter_subscribers
      set confirmation_nonce = new_nonce, confirmation_expires_at = now() + interval '24 hours'
      where email = normalized and status = 'pending'
        and (confirmation_expires_at is null or confirmation_expires_at <= now())
      returning * into subscriber;
    if found then
      insert into public.newsletter_mail (subscriber_id, kind, nonce)
        values (subscriber.id, 'confirm', new_nonce);
    end if;
  end if;

  return 'received';
end;
$$;

create function public.apply_newsletter_link(p_action text, p_id uuid, p_nonce uuid)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  if p_action = 'confirm' then
    update public.newsletter_subscribers
      set status = 'active', confirmed_at = now(), confirmation_nonce = null, confirmation_expires_at = null
      where id = p_id and status = 'pending' and confirmation_nonce = p_nonce and confirmation_expires_at > now();
    if not found then return 'invalid_link'; end if;
    insert into public.newsletter_mail (subscriber_id, kind) values (p_id, 'welcome');
    return 'confirmed';
  end if;

  if p_action = 'unsubscribe' then
    update public.newsletter_subscribers
      set status = 'unsubscribed', unsubscribed_at = coalesce(unsubscribed_at, now()),
          confirmation_nonce = null, confirmation_expires_at = null
      where id = p_id and unsubscribe_nonce = p_nonce;
    if found then return 'unsubscribed'; end if;
  end if;

  return 'invalid_link';
end;
$$;

create function public.claim_newsletter_mail()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  job record;
  claim uuid := gen_random_uuid();
begin
  -- Expired or superseded links and mail for withdrawn subscriptions are obsolete.
  update public.newsletter_mail m set status = 'cancelled', claim_id = null
    from public.newsletter_subscribers s
    where m.subscriber_id = s.id and m.status in ('queued', 'sending') and m.next_at <= now()
      and ((m.kind = 'confirm' and (s.status <> 'pending'
        or s.confirmation_nonce is distinct from m.nonce or s.confirmation_expires_at <= now()))
        or (m.kind = 'welcome' and s.status <> 'active'));

  update public.newsletter_mail
    set status = 'failed', claim_id = null, last_error = 'retry_window_or_attempt_limit'
    where status in ('queued', 'sending') and next_at <= now()
      and (attempts >= 5 or first_attempt_at <= now() - interval '20 hours');

  select m.id, m.kind, m.nonce, s.id as subscriber_id, s.email, s.source, s.subscribed_at, s.unsubscribe_nonce
    into job from public.newsletter_mail m join public.newsletter_subscribers s on s.id = m.subscriber_id
    where m.status in ('queued', 'sending') and m.next_at <= now()
    order by m.next_at, m.id limit 1 for update of m skip locked;

  if not found then return null; end if;
  update public.newsletter_mail
    set status = 'sending', claim_id = claim, next_at = now() + interval '2 minutes',
      attempts = attempts + 1, first_attempt_at = coalesce(first_attempt_at, now())
    where id = job.id;
  return to_jsonb(job) || jsonb_build_object('claim_id', claim);
end;
$$;

create function public.finish_newsletter_mail(
  p_id uuid, p_claim uuid, p_result text, p_provider text, p_error text
)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_result not in ('accepted', 'retry', 'failed') or p_result is null
    or (p_result = 'accepted' and coalesce(p_provider, '') = '') then return false; end if;

  update public.newsletter_mail set
    status = case when p_result = 'retry' and attempts < 5 then 'queued'
      when p_result = 'retry' then 'failed' else p_result end,
    provider_id = p_provider, last_error = p_error, claim_id = null,
    next_at = now() + (interval '2 minutes' * power(2, attempts - 1))
    where id = p_id and claim_id = p_claim and status = 'sending';
  return found;
end;
$$;

revoke all on function public.request_newsletter(text, text),
  public.apply_newsletter_link(text, uuid, uuid), public.claim_newsletter_mail(),
  public.finish_newsletter_mail(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.request_newsletter(text, text),
  public.apply_newsletter_link(text, uuid, uuid), public.claim_newsletter_mail(),
  public.finish_newsletter_mail(uuid, uuid, text, text, text) to service_role;

commit;
