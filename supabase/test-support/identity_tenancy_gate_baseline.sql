-- Pre-migration BASELINE definitions captured READ-ONLY from the hosted project cxfsbwbwmwmgtqfonqth on 2026-11-12 (pg_get_functiondef).
-- Test fixture only: loaded by supabase/tests/run_identity_tenancy_gate.py into a disposable container. Function code only; no data.
-- The harness asserts md5(prosrc) of each target equals the values below before applying the migration. Not a migration.

-- rentlease_property_edit.lock_owner(uuid)  md5(prosrc)=d92dbc08d296168776d7fa49e96b321c  (dependency, loaded as-is)
CREATE OR REPLACE FUNCTION rentlease_property_edit.lock_owner(p_property_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 if auth.uid() is null or not public.is_tier1_verified(auth.uid()) then
 raise exception 'Tier 1 active landlord required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_property_id::text,0));
 if not exists(select 1 from public.properties where id=p_property_id and landlord_id=auth.uid() and is_active) then
 raise exception 'Owned active property required' using errcode='42501';end if;
end$function$;

-- rentlease_property_identity.require_ready(uuid)  md5(prosrc)=a64c825de6695f7a8a4bac2c744385f7  (dependency, loaded as-is)
CREATE OR REPLACE FUNCTION rentlease_property_identity.require_ready(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$begin
 if exists(select 1 from rentlease_property_identity.repairs where property_id=p_id) or not exists(select 1 from rentlease_property_identity.current_identity c join rentlease_property_identity.revisions r on r.id=c.revision_id join public.properties p on p.id=c.property_id where c.property_id=p_id and r.owner_id=p.landlord_id) then raise exception 'Property identity data requires trusted repair before correction or verification' using errcode='22023';end if;
end$function$;

-- rentlease_property_identity.submission_json(verification_submissions)  md5(prosrc)=2a43ad53614ce8aea63674daf96043b9  (dependency, loaded as-is)
CREATE OR REPLACE FUNCTION rentlease_property_identity.submission_json(s verification_submissions)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$select to_jsonb(s)||jsonb_build_object('hasDocument',exists(select 1 from public.verification_documents d where d.submission_id=s.id),'identityCorrection',s.identity_correction_id is not null)$function$;

-- rentlease_property_identity.promote(uuid,uuid)  md5(prosrc)=e4de0578032cae920f8f73b3a6f20b92  (pinned target)
CREATE OR REPLACE FUNCTION rentlease_property_identity.promote(p_id uuid, r_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$declare j jsonb;begin
 if exists(select 1 from public.tenancies where property_id=p_id and status in('proposed','pending_confirmation','active')) then raise exception 'Identity cannot change while a tenancy is open' using errcode='22023';end if;
 select identity into strict j from rentlease_property_identity.revisions where id=r_id and property_id=p_id;
 perform rentlease_property_identity.check_identity(p_id,j);
 update public.properties set property_type=(j->>'property_type')::public.property_type,city=(j->>'city')::public.cavite_city,barangay=j->>'barangay',floor_number=(j->>'floor_number')::smallint,public_location=extensions.st_setsrid(extensions.st_makepoint((j->>'public_lng')::float8,(j->>'public_lat')::float8),4326)::extensions.geography where id=p_id;
 update public.property_private_locations set address_line_1=j->>'address_line_1',address_line_2=j->>'address_line_2',postal_code=j->>'postal_code',exact_location=extensions.st_setsrid(extensions.st_makepoint((j->>'exact_lng')::float8,(j->>'exact_lat')::float8),4326)::extensions.geography where property_id=p_id;
 if not found then raise exception 'Private identity requires repair' using errcode='22023';end if;
 update rentlease_property_identity.current_identity set revision_id=r_id,approved_submission_id=null where property_id=p_id;
 perform rentlease_completeness.refresh_listing_completeness_for_property(p_id);
 if exists(select 1 from public.listings where property_id=p_id and status in('active','paused') and completeness_score<.80) then raise exception 'Published identity must preserve 80%% completeness' using errcode='22023';end if;
end$function$;

-- manage_property_identity(uuid,uuid,uuid,text,jsonb,uuid,uuid)  md5(prosrc)=c11e5b963e27ffd7601fb161def042fe  (pinned target)
CREATE OR REPLACE FUNCTION public.manage_property_identity(p_property_id uuid, p_expected_version uuid, p_operation_id uuid, p_action text, p_identity jsonb DEFAULT NULL::jsonb, p_correction_id uuid DEFAULT NULL::uuid, p_expected_correction_version uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare body jsonb;receipt rentlease_property_identity.receipts%rowtype;c rentlease_property_identity.current_identity%rowtype;q rentlease_property_identity.corrections%rowtype;r uuid;result jsonb;
begin
 perform rentlease_property_edit.lock_owner(p_property_id);perform rentlease_property_identity.require_ready(p_property_id);
 if p_operation_id is null or p_expected_version is null then raise exception 'Version and operation ID required' using errcode='22023';end if;
 body:=jsonb_build_object('property',p_property_id,'version',p_expected_version,'action',p_action,'identity',p_identity,'correction',p_correction_id,'correction_version',p_expected_correction_version);
 select * into receipt from rentlease_property_identity.receipts where owner_id=auth.uid() and operation_id=p_operation_id;
 if found then if receipt.input is distinct from body then raise exception 'Operation ID reused' using errcode='22023';end if;return receipt.result;end if;
 if (select edit_version from public.properties where id=p_property_id) is distinct from p_expected_version then raise exception 'Property changed. Reload before requesting correction' using errcode='40001';end if;
 select * into strict c from rentlease_property_identity.current_identity where property_id=p_property_id;
 if p_action='cancel' then
  select * into q from rentlease_property_identity.corrections where id=p_correction_id and property_id=p_property_id for update;
  if q.id is not null and q.version is distinct from p_expected_correction_version then raise exception 'Correction changed. Refresh before cancelling' using errcode='40001';end if;
  if q.id is null or q.status not in('draft','submitted') or exists(select 1 from public.verification_submissions where id=q.submission_id and status='under_review') then raise exception 'This correction cannot be cancelled during or after review' using errcode='22023';end if;
  update public.verification_submissions set status='cancelled',identity_review_version=gen_random_uuid() where id=q.submission_id and status='pending';
  update rentlease_property_identity.corrections set status='cancelled',version=gen_random_uuid() where id=q.id;
 elsif p_action='same_property_correction' then
  if exists(select 1 from rentlease_property_identity.corrections where property_id=p_property_id and status in('draft','submitted')) or exists(select 1 from public.verification_submissions where property_id=p_property_id and tier='tier_3_property' and status in('pending','under_review')) then raise exception 'An identity correction or verification is already open' using errcode='22023';end if;
  p_identity:=rentlease_property_identity.check_identity(p_property_id,p_identity);
  if p_identity=(select identity from rentlease_property_identity.revisions where id=c.revision_id) then raise exception 'No identity changes' using errcode='22023';end if;
  insert into rentlease_property_identity.revisions(property_id,owner_id,identity,provenance) values(p_property_id,auth.uid(),p_identity,'owner_attested_same_physical_property') returning id into r;
  insert into rentlease_property_identity.corrections(property_id,owner_id,base_revision_id,candidate_revision_id,status) values(p_property_id,auth.uid(),c.revision_id,r,'draft') returning * into q;
  if not exists(select 1 from public.verification_submissions where property_id=p_property_id and tier='tier_3_property' and status in('approved','revoked')) and c.approved_submission_id is null then
   if exists(select 1 from public.listings where property_id=p_property_id and status in('active','paused','rented')) then raise exception 'Published property requires verified identity review' using errcode='22023';end if;
   perform rentlease_property_identity.promote(p_property_id,r);update rentlease_property_identity.corrections set status='applied',version=gen_random_uuid() where id=q.id;
  end if;
 else raise exception 'Relocation, splitting, merging or substitution requires a new property' using errcode='22023';end if;
 result:=jsonb_build_object('property_id',p_property_id,'correction_id',q.id);
 insert into rentlease_property_identity.receipts values(auth.uid(),p_operation_id,p_property_id,body,result);return result;
end$function$;

-- begin_property_identity_verification(uuid,uuid)  md5(prosrc)=79d82e9403a5f04511b53b25ed8b695d  (pinned target)
CREATE OR REPLACE FUNCTION public.begin_property_identity_verification(p_property_id uuid, p_expected_revision uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$declare q rentlease_property_identity.corrections%rowtype;c rentlease_property_identity.current_identity%rowtype;s public.verification_submissions%rowtype;r uuid;begin
 perform rentlease_property_edit.lock_owner(p_property_id);perform rentlease_property_identity.require_ready(p_property_id);
 select * into c from rentlease_property_identity.current_identity where property_id=p_property_id;
 select * into q from rentlease_property_identity.corrections where property_id=p_property_id and status in('draft','submitted');
 r:=coalesce(q.candidate_revision_id,c.revision_id);
 if r is distinct from p_expected_revision then raise exception 'Identity changed. Refresh before submitting proof' using errcode='40001';end if;
 select * into s from public.verification_submissions where property_id=p_property_id and tier='tier_3_property' and status in('pending','under_review') order by submitted_at desc,id desc limit 1;
 if s.id is not null then return rentlease_property_identity.submission_json(s);end if;
 if q.id is null and rentlease_property_identity.verified(p_property_id) then raise exception 'Current identity is already verified' using errcode='22023';end if;
 r:=coalesce(q.candidate_revision_id,c.revision_id);
 insert into public.verification_submissions(user_id,tier,property_id,identity_revision_id,identity_correction_id) values(auth.uid(),'tier_3_property',p_property_id,r,q.id) returning * into s;
 if q.id is not null then update rentlease_property_identity.corrections set submission_id=s.id,version=gen_random_uuid() where id=q.id;end if;
 return rentlease_property_identity.submission_json(s);
end$function$;

-- get_admin_property_identity_review(uuid)  md5(prosrc)=2f59d5579001d78cb2a8b8d40003d96a  (pinned target)
CREATE OR REPLACE FUNCTION public.get_admin_property_identity_review(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$declare result jsonb;begin
 if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin required' using errcode='42501';end if;
 select jsonb_build_object('submission_version',s.identity_review_version,'property_version',p.edit_version,'current_revision_id',c.revision_id,'current',r.identity,'proposed',v.identity,'correction_id',q.id,'correction_version',q.version,'same_asset_required',q.id is not null,'requires_repair',exists(select 1 from rentlease_property_identity.repairs z where z.property_id=p.id)) into result from public.verification_submissions s join public.properties p on p.id=s.property_id left join rentlease_property_identity.current_identity c on c.property_id=p.id left join rentlease_property_identity.revisions r on r.id=c.revision_id left join rentlease_property_identity.revisions v on v.id=s.identity_revision_id left join rentlease_property_identity.corrections q on q.id=s.identity_correction_id where s.id=p_submission_id and s.tier='tier_3_property';return result;
end$function$;
