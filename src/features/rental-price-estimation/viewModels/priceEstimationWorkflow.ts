import {PredictionError} from '../../../shared/models/RentalPrediction';
import type {EstimatePropertyService} from '../services/estimatePropertyService';
import type {PricePredictionClient} from '../../../shared/services/ml/priceEstimationClient';
import type {EstimateSource,EstimateProperty,EstimateState} from '../models/RentalPriceEstimate';
const initial=(source:EstimateSource):EstimateState=>({owner:null,source,properties:[],more:false,loading:false,predicting:false,selected:null,result:null,error:null});
export function createPriceEstimationWorkflow(properties:EstimatePropertyService,predictions:PricePredictionClient,accountId:string|undefined,source:EstimateSource='published'){
 let state=initial(source),disposed=false,generation=0,controller:AbortController|null=null,offset=0;
 const listeners=new Set<()=>void>(),update=(patch:Partial<EstimateState>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}},reset=()=>{generation++;controller?.abort();};
 const alive=(g:number)=>!disposed&&g===generation;
 const fail=(e:unknown)=>{if(e instanceof PredictionError&&['auth','access','eligibility'].includes(e.code)){reset();offset=0;update({...initial(state.source),error:e.message});}else update({error:e instanceof Error?e.message:'Could not reach the estimator. Please retry.'});};
 const load=async(more=false)=>{if(disposed||state.loading||state.predicting)return;const g=generation,c=controller=new AbortController();update({loading:true,error:null});
 try{const owner=await properties.user();if(owner!==accountId)throw new PredictionError('Your account changed. Reopen the estimator.','auth');const page=more?offset:0,rows=await properties.load(owner,state.source,page,c.signal);if(!alive(g))return;offset=page+rows.length;update({owner,properties:more?[...new Map([...state.properties,...rows].map(r=>[r.key,r])).values()]:rows,more:rows.length===20});}catch(e){if(alive(g))fail(e);}finally{if(alive(g))update({loading:false});}};
 const predict=async()=>{if(disposed||state.predicting||state.loading||!state.selected)return;const selected=state.selected;if(selected.unavailable){update({error:selected.unavailable});return;}const g=generation,c=controller=new AbortController();update({predicting:true,error:null,result:null});
 try{const owner=await properties.user();if(owner!==accountId)throw new PredictionError('Your account changed. Reopen the estimator.','auth');const result=await predictions.predict(owner,selected.target,c.signal);if(alive(g))update({result});}catch(e){if(alive(g))fail(e);}finally{if(alive(g))update({predicting:false});}};
 return {getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},activate(){disposed=false;},dispose(){reset();disposed=true;state=initial(source);},load,predict,
 select(property:EstimateProperty){if(!state.properties.some(p=>p.key===property.key))return;reset();update({selected:property,result:null,error:null,predicting:false,loading:false});},
 setSource(next:EstimateSource){if(next===state.source)return;reset();offset=0;update(initial(next));void load();},
 back(){if(state.predicting){reset();update({predicting:false,error:null});return true;}if(state.result){update({result:null,error:null});return true;}if(state.selected){reset();update({selected:null,result:null,error:null,loading:false});return true;}return false;}
 };
}
