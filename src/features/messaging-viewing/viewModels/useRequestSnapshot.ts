import {requestSummary,requestActivity} from '../models/RequestSummary';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {viewingService,reservationService} from '../services/messagingDependencies';
import {completeRequestPages} from '../services/requestScope';
import type {PropertyViewing} from '../models/PropertyViewing';
import type {RentalReservation} from '../models/RentalReservation';
export function useRequestSnapshot(accountId:string|undefined){
 const [state,setState]=useState<{owner:string|undefined;viewings:PropertyViewing[];reservations:RentalReservation[];busy:boolean;error:string|null;clockOffset:number}>({owner:undefined,viewings:[],reservations:[],busy:false,error:null,clockOffset:0});
 const [tick,setTick]=useState(Date.now());
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 const refresh=useCallback(async()=>{controller.current?.abort();const c=new AbortController();controller.current=c;const g=++generation.current;if(!accountId)return;
 setState({owner:accountId,viewings:[],reservations:[],busy:true,error:null,clockOffset:0});
 try{const [viewings,reservations]=await Promise.all([completeRequestPages(o=>viewingService.list(accountId,null,o,c.signal),c.signal),completeRequestPages(o=>reservationService.list(accountId,null,o,c.signal),c.signal)]);
 if(g===generation.current&&!c.signal.aborted)setState({owner:accountId,viewings,reservations,busy:false,error:null,clockOffset:reservations[0]?Date.parse(reservations[0].serverNow)-Date.now():0});
 }catch{c.abort();if(g===generation.current)setState({owner:accountId,viewings:[],reservations:[],busy:false,error:'Request counts unavailable. Open Manage Requests to retry.',clockOffset:0});}
 },[accountId]);
 useEffect(()=>{void refresh();const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>{generation.current++;controller.current?.abort();sub.remove();};},[refresh]);
 useEffect(()=>{const now=Date.now()+state.clockOffset,deadlines=state.reservations.filter(r=>r.status==='pending'||r.status==='approved').map(r=>Date.parse(r.expiresAt)).filter(t=>t>now);if(!deadlines.length)return;const timer=setTimeout(()=>setTick(Date.now()),Math.min(2147483647,Math.min(...deadlines)-now+50));return()=>clearTimeout(timer);},[state.reservations,state.clockOffset,tick]);
 const summary=(property:Parameters<typeof requestSummary>[0])=>requestSummary(property,accountId??'',state.owner===accountId?state.viewings:[],state.owner===accountId?state.reservations:[],Math.max(tick,Date.now())+state.clockOffset);
 const activity=(property:Parameters<typeof requestSummary>[0])=>requestActivity(property,accountId??'',state.owner===accountId?state.viewings:[],state.owner===accountId?state.reservations:[],Math.max(tick,Date.now())+state.clockOffset);
 return {summary,activity,now:Math.max(tick,Date.now())+state.clockOffset,...(state.owner===accountId?state:{owner:accountId,viewings:[],reservations:[],busy:true,error:null,clockOffset:0}),refresh};
}
