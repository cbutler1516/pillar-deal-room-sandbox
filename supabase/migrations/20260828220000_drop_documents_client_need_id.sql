-- Migration B: drop documents.client_need_id after the join table is in use.
-- Do not apply until Migration A has run and application code reads/writes
-- document_client_needs only.

do $$
declare
  missing_count integer;
begin
  if to_regclass('public.document_client_needs') is null then
    raise exception 'Apply 20260828210000_document_client_needs.sql before dropping documents.client_need_id';
  end if;

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
    raise exception 'Refusing to drop documents.client_need_id: % legacy links are not in document_client_needs', missing_count;
  end if;
end $$;

drop trigger if exists documents_need_deal_match on public.documents;
drop function if exists public.enforce_document_need_deal_match();

drop index if exists public.documents_client_need_id_idx;

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

alter table public.documents
  drop column if exists client_need_id;
