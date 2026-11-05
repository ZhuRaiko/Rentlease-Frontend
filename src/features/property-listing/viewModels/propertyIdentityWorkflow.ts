import {identityCorrectionIssues,identityCorrectionSnapshot} from '../models/PropertyIdentityCorrection';
import {propertyAddressQuery} from '../models/PropertyLocationConfirmation';
import {hasConfirmedPropertyLocation,type DraftProperty} from '../models/DraftProperty';
import {identityDraft,IdentityError,type IdentityContext} from '../models/PropertyIdentityCorrection';
import type {PropertyIdentityService} from '../services/propertyIdentityService';
import type {PropertyLocationService} from '../services/propertyLocationService';
import {createPropertyLocationWorkflow} from './propertyLocationWorkflow';
export function createPropertyIdentityWorkflow(service:PropertyIdentityService,mapService:PropertyLocationService,onChanged?:()=>void){
 type State={propertyId:string|null;status:'idle'|'loading'|'ready'|'error';context:IdentityContext|null;draft:DraftProperty|null;busy:boolean;uncertain:boolean;conflict:boolean;attested:boolean;locationRevision:number;locationConfirmed:boolean;error:string|null;notice:string|null};
 const empty=():State=>({propertyId:null,status:'idle',context:null,draft:null,busy:false,uncertain:false,conflict:false,attested:false,locationRevision:0,locationConfirmed:false,error:null,notice:null});
 let state=empty(),generation=0,alive=true;const listeners=new Set<()=>void>();
 const set=(p:Partial<State>)=>{state={...state,...p};listeners.forEach(f=>f());};const current=(g:number,id:string)=>alive&&generation===g&&state.propertyId===id;
 const pending=()=>!!state.context?.correction&&['draft','submitted'].includes(state.context.correction.status);
 const editable=()=>state.status==='ready'&&!state.busy&&!state.uncertain&&!state.conflict&&!state.context?.requires_repair&&!state.context?.open_tenancy&&!pending();
 const issues=()=>state.context&&state.draft?identityCorrectionIssues(identityDraft(state.context),state.draft,'same_property_correction',state.attested,state.locationConfirmed):[];
 const dirty=()=>{if(!state.draft||!state.context?.current||pending())return false;try{return JSON.stringify(identityCorrectionSnapshot(state.draft))!==JSON.stringify(identityCorrectionSnapshot(identityDraft(state.context)));}catch{return JSON.stringify(state.draft)!==JSON.stringify(identityDraft(state.context));}};
 const location=createPropertyLocationWorkflow(mapService,(point,revision)=>{if(!alive||!editable()||!state.draft||state.locationRevision!==revision)return false;set({draft:{...state.draft,...point},locationConfirmed:true});return true;},()=>{if(alive&&editable()&&state.draft)set({draft:{...state.draft,exactLatitude:null,exactLongitude:null,publicLatitude:null,publicLongitude:null},locationConfirmed:false,error:null});});
 const sync=()=>location.syncContext(state.draft&&editable()?{setupId:`identity:${state.propertyId}:${generation}`,addressRevision:state.locationRevision,query:propertyAddressQuery(state.draft)}:null);
 const adopt=(context:IdentityContext)=>{set({context,draft:identityDraft(context),status:'ready',busy:false,uncertain:false,conflict:false,attested:false,locationConfirmed:false});sync();};
 const api={getSnapshot:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>listeners.delete(f);},location,dirty,issues,
  canSave:()=>editable()&&dirty()&&issues().length===0,
  activate(){alive=true;location.activate();},dispose(){alive=false;generation++;location.dispose();state=empty();},
  close(){generation++;location.close();set(empty());},discard(){if(state.context){set({draft:identityDraft(state.context),attested:false,locationConfirmed:false,error:null});location.close();}},
  async open(id:string){const g=++generation;location.close();set({...empty(),propertyId:id,status:'loading'});try{const [c,p]=await Promise.all([service.load(id),service.hasPending(id)]);if(!current(g,id))return;adopt(c);set({uncertain:p,error:p?'An earlier correction needs confirmation. Check correction status before continuing.':null});sync();}catch(e){if(current(g,id))set({status:'error',error:e instanceof Error?e.message:'Could not load property identity.'});}},
  update(field:'propertyType'|'city'|'barangay'|'addressLine1'|'addressLine2'|'postalCode'|'floorNumber',value:DraftProperty[typeof field]){if(!editable()||!state.draft)return;const address=['city','barangay','addressLine1','addressLine2','postalCode'].includes(field)&&String(state.draft[field]??'').trim()!==String(value??'').trim();set({draft:{...state.draft,[field]:value,...(address?{exactLatitude:null,exactLongitude:null,publicLatitude:null,publicLongitude:null}:{})},error:null,notice:null,...(address?{locationRevision:state.locationRevision+1,locationConfirmed:false}:{})});sync();},
  attest(value:boolean){if(editable())set({attested:value});},
  reviseRejected(){if(!editable()||!state.context?.correction||!['rejected','cancelled'].includes(state.context.correction.status))return;location.close();set({draft:identityDraft({...state.context,current:state.context.correction.proposed}),attested:false,locationRevision:state.locationRevision+1,locationConfirmed:false,error:null});sync();},
  async openMap(){if(!editable()||!state.draft)return;await location.open({setupId:`identity:${state.propertyId}:${generation}`,addressRevision:state.locationRevision,query:propertyAddressQuery(state.draft)},hasConfirmedPropertyLocation(state.draft)?state.draft:undefined);},
  async save(){if(!api.canSave()||!state.context||!state.draft)return false;return mutate('same_property_correction');},
  async cancel(){if(state.busy||state.uncertain||!state.context?.correction||!pending())return false;return mutate('cancel');},
  async reconcile(){if(!state.propertyId||state.busy)return;const id=state.propertyId,g=generation;set({busy:true,error:null});try{const c=await service.reconcile(id);if(!current(g,id))return;if(!c){set({busy:false,uncertain:true,error:'Correction still unresolved. Check again before retrying.'});return;}adopt(c);set({notice:'Correction status confirmed. Review the saved result.'});onChanged?.();}catch(e){if(current(g,id))set({busy:false,error:e instanceof Error?e.message:'Could not check correction status.'});}},
  async reload(){if(state.propertyId&&!state.busy&&!state.uncertain)await api.open(state.propertyId);}
 };
 async function mutate(action:'same_property_correction'|'cancel'){
  const c=state.context!,d=state.draft!,g=generation,id=c.property_id;set({busy:true,error:null,notice:null});location.close();
  try{const row=await service.mutate(c,action,d);if(!current(g,id))return false;adopt(row);set({notice:action==='cancel'?'Correction cancelled. Current property identity is unchanged.':row.correction?.status==='applied'?'Unverified identity corrected. Tier 3 approval is still required before publication.':'Correction saved privately. Submit proof for this proposed identity; the current approved identity is unchanged.'});onChanged?.();return true;}
  catch(e){if(current(g,id))set({busy:false,error:e instanceof Error?e.message:'Correction failed. Your edits are kept.',uncertain:e instanceof IdentityError&&e.kind==='uncertain',conflict:e instanceof IdentityError&&e.kind==='conflict'});return false;}
 }
 return api;
}
