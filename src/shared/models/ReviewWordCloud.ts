import type {ReviewRow} from './RentalReview';
export type Span={start:number;end:number};
export interface ReviewCorpus {propertyId:string;count:number;rows:ReviewRow[];version:string}
export const termColors={blue:'#245CA6',green:'#237344',orange:'#A65112',purple:'#75449C',pink:'#A83872'};
export interface CloudTerm {id:string;text:string;review_count:number;color:keyof typeof termColors;font_size_rem:number;matches:{id:string;spans:Span[]}[]}
export interface ReviewCloud {status:'ready'|'empty'|'insufficient_data';terms:CloudTerm[]}
// Authenticated Edge bridge reuses Python Processor.cloud/matching; deployments remain separate.
// Never connect the fixture API or embed the ML bearer secret in the app.
export interface ReviewCloudProcessor {process(actor:string,corpus:ReviewCorpus,signal:AbortSignal):Promise<unknown>}
export function highlightSegments(text:string,spans:readonly Span[]){
 const chars=Array.from(text),parts:{text:string;marked:boolean}[]=[];let cursor=0;
 const valid=spans.filter(s=>s&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=chars.length).sort((a,b)=>a.start-b.start||a.end-b.end);
 for(const s of valid){if(s.start<cursor)continue;if(s.start>cursor)parts.push({text:chars.slice(cursor,s.start).join(''),marked:false});parts.push({text:chars.slice(s.start,s.end).join(''),marked:true});cursor=s.end;}
 if(cursor<chars.length)parts.push({text:chars.slice(cursor).join(''),marked:false});return parts;
}
export function validateReviewCloud(value:unknown,corpus:ReviewCorpus):ReviewCloud{
 const fail=()=>{throw Error('Word cloud response could not be verified.');};
 if(!value||typeof value!=='object')return fail();
 const v=value as Record<string,unknown>;
 if(v.property_id!==corpus.propertyId||v.corpus_version!==corpus.version||v.synthetic!==false||v.span_encoding!=='unicode_code_points'||v.eligible_review_count!==corpus.count||!['ready','empty','insufficient_data'].includes(String(v.status))||!Array.isArray(v.terms)||v.terms.length>24)return fail();
 const ids=new Set<string>();const terms:CloudTerm[]=v.terms.map((raw:unknown)=>{
  if(!raw||typeof raw!=='object')return fail();const t=raw as CloudTerm;
  if(typeof t.id!=='string'||!/^t-[a-f0-9]{64}$/.test(t.id)||ids.has(t.id)||typeof t.text!=='string'||!t.text.trim()||t.text.length>2000||!Object.hasOwn(termColors,t.color)||!Number.isFinite(t.font_size_rem)||t.font_size_rem<1||t.font_size_rem>2.3||!Array.isArray(t.matches)||t.review_count!==t.matches.length||t.review_count<2)return fail();ids.add(t.id);
  const seen=new Set<string>();const matches=t.matches.map(m=>{const row=corpus.rows.find(r=>r.id===m.id);if(!row?.text||seen.has(m.id)||!Array.isArray(m.spans)||!m.spans.length)return fail();seen.add(m.id);return{id:m.id,spans:m.spans.filter(s=>s&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=Array.from(row.text!).length).map(s=>({start:s.start,end:s.end}))};});
  return{id:t.id,text:t.text,review_count:t.review_count,color:t.color,font_size_rem:t.font_size_rem,matches};
 });
 if((v.status==='ready')!==(terms.length>0)||(v.status==='empty')!==(corpus.count===0))return fail();return{status:v.status as ReviewCloud['status'],terms};
}
