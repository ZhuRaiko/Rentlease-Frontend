import type {MatchingPreferences} from '../models/SearchDiscovery';
import {ManualSearchError,defaultSearchFilters,type SearchFilters} from '../models/ManualSearch';
import type {RecommendationService} from '../../property-recommendations/services/recommendationService';
import {rankRecommendations,hasScorablePreferences,type RecommendationCandidate,type RankedRecommendation} from '../../property-recommendations/models/ContentRecommendation';
const initial=()=>({owner:null as string|null,phase:'idle' as 'idle'|'loading'|'success'|'error'|'unavailable',recommended:[] as RankedRecommendation[],bestMatch:[] as RankedRecommendation[],limited:false,scanned:0,error:null as string|null});
/** One account-scoped pool; preference edits rerank it without another database search. */
export function createRecommendationWorkflow(service:RecommendationService,actor:string|undefined){
 let state=initial(),disposed=false,generation=0,controller:AbortController|null=null,candidates:RecommendationCandidate[]=[],preferences:MatchingPreferences|null=null,query='',filters=defaultSearchFilters(),scope='',preferenceKey='',loaded=false;
 const listeners=new Set<()=>void>(),update=(patch:Partial<typeof state>)=>{if(!disposed){state={...state,...patch};listeners.forEach(fn=>fn());}},reset=()=>{generation++;controller?.abort();};
 const rank=()=>({recommended:preferences?rankRecommendations(candidates,preferences,actor??'','Recommended'):[],bestMatch:preferences?rankRecommendations(candidates,preferences,actor??'','Best Match'):[]});
 const load=async()=>{if(disposed||!actor||!preferences||!hasScorablePreferences(preferences)||state.phase==='loading')return;const g=generation,c=controller=new AbortController();update({phase:'loading',error:null,recommended:[],bestMatch:[]});
 try{if(await service.user()!==actor)throw new ManualSearchError('Your account changed. Reopen Discover.',true);const result=await service.load(actor,filters,query,c.signal);if(disposed||g!==generation)return;loaded=true;candidates=result.candidates;update({owner:actor,phase:'success',limited:result.limited,scanned:result.scanned,...rank()});}
 catch(e){if(disposed||g!==generation)return;candidates=[];loaded=false;update({...initial(),owner:actor,phase:'error',error:e instanceof ManualSearchError?e.message:'Recommendations could not load. Please retry.'});}};
 return {subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>state,activate(){disposed=false;},dispose(){reset();disposed=true;candidates=[];loaded=false;scope='';preferenceKey='';state=initial();},load,
 configure(next:MatchingPreferences|null,nextFilters:SearchFilters,nextQuery:string){
 const nextScope=JSON.stringify([nextFilters,nextQuery]),nextPrefs=JSON.stringify(next);if(scope===nextScope&&preferenceKey===nextPrefs)return;
 const changed=scope!==nextScope;scope=nextScope;preferenceKey=nextPrefs;preferences=next;filters={...nextFilters,types:[...nextFilters.types],amenityIds:[...nextFilters.amenityIds]};query=nextQuery;
 if(!next||!hasScorablePreferences(next)){reset();candidates=[];loaded=false;update({...initial(),phase:'unavailable'});return;}
 if(changed){reset();candidates=[];loaded=false;update(initial());}
 if(loaded)update({...rank()});else void load();
 }};
}
