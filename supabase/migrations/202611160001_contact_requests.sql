-- PREPARATION ONLY. Never apply to production without owner approval.
-- New objects only; no article policies, roles, extensions or newsletter tables.
begin;
create schema contact_internal;
revoke all on schema contact_internal from public, anon, authenticated, service_role;

create table public.contact_requests (
  id uuid primary key,
  receipt_hash text not null check (receipt_hash ~ '^[a-f0-9]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 150),
  email text not null check (char_length(email) between 3 and 254 and email !~ '[[:space:]]'),
  phone text not null check (char_length(btrim(phone)) between 1 and 40),
  request_type text not null check (char_length(btrim(request_type)) between 1 and 200),
  message text not null check (char_length(btrim(message)) between 1 and 1200),
  consent_at timestamptz not null default now(),
  consent_scope text not null default 'contact-recontact-v1' check (consent_scope = 'contact-recontact-v1'),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  notification_state text not null default 'pending' check (notification_state in ('pending','attempting','accepted','failed','unknown')),
  reply_state text not null default 'disabled' check (reply_state in ('disabled','pending','attempting','accepted','failed','unknown')),
  notification_attempted_at timestamptz,
  reply_attempted_at timestamptz,
  check ((notification_state = 'pending') = (notification_attempted_at is null)),
  check ((reply_state in ('disabled','pending')) = (reply_attempted_at is null))
);
create index contact_requests_status_created_idx on public.contact_requests(status, created_at desc);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from public, anon, authenticated, service_role;

-- Fixed windows, pseudonymous email HMAC, no raw IP or email in counters.
create table contact_internal.limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null check (count >= 0)
);
alter table contact_internal.limits enable row level security;
revoke all on contact_internal.limits from public, anon, authenticated, service_role;

create function public.contact_submit(
  p_id uuid, p_receipt_hash text, p_payload_hash text, p_email_hash text,
  p_fields jsonb, p_reply_enabled boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.contact_requests%rowtype;
  t timestamptz := clock_timestamp();
  k text;
  window_at timestamptz;
  ceiling integer;
  n integer;
begin
  -- One short database lock; no lock held while contacting EmailJS.
  perform pg_advisory_xact_lock(21404, 1);
  if p_id is null or p_receipt_hash is null or p_receipt_hash !~ '^[a-f0-9]{64}$'
    or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$'
    or p_reply_enabled is null or jsonb_typeof(p_fields) is distinct from 'object'
    or not (p_fields ?& array['full_name','email','phone','request_type','message','consent'])
    or (p_fields - array['full_name','email','phone','request_type','message','consent']) <> '{}'::jsonb
    or p_fields->'consent' is distinct from 'true'::jsonb then
    return jsonb_build_object('error','invalid');
  end if;
  foreach k in array array['full_name','email','phone','request_type','message'] loop
    if jsonb_typeof(p_fields->k) is distinct from 'string' then
      return jsonb_build_object('error','invalid');
    end if;
  end loop;
  -- Opportunistic purge, bounded by short windows; never touches business rows.
  delete from contact_internal.limits where window_start < t - interval '32 days'
    or (key like 'email:%' and window_start < t - interval '1 day');
  insert into contact_internal.limits values ('attempts', date_trunc('minute',t), 1)
    on conflict (key) do update set
      count = case when contact_internal.limits.window_start = excluded.window_start
        then contact_internal.limits.count + 1 else 1 end,
      window_start = excluded.window_start returning count into n;
  if n > 30 then return jsonb_build_object('error','rate_limited'); end if;
  select * into r from public.contact_requests where id = p_id;
  if found then
    if r.receipt_hash <> p_receipt_hash or r.payload_hash <> p_payload_hash then
      return jsonb_build_object('error','conflict');
    end if;
    return jsonb_build_object('stored',true,'id',r.id,'notification',r.notification_state,'reply',r.reply_state);
  end if;
  -- New requests: at most 100/day for contact and 3/hour per normalized email.
  foreach k in array array['new:day', 'email:' || p_email_hash] loop
    window_at := case when k = 'new:day' then date_trunc('day',t) else date_trunc('hour',t) end;
    ceiling := case when k = 'new:day' then 100 else 3 end;
    insert into contact_internal.limits values (k, window_at, 1)
      on conflict (key) do update set
        count = case when contact_internal.limits.window_start = excluded.window_start
          then contact_internal.limits.count + 1 else 1 end,
        window_start = excluded.window_start returning count into n;
    if n > ceiling then return jsonb_build_object('error','rate_limited'); end if;
  end loop;
  insert into public.contact_requests(id,receipt_hash,payload_hash,full_name,email,phone,request_type,message,reply_state)
    values(p_id,p_receipt_hash,p_payload_hash,p_fields->>'full_name',p_fields->>'email',p_fields->>'phone',
      p_fields->>'request_type',p_fields->>'message',case when p_reply_enabled then 'pending' else 'disabled' end)
    returning * into r;
  return jsonb_build_object('stored',true,'id',r.id,'notification',r.notification_state,'reply',r.reply_state);
end;
$$;

create function public.contact_claim_email(p_id uuid, p_receipt_hash text, p_kind text, p_monthly_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.contact_requests%rowtype;
  t timestamptz := clock_timestamp();
  slot timestamptz;
  used integer;
begin
  perform pg_advisory_xact_lock(21404,1);
  select * into r from public.contact_requests where id = p_id and receipt_hash = p_receipt_hash for update;
  if not found then return jsonb_build_object('error','conflict'); end if;
  if p_kind is null or p_kind not in ('notification','reply') or p_monthly_budget is null
    or p_monthly_budget < 1 or p_monthly_budget > 100000 then
    return jsonb_build_object('claimed',false);
  end if;
  if (p_kind = 'notification' and r.notification_state <> 'pending') or
     (p_kind = 'reply' and (r.reply_state <> 'pending' or r.notification_state <> 'accepted')) then
    return jsonb_build_object('claimed',false);
  end if;
  select window_start into slot from contact_internal.limits where key = 'send:slot';
  if slot > t - interval '1100 milliseconds' then return jsonb_build_object('claimed',false); end if;
  select count into used from contact_internal.limits where key = 'send:month' and window_start = date_trunc('month',t);
  if coalesce(used,0) >= p_monthly_budget then return jsonb_build_object('claimed',false); end if;
  insert into contact_internal.limits values ('send:slot',t,1)
    on conflict(key) do update set window_start = excluded.window_start;
  insert into contact_internal.limits values ('send:month',date_trunc('month',t),1)
    on conflict(key) do update set count = case when contact_internal.limits.window_start = excluded.window_start
      then contact_internal.limits.count + 1 else 1 end, window_start = excluded.window_start;
  if p_kind = 'notification' then
    update public.contact_requests set notification_state = 'attempting', notification_attempted_at = t where id = p_id;
  else
    update public.contact_requests set reply_state = 'attempting', reply_attempted_at = t where id = p_id;
  end if;
  return jsonb_build_object('claimed',true);
end;
$$;

create function public.contact_finish_email(p_id uuid,p_receipt_hash text,p_kind text,p_state text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if p_state is null or p_state not in ('accepted','failed','unknown') then return false; end if;
  if p_kind = 'notification' then
    update public.contact_requests set notification_state = p_state
      where id = p_id and receipt_hash = p_receipt_hash and notification_state = 'attempting';
  elsif p_kind = 'reply' then
    update public.contact_requests set reply_state = p_state
      where id = p_id and receipt_hash = p_receipt_hash and reply_state = 'attempting';
  else return false;
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.contact_submit(uuid,text,text,text,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.contact_claim_email(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.contact_finish_email(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.contact_submit(uuid,text,text,text,jsonb,boolean) to service_role;
grant execute on function public.contact_claim_email(uuid,text,text,integer) to service_role;
grant execute on function public.contact_finish_email(uuid,text,text,text) to service_role;
commit;
