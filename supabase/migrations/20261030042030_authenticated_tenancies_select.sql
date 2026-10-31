-- PREPARED ONLY: not applied by Codex. Requires explicit authorization before live execution.
-- listings_read_allowed references tenancies; SELECT privilege is needed to evaluate it.
-- Existing enabled tenancy RLS limits reads to tenant/landlord parties or Admin.
-- No anon or write grant; no policy, function, ownership or RLS change.
GRANT SELECT ON TABLE public.tenancies TO authenticated;
