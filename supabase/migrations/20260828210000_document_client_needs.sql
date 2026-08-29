-- Migration A: many-to-many document ↔ client need links.
-- Does NOT drop documents.client_need_id. Apply Migration B only after
-- application code uses this join table and backfill is verified.

-- ---------------------------------------------------------------------------
-- Optional Client Need expectation fields (progress is still derived)
-- ---------------------------------------------------------------------------

alter table public.client_needs
  add column if not exists expected_document_count integer,
  add column if not exists require_all_linked_approved boolean not null default true;

alter table public.client_needs
  drop constraint if exists client_needs_expected_document_count_positive;

alter table public.client_needs
  add constraint client_needs_expected_document_count_positive
  check (expected_document_count is null or expected_document_count >= 1);

comment on column public.client_needs.expected_document_count is
  'Optional expected evidence count (e.g. 2 bank statements). Null means unknown. Do not store redundant received counts.';

comment on column public.client_needs.require_all_linked_approved is
  'When true, processors should not treat the need as fully satisfied until every linked document is approved. Never auto-approve from this flag.';

-- Processors still cannot change checklist identity or expectation config.
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
    or new.expected_document_count is distinct from old.expected_document_count
    or new.require_all_linked_approved is distinct from old.require_all_linked_approved
    or new.created_at is distinct from old.created_at
  then
    raise exception 'processors may only update operational client_needs fields (status, dates, reviewer, notes)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop policy if exists client_needs_insert_processor on public.client_needs;
create policy client_needs_insert_processor
  on public.client_needs
  for insert
  to authenticated
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );

-- ---------------------------------------------------------------------------
-- Join table
-- ---------------------------------------------------------------------------

create table public.document_client_needs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  client_need_id uuid not null references public.client_needs (id) on delete cascade,
  linked_at timestamptz not null default now(),
  linked_by uuid references public.users (id) on delete set null,
  link_source text,
  constraint document_client_needs_unique_pair unique (document_id, client_need_id),
  constraint document_client_needs_link_source_valid check (
    link_source is null
    or link_source in ('upload', 'manual', 'ai_suggested', 'system')
  )
);

comment on table public.document_client_needs is
  'Many-to-many link between deal-level document metadata and Client Needs. One need may have many documents; one document may satisfy many needs. Unlinked documents (zero rows) are valid.';

create index document_client_needs_document_id_idx
  on public.document_client_needs (document_id);

create index document_client_needs_client_need_id_idx
  on public.document_client_needs (client_need_id);

-- Same-deal integrity: a document may only link to a Client Need on the same deal.
create or replace function public.enforce_document_client_need_same_deal()
returns trigger
language plpgsql
as $$
declare
  document_deal uuid;
  need_deal uuid;
begin
  select deal_id into document_deal
  from public.documents
  where id = new.document_id;

  select deal_id into need_deal
  from public.client_needs
  where id = new.client_need_id;

  if document_deal is null or need_deal is null or document_deal is distinct from need_deal then
    raise exception 'document_client_needs cannot link a document to a Client Need on a different deal'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger document_client_needs_same_deal
  before insert or update of document_id, client_need_id
  on public.document_client_needs
  for each row
  execute function public.enforce_document_client_need_same_deal();

-- ---------------------------------------------------------------------------
-- Backfill from documents.client_need_id
-- ---------------------------------------------------------------------------

insert into public.document_client_needs (
  document_id,
  client_need_id,
  linked_at,
  linked_by,
  link_source
)
select
  d.id,
  d.client_need_id,
  coalesce(d.uploaded_at, d.created_at, now()),
  null,
  'system'
from public.documents d
where d.client_need_id is not null
on conflict (document_id, client_need_id) do nothing;

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from public.documents d
  where d.client_need_id is not null
    and not exists (
      select 1
      from public.document_client_needs l
      where l.document_id = d.id
        and l.client_need_id = d.client_need_id
    );

  if missing_count > 0 then
    raise exception 'document_client_needs backfill incomplete: % legacy documents.client_need_id values have no join row', missing_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS (do not weaken existing document/need policies)
-- ---------------------------------------------------------------------------

revoke all on table public.document_client_needs from anon, public;
grant select, insert, delete on table public.document_client_needs to authenticated;

alter table public.document_client_needs enable row level security;

create policy document_client_needs_select_admin_processor
  on public.document_client_needs
  for select
  to authenticated
  using (public.is_admin_or_processor());

create policy document_client_needs_insert_admin
  on public.document_client_needs
  for insert
  to authenticated
  with check (public.is_admin());

create policy document_client_needs_insert_processor
  on public.document_client_needs
  for insert
  to authenticated
  with check (
    public.is_processor()
    and exists (
      select 1
      from public.documents d
      join public.client_needs cn on cn.id = document_client_needs.client_need_id
      where d.id = document_client_needs.document_id
        and d.deal_id = cn.deal_id
        and public.deal_is_processor_updatable(d.deal_id)
    )
  );

create policy document_client_needs_delete_admin
  on public.document_client_needs
  for delete
  to authenticated
  using (public.is_admin());

create policy document_client_needs_delete_processor
  on public.document_client_needs
  for delete
  to authenticated
  using (
    public.is_processor()
    and exists (
      select 1
      from public.documents d
      where d.id = document_client_needs.document_id
        and public.deal_is_processor_updatable(d.deal_id)
    )
  );
