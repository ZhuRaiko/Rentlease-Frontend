import {PropertyAmenityError,type PropertyAmenity} from '../models/PropertyAmenity';
import type {PropertyAmenityService} from '../services/propertyAmenityService';
const initial=(propertyId:string|null=null)=>({propertyId,catalog:[] as PropertyAmenity[],selectedIds:[] as number[],hasPrivateLocation:false,loaded:false,busy:false,error:null as string|null});
export function createPropertyAmenityWorkflow(service:PropertyAmenityService){
  let state=initial(),generation=0,disposed=false,owner:string|null=null;
  const listeners=new Set<()=>void>();
  const update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}};
  return {getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
    activate(){disposed=false;},dispose(){disposed=true;generation++;owner=null;state=initial();listeners.clear();},
    setProperty(id:string|null){if(state.propertyId!==id){generation++;update(initial(id));}},
    async load(){if(disposed||state.busy)return;const token=generation;update({busy:true,error:null});try{const result=await service.load(state.propertyId);if(disposed||token!==generation)return;if(owner&&result.userId!==owner)throw new PropertyAmenityError('Your account changed. Reopen the property.',true);owner=result.userId;update({...result,loaded:true});}catch(error){if(!disposed&&token===generation)update({loaded:false,catalog:[],selectedIds:[],hasPrivateLocation:false,error:error instanceof PropertyAmenityError?error.message:'Amenities could not load. Please retry.'});}finally{if(!disposed&&token===generation)update({busy:false});}}
  };
}
