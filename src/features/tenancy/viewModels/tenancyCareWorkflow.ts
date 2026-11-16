import {CareError,validateCareOperation,type CareContext,type CareOperation,type CareHistory} from '../models/TenancyCare';
import {careActionsFor,tenancyStateOf} from '../models/Maintenance';
import type {TenancyCareService} from '../services/tenancyCareService';
import type {CareJournal} from '../services/tenancyCareJournal';
const initial=()=>({confirmations:{} as Record<string,boolean>,created:null as string|null,data:null as CareContext|null,busy:false,saving:false,ready:false,error:null as string|null,notice:null as string|null,pending:null as CareOperation|null,offset:0,selected:null as string|null,history:[] as CareHistory[],historyOffset:0,historyMore:false,historyBusy:false,historyError:null as string|null});
export function createTenancyCareWorkflow(service:TenancyCareService,journal:CareJournal,actor:string|undefined,id:string,newId:()=>string){
 let state=initial(),disposed=false,generation=0,controller:AbortController|null=null,historyController:AbortController|null=null,historyGeneration=0;
 const listeners=new Set<()=>void>(),update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
 const load=async(offset=state.offset)=>{if(!actor||disposed||state.saving||state.busy)return;controller?.abort();const c=controller=new AbortController(),g=++generation,timer=setTimeout(()=>c.abort(),15000);historyController?.abort();historyGeneration++;update({busy:true,data:null,error:null,ready:false,selected:null,history:[],historyError:null,historyBusy:false});
 try{const pending=await journal.read(actor,id);if(disposed||g!==generation)return;if(c.signal.aborted)throw new CareError('Rental management timed out. Retry.');update({pending});const data=await service.read(actor,id,offset,c.signal);if(!disposed&&g===generation&&!c.signal.aborted){update({data,busy:false,ready:true,offset});void confirmations(data,g);}}
 catch(e){if(!disposed&&g===generation)update({busy:false,error:e instanceof CareError?e.message:'Rental management could not load. Retry.'});}finally{clearTimeout(timer);}};
 /** get_tenancy_care does not say whether the tenant confirmed a resolved request; the confirmations are read per request. Unknown counts as confirmed, so no confirm or reopen is offered before it is known. */
 const confirmedOf=(r:{id:string;revision:string;status:string})=>r.status!=='resolved'?false:state.confirmations[r.id+':'+r.revision]??true;
 /** Is this action open to this person right now? The same rules as the transitions document (see models/Maintenance.ts). */
 const allowed=(action:CareOperation['action'],payload:Record<string,string>)=>{const d=state.data;if(!d||!actor)return false;const role=actor===d.tenantId?'tenant':actor===d.landlordId?'landlord':null;if(!role)return false;
  if(action==='check_reminder')return d.status==='active';
  if(action==='create')return role==='tenant'&&d.status==='active';
  const r=d.requests.find(r=>r.id===payload.requestId&&r.revision===payload.revision);if(!r)return false;
  const a=careActionsFor({role,tenancy:tenancyStateOf(d.status),status:r.status,confirmed:confirmedOf(r)});
  if(action==='reply')return a.reply;if(action==='confirm_resolved')return a.confirm;if(action==='reopen')return a.notFixed;if(action==='cancel')return a.cancel;
  if(action==='respond')return role==='landlord'&&((payload.status==='acknowledged'&&a.seen)||(payload.status==='in_progress'&&a.start)||(payload.status==='resolved'&&a.resolve)||(payload.status===r.status&&a.reply));
  return false;};
 /** Read the tenant's confirmation of each resolved request (one small read each, four at a time). A failed read leaves it unknown (no confirm or reopen offered). */
 const confirmations=async(data:CareContext,g:number)=>{if(!actor)return;const todo=data.requests.filter(r=>r.status==='resolved'&&state.confirmations[r.id+':'+r.revision]===undefined);const run=async(r:CareContext['requests'][number])=>{try{const read=await service.request(actor,r.id,0,new AbortController().signal);if(!disposed&&g===generation)update({confirmations:{...state.confirmations,[r.id+':'+r.revision]:read.request.tenantConfirmedAt!==null}});}catch{/* unknown */}};for(let i=0;i<todo.length;i+=4)await Promise.all(todo.slice(i,i+4).map(run));};
 const submit=async(action:CareOperation['action'],payload:Record<string,string>)=>{if(!actor||disposed||state.saving||state.busy||!state.ready||!state.data)return;
 let op=state.pending;
 if(!op){if(!allowed(action,payload))return;
 op={operationId:newId(),action,payload:{...payload},tenancyId:id};try{validateCareOperation(op);}catch(e){update({error:e instanceof Error?e.message:'Check request fields.'});return;}}
 const input=op,c=controller=new AbortController(),g=++generation,timer=setTimeout(()=>c.abort(),15000);update({saving:true,error:null,notice:null,created:null,pending:input});
 let sent=false;
 try{await journal.save(actor,input);if(disposed||g!==generation||c.signal.aborted)return;sent=true;const result=await service.write(actor,input,c.signal);if(disposed||g!==generation||c.signal.aborted)return;await journal.clear(actor,id);if(disposed||g!==generation)return;update({saving:false,pending:null,created:input.action==='create'&&typeof result.requestId==='string'?result.requestId:null,notice:input.action==='check_reminder'?(typeof result.reminderDate==='string'?'In-app reminder saved.':'No rent date falls within the next three days.'):'Maintenance action saved.'});await load(0);}
 catch(e){if(disposed||g!==generation)return;const uncertain=sent&&(!(e instanceof CareError)||e.uncertain);if(!uncertain){try{await journal.clear(actor,id);}catch{update({saving:false,error:'Recovery record could not be cleared. Retry the same operation.'});return;}}
  const message=e instanceof CareError?e.message:sent?'Outcome not confirmed. Retry the same operation.':'Recovery record could not be saved. No request was sent.';
  update({saving:false,ready:uncertain||!sent,pending:uncertain?input:null,error:message});
  // The request changed under us (40001) or was already updated (22023): read the current state again and keep the plain sentence.
  if(e instanceof CareError&&e.reload&&!uncertain){await load(state.offset);if(!disposed&&g===generation)update({error:message});}}
 finally{clearTimeout(timer);if(!disposed&&g===generation&&state.saving)update({saving:false});}};
 const history=async(requestId:string,more=false)=>{if(!actor||!state.data||disposed||state.saving||state.historyBusy||!state.data.requests.some(r=>r.id===requestId))return;historyController?.abort();const c=historyController=new AbortController(),g=++historyGeneration,offset=more?state.historyOffset+20:0,timer=setTimeout(()=>c.abort(),15000),context=state.data;update({selected:requestId,historyBusy:true,historyError:null,...(!more?{history:[],historyOffset:0,historyMore:false}:{})});try{const rows=await service.history(actor,context,requestId,offset,c.signal);if(!disposed&&g===historyGeneration&&!c.signal.aborted)update({history:more?[...state.history,...rows.filter(r=>!state.history.some(h=>h.id===r.id))]:rows,historyOffset:offset,historyMore:rows.length===20,historyBusy:false});}catch(e){if(!disposed&&g===historyGeneration)update({historyBusy:false,historyError:e instanceof CareError?e.message:'Request history could not load. Retry.'});}finally{clearTimeout(timer);}};
 return {subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>state,activate(){disposed=false;},dispose(){disposed=true;generation++;historyGeneration++;controller?.abort();historyController?.abort();state=initial();},load,submit,history,confirmedOf,retry(){return state.pending?submit(state.pending.action,state.pending.payload):load();}};
}
