import type {ReviewRow} from './RentalReview';
export type Span={start:number;end:number};
export interface ReviewCorpus {propertyId:string;count:number;rows:ReviewRow[];version:string}
// Color NAMES only. The service picks a name per term; the app maps it to a theme token (reviewCloudPresentation.ts). This file is also bundled by the Edge function, so it imports nothing from the theme.
export const termColors={blue:'blue',green:'green',orange:'orange',purple:'purple',pink:'pink'} as const;
export interface CloudTerm {id:string;text:string;review_count:number;color:keyof typeof termColors;font_size_rem:number;matches:{id:string;spans:Span[]}[]}
export interface ReviewCloud {status:'ready'|'empty'|'insufficient_data';terms:CloudTerm[]}
// Authenticated Edge bridge reuses Python Processor.cloud/matching; deployments remain separate.
// Never connect the fixture API or embed the ML bearer secret in the app.
export interface ReviewCloudProcessor {process(actor:string,corpus:ReviewCorpus,signal:AbortSignal):Promise<unknown>}
/**
 * The service reports spans as END-EXCLUSIVE offsets in Unicode CODE POINTS, not UTF-16 units. A JS string index differs as soon as a review has an emoji (two units for one code point);
 * accents written as a letter plus a combining mark are two code points. This converts a code point offset into the JS string index for the same place. Never slice a review with the raw numbers.
 */
export function codePointToIndex(text:string,offset:number):number{
 if(!Number.isInteger(offset)||offset<=0)return 0;
 let index=0,seen=0;
 for(const ch of text){if(seen===offset)return index;index+=ch.length;seen++;}
 return text.length;
}
export function codePointLength(text:string):number{let n=0;for(const _ of text)n++;return n;}
/** Splits a review into plain and highlighted parts. Overlapping, duplicate, reversed, out-of-range or non-integer spans are ignored; the parts always join back to the exact original text. */
export function highlightSegments(text:string,spans:readonly Span[]){
 const total=codePointLength(text),parts:{text:string;marked:boolean}[]=[];let cursor=0;
 const valid=(Array.isArray(spans)?spans:[]).filter(s=>s&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=total).sort((a,b)=>a.start-b.start||a.end-b.end);
 let at=0;const push=(to:number,marked:boolean)=>{const next=codePointToIndex(text,to);if(next>at)parts.push({text:text.slice(at,next),marked});at=Math.max(at,next);};
 for(const s of valid){if(s.start<cursor)continue;push(s.start,false);push(s.end,true);cursor=s.end;}
 push(total,false);return parts;
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
