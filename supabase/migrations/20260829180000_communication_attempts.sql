-- Processor communications ledger.
-- Copy-only sandbox records. No real email, SMS, or provider send path.
-- Do not store passwords, credentials, SSNs, bank data, or document contents.

alter table public.tasks
  add column if not exists last_response_at timestamptz;

comment on column public.tasks.last_response_at is
  'When a processor recorded a response. Does not complete the task.';

create table if not exists public.communication_attempts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  client_need_id uuid references public.client_needs (id) on delete set null,
  deal_contact_id uuid references public.deal_contacts (id) on delete set null,
  direction text not null,
  channel text not null,
  status text not null,
  subject text,
  body_snapshot text not null default '',
  attempted_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null,
  outbound_sent boolean not null default false,
  draft_type text,
  audience text not null default 'internal',
  sandbox_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint communication_attempts_direction_valid check (
    direction in ('outbound', 'inbound', 'internal')
  ),
  constraint communication_attempts_channel_valid check (
    channel in ('email', 'sms', 'phone', 'portal', 'internal', 'other')
  ),
  constraint communication_attempts_status_valid check (
    status in (
      'drafted',
      'copied',
      'contacted',
      'waiting',
      'responded',
      'failed',
      'canceled'
    )
  ),
  constraint communication_attempts_draft_type_valid check (
    draft_type is null
    or draft_type in (
      'initial',
      'follow_up',
      'second_follow_up',
      'escalation',
      'replacement',
      'thank_you'
    )
  ),
  constraint communication_attempts_audience_valid check (
    audience in ('internal', 'borrower')
  ),
  constraint communication_attempts_outbound_sent_false check (outbound_sent = false)
);

comment on table public.communication_attempts is
  'Copy-only communication ledger. outbound_sent must stay false; no provider send.';

create index if not exists communication_attempts_deal_id_idx
  on public.communication_attempts (deal_id, attempted_at desc);

create index if not exists communication_attempts_task_id_idx
  on public.communication_attempts (task_id, attempted_at desc);

create or replace function public.enforce_communication_same_deal()
returns trigger
language plpgsql
as $$
declare
  task_deal uuid;
  need_deal uuid;
  contact_deal uuid;
begin
  new.outbound_sent := false;

  if new.task_id is not null then
    select deal_id into task_deal
    from public.tasks
    where id = new.task_id;

    if task_deal is null or task_deal is distinct from new.deal_id then
      raise exception 'communication_attempts.task_id must belong to the same deal'
        using errcode = '23514';
    end if;
  end if;

  if new.client_need_id is not null then
    select deal_id into need_deal
    from public.client_needs
    where id = new.client_need_id;

    if need_deal is null or need_deal is distinct from new.deal_id then
      raise exception 'communication_attempts.client_need_id must belong to the same deal'
        using errcode = '23514';
    end if;
  end if;

  if new.deal_contact_id is not null then
    select deal_id into contact_deal
    from public.deal_contacts
    where id = new.deal_contact_id;

    if contact_deal is null or contact_deal is distinct from new.deal_id then
      raise exception 'communication_attempts.deal_contact_id must belong to the same deal'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists communication_attempts_enforce_same_deal
  on public.communication_attempts;
create trigger communication_attempts_enforce_same_deal
  before insert or update
  on public.communication_attempts
  for each row
  execute function public.enforce_communication_same_deal();

revoke all on table public.communication_attempts from anon, public;
grant select, insert, update on table public.communication_attempts to authenticated;

alter table public.communication_attempts enable row level security;

drop policy if exists communication_attempts_select_admin_processor
  on public.communication_attempts;
create policy communication_attempts_select_admin_processor
  on public.communication_attempts
  for select
  to authenticated
  using (public.is_admin_or_processor());

drop policy if exists communication_attempts_select_loan_officer
  on public.communication_attempts;
create policy communication_attempts_select_loan_officer
  on public.communication_attempts
  for select
  to authenticated
  using (public.is_loan_officer());

drop policy if exists communication_attempts_insert_admin
  on public.communication_attempts;
create policy communication_attempts_insert_admin
  on public.communication_attempts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists communication_attempts_insert_processor
  on public.communication_attempts;
create policy communication_attempts_insert_processor
  on public.communication_attempts
  for insert
  to authenticated
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );

drop policy if exists communication_attempts_update_admin
  on public.communication_attempts;
create policy communication_attempts_update_admin
  on public.communication_attempts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and outbound_sent = false);
