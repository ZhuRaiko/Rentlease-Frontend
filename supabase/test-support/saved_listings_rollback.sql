-- Data-retaining withdrawal only; separately authorize as a compensating migration.
-- Withdraw clients/reconcile unknown outcomes first. Retain table, bookmarks and index.
begin;
revoke execute on function public.get_saved_listing_states(uuid[]),public.set_saved_listing(uuid,boolean),public.get_saved_listings(integer,text) from authenticated;
commit;
