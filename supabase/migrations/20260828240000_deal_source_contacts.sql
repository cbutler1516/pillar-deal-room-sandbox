-- Deal-level source contacts + task contact references.
-- Do not store passwords, credentials, SSNs, bank data, or document contents.

create table if not exists public.deal_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  contact_type text not null,
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  is_primary boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_contacts_name_not_blank check (length(trim(name)) > 0),
  constraint deal_contacts_type_valid check (
    contact_type in (
      'borrower',
      'co_borrower',
      'title',
      'insurance',
      'escrow',
      'closing_attorney',
      'appraiser',
      'contractor',
      'property_manager',
      'cpa',
      'lender',
      'realtor',
      'loan_officer',
      'other'
    )
  )
);

comment on table public.deal_contacts is
  'People/entities the processor contacts to complete a file. Operational contact data only.';

create index if not exists deal_contacts_deal_id_idx on public.deal_contacts (deal_id);
create index if not exists deal_contacts_type_idx on public.deal_contacts (deal_id, contact_type);

create unique index if not exists deal_contacts_one_primary_per_type
  on public.deal_contacts (deal_id, contact_type)
  where is_primary and archived_at is null;

create trigger deal_contacts_set_updated_at
  before update on public.deal_contacts
  for each row
  execute function public.set_updated_at();

alter table public.tasks
  add column if not exists deal_contact_id uuid references public.deal_contacts (id) on delete set null;

create index if not exists tasks_deal_contact_id_idx on public.tasks (deal_contact_id);

create or replace function public.enforce_task_contact_same_deal()
returns trigger
language plpgsql
as $$
declare
  contact_deal uuid;
begin
  if new.deal_contact_id is null then
    return new;
  end if;

  select deal_id into contact_deal
  from public.deal_contacts
  where id = new.deal_contact_id;

  if contact_deal is null or contact_deal is distinct from new.deal_id then
    raise exception 'tasks.deal_contact_id must belong to the same deal'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_enforce_contact_same_deal on public.tasks;
create trigger tasks_enforce_contact_same_deal
  before insert or update of deal_id, deal_contact_id
  on public.tasks
  for each row
  execute function public.enforce_task_contact_same_deal();

revoke all on table public.deal_contacts from anon, public;
grant select, insert, update, delete on table public.deal_contacts to authenticated;

alter table public.deal_contacts enable row level security;

drop policy if exists deal_contacts_select_admin_processor on public.deal_contacts;
create policy deal_contacts_select_admin_processor
  on public.deal_contacts
  for select
  to authenticated
  using (public.is_admin_or_processor());

drop policy if exists deal_contacts_select_loan_officer on public.deal_contacts;
create policy deal_contacts_select_loan_officer
  on public.deal_contacts
  for select
  to authenticated
  using (public.is_loan_officer());

drop policy if exists deal_contacts_insert_admin on public.deal_contacts;
create policy deal_contacts_insert_admin
  on public.deal_contacts
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists deal_contacts_insert_processor on public.deal_contacts;
create policy deal_contacts_insert_processor
  on public.deal_contacts
  for insert
  to authenticated
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );

drop policy if exists deal_contacts_update_admin on public.deal_contacts;
create policy deal_contacts_update_admin
  on public.deal_contacts
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists deal_contacts_update_processor on public.deal_contacts;
create policy deal_contacts_update_processor
  on public.deal_contacts
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

drop policy if exists deal_contacts_delete_admin on public.deal_contacts;
create policy deal_contacts_delete_admin
  on public.deal_contacts
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists deal_contacts_delete_processor on public.deal_contacts;
create policy deal_contacts_delete_processor
  on public.deal_contacts
  for delete
  to authenticated
  using (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );
