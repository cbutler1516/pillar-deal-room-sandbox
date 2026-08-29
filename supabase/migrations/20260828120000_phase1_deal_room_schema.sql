-- Phase 1: Pillar Deal Room core schema + conservative internal RLS
-- FINAL REVIEW — ready to apply, not yet applied.
--
-- Auth mapping (do not guess JWT custom claims):
--   public.users.id = auth.users.id
--   Internal access requires an active public.users row.
--   Users are provisioned by service_role / admin, not by open self-signup.
--   Role checks go through SECURITY DEFINER helpers to avoid RLS recursion.
--
-- Visibility:
--   loan_officer: SELECT deals + client_needs only (no documents/tasks/activity/users)
--   processor: SELECT operational tables; UPDATE only assigned or unassigned deals
--   admin: full CRUD
--
-- BEFORE PRODUCTION BORROWER DATA:
--   activity_log.safe_metadata must pass through a sanitizer/denylist.
--   That sanitizer is intentionally not implemented in this migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum (
  'admin',
  'loan_officer',
  'processor'
);

create type public.deal_status as enum (
  'new',
  'application_in_progress',
  'collecting_documents',
  'processor_review',
  'missing_items',
  'ready_for_submission',
  'submitted',
  'closed',
  'withdrawn'
);

create type public.client_need_status as enum (
  'missing',
  'requested',
  'received',
  'needs_review',
  'approved',
  'rejected',
  'waived'
);

create type public.document_status as enum (
  'received',
  'classifying',
  'needs_review',
  'approved',
  'rejected'
);

create type public.task_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type public.task_status as enum (
  'open',
  'in_progress',
  'completed',
  'dismissed'
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_unique unique (email),
  constraint users_email_not_blank check (length(trim(email)) > 0)
);

comment on table public.users is
  'Internal staff profiles. PK must equal auth.users.id. Provisioned explicitly; not an open signup table.';

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  deal_reference text not null,
  borrower_name text not null,
  borrower_email text,
  borrower_phone text,
  entity_name text,
  loan_type text,
  loan_purpose text,
  loan_amount numeric(15, 2),
  property_address text,
  property_city text,
  property_state text,
  property_type text,
  credit_band text,
  experience text,
  assigned_processor_id uuid references public.users (id) on delete set null,
  status public.deal_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_reference_unique unique (deal_reference),
  constraint deals_reference_not_blank check (length(trim(deal_reference)) > 0),
  constraint deals_borrower_name_not_blank check (length(trim(borrower_name)) > 0),
  constraint deals_loan_amount_non_negative check (loan_amount is null or loan_amount >= 0)
);

create table public.client_needs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  category text not null,
  document_type text not null,
  description text,
  required boolean not null default true,
  status public.client_need_status not null default 'missing',
  requested_at timestamptz,
  received_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_needs_category_not_blank check (length(trim(category)) > 0),
  constraint client_needs_document_type_not_blank check (length(trim(document_type)) > 0)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  client_need_id uuid references public.client_needs (id) on delete set null,
  file_name text not null,
  document_type text,
  storage_provider text,
  external_file_id text,
  mime_type text,
  status public.document_status not null default 'received',
  ai_classification text,
  ai_confidence numeric(5, 4),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_file_name_not_blank check (length(trim(file_name)) > 0),
  constraint documents_ai_confidence_range check (
    ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)
  )
);

comment on table public.documents is
  'Document metadata only. File bytes live in an external store (storage_provider + external_file_id).';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  task_type text not null,
  title text not null,
  description text,
  priority public.task_priority not null default 'normal',
  assigned_to uuid references public.users (id) on delete set null,
  status public.task_status not null default 'open',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_task_type_not_blank check (length(trim(task_type)) > 0),
  constraint tasks_title_not_blank check (length(trim(title)) > 0)
);

-- activity_log is append-oriented (no UPDATE policy).
-- TODO before production borrower data: add a sanitizer/denylist for safe_metadata
-- so secrets, raw document text, and storage identifiers cannot be persisted.
-- The denylist itself is intentionally not implemented in this migration.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  event_type text not null,
  actor_type text not null,
  actor_id uuid references public.users (id) on delete set null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_event_type_not_blank check (length(trim(event_type)) > 0),
  constraint activity_log_actor_type_valid check (
    actor_type in ('user', 'system', 'ai', 'service')
  ),
  constraint activity_log_actor_id_when_user check (
    actor_type <> 'user' or actor_id is not null
  ),
  constraint activity_log_safe_metadata_object check (
    jsonb_typeof(safe_metadata) = 'object'
  )
);

comment on table public.activity_log is
  'Append-oriented audit trail. No UPDATE policy. A metadata sanitizer/denylist MUST exist before production borrower data is written here. Not implemented in Phase 1.';

comment on column public.activity_log.safe_metadata is
  'Non-sensitive event context only. Do not store raw document text, SSNs, account numbers, storage identifiers, or full file payloads. REQUIRED BEFORE PRODUCTION: implement a sanitizer that strips sensitive keys (denylist not shipped in this migration).';

-- ---------------------------------------------------------------------------
-- Integrity: document.deal_id must match the linked client need
-- ---------------------------------------------------------------------------

create or replace function public.enforce_document_need_deal_match()
returns trigger
language plpgsql
as $$
begin
  if new.client_need_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.client_needs cn
    where cn.id = new.client_need_id
      and cn.deal_id = new.deal_id
  ) then
    raise exception 'documents.deal_id must match client_needs.deal_id for client_need_id %', new.client_need_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger documents_need_deal_match
  before insert or update of deal_id, client_need_id
  on public.documents
  for each row
  execute function public.enforce_document_need_deal_match();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger users_set_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at();

create trigger deals_set_updated_at
  before update on public.deals
  for each row
  execute function public.set_updated_at();

create trigger client_needs_set_updated_at
  before update on public.client_needs
  for each row
  execute function public.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index users_role_idx on public.users (role);
create index users_is_active_idx on public.users (is_active);

create index deals_status_idx on public.deals (status);
create index deals_assigned_processor_id_idx on public.deals (assigned_processor_id);
create index deals_created_at_idx on public.deals (created_at desc);
create index deals_status_created_at_idx on public.deals (status, created_at desc);

create index client_needs_status_idx on public.client_needs (status);
create index client_needs_deal_id_idx on public.client_needs (deal_id);
create index client_needs_deal_id_status_idx on public.client_needs (deal_id, status);
create index client_needs_reviewed_by_idx on public.client_needs (reviewed_by);

create index documents_status_idx on public.documents (status);
create index documents_deal_id_idx on public.documents (deal_id);
create index documents_client_need_id_idx on public.documents (client_need_id);
create index documents_deal_id_status_idx on public.documents (deal_id, status);

create index tasks_status_idx on public.tasks (status);
create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_deal_id_idx on public.tasks (deal_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_due_at_idx on public.tasks (status, due_at);

create index activity_log_deal_id_created_at_idx
  on public.activity_log (deal_id, created_at desc);
create index activity_log_actor_id_idx on public.activity_log (actor_id);
create index activity_log_event_type_idx on public.activity_log (event_type);

-- ---------------------------------------------------------------------------
-- RLS helpers
-- SECURITY DEFINER + fixed search_path so policies can read public.users
-- without recursive RLS on the users table.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
    and u.is_active = true
$$;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.is_active = true
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_processor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'processor', false)
$$;

create or replace function public.is_loan_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'loan_officer', false)
$$;

create or replace function public.is_admin_or_processor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'processor'), false)
$$;

-- Reads deals via SECURITY DEFINER so assignment checks are not RLS-recursive
-- and are not left to application code. Used for processor UPDATE policies.
create or replace function public.deal_is_processor_updatable(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deals d
    where d.id = p_deal_id
      and (
        d.assigned_processor_id is null
        or d.assigned_processor_id = auth.uid()
      )
  )
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_internal_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_processor() from public, anon;
revoke all on function public.is_loan_officer() from public, anon;
revoke all on function public.is_admin_or_processor() from public, anon;
revoke all on function public.deal_is_processor_updatable(uuid) from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_internal_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_processor() to authenticated;
grant execute on function public.is_loan_officer() to authenticated;
grant execute on function public.is_admin_or_processor() to authenticated;
grant execute on function public.deal_is_processor_updatable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Processor column-level guards
-- RLS is row-level only; these triggers limit which columns a processor may change.
-- service_role / admin are not restricted here (service_role also bypasses RLS).
-- ---------------------------------------------------------------------------

create or replace function public.enforce_processor_deal_updates()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or not public.is_processor() then
    return new;
  end if;

  if old.assigned_processor_id is not null
    and old.assigned_processor_id is distinct from auth.uid()
  then
    raise exception 'processors cannot modify a deal assigned to another processor'
      using errcode = '42501';
  end if;

  if new.assigned_processor_id is not null
    and new.assigned_processor_id is distinct from auth.uid()
  then
    raise exception 'processors may only assign a deal to themselves'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.deal_reference is distinct from old.deal_reference
    or new.borrower_name is distinct from old.borrower_name
    or new.borrower_email is distinct from old.borrower_email
    or new.borrower_phone is distinct from old.borrower_phone
    or new.entity_name is distinct from old.entity_name
    or new.loan_type is distinct from old.loan_type
    or new.loan_purpose is distinct from old.loan_purpose
    or new.loan_amount is distinct from old.loan_amount
    or new.property_address is distinct from old.property_address
    or new.property_city is distinct from old.property_city
    or new.property_state is distinct from old.property_state
    or new.property_type is distinct from old.property_type
    or new.credit_band is distinct from old.credit_band
    or new.experience is distinct from old.experience
    or new.created_at is distinct from old.created_at
  then
    raise exception 'processors may only update operational deal fields (status, assigned_processor_id)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_processor_client_need_updates()
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
    raise exception 'processors cannot update client_needs on another processor''s deal'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.deal_id is distinct from old.deal_id
    or new.category is distinct from old.category
    or new.document_type is distinct from old.document_type
    or new.description is distinct from old.description
    or new.required is distinct from old.required
    or new.created_at is distinct from old.created_at
  then
    raise exception 'processors may only update operational client_needs fields (status, dates, reviewer, notes)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_processor_document_updates()
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
    raise exception 'processors cannot update documents on another processor''s deal'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.deal_id is distinct from old.deal_id
    or new.client_need_id is distinct from old.client_need_id
    or new.file_name is distinct from old.file_name
    or new.storage_provider is distinct from old.storage_provider
    or new.external_file_id is distinct from old.external_file_id
    or new.mime_type is distinct from old.mime_type
    or new.uploaded_at is distinct from old.uploaded_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'processors may only update operational document fields (status, document_type, ai_classification, ai_confidence)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

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
    or new.created_at is distinct from old.created_at
  then
    raise exception 'processors may only update operational task fields (priority, assigned_to, status, due_at, completed_at)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger deals_enforce_processor_updates
  before update on public.deals
  for each row
  execute function public.enforce_processor_deal_updates();

create trigger client_needs_enforce_processor_updates
  before update on public.client_needs
  for each row
  execute function public.enforce_processor_client_need_updates();

create trigger documents_enforce_processor_updates
  before update on public.documents
  for each row
  execute function public.enforce_processor_document_updates();

create trigger tasks_enforce_processor_updates
  before update on public.tasks
  for each row
  execute function public.enforce_processor_task_updates();

-- ---------------------------------------------------------------------------
-- Grants
-- anon: no table access
-- authenticated: DML privileges exist, but RLS decides what is allowed
-- service_role: bypasses RLS (Supabase default)
-- ---------------------------------------------------------------------------

revoke all on table public.users from anon, public;
revoke all on table public.deals from anon, public;
revoke all on table public.client_needs from anon, public;
revoke all on table public.documents from anon, public;
revoke all on table public.tasks from anon, public;
revoke all on table public.activity_log from anon, public;

grant select, insert, update, delete on table public.users to authenticated;
grant select, insert, update, delete on table public.deals to authenticated;
grant select, insert, update, delete on table public.client_needs to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.activity_log to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- No broad always-allow policies. Anonymous has zero policies = no access.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.deals enable row level security;
alter table public.client_needs enable row level security;
alter table public.documents enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_log enable row level security;

-- users: staff directory is admin/processor only. Loan officers have no profile SELECT.
create policy users_select_admin_processor
  on public.users
  for select
  to authenticated
  using (public.is_admin_or_processor());

create policy users_insert_admin
  on public.users
  for insert
  to authenticated
  with check (public.is_admin());

create policy users_update_admin
  on public.users
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy users_delete_admin
  on public.users
  for delete
  to authenticated
  using (public.is_admin());

-- deals: loan officers may read; processors may read the full queue
create policy deals_select_internal
  on public.deals
  for select
  to authenticated
  using (public.is_internal_user());

create policy deals_insert_admin
  on public.deals
  for insert
  to authenticated
  with check (public.is_admin());

create policy deals_update_admin
  on public.deals
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Processor claim/update: USING sees the current assignment, WITH CHECK sees the new one.
-- Combined with the assignment trigger, this blocks assigning to others, taking B's deal,
-- or clearing B's assignment. Concurrent claims serialize on the row lock; the second
-- updater re-checks USING against the claimed row and is denied.
create policy deals_update_processor
  on public.deals
  for update
  to authenticated
  using (
    public.is_processor()
    and (
      assigned_processor_id is null
      or assigned_processor_id = auth.uid()
    )
  )
  with check (
    public.is_processor()
    and (
      assigned_processor_id is null
      or assigned_processor_id = auth.uid()
    )
  );

create policy deals_delete_admin
  on public.deals
  for delete
  to authenticated
  using (public.is_admin());

-- client_needs: loan officers may read; processor writes only on eligible deals
create policy client_needs_select_internal
  on public.client_needs
  for select
  to authenticated
  using (public.is_internal_user());

create policy client_needs_insert_admin
  on public.client_needs
  for insert
  to authenticated
  with check (public.is_admin());

create policy client_needs_update_admin
  on public.client_needs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy client_needs_update_processor
  on public.client_needs
  for update
  to authenticated
  using (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  )
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );

create policy client_needs_delete_admin
  on public.client_needs
  for delete
  to authenticated
  using (public.is_admin());

-- documents: no loan officer SELECT (hides storage_provider / external_file_id)
create policy documents_select_admin_processor
  on public.documents
  for select
  to authenticated
  using (public.is_admin_or_processor());

create policy documents_insert_admin
  on public.documents
  for insert
  to authenticated
  with check (public.is_admin());

create policy documents_update_admin
  on public.documents
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy documents_update_processor
  on public.documents
  for update
  to authenticated
  using (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  )
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );

create policy documents_delete_admin
  on public.documents
  for delete
  to authenticated
  using (public.is_admin());

-- tasks: no loan officer SELECT
create policy tasks_select_admin_processor
  on public.tasks
  for select
  to authenticated
  using (public.is_admin_or_processor());

create policy tasks_insert_admin
  on public.tasks
  for insert
  to authenticated
  with check (public.is_admin());

create policy tasks_update_admin
  on public.tasks
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy tasks_update_processor
  on public.tasks
  for update
  to authenticated
  using (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  )
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );

create policy tasks_delete_admin
  on public.tasks
  for delete
  to authenticated
  using (public.is_admin());

-- activity_log: append-oriented. Writes from the app should use service_role.
-- Admin may insert/delete for operational cleanup. No update policy (immutable events).
-- Loan officers have no SELECT. Sanitizer/denylist required before production data.
create policy activity_log_select_admin_processor
  on public.activity_log
  for select
  to authenticated
  using (public.is_admin_or_processor());

create policy activity_log_insert_admin
  on public.activity_log
  for insert
  to authenticated
  with check (public.is_admin());

create policy activity_log_delete_admin
  on public.activity_log
  for delete
  to authenticated
  using (public.is_admin());
