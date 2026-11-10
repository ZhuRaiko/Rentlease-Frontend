import type {TenancyCardContext} from '../models/TenancyDetails';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {readTenancyWorkspace} from '../services/tenancyWorkspaceService';
import {tenancySections,type RentalRelationship} from '../models/TenancyWorkspace';
import type {RentalReservation} from '../../messaging-viewing/models/RentalReservation';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
export function useTenancyWorkspaceViewModel(actor:string|undefined){
 const [state,setState]=useState<{owner:string|undefined;tenancies:RentalRelationship[];reservations:RentalReservation[];contexts:Record<string,TenancyCardContext>;contextWarning:string|null;links:{reservation_id:string;tenancy_id:string}[]|null;busy:boolean;error:string|null;offset:number}>({owner:undefined,tenancies:[],reservations:[],contexts:{},contextWarning:null,links:null,busy:false,error:null,offset:0}),[tick,setTick]=useState(Date.now());
 const version=useRef(0),controller=useRef<AbortController|null>(null);
 const refresh=useCallback(async()=>{controller.current?.abort();const c=new AbortController();controller.current=c;const g=++version.current;if(!actor)return;setState({owner:actor,tenancies:[],reservations:[],contexts:{},contextWarning:null,links:null,busy:true,error:null,offset:0});
 try{const data=await readTenancyWorkspace(actor,c.signal);if(g===version.current&&!c.signal.aborted)setState({owner:actor,...data,busy:false,error:null,offset:data.reservations[0]?Date.parse(data.reservations[0].serverNow)-Date.now():0});}catch(e){if(g===version.current&&!c.signal.aborted)setState({owner:actor,tenancies:[],reservations:[],contexts:{},contextWarning:null,links:null,busy:false,error:e instanceof Error?e.message:'Could not load rentals.',offset:0});}},[actor]);
 useEffect(()=>{void refresh();const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>{version.current++;controller.current?.abort();sub.remove();};},[refresh]);
 const safe=state.owner===actor?state:{owner:actor,tenancies:[],reservations:[],contexts:{},contextWarning:null,links:null,busy:true,error:null,offset:0};
 const now=Math.max(tick,Date.now())+safe.offset;
 useEffect(()=>{const deadlines=safe.reservations.filter(r=>r.status==='approved').map(r=>Date.parse(r.expiresAt)).filter(d=>d>now);if(!deadlines.length)return;const timer=setTimeout(()=>setTick(Date.now()),Math.min(2147483647,Math.min(...deadlines)-now+50));return()=>clearTimeout(timer);},[safe.reservations,now]);
 const sections=tenancySections(actor??'',safe.tenancies,safe.reservations,now,safe.links);
 const identities=usePublicIdentitiesViewModel(actor,[...safe.tenancies.flatMap(t=>[t.tenant_id,t.landlord_id]),...safe.reservations.flatMap(r=>[r.tenantId,r.landlordId])].filter(id=>id!==actor));
 return {...safe,...sections,identities,refresh};
}
