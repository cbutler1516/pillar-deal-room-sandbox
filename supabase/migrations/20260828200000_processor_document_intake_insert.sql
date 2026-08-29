-- Processors may insert document metadata on eligible deals (unassigned or
-- assigned to them). File bytes are never stored in this table.

create policy documents_insert_processor
  on public.documents
  for insert
  to authenticated
  with check (
    public.is_processor()
    and public.deal_is_processor_updatable(deal_id)
  );
