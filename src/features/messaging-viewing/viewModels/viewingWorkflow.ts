import {ViewingError,viewingTimes,viewingActions,viewingStatusLabels,manilaParts,type PropertyViewing,type ViewingDraft,type ViewingAction} from '../models/PropertyViewing';
import type {ViewingService,ViewingWrite} from '../services/viewingService';
import type {Conversation} from '../models/PersistentMessaging';
const initial=()=>({owner:null as string|null,rows:[] as PropertyViewing[],busy:false,saving:false,error:null as string|null,notice:null as string|null,uncertain:false,more:false,conversation:null as Conversation|null,editor:null as {viewing:PropertyViewing|null;action:ViewingAction|'request'}|null,draft:{date:'',start:'',end:'',note:''} as ViewingDraft});
export function createViewingWorkflow(service:ViewingService,newId:()=>string){
 let state=initial(),generation=0,disposed=false,controller:AbortController|null=null,pending:ViewingWrite|null=null,offset=0;
 const listeners=new Set<()=>void>();const update=(p:Partial<typeof state>)=>{if(!disposed){state={...state,...p};listeners.forEach(fn=>fn());}};
 const reset=()=>{generation++;controller?.abort();pending=null;offset=0;};
 const fail=(e:unknown)=>{if(e instanceof ViewingError&&e.denied){reset();update({...initial(),error:e.message});}else update({error:e instanceof ViewingError?e.message:'Could not complete the viewing request. Please retry.'});};
 const load=async(more=false)=>{if(disposed||state.busy||state.saving)return;const g=generation,c=controller=new AbortController();update({busy:true,error:null});try{const actor=await service.user(),page=more?offset:0;const rows=await service.list(actor,state.conversation?.id??null,page,c.signal);if(disposed||g!==generation)return;if(state.owner&&actor!==state.owner){reset();update({...initial(),error:'Your account changed. Reopen Viewings.'});return;}offset=page+rows.length;update({owner:actor,rows:more?[...new Map([...state.rows,...rows].map(r=>[r.id,r])).values()]:rows,more:rows.length===20});}catch(e){if(!disposed&&g===generation)fail(e);}finally{if(!disposed&&g===generation)update({busy:false});}};
 const submit=async()=>{if(disposed||state.busy||state.saving||!state.owner||(!state.editor&&!pending))return;const g=generation;try{
 if(!pending){const editor=state.editor!;if(editor.action==='request'||editor.action==='reschedule'){const times=viewingTimes(state.draft);pending={id:newId(),note:times.note,startsAt:times.startsAt,endsAt:times.endsAt,...(editor.viewing?{viewingId:editor.viewing.id,revision:editor.viewing.revision,action:'reschedule' as const}:{conversationId:state.conversation!.id})};}else pending={id:newId(),viewingId:editor.viewing!.id,revision:editor.viewing!.revision,action:editor.action,note:state.draft.note.trim()||null};}
 update({saving:true,error:null});const c=controller=new AbortController();const saved=await service.write(state.owner,pending,c.signal);if(disposed||g!==generation)return;pending=null;update({rows:[saved,...state.rows.filter(v=>v.id!==saved.id)],editor:null,uncertain:false,saving:false,notice:`Saved: ${viewingStatusLabels[saved.status]}.`});await load();
 }catch(e){if(!disposed&&g===generation){const uncertain=e instanceof ViewingError&&e.uncertain;if(!uncertain)pending=null;update({saving:false,uncertain});fail(e);}}finally{if(!disposed&&g===generation)update({saving:false});}};
 return{getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){disposed=false;},dispose(){reset();disposed=true;state=initial();},
 open(conversation:Conversation|null){reset();update({...initial(),conversation});return load();},load,submit,
 edit(viewing:PropertyViewing|null,action:ViewingAction|'request'){
 if(state.busy||state.saving||state.uncertain||!state.owner)return;
 if(action==='request'){if(!state.conversation||state.owner!==state.conversation.tenantId||state.conversation.status!=='open')return;}
 else if(!viewing||!viewingActions(viewing,state.owner).includes(action))return;
 const start=viewing?manilaParts(viewing.startsAt):null,end=viewing?manilaParts(viewing.endsAt):null;
 update({editor:{viewing,action},draft:{date:start?.date??'',start:start?.time??'',end:end?.time??'',note:''},error:null,notice:null});},
 setDraft(p:Partial<ViewingDraft>){if(!state.saving&&!state.uncertain)update({draft:{...state.draft,...p}});},
 closeEditor(){if(state.saving||state.uncertain)return;update({editor:null,error:null});},
 };
}
