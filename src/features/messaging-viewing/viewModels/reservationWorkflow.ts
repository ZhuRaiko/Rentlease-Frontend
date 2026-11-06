import {ReservationError,reservationInput,reservationActions,reservationStatusLabels,type RentalReservation,type ReservationDraft,type ReservationAction} from '../models/RentalReservation';
import type {ReservationService,ReservationWrite} from '../services/reservationService';
import type {Conversation} from '../models/PersistentMessaging';
const initial=()=>({owner:null as string|null,rows:[] as RentalReservation[],busy:false,saving:false,error:null as string|null,notice:null as string|null,uncertain:false,more:false,clockOffset:0,conversation:null as Conversation|null,editor:null as {reservation:RentalReservation|null;action:ReservationAction|'request'}|null,draft:{moveInDate:'',durationMonths:'',message:''} as ReservationDraft});
export function createReservationWorkflow(service:ReservationService,newId:()=>string){
 let state=initial(),disposed=false,generation=0,offset=0,pending:ReservationWrite|null=null,controller:AbortController|null=null;
 const listeners=new Set<()=>void>();
 const update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
 const reset=()=>{generation++;controller?.abort();pending=null;offset=0;};
 const failure=(error:unknown)=>{if(error instanceof ReservationError&&error.denied){reset();update({...initial(),error:error.message});}else update({error:error instanceof ReservationError?error.message:'Could not complete the reservation request. Please retry.'});};
 const load=async(more=false)=>{
  if(disposed||state.busy||state.saving)return;const g=generation,c=controller=new AbortController();update({busy:true,error:null});
  try{const actor=await service.user();if(disposed||g!==generation)return;
   if(state.owner&&state.owner!==actor)throw new ReservationError('Your account changed. Reopen Reservations.',true);
   const page=more?offset:0,rows=await service.list(actor,state.conversation?.id??null,page,c.signal);if(disposed||g!==generation)return;
   offset=page+rows.length;update({owner:actor,rows:more?[...new Map([...state.rows,...rows].map(r=>[r.id,r])).values()]:rows,more:rows.length===20,...(rows[0]?{clockOffset:Date.parse(rows[0].serverNow)-Date.now()}:{})});
  }catch(e){if(!disposed&&g===generation)failure(e);}finally{if(!disposed&&g===generation)update({busy:false});}
 };
 const submit=async()=>{
  if(disposed||state.busy||state.saving||!state.owner||(!state.editor&&!pending))return;const g=generation;
  try{if(!pending){const editor=state.editor!;
   if(editor.action==='request'){const input=reservationInput(state.draft,Date.now()+state.clockOffset);pending={id:newId(),conversationId:state.conversation!.id,...input};}
   else{if(state.draft.message.trim().length>1000)throw new ReservationError('Keep the note within 1,000 characters.');pending={id:newId(),reservationId:editor.reservation!.id,revision:editor.reservation!.revision,action:editor.action,message:state.draft.message.trim()||null};}
  }
  update({saving:true,error:null});const c=controller=new AbortController(),saved=await service.write(state.owner,pending,c.signal);if(disposed||g!==generation)return;
  pending=null;update({rows:[saved,...state.rows.filter(v=>v.id!==saved.id)],editor:null,uncertain:false,saving:false,notice:`Saved: ${reservationStatusLabels[saved.status]}.`,clockOffset:Date.parse(saved.serverNow)-Date.now()});await load();
  }catch(e){if(!disposed&&g===generation){const uncertain=e instanceof ReservationError&&e.uncertain;if(!uncertain)pending=null;update({saving:false,uncertain});failure(e);}}finally{if(!disposed&&g===generation)update({saving:false});}
 };
 return{getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){disposed=false;},dispose(){reset();disposed=true;state=initial();},open(conversation:Conversation|null){reset();update({...initial(),conversation});return load();},load,submit,
 edit(reservation:RentalReservation|null,action:ReservationAction|'request'){
  if(state.busy||state.saving||state.uncertain||!state.owner)return;
  if(action==='request'){if(!state.conversation||state.owner!==state.conversation.tenantId||state.conversation.status!=='open')return;}
  else if(!reservation||!reservationActions(reservation,state.owner,Date.now()+state.clockOffset).includes(action))return;
  update({editor:{reservation,action},draft:{moveInDate:'',durationMonths:'',message:''},error:null,notice:null});
 },setDraft(patch:Partial<ReservationDraft>){if(!state.saving&&!state.uncertain)update({draft:{...state.draft,...patch}});},closeEditor(){if(!state.saving&&!state.uncertain)update({editor:null,error:null});}
 };
}
