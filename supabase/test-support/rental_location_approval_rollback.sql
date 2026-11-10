-- Separately authorized downgrade only. Stops future coordinate projection first.
-- Retain private approval/revision state and invalidation triggers; do not restore old approvals.
begin;
revoke execute on function public.get_rental_prediction_coordinates(uuid,uuid,uuid),public.get_rental_location_approval(uuid),public.set_rental_location_approval(uuid,uuid,boolean,text) from authenticated;
commit;
-- Redeploy prior proxy or disable approvedCoordinates before revoking entry points.
-- No lost rows/coordinates to restore. Forward re-enable requires reviewed grants and fresh owner approval.
