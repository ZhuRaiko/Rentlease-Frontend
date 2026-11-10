-- Data-retaining withdrawal only, as a separately reviewed compensating migration.
-- Withdraw T7A clients and reconcile pending submissions/moderation receipts first.
-- Retain original reviews, pending legacy imports, publication state, immutable events,
-- receipts, restrictive raw-review policy and source-content protection.
begin;
revoke execute on function public.get_tenancy_reviews(uuid),public.submit_tenancy_review(uuid,uuid,text,integer,text),public.get_published_rental_reviews(text,uuid,integer),public.get_review_moderation(text,integer),public.moderate_rental_review(uuid,uuid,uuid,text,text) from authenticated;
commit;
