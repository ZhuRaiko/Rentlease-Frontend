import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {messagingService} from '../../messaging-viewing/services/messagingDependencies';
import {createRentLedgerService} from '../services/rentLedgerService';
import {createRentLedgerWorkflow} from './rentLedgerWorkflow';
const service=createRentLedgerService(getSupabaseClient);
/** The ledger for one tenancy. `conversationId` is the tenancy's existing conversation (null when it has none); the chat message after "Not received" goes only there. */
export function useRentLedgerViewModel(actor:string|undefined,tenancyId:string,conversationId:string|null,counterpart:string){
 // The name can arrive after the screen opens; it is read when a message is built, so it must not recreate the workflow (and reload the ledger).
 const name=useRef(counterpart);name.current=counterpart;
 const workflow=useMemo(()=>createRentLedgerWorkflow(service,{send:async(id,messageId,body)=>{if(!actor)throw new Error('Signed out');await messagingService.send(actor,id,messageId,body);}},{actor,tenancyId,conversationId,get counterpart(){return name.current;}},randomUUID),[actor,tenancyId,conversationId]);
 const state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);
 useEffect(()=>{workflow.activate();void workflow.load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void workflow.load();});return()=>{sub.remove();workflow.dispose();};},[workflow]);
 return {...state,workflow};
}
export type RentLedgerViewModel=ReturnType<typeof useRentLedgerViewModel>;
