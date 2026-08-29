-- Persist structured application intake on the deal.
-- Why: activity_log.safe_metadata truncates values to 120 characters and is an
-- audit trail, not a working file. Processors need purchase price, ARV, rehab
-- budget, funding timeline, and other intake fields on Overview without reading
-- JSON. A single jsonb column keeps the schema extensible instead of adding
-- dozens of nullable deal columns.
-- Do not apply this migration to production. Sandbox evaluation only.

alter table public.deals
  add column if not exists application_intake jsonb;

comment on column public.deals.application_intake is
  'Structured sandbox application intake. Operational fields only; no SSN, account numbers, or document contents.';
