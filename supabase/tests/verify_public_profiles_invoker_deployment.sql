-- Read-only hosted acceptance using existing accounts only; outputs aggregate counts.
begin isolation level repeatable read read only;
do $verify$
declare actors jsonb; links jsonb; a jsonb; t jsonb; entry jsonb; result jsonb;
 actor uuid; target uuid; expected boolean; checks integer:=0; pairs integer:=0; denied integer:=0; inboxes integer:=0; active boolean; eligible boolean; original_role text:=current_user; wanted integer;
begin
 select jsonb_agg(jsonb_build_object('id',p.id,'active',p.account_status='active','eligible',public.is_tier1_verified(p.id),
 'nickname',case when p.public_nickname_confirmed_at is not null then p.public_nickname end,
 'avatar',case when p.avatar_public_confirmed_at is not null and p.avatar_path ~ ('^'||p.id::text||'/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png)$') then p.avatar_path end,
 'listed',exists(select 1 from public.listings l join public.properties pr on pr.id=l.property_id where l.landlord_id=p.id and pr.landlord_id=p.id and pr.is_active and l.status='active' and l.published_at is not null and (l.available_from is null or l.available_from<=(now() at time zone 'Asia/Manila')::date)))) into actors from (select * from public.profiles order by id limit 50)p;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'tenant',tenant_id,'owner',landlord_id)),'[]') into links from public.conversations;
 if actors is null then raise exception 'No existing account coverage';end if;
 for a in select value from jsonb_array_elements(actors) loop
  actor:=(a->>'id')::uuid;active:=(a->>'active')::boolean;eligible:=(a->>'eligible')::boolean;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.public_profiles)<>(case when active then 1 else 0 end) then raise exception 'Direct view not self-only';end if;checks:=checks+1;
  if exists(select 1 from public.public_profiles where id<>actor) then raise exception 'Foreign direct view row';end if;checks:=checks+1;
  if exists(select 1 from public.profiles where id<>actor) then raise exception 'Foreign private profile row';end if;checks:=checks+1;
  for t in select value from jsonb_array_elements(actors) loop
   target:=(t->>'id')::uuid;
   expected:=active and (t->>'active')::boolean and (actor=target or eligible and ((t->>'listed')::boolean or exists(select 1 from jsonb_array_elements(links)c where actor in((c->>'tenant')::uuid,(c->>'owner')::uuid) and target in((c->>'tenant')::uuid,(c->>'owner')::uuid))));
   if active then
    result:=public.get_public_identities(array[target]);
    if jsonb_array_length(result)<>(case when expected then 1 else 0 end) then raise exception 'Public identity relationship mismatch';end if;
    if expected then
     if (result->0->>'id')::uuid<>target or result->0->>'nickname' is distinct from t->>'nickname' or result->0->>'avatar_path' is distinct from t->>'avatar' or (select count(*) from jsonb_object_keys(result->0))<>3 then raise exception 'Public identity projection mismatch';end if;
     pairs:=pairs+1;
    else denied:=denied+1;end if;
   else
    begin perform public.get_public_identities(array[target]);raise exception 'Inactive identity accepted';exception when insufficient_privilege then denied:=denied+1;end;
   end if;checks:=checks+1;
  end loop;
  if eligible then
   result:=public.get_messaging_inbox(0,50,null);
   select least(count(*),50)::integer into wanted from jsonb_array_elements(links)c where actor in((c->>'tenant')::uuid,(c->>'owner')::uuid);
   if jsonb_array_length(result)<>wanted then raise exception 'Inbox participant count mismatch';end if;checks:=checks+1;inboxes:=inboxes+1;
   for entry in select value from jsonb_array_elements(result) loop
    if actor not in((entry->>'tenant_id')::uuid,(entry->>'landlord_id')::uuid) then raise exception 'Foreign inbox conversation';end if;
    select value into t from jsonb_array_elements(actors) where value->>'id'=entry->>'participant_id';
    if t is null then raise exception 'Counterpart coverage unavailable';end if;
    if entry->>'participant_name' is distinct from (case when (t->>'active')::boolean then t->>'nickname' else null end) then raise exception 'Inbox public name mismatch';end if;checks:=checks+1;
   end loop;
  else
   begin perform public.get_messaging_inbox(0,50,null);raise exception 'Ineligible inbox accepted';exception when insufficient_privilege then checks:=checks+1;end;
  end if;
  execute 'set local role '||quote_ident(original_role);
 end loop;
 execute 'set local role anon';
 begin perform count(*) from public.public_profiles;raise exception 'Anonymous view accepted';exception when insufficient_privilege then checks:=checks+1;end;
 begin perform public.get_public_identities(array[actor]);raise exception 'Anonymous RPC accepted';exception when insufficient_privilege then checks:=checks+1;end;
 execute 'set local role '||quote_ident(original_role);
 perform set_config('rentlease.invoker_acceptance',jsonb_build_object('checks',checks,'failed',0,'accounts',jsonb_array_length(actors),'allowed_pairs',pairs,'denied_pairs',denied,'eligible_inboxes',inboxes)::text,true);
end $verify$;
select current_setting('rentlease.invoker_acceptance')::jsonb as acceptance;
rollback;
