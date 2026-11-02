-- Milestone 4. LOCAL PREPARATION ONLY. Do not deploy without review and approval.
begin;
create schema rentlease_property_identity;
revoke all on schema rentlease_property_identity from public,anon,authenticated;
create table rentlease_property_identity.revisions(
 id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id),owner_id uuid not null,
 identity jsonb not null,provenance text not null,created_at timestamptz not null default now(),unique(property_id,id)
);
create table rentlease_property_identity.current_identity(
 property_id uuid primary key references public.properties(id),revision_id uuid not null,approved_submission_id uuid references public.verification_submissions(id),
 foreign key(property_id,revision_id) references rentlease_property_identity.revisions(property_id,id)
);
create table rentlease_property_identity.repairs(property_id uuid primary key references public.properties(id),reason text not null);
create table rentlease_property_identity.corrections(
 id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id),owner_id uuid not null,
 base_revision_id uuid not null,candidate_revision_id uuid not null,version uuid not null default gen_random_uuid(),
 status text not null check(status in('draft','submitted','applied','rejected','cancelled')),
 submission_id uuid references public.verification_submissions(id),created_at timestamptz not null default now(),
 foreign key(property_id,base_revision_id) references rentlease_property_identity.revisions(property_id,id),
 foreign key(property_id,candidate_revision_id) references rentlease_property_identity.revisions(property_id,id)
);
create unique index one_open_identity_correction on rentlease_property_identity.corrections(property_id) where status in('draft','submitted');
create table rentlease_property_identity.receipts(owner_id uuid not null,operation_id uuid not null,property_id uuid not null,input jsonb not null,result jsonb not null,primary key(owner_id,operation_id));
alter table public.verification_submissions add column identity_revision_id uuid references rentlease_property_identity.revisions(id),add column identity_correction_id uuid references rentlease_property_identity.corrections(id),add column identity_review_version uuid not null default gen_random_uuid(),add column ready_for_review_at timestamptz;
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='rentlease_property_identity' loop execute format('alter table rentlease_property_identity.%I enable row level security',t);execute format('revoke all on rentlease_property_identity.%I from public,anon,authenticated',t);end loop;end$$;

create function rentlease_property_identity.snapshot(p_id uuid) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('property_type',p.property_type,'city',p.city,'barangay',p.barangay,'floor_number',p.floor_number,
 'address_line_1',l.address_line_1,'address_line_2',l.address_line_2,'postal_code',l.postal_code,
 'exact_lat',extensions.st_y(l.exact_location::extensions.geometry),'exact_lng',extensions.st_x(l.exact_location::extensions.geometry),
 'public_lat',extensions.st_y(p.public_location::extensions.geometry),'public_lng',extensions.st_x(p.public_location::extensions.geometry))
 from public.properties p join public.property_private_locations l on l.property_id=p.id where p.id=p_id and l.exact_location is not null and p.public_location is not null and nullif(btrim(l.address_line_1),'') is not null and nullif(btrim(p.barangay),'') is not null
$$;
-- Observations of existing complete data, never fabricated historical evidence.
do $$declare p record;r uuid;s uuid;j jsonb;begin
 if exists(select 1 from public.verification_submissions where tier='tier_3_property' and status in('pending','under_review') group by property_id having count(*)>1) then raise exception 'Ambiguous open legacy property verification';end if;
 for p in select id,landlord_id from public.properties loop
  j:=rentlease_property_identity.snapshot(p.id);
  if j is null or p.id='52897654-d4f8-405e-b11e-44e57b4b4007' then insert into rentlease_property_identity.repairs values(p.id,'Trusted private identity data requires repair; historical approval is not a binding');continue;end if;
  if (select count(*) from public.verification_submissions where property_id=p.id and tier='tier_3_property' and status='approved')>1 then raise exception 'Ambiguous legacy property approvals';end if;
  insert into rentlease_property_identity.revisions(property_id,owner_id,identity,provenance) values(p.id,p.landlord_id,j,'bootstrap_current_observation_not_original_evidence') returning id into r;
  select v.id into s from public.verification_submissions v where v.property_id=p.id and v.user_id=p.landlord_id and v.tier='tier_3_property' and v.status='approved' and exists(select 1 from public.verification_documents d join storage.objects o on o.bucket_id='verification-documents' and o.name=d.storage_path where d.submission_id=v.id and d.document_type in('land_title','tax_declaration','hoa_document','authorization_to_lease'));
  if s is null and exists(select 1 from public.verification_submissions where property_id=p.id and tier='tier_3_property' and status='approved') then raise exception 'Legacy approval lacks qualifying owned proof';end if;
  insert into rentlease_property_identity.current_identity values(p.id,r,s);
  update public.verification_submissions v set identity_revision_id=r,ready_for_review_at=case when exists(select 1 from public.verification_documents d join storage.objects o on o.bucket_id='verification-documents' and o.name=d.storage_path where d.submission_id=v.id and d.document_type in('land_title','tax_declaration','hoa_document','authorization_to_lease')) then v.submitted_at else null end where v.property_id=p.id and v.user_id=p.landlord_id and v.tier='tier_3_property' and (v.id=s or v.status in('pending','under_review'));
 end loop;
 if exists(select 1 from public.verification_submissions where tier='tier_3_property' and status='under_review' and (identity_revision_id is null or ready_for_review_at is null)) then raise exception 'Legacy under-review identity evidence requires repair before migration';end if;
 if exists(select 1 from public.listings l join rentlease_property_identity.repairs r on r.property_id=l.property_id where l.status in('active','paused','rented')) then raise exception 'Published legacy identity requires repair before migration';end if;
end$$;

create unique index verification_tier3_one_open_identity on public.verification_submissions(property_id) where tier='tier_3_property' and status in('pending','under_review');
create function rentlease_property_identity.immutable_revision() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin raise exception 'Identity revisions are immutable; create a new correction' using errcode='42501';end$$;
create trigger identity_revision_immutable before update or delete on rentlease_property_identity.revisions for each row execute function rentlease_property_identity.immutable_revision();

create function rentlease_property_identity.verified(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from rentlease_property_identity.current_identity c join rentlease_property_identity.revisions r on r.id=c.revision_id join public.properties p on p.id=c.property_id join public.verification_submissions v on v.id=c.approved_submission_id
 where c.property_id=p_id and r.owner_id=p.landlord_id and v.user_id=p.landlord_id and v.property_id=p_id and v.identity_revision_id=r.id and v.status='approved' and not exists(select 1 from rentlease_property_identity.repairs x where x.property_id=p_id))
$$;
create function rentlease_property_identity.require_ready(p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from rentlease_property_identity.repairs where property_id=p_id) or not exists(select 1 from rentlease_property_identity.current_identity c join rentlease_property_identity.revisions r on r.id=c.revision_id join public.properties p on p.id=c.property_id where c.property_id=p_id and r.owner_id=p.landlord_id) then raise exception 'Property identity data requires trusted repair before correction or verification' using errcode='22023';end if;
end$$;
create function rentlease_property_identity.check_identity(p_id uuid,j jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare typ public.property_type;city public.cavite_city;floor smallint;lat double precision;lng double precision;plat double precision;plng double precision;x double precision;y double precision;current_j jsonb;
begin
 if j is null or jsonb_typeof(j)<>'object' or (j-array['property_type','city','barangay','floor_number','address_line_1','address_line_2','postal_code','exact_lat','exact_lng','public_lat','public_lng'])<>'{}'::jsonb then raise exception 'Only same-property identity fields are accepted' using errcode='22023';end if;
 typ:=(j->>'property_type')::public.property_type;city:=(j->>'city')::public.cavite_city;floor:=(j->>'floor_number')::smallint;
 lat:=(j->>'exact_lat')::double precision;lng:=(j->>'exact_lng')::double precision;plat:=(j->>'public_lat')::double precision;plng:=(j->>'public_lng')::double precision;
 if typ is null or city is null or nullif(btrim(j->>'barangay'),'') is null or nullif(btrim(j->>'address_line_1'),'') is null or lat is null or lng is null or plat is null or plng is null or not(lat between -90 and 90 and lng between -180 and 180 and plat between -90 and 90 and plng between -180 and 180) or floor<0 or (typ='house' and floor is not null) or floor>(select total_floors from public.properties where id=p_id) then raise exception 'Check identity, location and floor fields' using errcode='22023';end if;
 current_j:=rentlease_property_identity.snapshot(p_id);
 -- Legacy unchanged points may be retained; any location/address change must use the approved grid projection.
 if (j-array['property_type','floor_number']) is distinct from (current_j-array['property_type','floor_number']) then
  x:=6378137*radians(lng);y:=6378137*asinh(tan(radians(greatest(-85.05112878,least(85.05112878,lat)))));
  if abs(plng-degrees((floor(x/300)*300+150)/6378137))>0.00000001 or abs(plat-degrees(atan(sinh((floor(y/300)*300+150)/6378137))))>0.00000001 then raise exception 'Reconfirm corrected location using the approved public-point policy' using errcode='22023';end if;
 end if;
 return jsonb_build_object('property_type',typ,'city',city,'barangay',btrim(j->>'barangay'),'floor_number',floor,'address_line_1',btrim(j->>'address_line_1'),'address_line_2',nullif(btrim(j->>'address_line_2'),''),'postal_code',nullif(btrim(j->>'postal_code'),''),'exact_lat',lat,'exact_lng',lng,'public_lat',plat,'public_lng',plng);
end$$;
create function rentlease_property_identity.promote(p_id uuid,r_id uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$declare j jsonb;begin
 if exists(select 1 from public.tenancies where property_id=p_id and status in('proposed','pending_confirmation','active')) then raise exception 'Identity cannot change while a tenancy is open' using errcode='22023';end if;
 select identity into strict j from rentlease_property_identity.revisions where id=r_id and property_id=p_id;
 perform rentlease_property_identity.check_identity(p_id,j);
 update public.properties set property_type=(j->>'property_type')::public.property_type,city=(j->>'city')::public.cavite_city,barangay=j->>'barangay',floor_number=(j->>'floor_number')::smallint,public_location=extensions.st_setsrid(extensions.st_makepoint((j->>'public_lng')::float8,(j->>'public_lat')::float8),4326)::extensions.geography where id=p_id;
 update public.property_private_locations set address_line_1=j->>'address_line_1',address_line_2=j->>'address_line_2',postal_code=j->>'postal_code',exact_location=extensions.st_setsrid(extensions.st_makepoint((j->>'exact_lng')::float8,(j->>'exact_lat')::float8),4326)::extensions.geography where property_id=p_id;
 if not found then raise exception 'Private identity requires repair' using errcode='22023';end if;
 update rentlease_property_identity.current_identity set revision_id=r_id,approved_submission_id=null where property_id=p_id;
 perform rentlease_completeness.refresh_listing_completeness_for_property(p_id);
 if exists(select 1 from public.listings where property_id=p_id and status in('active','paused') and completeness_score<.80) then raise exception 'Published identity must preserve 80%% completeness' using errcode='22023';end if;
end$$;
create function public.get_property_identity_context(p_property_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare result jsonb;begin
 perform rentlease_property_edit.lock_owner(p_property_id);
 select jsonb_build_object('property_id',p.id,'owner_id',p.landlord_id,'edit_version',p.edit_version,'total_floors',p.total_floors,'current',r.identity,'current_revision_id',c.revision_id,'verified',rentlease_property_identity.verified(p.id),'requires_repair',exists(select 1 from rentlease_property_identity.repairs where property_id=p.id),'open_tenancy',exists(select 1 from public.tenancies t where t.property_id=p.id and t.status in('proposed','pending_confirmation','active')),'correction',(select to_jsonb(q)||jsonb_build_object('proposed',v.identity,'submission_status',(select status from public.verification_submissions where id=q.submission_id),'rejection_reason',(select rejection_reason from public.verification_submissions where id=q.submission_id),'review_note',(select review_note from public.verification_submissions where id=q.submission_id)) from rentlease_property_identity.corrections q join rentlease_property_identity.revisions v on v.id=q.candidate_revision_id where q.property_id=p.id order by q.created_at desc,q.id desc limit 1)) into result from public.properties p left join rentlease_property_identity.current_identity c on c.property_id=p.id left join rentlease_property_identity.revisions r on r.id=c.revision_id where p.id=p_property_id;return result;
end$$;
create function public.get_property_identity_operation(p_property_id uuid,p_operation_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin
 perform rentlease_property_edit.lock_owner(p_property_id);return(select result from rentlease_property_identity.receipts where owner_id=auth.uid() and property_id=p_property_id and operation_id=p_operation_id);end$$;
create function public.manage_property_identity(p_property_id uuid,p_expected_version uuid,p_operation_id uuid,p_action text,p_identity jsonb default null,p_correction_id uuid default null,p_expected_correction_version uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
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
end$$;
create function rentlease_property_identity.submission_json(s public.verification_submissions) returns jsonb language sql stable security definer set search_path=pg_catalog as $$select to_jsonb(s)||jsonb_build_object('hasDocument',exists(select 1 from public.verification_documents d where d.submission_id=s.id),'identityCorrection',s.identity_correction_id is not null)$$;
create function public.get_property_identity_submission(p_property_id uuid,p_current_only boolean default false) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare s public.verification_submissions%rowtype;q uuid;begin
 perform rentlease_property_edit.lock_owner(p_property_id);perform rentlease_property_identity.require_ready(p_property_id);
 if p_current_only then
  if rentlease_property_identity.verified(p_property_id) then select v.* into s from public.verification_submissions v join rentlease_property_identity.current_identity c on c.approved_submission_id=v.id where c.property_id=p_property_id;
  else select v.* into s from public.verification_submissions v join rentlease_property_identity.current_identity c on c.revision_id=v.identity_revision_id where c.property_id=p_property_id and v.tier='tier_3_property' and v.user_id=auth.uid() and v.status<>'approved' order by v.submitted_at desc,v.id desc limit 1;end if;
  if s.id is null then return null;end if;return rentlease_property_identity.submission_json(s);
 end if;
 select id into q from rentlease_property_identity.corrections where property_id=p_property_id and status in('draft','submitted');
 if q is not null then select * into s from public.verification_submissions where identity_correction_id=q order by submitted_at desc,id desc limit 1;
 else select * into s from public.verification_submissions where property_id=p_property_id and user_id=auth.uid() and tier='tier_3_property' order by submitted_at desc,id desc limit 1;end if;
 if s.id is null then return null;end if;return rentlease_property_identity.submission_json(s);
end$$;
create function public.begin_property_identity_verification(p_property_id uuid,p_expected_revision uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare q rentlease_property_identity.corrections%rowtype;c rentlease_property_identity.current_identity%rowtype;s public.verification_submissions%rowtype;r uuid;begin
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
end$$;
create function public.attach_property_identity_document(p_submission_id uuid,p_document_type public.verification_document_type,p_storage_path text,p_file_name text,p_mime_type text) returns void language plpgsql security definer set search_path=pg_catalog as $$declare s public.verification_submissions%rowtype;begin
 select * into s from public.verification_submissions where id=p_submission_id;
 if s.id is null or s.user_id is distinct from auth.uid() or s.tier<>'tier_3_property' then raise exception 'Owned property submission required' using errcode='42501';end if;
 perform rentlease_property_edit.lock_owner(s.property_id);perform rentlease_property_identity.require_ready(s.property_id);
 select * into s from public.verification_submissions where id=p_submission_id for update;
 if s.status<>'pending' or s.ready_for_review_at is not null or s.identity_revision_id is null then raise exception 'Evidence is frozen or submission changed' using errcode='40001';end if;
 if p_document_type not in('land_title','tax_declaration','hoa_document','authorization_to_lease') or p_mime_type not in('image/jpeg','image/png','application/pdf') or nullif(btrim(p_file_name),'') is null or split_part(p_storage_path,'/',1)<>auth.uid()::text or split_part(p_storage_path,'/',2)<>s.id::text or cardinality(string_to_array(p_storage_path,'/'))<>3 or not exists(select 1 from storage.objects where bucket_id='verification-documents' and name=p_storage_path) then raise exception 'Valid uploaded private proof required' using errcode='22023';end if;
 insert into public.verification_documents(submission_id,document_type,storage_path,file_name,mime_type) values(s.id,p_document_type,p_storage_path,p_file_name,p_mime_type);
 -- Finalize only after the private object and metadata are established, in one transaction.
 update public.verification_submissions set ready_for_review_at=now(),identity_review_version=gen_random_uuid() where id=s.id;
 update rentlease_property_identity.corrections set status='submitted',version=gen_random_uuid() where id=s.identity_correction_id;
end$$;
-- Freeze Tier 3 direct writes. Tier 2 policies/flow remain unchanged.
create policy identity_tier3_submission_insert on public.verification_submissions as restrictive for insert to authenticated with check(tier<>'tier_3_property');
create policy identity_tier3_submission_update on public.verification_submissions as restrictive for update to authenticated using(tier<>'tier_3_property') with check(tier<>'tier_3_property');
create policy identity_tier3_document_insert on public.verification_documents as restrictive for insert to authenticated with check(not exists(select 1 from public.verification_submissions s where s.id=submission_id and s.tier='tier_3_property'));
create policy identity_tier3_document_update on public.verification_documents as restrictive for update to authenticated using(not exists(select 1 from public.verification_submissions s where s.id=submission_id and s.tier='tier_3_property'));
create policy identity_tier3_document_delete on public.verification_documents as restrictive for delete to authenticated using(not exists(select 1 from public.verification_submissions s where s.id=submission_id and s.tier='tier_3_property'));
create function public.property_identity_document_mutable(p_path text) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$declare s public.verification_submissions%rowtype;begin
 if split_part(p_path,'/',2)!~'^[0-9a-fA-F-]{36}$' then return false;end if;
 select * into s from public.verification_submissions where id=split_part(p_path,'/',2)::uuid;
 if s.id is null then return false;end if;
 if s.tier<>'tier_3_property' then return true;end if;
 return s.user_id=auth.uid() and split_part(p_path,'/',1)=auth.uid()::text and s.status='pending' and s.ready_for_review_at is null and s.identity_revision_id is not null;
exception when invalid_text_representation then return false;end$$;
create policy identity_proof_insert on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'verification-documents' or public.property_identity_document_mutable(name));
create policy identity_proof_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'verification-documents' or public.property_identity_document_mutable(name));
-- No proof replacement/upsert; frozen evidence never changes under an Admin decision.
create policy identity_proof_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'verification-documents');

create function public.get_admin_property_identity_review(p_submission_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare result jsonb;begin
 if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin required' using errcode='42501';end if;
 select jsonb_build_object('submission_version',s.identity_review_version,'property_version',p.edit_version,'current_revision_id',c.revision_id,'current',r.identity,'proposed',v.identity,'correction_id',q.id,'correction_version',q.version,'same_asset_required',q.id is not null,'requires_repair',exists(select 1 from rentlease_property_identity.repairs z where z.property_id=p.id)) into result from public.verification_submissions s join public.properties p on p.id=s.property_id left join rentlease_property_identity.current_identity c on c.property_id=p.id left join rentlease_property_identity.revisions r on r.id=c.revision_id left join rentlease_property_identity.revisions v on v.id=s.identity_revision_id left join rentlease_property_identity.corrections q on q.id=s.identity_correction_id where s.id=p_submission_id and s.tier='tier_3_property';return result;
end$$;
create function public.review_property_identity_verification(p_submission_id uuid,p_expected_submission_version uuid,p_expected_property_version uuid,p_expected_correction_version uuid,p_status public.verification_status,p_same_asset_confirmed boolean,p_note text default null,p_reason text default null) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare s public.verification_submissions%rowtype;q rentlease_property_identity.corrections%rowtype;c rentlease_property_identity.current_identity%rowtype;p public.properties%rowtype;
begin
 if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin required' using errcode='42501';end if;
 select * into s from public.verification_submissions where id=p_submission_id and tier='tier_3_property';
 if s.id is null then raise exception 'Property submission required' using errcode='22023';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ COMMITTED required' using errcode='25001';end if;
 perform pg_advisory_xact_lock(hashtextextended(s.property_id::text,0));
 select * into s from public.verification_submissions where id=p_submission_id for update;
 select * into p from public.properties where id=s.property_id;
 perform rentlease_property_identity.require_ready(p.id);
 select * into c from rentlease_property_identity.current_identity where property_id=p.id;
 select * into q from rentlease_property_identity.corrections where id=s.identity_correction_id for update;
 if s.identity_review_version is distinct from p_expected_submission_version or p.edit_version is distinct from p_expected_property_version or (q.id is not null and q.version is distinct from p_expected_correction_version) then raise exception 'Review context changed. Reload before deciding' using errcode='40001';end if;
 if not p.is_active or p.landlord_id is distinct from s.user_id or not public.is_tier1_verified(s.user_id) or not public.has_app_role('landlord',s.user_id) or s.identity_revision_id is null or s.ready_for_review_at is null then raise exception 'Eligible owner and finalized evidence required' using errcode='42501';end if;
 if q.id is not null and (q.status<>'submitted' or q.submission_id<>s.id or q.base_revision_id<>c.revision_id or q.candidate_revision_id<>s.identity_revision_id) then raise exception 'Correction changed' using errcode='40001';end if;
 if q.id is null and s.identity_revision_id<>c.revision_id then raise exception 'Identity changed' using errcode='40001';end if;
 if not((s.status='pending' and p_status='under_review') or (s.status='under_review' and p_status in('approved','rejected'))) then raise exception 'Invalid review transition' using errcode='22023';end if;
 if p_status='rejected' and nullif(btrim(p_reason),'') is null then raise exception 'Rejection reason required' using errcode='22023';end if;
 if p_status='approved' then
  if not exists(select 1 from public.verification_documents d join storage.objects o on o.bucket_id='verification-documents' and o.name=d.storage_path where d.submission_id=s.id and d.document_type in('land_title','tax_declaration','hoa_document','authorization_to_lease')) then raise exception 'Qualifying private proof required' using errcode='22023';end if;
  if q.id is not null then if p_same_asset_confirmed is not true then raise exception 'Confirm evidence corrects the same physical property' using errcode='22023';end if;perform rentlease_property_identity.promote(p.id,s.identity_revision_id);end if;
 end if;
 update public.verification_submissions set status=p_status,reviewed_by=auth.uid(),review_note=nullif(btrim(p_note),''),rejection_reason=case when p_status='rejected' then btrim(p_reason) else null end,reviewed_at=case when p_status in('approved','rejected') then now() else null end,identity_review_version=gen_random_uuid() where id=s.id;
 if p_status='approved' then update rentlease_property_identity.current_identity set approved_submission_id=s.id where property_id=p.id and revision_id=s.identity_revision_id;end if;
 if q.id is not null then update rentlease_property_identity.corrections set status=case when p_status='approved' then 'applied' when p_status='rejected' then 'rejected' else status end,version=gen_random_uuid() where id=q.id;end if;
end$$;
-- Preserve original Tier 2 operation, prevent legacy Tier 3 review bypass.
alter function public.review_verification_submission(uuid,public.verification_status,text,text) set schema rentlease_property_identity;
create function public.review_verification_submission(requested_submission_id uuid,requested_status public.verification_status,requested_review_note text default null,requested_rejection_reason text default null) returns public.verification_submissions language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from public.verification_submissions where id=requested_submission_id and tier='tier_3_property') then raise exception 'Use versioned property identity review' using errcode='22023';end if;
 return rentlease_property_identity.review_verification_submission(requested_submission_id,requested_status,requested_review_note,requested_rejection_reason);
end$$;
-- Queue projection stays structurally unchanged; exclude unfinished Tier 3 evidence.
do $$declare source text;begin
 source:=pg_get_functiondef('public.get_admin_verification_queue()'::regprocedure);
 if position('where v.status in' in source)=0 then raise exception 'Unexpected queue definition';end if;
 source:=replace(source,'where v.status in','where (v.tier <> ''tier_3_property'' or (v.identity_revision_id is not null and v.ready_for_review_at is not null)) and v.status in');execute source;
end$$;
do $$begin if exists(select 1 from public.listings where status in('active','paused','rented') and not rentlease_property_identity.verified(property_id)) then raise exception 'Published identity cannot be safely bound; resolve before migration';end if;end$$;
-- Keep existing publication signatures/behavior, replacing only historical approval lookup.
do $$declare fn text;source text;patched text;begin
 foreach fn in array array['publish_listing','reactivate_listing'] loop
  source:=pg_get_functiondef(to_regprocedure('public.'||fn||'(uuid)'));
  patched:=regexp_replace(source,'if not exists \(\s*select 1\s*from public.verification_submissions vs\s*where vs.user_id = v_user_id\s*and vs.property_id = v_listing.property_id\s*and vs.tier = ''tier_3_property''::public.verification_tier\s*and vs.status = ''approved''::public.verification_status\s*\) then','if not rentlease_property_identity.verified(v_listing.property_id) then','i');
  if patched is null or patched=source then raise exception 'Unexpected % contract; review migration before proceeding',fn;end if;execute patched;
 end loop;
end$$;
-- Deferred check closes direct canonical-write bypasses without a spoofable session flag.
create function rentlease_property_identity.canonical_consistency() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare target uuid;actual jsonb;expected jsonb;begin
 target:=case when tg_table_name='properties' then (to_jsonb(new)->>'id')::uuid else coalesce(to_jsonb(new)->>'property_id',to_jsonb(old)->>'property_id')::uuid end;
 if not exists(select 1 from public.properties where id=target) then return null;end if;
 actual:=rentlease_property_identity.snapshot(target);
 select r.identity into expected from rentlease_property_identity.current_identity c join rentlease_property_identity.revisions r on r.id=c.revision_id where c.property_id=target;
 if expected is not null and actual is distinct from expected then raise exception 'Identity changes require the revision workflow' using errcode='42501';end if;
 return null;
end$$;
create constraint trigger identity_canonical_property after update on public.properties deferrable initially deferred for each row execute function rentlease_property_identity.canonical_consistency();
create constraint trigger identity_canonical_private after insert or update or delete on public.property_private_locations deferrable initially deferred for each row execute function rentlease_property_identity.canonical_consistency();
-- Serialize file deletion with evidence finalization, not just an earlier RLS snapshot.
create function rentlease_property_identity.guard_proof_delete() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare s public.verification_submissions%rowtype;begin
 if old.bucket_id<>'verification-documents' or split_part(old.name,'/',2)!~'^[0-9a-fA-F-]{36}$' then return old;end if;
 select * into s from public.verification_submissions where id=split_part(old.name,'/',2)::uuid;
 if s.tier='tier_3_property' then
  perform pg_advisory_xact_lock(hashtextextended(s.property_id::text,0));
  select * into s from public.verification_submissions where id=s.id;
  if s.ready_for_review_at is not null or s.status<>'pending' then raise exception 'Finalized verification evidence cannot be deleted' using errcode='42501';end if;
 end if;return old;
end$$;
create trigger identity_proof_frozen before delete on storage.objects for each row execute function rentlease_property_identity.guard_proof_delete();
-- Initial property creation captures an unverified baseline once the private row exists.
create function rentlease_property_identity.new_property_identity() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare r uuid;j jsonb;begin
 if exists(select 1 from rentlease_property_identity.current_identity where property_id=new.property_id) or exists(select 1 from rentlease_property_identity.repairs where property_id=new.property_id) then return null;end if;
 j:=rentlease_property_identity.snapshot(new.property_id);if j is null then raise exception 'Complete initial property identity required' using errcode='22023';end if;
 insert into rentlease_property_identity.revisions(property_id,owner_id,identity,provenance) select id,landlord_id,j,'created_unverified' from public.properties where id=new.property_id returning id into r;
 insert into rentlease_property_identity.current_identity values(new.property_id,r,null);return null;
end$$;
create trigger identity_initial_snapshot after insert on public.property_private_locations for each row execute function rentlease_property_identity.new_property_identity();
-- Accepted identity evidence for future open-tenancy confirmations; never fabricate history.
alter table public.tenancies add column accepted_identity_revision_id uuid references rentlease_property_identity.revisions(id);
create function rentlease_property_identity.guard_tenancy_identity() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare r uuid;begin
 perform pg_advisory_xact_lock(hashtextextended(new.property_id::text,0));
 if new.status in('proposed','pending_confirmation','active') and (tg_op='INSERT' or new.status is distinct from old.status or new.tenant_confirmed_at is distinct from old.tenant_confirmed_at or new.landlord_confirmed_at is distinct from old.landlord_confirmed_at or new.accepted_identity_revision_id is distinct from old.accepted_identity_revision_id) then
  select revision_id into r from rentlease_property_identity.current_identity where property_id=new.property_id;
  if r is null or new.accepted_identity_revision_id is distinct from r then raise exception 'Both parties must review the current property identity before confirming' using errcode='40001';end if;
 end if;return new;
end$$;
create trigger aab_tenancy_identity_gate before insert or update on public.tenancies for each row execute function rentlease_property_identity.guard_tenancy_identity();
-- Owner-only batch status, without private identity payloads or per-listing reads.
create function public.get_owned_property_identity_statuses(p_property_ids uuid[]) returns table(property_id uuid,verified boolean,requires_repair boolean,current_submission_id uuid) language plpgsql stable security definer set search_path=pg_catalog as $$begin
 if auth.uid() is null or public.is_tier1_verified(auth.uid()) is not true or public.has_app_role('landlord',auth.uid()) is not true then raise exception 'Eligible owner required' using errcode='42501';end if;
 if p_property_ids is null or cardinality(p_property_ids)>1000 or exists(select 1 from unnest(p_property_ids) x where not exists(select 1 from public.properties p where p.id=x and p.landlord_id=auth.uid())) then raise exception 'Owned property IDs required' using errcode='42501';end if;
 return query select p.id,rentlease_property_identity.verified(p.id),(x.property_id is not null or c.property_id is null),case when rentlease_property_identity.verified(p.id) then c.approved_submission_id else null end from public.properties p left join rentlease_property_identity.current_identity c on c.property_id=p.id left join rentlease_property_identity.repairs x on x.property_id=p.id where p.id=any(p_property_ids) and p.landlord_id=auth.uid();
end$$;
-- All private helpers are inaccessible directly; only named public contracts are callable.
revoke all on all functions in schema rentlease_property_identity from public,anon,authenticated;
do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in('get_owned_property_identity_statuses','get_property_identity_context','get_property_identity_operation','manage_property_identity','get_property_identity_submission','begin_property_identity_verification','attach_property_identity_document','property_identity_document_mutable','get_admin_property_identity_review','review_property_identity_verification','review_verification_submission') loop execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end$$;
commit;
