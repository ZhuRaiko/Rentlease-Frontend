import {useEffect,useRef,useState} from 'react';
import {createRentalLocationApprovalService,type RentalLocationApproval} from '../services/rentalLocationApprovalService';
import {getSupabaseClient} from '../services/supabase/client';
const service=createRentalLocationApprovalService(getSupabaseClient);
export function useRentalLocationApproval(actor:string|undefined,propertyId:string|undefined,savedVersion:unknown){
 const [state,setState]=useState<RentalLocationApproval|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[refresh,setRefresh]=useState(0),[ready,setReady]=useState(false);
 const generation=useRef(0),transport=useRef<AbortController|null>(null),lock=useRef(false);
 const key=JSON.stringify([actor,propertyId,savedVersion]);const current=useRef(key);current.current=key;
 const [owner,setOwner]=useState('');
 useEffect(()=>{const g=++generation.current,c=new AbortController();transport.current?.abort();transport.current=c;lock.current=false;setOwner(key);setState(null);setError(null);setReady(false);setBusy(false);
 if(actor&&propertyId){setBusy(true);void service.load(actor,propertyId,c.signal).then(value=>{if(g===generation.current&&current.current===key){setState(value);setReady(true);}}).catch(()=>{if(g===generation.current&&current.current===key&&!c.signal.aborted)setError('Location approval could not load. Reload its status.');}).finally(()=>{if(g===generation.current&&current.current===key)setBusy(false);});}
 return()=>{generation.current++;c.abort();};},[key,refresh]);
 const save=async(approve:boolean)=>{if(!actor||!propertyId||!state||busy||lock.current||owner!==key||!ready)return;lock.current=true;setBusy(true);setError(null);const g=generation.current,c=transport.current!;
 try{const next=await service.save(actor,propertyId,state,approve,c.signal);if(g===generation.current&&current.current===key)setState(next);}
 catch{if(g===generation.current&&current.current===key){setReady(false);setError('Approval was not confirmed. Reload its status before trying again.');}}
 finally{if(g===generation.current&&current.current===key){lock.current=false;setBusy(false);}}};
 return {state:owner===key?state:null,busy:owner===key?busy:false,error:owner===key?error:null,ready:owner===key&&ready,save,reload:()=>setRefresh(v=>v+1)};
}
