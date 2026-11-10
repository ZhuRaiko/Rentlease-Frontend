import {TenancyReadError,type TenancyDetails} from '../models/TenancyDetails';
import type {TenancyDetailsService} from '../services/tenancyDetailsService';
export type TenancyDetailsPanel='details'|'property'|'reservation'|'care'|'lifecycle';
const initial=()=>({phase:'idle' as 'idle'|'loading'|'success'|'error',data:null as TenancyDetails|null,error:null as string|null,panel:'details' as TenancyDetailsPanel});
export function createTenancyDetailsWorkflow(service:Pick<TenancyDetailsService,'read'>,actor:string|undefined,id:string,sourceId:string|null){
 let state=initial(),disposed=false,generation=0,transport:AbortController|null=null;
 const listeners=new Set<()=>void>(),update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
 const load=async()=>{if(disposed||!actor||state.phase==='loading')return;const c=transport=new AbortController(),g=++generation,timer=setTimeout(()=>c.abort(),20000);update({phase:'loading',data:null,error:null});
 try{const data=await service.read(actor,id,sourceId,c.signal);if(disposed||g!==generation)return;const panel=state.panel==='property'&&!data.context.property||state.panel==='reservation'&&!data.reservation?'details':state.panel;update({phase:'success',data,panel});}
 catch(e){if(!disposed&&g===generation)update({phase:'error',data:null,error:e instanceof TenancyReadError?e.message:'Tenancy details could not load. Please retry.'});}
 finally{clearTimeout(timer);}};
 return {subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>state,activate(){disposed=false;},dispose(){disposed=true;generation++;transport?.abort();state=initial();},load,
 open(panel:TenancyDetailsPanel){if(state.phase!=='success'||!state.data)return;if(panel==='property'&&!state.data.context.property||panel==='reservation'&&!state.data.reservation)return;update({panel});},back(){if(state.panel==='details')return false;update({panel:'details'});return true;}};
}
