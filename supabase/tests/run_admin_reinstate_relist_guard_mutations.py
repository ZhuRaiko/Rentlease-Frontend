"""Mutation check for 20261114120000_admin_reinstate_relist_guard.sql: each deliberately broken copy of the migration must make
run_admin_reinstate_relist_guard.py fail, and the check that failed is reported. A mutant that still passes is NOT CAUGHT.

Each mutant changes behavior only: the pinned-md5 comparisons of the patched sources are switched off for the mutant (otherwise every
edit would be "caught" by the pin and prove nothing). The control mutant applies only that switch-off and must PASS.
Run: python supabase/tests/run_admin_reinstate_relist_guard_mutations.py [--jobs 4] [--only <name>]   (needs Docker; each run takes minutes)
"""
import re,subprocess,sys,tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];MIG=ROOT/'supabase/migrations/20261114120000_admin_reinstate_relist_guard.sql';HARNESS=ROOT/'supabase/tests/run_admin_reinstate_relist_guard.py'
# (name, exact text in the migration, replacement). Each text must occur exactly `count` times (default 1).
M=[
 ('control: md5 pins off, no behavior change',None,None),
 ('save: guard never fires',"r.property_id = p_property_id and r.status = 'removed'::public.listing_status","r.property_id = p_property_id and r.status = 'removed'::public.listing_status and false"),
 ('save: guard placed BEFORE the property lock (lock ordering dropped)',"$q$  select l.*$q$","$q$  perform pg_catalog.pg_advisory_xact_lock($q$",2),
 ('save: wrong errcode (23505)',"raise exception 'Property has a removed listing' using errcode = '22023'; end if;","raise exception 'Property has a removed listing' using errcode = '23505'; end if;"),
 ('save: wrong message',"raise exception 'Property has a removed listing' using errcode = '22023'; end if;","raise exception 'Property is unavailable' using errcode = '22023'; end if;"),
 ('publish: guard never fires',"r.id <> v_listing.id and r.status = 'removed'::public.listing_status","r.id <> v_listing.id and r.status = 'removed'::public.listing_status and false"),
 ('publish: checks archived instead of removed',"r.id <> v_listing.id and r.status = 'removed'::public.listing_status","r.id <> v_listing.id and r.status = 'archived'::public.listing_status"),
 ('reinstate: resulting status active instead of paused',"set status='paused',paused_at=now()","set status='active',paused_at=now()"),
 ('reinstate: a report id is accepted',"if p_report_id is not null and p_action='reinstate_listing' then","if p_report_id is not null and p_action='reinstate_listing' and false then"),
 ('reinstate: conflicted-admin check removed',"(rr.reported_listing_id=l.id or rr.reported_user_id=l.landlord_id) and rentlease_reporting.conflicted(rr.id,a)","(rr.reported_listing_id=l.id or rr.reported_user_id=l.landlord_id) and rentlease_reporting.conflicted(rr.id,a) and false"),
 ('reinstate: conflict check reverted to listing-only (owner reports ignored)',"(rr.reported_listing_id=l.id or rr.reported_user_id=l.landlord_id) and rentlease_reporting.conflicted(rr.id,a)","rr.reported_listing_id=l.id and rentlease_reporting.conflicted(rr.id,a)"),
 ('reinstate: other-live-listing check removed',"o.property_id=l.property_id and o.id<>l.id and o.status in('active','paused','rented')","o.property_id=l.property_id and o.id<>l.id and false and o.status in('active','paused','rented')"),
 ('reinstate: paused sibling no longer counts as live',"o.status in('active','paused','rented')","o.status in('active','rented')"),
 ('reinstate: audit insert skipped',"insert into public.admin_audit_logs(admin_id,action,entity_type,entity_id,metadata) values(a,'reinstate_listing'","perform 1; -- "),
 ('reinstate: audit metadata drops previous_status',"'reason',reason,'previous_status','removed','status','paused'","'reason',reason,'status','paused'"),
 ('reinstate: removed_at not cleared',"paused_at=now(),removed_at=null,removal_reason=null where","paused_at=now(),removal_reason=null where"),
 ('reinstate: removal_reason not cleared',"paused_at=now(),removed_at=null,removal_reason=null where","paused_at=now(),removed_at=null where"),
 ('reinstate: paused_at not set',"set status='paused',paused_at=now(),removed_at=null","set status='paused',removed_at=null"),
 ('reinstate: status check dropped (non-removed listing accepted)',"if l.status<>'removed' then raise exception 'Listing is not removed'","if false then raise exception 'Listing is not removed'"),
 ('reinstate: branch never taken (falls into moderation_actions)',"$q$if p_action='reinstate_listing' then$q$||chr(10)||$q$  mid:=p_operation_id;","$q$if false then$q$||chr(10)||$q$  mid:=p_operation_id;"),
 ('audit log: verification applicant join removed',"left join public.profiles vp on vp.id=vs.user_id","left join public.profiles vp on false"),
 ('audit log: subject reads the private display_name',"nullif(btrim(vp.public_nickname),'')","nullif(btrim(vp.display_name),'')"),
 ('audit log: report subject never uses the listing',"when 'report' then case when sr.reported_listing_id is not null","when 'report' then case when false"),
 ('audit log: reinstate rows no longer filtered for a conflicted Admin',"and not (l.action='reinstate_listing' and","and not (false and l.action='reinstate_listing' and"),
 ('audit log: reinstate filter ignores reports about the owner',"(rx.reported_listing_id=rl0.id or rx.reported_user_id=rl0.landlord_id)","(rx.reported_listing_id=rl0.id)"),
 ('audit log: actorId always null',"'entityId',g.entity_id,'actorId',g.admin_id,","'entityId',g.entity_id,'actorId',null::uuid,"),
 ('audit log: actions filter lists a wrong action instead of reinstate_listing',"'remove_listing','reinstate_listing','restrict_account','warning') end","'remove_listing','pause_listing2','restrict_account','warning') end"),
 ('removed list: owner name reads the private display_name',"nullif(btrim(o.public_nickname),'')","nullif(btrim(o.display_name),'')"),
 ('removed list: limit raised to 1000',"order by removed_at desc nulls last,id limit 100","order by removed_at desc nulls last,id limit 1000"),
 ('removed list: conflict filter removed',"rr.reported_user_id=lr.landlord_id) and rentlease_reporting.conflicted(rr.id,a)","rr.reported_user_id=lr.landlord_id) and rentlease_reporting.conflicted(rr.id,a) and false"),
 ('removed list: reports about the owner ignored',"(rr.reported_listing_id=lr.id or rr.reported_user_id=lr.landlord_id)","(rr.reported_listing_id=lr.id)"),
 ('removed list: count not filtered',"'count',(select count(*) from f),","'count',(select count(*) from public.listings x0 where x0.status='removed'),"),
 ('removed list: reinstatable ignores another live listing',"and not exists(select 1 from public.listings ol where ol.property_id=g.property_id","and not exists(select 1 from public.listings ol where false and ol.property_id=g.property_id"),
 ('removed list: reinstatable ignores an Admin owner',"public.is_admin(g.landlord_id) is not true and not exists","true and not exists"),
 ('removed list: any authenticated user may call it',"if a is null or public.is_active_admin(a) is not true then raise exception 'Access unavailable' using errcode='42501';end if;","if a is null then raise exception 'Access unavailable' using errcode='42501';end if;"),
 ('removed list: executable by anon',"grant execute on function public.get_admin_removed_listings() to authenticated;","grant execute on function public.get_admin_removed_listings() to authenticated,anon;"),
]
def mutant_text(base,old,new,count):
 if old is not None:
  assert base.count(old)==count,(base.count(old),old[:80]);base=base.replace(old,new)
 base=base.replace('is distinct from spec.final_md5','is null')
 base,n=re.subn(r'^ if \(select md5\(prosrc\) from pg_proc where oid=patched\[1\]\).*$','',base,flags=re.M);assert n==1
 return base
def run_one(item,tmp):
 i,(name,old,new,*rest)=item;count=rest[0] if rest else 1
 f=Path(tmp)/f'mutant_{i}.sql';f.write_text(mutant_text(MIG.read_text(encoding='utf-8'),old,new,count),encoding='utf-8',newline='\n')
 p=subprocess.run([sys.executable,str(HARNESS),'--migration',str(f)],capture_output=True,text=True,encoding='utf-8',errors='replace')
 out=p.stdout+p.stderr;passes=out.count('PASS ')
 if p.returncode==0:return name,'NOT CAUGHT' if old is not None else 'passes as expected',f'{passes} checks passed'
 m=re.findall(r'(?:AssertionError|Exception): (.*)',out);return name,'caught',(m[-1] if m else out.strip().splitlines()[-1])[:230]+f' (after {passes} passing checks)'
if __name__=='__main__':
 jobs=int(sys.argv[sys.argv.index('--jobs')+1]) if '--jobs' in sys.argv else 4;only=sys.argv[sys.argv.index('--only')+1] if '--only' in sys.argv else None
 items=[x for x in enumerate(M) if only is None or only in x[1][0]]
 with tempfile.TemporaryDirectory() as tmp,ThreadPoolExecutor(jobs) as ex:
  results=list(ex.map(lambda it:run_one(it,tmp),items))
 for name,verdict,detail in results:print(f'{verdict:20} | {name} | {detail}',flush=True)
 caught=sum(1 for _,v,_ in results if v=='caught');bad=[n for n,v,_ in results if v=='NOT CAUGHT'];print(f'{caught} mutants caught, {len(bad)} NOT CAUGHT'+(': '+'; '.join(bad) if bad else ''))
 sys.exit(1 if bad else 0)
