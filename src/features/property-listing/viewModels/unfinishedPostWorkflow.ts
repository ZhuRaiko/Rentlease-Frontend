import {UnfinishedPostError,type UnfinishedPostService,type UnfinishedPostStatus} from '../models/UnfinishedPostDeletion';
export function createUnfinishedPostWorkflow(service:UnfinishedPostService,onCompleted:(id:string)=>void){
 const empty=()=>({propertyId:null as string|null,status:null as UnfinishedPostStatus|null,busy:false,confirming:false,error:null as string|null,pending:[] as UnfinishedPostStatus[]});
 let state=empty(),generation=0,alive=true;const listeners=new Set<()=>void>();
 const set=(patch:Partial<typeof state>)=>{state={...state,...patch};listeners.forEach(fn=>fn());};
 const error=(e:unknown)=>e instanceof UnfinishedPostError?e.message:'Deletion could not be confirmed. Check status before retrying.';
 const current=(g:number)=>alive&&generation===g;
 const remove=async(id:string)=>{if(state.busy)return;const g=generation;set({busy:true,confirming:false,error:null});try{const result=await service.remove(id);if(!current(g))return;set({status:result,propertyId:id});if(result.state==='completed'){set({pending:state.pending.filter(p=>p.propertyId!==id)});onCompleted(id);}else set({pending:[...state.pending.filter(p=>p.propertyId!==id),result],error:'The post was removed. Owned photo cleanup is pending. Retry cleanup to finish deletion.'});}catch(e){if(current(g))set({error:error(e),status:null});}finally{if(current(g))set({busy:false});}};
 return {getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){alive=true;},dispose(){alive=false;generation++;},
  async open(id:string|null){const g=++generation;set({...empty(),pending:state.pending,propertyId:id});if(!id)return;set({busy:true});try{const result=await service.inspect(id);if(current(g))set({status:result});}catch(e){if(current(g))set({error:error(e)});}finally{if(current(g))set({busy:false});}},
  async refreshPending(){const g=generation;try{const pending=await service.pending();if(current(g))set({pending});}catch(e){if(current(g))set({error:error(e)});}},
  requestConfirmation(){if(!state.busy&&state.status?.state==='live'&&state.status.eligible)set({confirming:true,error:null});},
  cancel(){if(!state.busy)set({confirming:false});},
  async confirm(){if(state.confirming&&state.status?.eligible&&state.propertyId)await remove(state.propertyId);},
  async retry(){if(!state.propertyId||state.busy)return;const id=state.propertyId,g=generation;set({busy:true,error:null});try{const status=await service.inspect(id);if(current(g)){set({status});if(status.state==='completed')onCompleted(id);else if(status.state==='cleanup_pending')set({pending:[...state.pending.filter(p=>p.propertyId!==id),status]});}}catch(e){if(current(g))set({error:error(e)});}finally{if(current(g))set({busy:false});}},
  async resume(id:string){if(state.pending.some(p=>p.propertyId===id)||state.status?.propertyId===id&&state.status.state==='cleanup_pending')await remove(id);}
 };
}
