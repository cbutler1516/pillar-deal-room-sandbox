-- Processor task playbooks + source-based work queues.
-- Do not store borrower document contents, credentials, or provider secrets.

alter type public.task_status add value if not exists 'waiting';

alter table public.tasks
  add column if not exists source_type text,
  add column if not exists task_kind text,
  add column if not exists timing text,
  add column if not exists client_need_id uuid references public.client_needs (id) on delete set null,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists follow_up_interval_hours integer,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists escalation_after_hours integer,
  add column if not exists escalation_level text,
  add column if not exists completion_rule text,
  add column if not exists playbook_key text,
  add column if not exists instructions text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists waiting_since timestamptz,
  add column if not exists blocked_reason text;

alter table public.tasks
  drop constraint if exists tasks_source_type_valid;
alter table public.tasks
  add constraint tasks_source_type_valid check (
    source_type is null or source_type in (
      'borrower',
      'title',
      'insurance',
      'escrow',
      'closing_attorney',
      'appraiser',
      'contractor',
      'property_manager',
      'cpa',
      'lender',
      'internal',
      'other'
    )
  );

alter table public.tasks
  drop constraint if exists tasks_task_kind_valid;
alter table public.tasks
  add constraint tasks_task_kind_valid check (
    task_kind is null or task_kind in (
      'request_document',
      'request_information',
      'review_document',
      'verify_information',
      'contact_third_party',
      'follow_up',
      'prepare_submission',
      'resolve_exception',
      'internal_review',
      'other'
    )
  );

alter table public.tasks
  drop constraint if exists tasks_timing_valid;
alter table public.tasks
  add constraint tasks_timing_valid check (
    timing is null or timing in ('required_now', 'required_later', 'optional')
  );

alter table public.tasks
  drop constraint if exists tasks_escalation_level_valid;
alter table public.tasks
  add constraint tasks_escalation_level_valid check (
    escalation_level is null or escalation_level in (
      'none',
      'processor',
      'loan_officer',
      'manager'
    )
  );

alter table public.tasks
  drop constraint if exists tasks_follow_up_interval_positive;
alter table public.tasks
  add constraint tasks_follow_up_interval_positive check (
    follow_up_interval_hours is null or follow_up_interval_hours > 0
  );

alter table public.tasks
  drop constraint if exists tasks_escalation_after_positive;
alter table public.tasks
  add constraint tasks_escalation_after_positive check (
    escalation_after_hours is null or escalation_after_hours > 0
  );

comment on column public.tasks.source_type is
  'Where the processor must go to complete this task. Not a Client Need.';
comment on column public.tasks.instructions is
  'Operational how-to. Do not store document contents or secrets.';
comment on column public.tasks.completion_rule is
  'Plain-language completion criteria. Does not auto-underwrite.';
comment on column public.tasks.playbook_key is
  'Machine-readable playbook identifier for later AI/automation.';

create index if not exists tasks_source_type_idx on public.tasks (source_type);
create index if not exists tasks_timing_idx on public.tasks (timing);
create index if not exists tasks_playbook_key_idx on public.tasks (playbook_key);
create index if not exists tasks_next_follow_up_at_idx on public.tasks (next_follow_up_at);
create index if not exists tasks_client_need_id_idx on public.tasks (client_need_id);

create or replace function public.enforce_processor_task_updates()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or not public.is_processor() then
    return new;
  end if;

  if not public.deal_is_processor_updatable(old.deal_id)
    or not public.deal_is_processor_updatable(new.deal_id)
  then
    raise exception 'processors cannot update tasks on another processor''s deal'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.deal_id is distinct from old.deal_id
    or new.task_type is distinct from old.task_type
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.playbook_key is distinct from old.playbook_key
    or new.source_type is distinct from old.source_type
    or new.task_kind is distinct from old.task_kind
    or new.timing is distinct from old.timing
    or new.completion_rule is distinct from old.completion_rule
    or new.instructions is distinct from old.instructions
    or new.created_at is distinct from old.created_at
  then
    raise exception 'processors may only update operational task fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop policy if exists tasks_insert_processor on public.tasks;
create policy tasks_insert_processor
  on public.tasks
  for insert
  to authenticated
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );

drop policy if exists tasks_select_loan_officer on public.tasks;
create policy tasks_select_loan_officer
  on public.tasks
  for select
  to authenticated
  using (public.is_loan_officer());
