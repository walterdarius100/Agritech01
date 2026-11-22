begin;

-- Retain the payload version of existing tasks to preserve Resend idempotency.
alter table public.newsletter_mail
  drop constraint newsletter_mail_template_version_check,
  add constraint newsletter_mail_template_version_check check (template_version in (1, 2, 3)),
  alter column template_version set default 3;

drop index public.newsletter_mail_direct_once;
create unique index newsletter_mail_direct_once
  on public.newsletter_mail(subscriber_id, kind) where template_version >= 2;

create or replace function public.request_newsletter(p_email text, p_source text, p_consent boolean default null)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  normalized text := lower(btrim(p_email));
  hour_start timestamptz := date_trunc('hour', statement_timestamp());
  day_start timestamptz := date_trunc('day', statement_timestamp(), 'UTC');
  subscriber_id uuid;
begin
  if (p_source = 'article' and p_consent is distinct from true) or normalized is null or length(normalized) > 254
    or normalized !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
    or p_source is null or p_source not in ('article', 'footer') then
    return 'invalid';
  end if;

  delete from public.newsletter_request_limits
    where (bucket = 'daily' and window_start < day_start)
       or (bucket <> 'daily' and window_start < hour_start);
  insert into public.newsletter_request_limits as limits (window_start, bucket, attempts)
    values (hour_start, 'global', 1)
    on conflict (window_start, bucket) do update set attempts = limits.attempts + 1
    where limits.attempts < 30;
  if not found then return 'limited'; end if;

  insert into public.newsletter_request_limits as limits (window_start, bucket, attempts)
    values (day_start, 'daily', 1)
    on conflict (window_start, bucket) do update set attempts = limits.attempts + 1
    where limits.attempts < 60;
  if not found then return 'limited'; end if;

  insert into public.newsletter_subscribers as subscribers (email, source, status, consented_at, consent_version, consent_source)
    values (normalized, p_source, 'active', now(),
      case when p_source = 'footer' and p_consent is distinct from true
        then 'newsletter-footer-submit-v1' else 'newsletter-direct-v1' end, p_source)
    on conflict (email) do update set status = 'active', consent_source = excluded.consent_source,
      consented_at = excluded.consented_at, consent_version = excluded.consent_version
    where subscribers.status = 'pending'
    returning subscribers.id into subscriber_id;

  if found then
    insert into public.newsletter_mail (subscriber_id, kind)
      values (subscriber_id, 'admin'), (subscriber_id, 'welcome');
  end if;
  return 'received';
end;
$$;

create or replace function public.claim_newsletter_mail()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  job record;
  claim uuid := gen_random_uuid();
begin
  update public.newsletter_mail m set status = 'cancelled', claim_id = null
    from public.newsletter_subscribers s
    where m.subscriber_id = s.id and m.status in ('queued', 'sending') and m.next_at <= now()
      and (m.kind = 'confirm' or (m.kind = 'welcome' and s.status <> 'active'));

  update public.newsletter_mail
    set status = 'failed', claim_id = null, last_error = 'retry_window_or_attempt_limit'
    where status in ('queued', 'sending') and next_at <= now()
      and (attempts >= 5 or first_attempt_at <= now() - interval '20 hours');

  select m.id, m.kind, m.template_version, s.id as subscriber_id, s.email,
      case when m.template_version >= 2 then s.consent_source else s.source end as source,
      case when m.template_version >= 2 then s.consented_at else s.subscribed_at end as subscribed_at,
      s.unsubscribe_nonce
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

commit;
