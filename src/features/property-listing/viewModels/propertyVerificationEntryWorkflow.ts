import {propertyVerificationActionLabel} from '../models/PropertyVerificationPresentation';
import {isPropertyUuid} from '../models/DraftProperty';
import type {TierThreeVerificationService} from '../../user-verification/services/tierThreeVerificationService';
import type {TierThreeSubmission} from '../../user-verification/models/TierThreeVerification';
const initial=(propertyId:string|null=null)=>({propertyId,status:null as TierThreeSubmission['status']|'not_submitted'|null,loaded:false,busy:false,opening:false,entryPropertyId:null as string|null,actionLabel:null as string|null,error:null as string|null});
export function createPropertyVerificationEntry(service:Pick<TierThreeVerificationService,'getEligibleUserId'|'fetchLatest'>,canOpen=()=>true){
 let state=initial(),generation=0,disposed=false,owner:string|null=null;const listeners=new Set<()=>void>();
 const update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
 const alive=(g:number)=>!disposed&&generation===g;
 const refresh=async()=>{
  if(disposed||state.busy||!state.propertyId)return false;const g=generation,id=state.propertyId;update({busy:true,error:null});
  try{const userId=await service.getEligibleUserId();if(!alive(g))return false;if(owner&&owner!==userId)throw Error('Account changed');const row=await service.fetchLatest(userId,id);if(!alive(g))return false;if(row&&row.property_id!==id)throw Error('Property changed');if(await service.getEligibleUserId()!==userId)throw Error('Account changed');if(!alive(g))return false;owner=userId;
   const status=row?.status??'not_submitted';update({loaded:true,status,actionLabel:propertyVerificationActionLabel(status)});return true;
  }catch{if(alive(g))update({loaded:false,status:null,actionLabel:null,error:'Could not check this property’s verification. Check your account and try again.'});return false;}
  finally{if(alive(g))update({busy:false});}
 };
 const workflow={
  getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  activate(){disposed=false;},dispose(){disposed=true;generation++;state=initial();owner=null;listeners.clear();},
  setProperty(id:string|null){if(id===state.propertyId)return;generation++;owner=null;update(initial(isPropertyUuid(id)?id:null));},refresh,
  async open(){if(disposed||state.opening||state.entryPropertyId||!canOpen())return;const g=generation;update({opening:true});try{if(await refresh()&&alive(g)&&state.status!=='approved')update({entryPropertyId:state.propertyId});}finally{if(alive(g))update({opening:false});}},
  async openForProperty(id:string):Promise<void>{if(disposed||state.opening||state.entryPropertyId||!canOpen()||!isPropertyUuid(id))return;workflow.setProperty(id);await workflow.open();},
  async close(){if(disposed||!state.entryPropertyId)return;update({entryPropertyId:null});await refresh();},
 };
 return workflow;
}
