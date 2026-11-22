begin;

-- A retry keeps the same payload and Resend idempotency key. Only newly
-- queued tasks use version 4; administrative messages keep their rendering.
alter table public.newsletter_mail
  drop constraint newsletter_mail_template_version_check,
  add constraint newsletter_mail_template_version_check check (template_version in (1, 2, 3, 4)),
  alter column template_version set default 4;

commit;
