import {scopedReservationService,type RequestScope} from '../services/requestScope';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {reservationService,messageId} from '../services/messagingDependencies';
import {createReservationWorkflow} from './reservationWorkflow';
import type {Conversation} from '../models/PersistentMessaging';
export function useRentalReservationsViewModel(accountId:string|undefined,conversation:Conversation|null,scope?:RequestScope){
 const workflow=useMemo(()=>createReservationWorkflow(scope?scopedReservationService(reservationService,scope,accountId):reservationService,messageId),[accountId,JSON.stringify(scope)]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot),[localNow,setLocalNow]=useState(Date.now());
 useEffect(()=>{workflow.activate();void workflow.open(conversation);const sub=AppState.addEventListener('change',status=>{if(status==='active'){setLocalNow(Date.now());void workflow.load();}});return()=>{sub.remove();workflow.dispose();};},[workflow,conversation?.id]);
 // One deadline wake-up, not a polling loop or a dependency on Realtime delivery.
 useEffect(()=>{const serverNow=Date.now()+state.clockOffset,deadlines=state.rows.filter(r=>r.status==='pending'||r.status==='approved').map(r=>Date.parse(r.expiresAt)).filter(at=>at>serverNow);if(!deadlines.length)return;
  const timer=setTimeout(()=>{setLocalNow(Date.now());void workflow.load();},Math.min(2147483647,Math.min(...deadlines)-serverNow+50));return()=>clearTimeout(timer);
 },[workflow,state.rows,state.clockOffset,localNow]);
 const publicIdentities=usePublicIdentitiesViewModel(accountId,state.rows.map(r=>r.tenantId===accountId?r.landlordId:r.tenantId));
 return{...state,publicIdentities,workflow,now:Math.max(localNow,Date.now())+state.clockOffset};
}
export type RentalReservationsViewModel=ReturnType<typeof useRentalReservationsViewModel>;
