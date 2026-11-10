import {ReviewError,type ReviewRow} from '../models/RentalReview';
import type {ReviewCorpus} from '../models/ReviewWordCloud';
import type {RentalReviewService} from './rentalReviewService';
export async function loadPropertyReviewCorpus(service:Pick<RentalReviewService,'read'>,actor:string,propertyId:string,signal:AbortSignal):Promise<ReviewCorpus>{
 const scan=async()=>{let count:number|null=null;const rows:ReviewRow[]=[],seen=new Set<string>();
  for(let offset=0;offset<=10000;offset+=20){
   if(signal.aborted)throw new ReviewError('Review loading cancelled.');
   const d=await service.read(actor,{mode:'property',id:propertyId},offset,signal);
   if(signal.aborted||d.type!=='public'||d.value.kind!=='property'||d.value.targetId!==propertyId)throw new ReviewError('Property review access changed.');
   const page=d.value;if(count===null)count=page.count;
   if(page.count!==count||count>10020)throw new ReviewError('Review corpus changed or exceeds the supported backend paging range. Refresh.');
   for(const r of page.rows){if(r.kind!=='property'||r.status!=='approved'||r.propertyId!==propertyId||seen.has(r.id))throw new ReviewError('Review corpus changed. Refresh.');seen.add(r.id);rows.push(r);}
   if(rows.length===count)return{propertyId,count,rows,version:JSON.stringify(rows.map(r=>[r.id,r.revision,r.moderatedAt,r.updatedAt,r.text]))};
   if(page.rows.length<20||rows.length>count)throw new ReviewError('Incomplete review corpus. Refresh.');
  }throw new ReviewError('Complete review corpus unavailable.');
 };
 const first=await scan(),second=await scan();if(first.version!==second.version||first.count!==second.count)throw new ReviewError('Published reviews changed while loading. Refresh.');return second;
}

/** Mobile sends only a property reference. The Edge independently obtains all review text. */
export function createReviewCloudProcessor(client:()=>import('@supabase/supabase-js').SupabaseClient<import('./supabase/database.types').Database>):import('../models/ReviewWordCloud').ReviewCloudProcessor{
 const identity=async(actor:string,signal:AbortSignal)=>{const response=await client().auth.getUser();if(signal.aborted||response.error||response.data.user?.id!==actor)throw new ReviewError('Your account changed. Reopen property reviews.');};
 return{async process(actor,corpus,signal){await identity(actor,signal);
  const response=await client().functions.invoke<unknown>('review-wordcloud',{body:{propertyId:corpus.propertyId},signal});
  await identity(actor,signal);
  if(response.error)throw new ReviewError(response.response?.status===404?'Review themes require the word-cloud backend deployment.':'Review themes are unavailable or changed. Refresh to retry.');
  if(response.data===null)throw new ReviewError('Review themes could not be verified.');return response.data;
 }};
}
