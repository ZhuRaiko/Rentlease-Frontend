-- LOCAL TEST FIXTURE ONLY: complete the listing shape for SETOF public.listings types.
\ir draft_edit_schema.sql
alter table public.listings add column paused_at timestamptz,add column archived_at timestamptz,add column removed_at timestamptz,add column removal_reason text;
alter table public.listings alter column title set not null,alter column description set not null,alter column asking_rent_monthly set not null,alter column completeness_score set not null,alter column rental_term set not null,alter column security_deposit_months set not null,alter column advance_rent_months set not null,alter column updated_at set not null;
