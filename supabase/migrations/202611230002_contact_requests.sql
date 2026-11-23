create table public.contact_requests (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 7 and 40),
  request_type text not null check (request_type in ('service', 'formation', 'partenariat')),
  need text not null check (char_length(need) between 1 and 200),
  message text not null check (char_length(message) <= 1200),
  source text not null default 'Site Agri-Tech',
  received_at timestamptz not null default now(),
  consent boolean not null check (consent),
  consent_version text not null default 'contact-v1',
  status text not null default 'pending' check (status in ('pending', 'processed', 'attention')),
  check ((request_type = 'formation') = (message = ''))
);

create table public.contact_request_jobs (
  request_id uuid not null references public.contact_requests(id) on delete cascade,
  kind text not null check (kind in ('admin_email', 'receipt_email', 'pipeline')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  completed_at timestamptz,
  last_error text,
  result jsonb,
  primary key (request_id, kind)
);
create index contact_jobs_due on public.contact_request_jobs (next_attempt_at) where status in ('pending', 'running');

create table public.contact_request_rate (
  request_id uuid primary key references public.contact_requests(id) on delete cascade,
  network_hash text,
  email_hash text not null,
  received_at timestamptz not null default now()
);
create index contact_rate_recent on public.contact_request_rate (received_at);

alter table public.contact_requests enable row level security;
alter table public.contact_request_jobs enable row level security;
alter table public.contact_request_rate enable row level security;
revoke all on public.contact_requests, public.contact_request_jobs, public.contact_request_rate from public, anon, authenticated;

create function public.record_contact_request(
  p_id uuid, p_name text, p_email text, p_phone text, p_type text, p_need text,
  p_message text, p_email_hash text, p_network_hash text
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  existing public.contact_requests;
begin
  -- Serialize the short intake transaction so concurrent submissions share exact quotas.
  perform pg_catalog.pg_advisory_xact_lock(321935, 1);

  select * into existing from public.contact_requests where id = p_id;
  if found then
    if (existing.name, existing.email, existing.phone, existing.request_type, existing.need, existing.message)
      is not distinct from (p_name, p_email, p_phone, p_type, p_need, p_message) then
      return 'recorded';
    end if;
    return 'conflict';
  end if;

  delete from public.contact_request_rate where received_at < now() - interval '1 hour';
  if (select count(*) from public.contact_request_rate) >= 120
     or (select count(*) from public.contact_request_rate where email_hash = p_email_hash) >= 4
     or (p_network_hash is not null and
         (select count(*) from public.contact_request_rate where network_hash = p_network_hash) >= 12) then
    return 'limited';
  end if;

  insert into public.contact_requests (id, name, email, phone, request_type, need, message, consent)
  values (p_id, p_name, p_email, p_phone, p_type, p_need, p_message, true);
  insert into public.contact_request_rate (request_id, network_hash, email_hash)
  values (p_id, p_network_hash, p_email_hash);
  insert into public.contact_request_jobs (request_id, kind) values
    (p_id, 'admin_email'), (p_id, 'receipt_email'), (p_id, 'pipeline');
  return 'recorded';
end;
$$;

create function public.claim_contact_jobs()
returns setof public.contact_request_jobs language sql security invoker set search_path = '' as $$
  with due as (
    select request_id, kind from public.contact_request_jobs
    where status in ('pending', 'running') and next_attempt_at <= now()
    order by next_attempt_at, request_id, kind
    limit 6 for update skip locked
  )
  update public.contact_request_jobs j set
    status = 'running',
    lease_token = gen_random_uuid(),
    attempts = j.attempts + 1,
    first_attempt_at = coalesce(j.first_attempt_at, now()),
    last_attempt_at = now(),
    next_attempt_at = now() + interval '3 minutes'
  from due where (j.request_id, j.kind) = (due.request_id, due.kind)
  returning j.*;
$$;

create function public.finish_contact_job(
  p_id uuid, p_kind text, p_lease uuid, p_state text, p_error text, p_result jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Updating one request's aggregate is serialized across its independent jobs.
  perform 1 from public.contact_requests where id = p_id for update;

  update public.contact_request_jobs set
    status = case when p_state = 'pending' and attempts >= 6 then 'failed' else p_state end,
    lease_token = null,
    next_attempt_at = now() + make_interval(mins => least(60, power(2, least(attempts, 6))::integer)),
    completed_at = case when p_state in ('done', 'failed') or attempts >= 6 then now() end,
    last_error = p_error,
    result = p_result
  where request_id = p_id and kind = p_kind and lease_token = p_lease and status = 'running';
  if not found then return false; end if;

  update public.contact_requests set status = case
    when exists (select 1 from public.contact_request_jobs where request_id = p_id and status = 'failed') then 'attention'
    when exists (select 1 from public.contact_request_jobs where request_id = p_id and status <> 'done') then 'pending'
    else 'processed'
  end where id = p_id;
  return true;
end;
$$;

revoke all on function public.record_contact_request(uuid,text,text,text,text,text,text,text,text),
  public.claim_contact_jobs(), public.finish_contact_job(uuid,text,uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_contact_request(uuid,text,text,text,text,text,text,text,text),
  public.claim_contact_jobs(), public.finish_contact_job(uuid,text,uuid,text,text,jsonb) to service_role;
grant select, insert, update, delete on public.contact_requests, public.contact_request_jobs,
  public.contact_request_rate to service_role;

create function public.prune_contact_rate()
returns void language sql security invoker set search_path = '' as $$
  delete from public.contact_request_rate where received_at < now() - interval '1 hour';
$$;
revoke all on function public.prune_contact_rate() from public, anon, authenticated;
grant execute on function public.prune_contact_rate() to service_role;
