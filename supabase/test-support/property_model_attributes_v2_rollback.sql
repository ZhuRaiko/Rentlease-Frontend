-- Disable Phase 2A entry points only. Retain nullable columns, values and receipts.
begin;
drop function public.create_property_setup_v2(property_type,cavite_city,text,double precision,double precision,text,double precision,double precision,bigint[],text,text,text,smallint,numeric,numeric,smallint,smallint,furnishing_status,smallint,text,numeric,integer);
drop function public.update_property_details_v2(uuid,uuid,uuid,smallint,numeric,numeric,smallint,smallint,furnishing_status,bigint[],text,text,numeric,integer);
drop function public.get_owned_property_edit_context_v2(uuid);
-- Destructive column removal is deliberately not automatic. Old RPCs preserve new data.
commit;
