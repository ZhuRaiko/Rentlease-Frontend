import type {TenancyCardContext} from '../models/TenancyDetails';
import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {reservationService} from '../../messaging-viewing/services/messagingDependencies';
import {readTenancyWorkspace} from '../services/tenancyWorkspaceService';
import {createTenancyActivityService,emptyActivity,type TenancyActivity} from '../services/tenancyActivityService';
import {type RentalRelationship} from '../models/TenancyWorkspace';
import {releaseTarget,type Role} from '../models/CancelledRentals';
import {workspaceScreen} from '../models/TenancyWorkspaceScreen';
import {dateRange} from '../models/TenancyPresentation';
import {createTenancyReleaseWorkflow,type ReleaseRequest} from './tenancyReleaseWorkflow';
import {publicIdentityLabel} from '../../../shared/models/PublicIdentity';
import type {RentalReservation} from '../../messaging-viewing/models/RentalReservation';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
const activityService=createTenancyActivityService(getSupabaseClient);
type State={owner:string|undefined;tenancies:RentalRelationship[];reservations:RentalReservation[];contexts:Record<string,TenancyCardContext>;contextWarning:string|null;links:{reservation_id:string;tenancy_id:string}[]|null;busy:boolean;error:string|null;offset:number};
const blank=(owner:string|undefined,busy:boolean,error:string|null=null):State=>({owner,tenancies:[],reservations:[],contexts:{},contextWarning:null,links:null,busy,error,offset:0});
/** `onStartRequest` opens the reservation request for a conversation once the held reservation was released. */
export function useTenancyWorkspaceViewModel(actor:string|undefined,onStartRequest?:(conversationId:string)=>void){
 const [state,setState]=useState<State>(blank(undefined,false)),[activity,setActivity]=useState<{owner:string|undefined;value:TenancyActivity}>({owner:undefined,value:emptyActivity()}),[tick,setTick]=useState(Date.now());
 const version=useRef(0),controller=useRef<AbortController|null>(null);
 const refresh=useCallback(async()=>{controller.current?.abort();const c=new AbortController();controller.current=c;const g=++version.current;if(!actor)return;setState(blank(actor,true));
 try{const data=await readTenancyWorkspace(actor,c.signal);if(g!==version.current||c.signal.aborted)return;setState({owner:actor,...data,busy:false,error:null,offset:data.reservations[0]?Date.parse(data.reservations[0].serverNow)-Date.now():0});
  // The list is on screen now; open maintenance, end requests and review state follow without holding it. A failed read just leaves that item out.
  void activityService.read(actor,data.tenancies,c.signal).then(value=>{if(g===version.current&&!c.signal.aborted)setActivity({owner:actor,value});},()=>{});}
 catch(e){if(g===version.current&&!c.signal.aborted)setState(blank(actor,false,e instanceof Error?e.message:'Could not load rentals.'));}},[actor]);
 useEffect(()=>{void refresh();const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>{version.current++;controller.current?.abort();sub.remove();};},[refresh]);
 const safe=state.owner===actor?state:blank(actor,true);
 const now=Math.max(tick,Date.now())+safe.offset;
 useEffect(()=>{const deadlines=safe.reservations.filter(r=>r.status==='approved').map(r=>Date.parse(r.expiresAt)).filter(d=>d>now);if(!deadlines.length)return;const timer=setTimeout(()=>setTick(Date.now()),Math.min(2147483647,Math.min(...deadlines)-now+50));return()=>clearTimeout(timer);},[safe.reservations,now]);
 const identities=usePublicIdentitiesViewModel(actor,[...safe.tenancies.flatMap(t=>[t.tenant_id,t.landlord_id]),...safe.reservations.flatMap(r=>[r.tenantId,r.landlordId])].filter(id=>id!==actor));
 const screen=useMemo(()=>workspaceScreen({actor:actor??'',tenancies:safe.tenancies,reservations:safe.reservations,links:safe.links,contexts:safe.contexts,identities,activity:activity.owner===actor?activity.value:emptyActivity(),now}),[actor,safe.tenancies,safe.reservations,safe.links,safe.contexts,identities,activity,now]);
 // "Start a new request" / "Release it": the existing reservation cancel, then (tenant) the request screen. The workflow never retries by itself.
 const latest=useRef({refresh,onStartRequest});latest.current={refresh,onStartRequest};
 const release=useMemo(()=>createTenancyReleaseWorkflow({cancelReservation:(owner,op)=>reservationService.write(owner,{id:op.id,reservationId:op.reservationId,revision:op.revision,action:'cancel',message:null})},actor,randomUUID,request=>{void latest.current.refresh();if(request.role==='tenant'&&request.conversationId)latest.current.onStartRequest?.(request.conversationId);}),[actor]);
 useEffect(()=>()=>release.dispose(),[release]);
 const releaseState=useSyncExternalStore(release.subscribe,release.getSnapshot,release.getSnapshot);
 /** Tenant: skip the sheet when nothing is held. Landlord: only offered while held. */
 const startRequest=(tenancyId:string)=>{const t=safe.tenancies.find(x=>x.id===tenancyId);if(!t||!actor)return;const target=releaseTarget(t,safe.links,safe.reservations,now);
  if(!target.needsRelease||!target.reservation){if(target.conversationId)onStartRequest?.(target.conversationId);return;}
  const role:Role=actor===t.tenant_id?'tenant':'landlord',other=publicIdentityLabel(identities[role==='tenant'?t.landlord_id:t.tenant_id],role==='tenant'?'owner':'renter');
  release.ask({tenancyId,role,reservationId:target.reservation.id,revision:target.reservation.revision,conversationId:target.conversationId,listing:safe.contexts[t.id]?.title??t.listingTitle??'this rental',range:dateRange(t.start_date,t.expected_end_date),other});};
 return {...safe,screen,identities,refresh,release:{...releaseState,request:releaseState.request as ReleaseRequest|null,confirm:release.confirm,retry:release.retry,keep:release.keep},startRequest};
}
