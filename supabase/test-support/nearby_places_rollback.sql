-- LOCAL guidance; execute only with separate withdrawal authorization after client/Edge disable.
-- Data retaining: no original application rows, grants, RLS or migration history are altered.
begin;
revoke execute on function public.get_nearby_places_context(uuid) from authenticated;
revoke execute on function public.claim_nearby_places(uuid,text),public.finish_nearby_places(text,uuid,jsonb,integer) from service_role;
commit;
-- Retain private cache/counters until reviewed cleanup. Never replay/remove migration history.
