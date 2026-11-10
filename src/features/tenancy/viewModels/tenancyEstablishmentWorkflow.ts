import {setupActions,setupTerms,TenancySetupError,type SetupContext,type SetupDraft,type SetupAction} from '../models/TenancyEstablishment';
import type {TenancyEstablishmentService,SetupWrite} from '../services/tenancyEstablishmentService';
const initial=()=>({context:null as SetupContext|null,draft:{rent:'',dueDay:''} as SetupDraft,busy:false,saving:false,uncertain:false,error:null as string|null,notice:null as string|null});
export function createTenancyEstablishmentWorkflow(service:TenancyEstablishmentService,actor:string|undefined,reservationId:string,newId:()=>string){
 let state=initial(),disposed=false,generation=0,controller:AbortController|null=null,pending:SetupWrite|null=null;
 const listeners=new Set<()=>void>(),update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
 const load=async()=>{if(disposed||!actor||state.saving)return;controller?.abort();const c=controller=new AbortController(),g=++generation;update({busy:true,context:null,error:null,notice:null});
 try{const context=await service.read(actor,reservationId,c.signal);if(g!==generation||disposed||c.signal.aborted)return;pending=null;update({context,busy:false,uncertain:false,draft:{rent:String(context.tenancy?.rent??context.askingRent??''),dueDay:String(context.tenancy?.dueDay??'')}});}
 catch(e){if(g===generation&&!disposed&&!c.signal.aborted)update({busy:false,error:e instanceof TenancySetupError?e.message:'Tenancy setup could not load. Retry.'});}};
 const submit=async(action:SetupAction)=>{if(disposed||!actor||state.busy||state.saving||(!state.context&&!pending))return;
 if(!pending){if(!state.context)return;if(!setupActions(state.context,actor).includes(action))return;try{if(action==='create')setupTerms(state.draft);}catch(e){update({error:e instanceof Error?e.message:'Check rental terms.'});return;}pending={context:state.context,draft:{...state.draft},operationId:newId(),action};}
 const input=pending,c=controller=new AbortController(),g=++generation;update({saving:true,error:null,notice:null});
 try{const context=await service.write(actor,input,c.signal);if(g!==generation||disposed||c.signal.aborted)return;pending=null;update({context,saving:false,uncertain:false,notice:context.tenancy?.status==='active'?'Tenancy is active.':input.action==='create'?'Tenancy proposed. The renter must explicitly confirm.':input.action==='cancel'?'Tenancy setup cancelled. The reservation was not changed.':'Tenancy setup updated.'});}
 catch(e){if(g!==generation||disposed||c.signal.aborted)return;const uncertain=e instanceof TenancySetupError&&e.uncertain;if(!uncertain)pending=null;update({saving:false,uncertain,error:e instanceof TenancySetupError?e.message:'Tenancy setup could not be confirmed.'});}};
 return {subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>state,activate(){disposed=false;},dispose(){disposed=true;generation++;controller?.abort();pending=null;state=initial();},load,submit,
 setDraft(patch:Partial<SetupDraft>){if(!state.busy&&!state.saving&&!state.uncertain&&!state.context?.tenancy)update({draft:{...state.draft,...patch},error:null});},retry(){return pending?submit(pending.action):load();}};
}
