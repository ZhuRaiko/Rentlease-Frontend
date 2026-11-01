-- Stage 2 PREPARED ONLY. Requires deployed edit_version infrastructure.
-- Content-only updates: active and paused; no INSERT, status or association assignments.
begin;
do $prerequisite$
begin
 if not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.listings'::regclass and attname='edit_version' and atttypid='pg_catalog.uuid'::regtype and attnotnull and not attisdropped)
 or not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.listings'::regclass and tgname='trg_listings_edit_version' and tgenabled in ('O','A')) then
  raise exception 'Deployed exact-target edit version infrastructure required';
 end if;
end;
$prerequisite$;
create function public.update_published_listing_content(
 p_listing_id uuid, p_expected_edit_version uuid,
 p_title text, p_description text, p_asking_rent_monthly numeric,
 p_house_rules text default null, p_rental_term public.rental_term_type default 'long_term',
 p_security_deposit_months numeric default 1, p_advance_rent_months numeric default 1,
 p_minimum_stay_months smallint default null, p_available_from date default null
) returns setof public.listings
language plpgsql security definer set search_path = pg_catalog as $function$
declare
 v_user uuid := auth.uid();
 v_property uuid;
 v_listing public.listings%rowtype;
 v_status public.listing_status;
 v_published_at timestamptz;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.is_tier1_verified(v_user) then raise exception 'Tier 1 verified active account required' using errcode='42501'; end if;
 if not public.has_app_role('landlord'::public.app_role,v_user) then raise exception 'Landlord role required' using errcode='42501'; end if;
 if p_listing_id is null or p_expected_edit_version is null then raise exception 'Listing and edit version required' using errcode='22023'; end if;
 if current_setting('transaction_isolation') not in ('read committed','read uncommitted') then raise exception 'Published editing requires READ COMMITTED isolation' using errcode='25001'; end if;
 select l.property_id into v_property from public.listings l where l.id=p_listing_id and l.landlord_id=v_user;
 if v_property is null then raise exception 'Owned listing required' using errcode='42501'; end if;
 -- Same advisory key as create, publish, lifecycle and completeness operations.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_property::text,0));
 -- Recheck authorization after waiting; property ownership must remain stable.
 if not public.is_tier1_verified(v_user) or not public.has_app_role('landlord'::public.app_role,v_user) then raise exception 'Active Tier 1 landlord required' using errcode='42501'; end if;
 perform 1 from public.properties p where p.id=v_property and p.landlord_id=v_user and p.is_active=true for share;
 if not found then raise exception 'Owned active property required' using errcode='42501'; end if;
 select l.* into v_listing from public.listings l where l.id=p_listing_id and l.landlord_id=v_user and l.property_id=v_property for update;
 if not found or v_listing.status not in ('active'::public.listing_status,'paused'::public.listing_status) or v_listing.edit_version<>p_expected_edit_version then
   raise exception 'Listing changed or is no longer editable' using errcode='40001';
 end if;
 v_status:=v_listing.status;v_published_at:=v_listing.published_at;
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_description),'') is null then raise exception 'Title and description required' using errcode='22023'; end if;
 if p_asking_rent_monthly is null or p_asking_rent_monthly<=0 or p_asking_rent_monthly::text in ('NaN','Infinity','-Infinity') then raise exception 'Positive finite rent required' using errcode='22023'; end if;
 if p_rental_term is null then raise exception 'Rental term required' using errcode='22023'; end if;
 if p_security_deposit_months is null or p_security_deposit_months<0 or p_security_deposit_months::text in ('NaN','Infinity','-Infinity') then raise exception 'Valid deposit months required' using errcode='22023'; end if;
 if p_advance_rent_months is null or p_advance_rent_months<0 or p_advance_rent_months::text in ('NaN','Infinity','-Infinity') then raise exception 'Valid advance months required' using errcode='22023'; end if;
 if p_minimum_stay_months is not null and p_minimum_stay_months<=0 then raise exception 'Positive minimum stay required' using errcode='22023'; end if;
 update public.listings l set title=btrim(p_title),description=btrim(p_description),
  asking_rent_monthly=p_asking_rent_monthly,house_rules=nullif(btrim(p_house_rules),''),rental_term=p_rental_term,
  security_deposit_months=p_security_deposit_months,advance_rent_months=p_advance_rent_months,
  minimum_stay_months=p_minimum_stay_months,available_from=p_available_from
 where l.id=p_listing_id and l.landlord_id=v_user and l.property_id=v_property
  and l.status=v_listing.status and l.edit_version=p_expected_edit_version
 returning l.* into v_listing;
 if not found then raise exception 'Listing changed before update' using errcode='40001'; end if;
 if v_listing.status<>v_status or v_listing.published_at is distinct from v_published_at then raise exception 'Publication state changed during edit' using errcode='40001'; end if;
 return next v_listing;
end;
$function$;
revoke all on function public.update_published_listing_content(uuid,uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date) from public,anon;
grant execute on function public.update_published_listing_content(uuid,uuid,text,text,numeric,text,public.rental_term_type,numeric,numeric,smallint,date) to authenticated;

commit;
