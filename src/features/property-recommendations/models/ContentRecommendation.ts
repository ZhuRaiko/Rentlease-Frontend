import type {MatchingPreferences} from '../../search-discovery/models/SearchDiscovery';
import type {SearchListing} from '../../search-discovery/models/ManualSearch';
export const recommendationWeights=Object.freeze({preference:0.8,tier2:0.1,completeness:0.1});
export const recommendationPoolLimit=100;
export type RecommendationSort='Recommended'|'Best Match';
export interface OwnerVerification {ownerId:string;status:'approved'|'pending'|'rejected'|'revoked'|'expired'|'unknown';active:boolean;authoritative:boolean;expiresAt:string|null}
export interface RecommendationCandidate {listing:SearchListing;amenities:string[]|null;completeness:number|null;publishedAt:string;ownerVerification:OwnerVerification|null}
export interface RecommendationScore {preference:number;tier2:number;completeness:number|null;score:number;factors:number;reasons:string[]}
export interface RankedRecommendation extends RecommendationScore {candidate:RecommendationCandidate}
const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const priority=(name:string,order:readonly string[])=>{const i=order.indexOf(name);return i<0?1:order.length-i;};
export function hasScorablePreferences(p:MatchingPreferences){return !!p.city.trim()||(number(p.maximumRent)&&p.maximumRent>0&&number(p.minimumRent)&&p.minimumRent<=p.maximumRent)||p.propertyKinds.length>0||p.minimumBedrooms>0||p.minimumBathrooms>0||p.furnishedOnly||p.amenities.some(a=>a.trim());}
export function scoreRecommendation(c:RecommendationCandidate,p:MatchingPreferences,now=Date.now()):RecommendationScore {
 const l=c.listing,groups:{name:string;value:number}[]=[],reasons:string[]=[];
 if(p.city.trim()){const match=typeof l.city==='string'&&normalize(l.city)===normalize(p.city);groups.push({name:'Location',value:match?1:0});if(match)reasons.push('Preferred city');}
 if(number(p.maximumRent)&&p.maximumRent>0&&number(p.minimumRent)&&p.minimumRent<=p.maximumRent){const distance=number(l.rent)?Math.max(p.minimumRent-l.rent,l.rent-p.maximumRent,0):Infinity;const match=clamp(1-distance/Math.max(1,p.maximumRent));groups.push({name:'Budget',value:match});if(distance===0)reasons.push('Within your budget');}
 const units:{value:number;weight:number}[]=[];
 if(p.propertyKinds.length){const match=typeof l.propertyType==='string'&&p.propertyKinds.some(t=>normalize(t)===normalize(l.propertyType));units.push({value:match?1:0,weight:1});if(match)reasons.push('Preferred property type');}
 for(const [minimum,value,name] of [[p.minimumBedrooms,l.bedrooms,'Bedrooms'],[p.minimumBathrooms,l.bathrooms,'Bathrooms']] as const){if(number(minimum)&&minimum>0)units.push({value:number(value)&&value>=minimum?1:0,weight:priority(name,p.unitSpecificationRanking)});}
 if(p.furnishedOnly)units.push({value:l.furnishing==='furnished'?1:0,weight:1});
 if(units.length)groups.push({name:'Unit specifications',value:units.reduce((sum,v)=>sum+v.value*v.weight,0)/units.reduce((sum,v)=>sum+v.weight,0)});
 const wanted=[...new Map(p.amenities.filter(a=>a.trim()).map(a=>[normalize(a),a])).entries()];
 if(wanted.length){const available=c.amenities===null?null:new Set(c.amenities.map(normalize));let matched=0,total=0;for(const [key,label] of wanted){const weight=priority(label,p.amenityRanking);total+=weight;if(available?.has(key))matched+=weight;}groups.push({name:'Amenities',value:matched/total});if(matched)reasons.push('Selected amenities');}
 const total=groups.reduce((sum,g)=>sum+priority(g.name,p.factorRanking),0),preference=total?groups.reduce((sum,g)=>sum+g.value*priority(g.name,p.factorRanking),0)/total:0;
 const v=c.ownerVerification,tier2=v?.ownerId===l.ownerId&&v.status==='approved'&&v.active===true&&v.authoritative===true&&(v.expiresAt===null||(Number.isFinite(Date.parse(v.expiresAt))&&Date.parse(v.expiresAt)>now))?1:0;
 const completeness=number(c.completeness)&&c.completeness<=1?c.completeness:null;
 return {preference,tier2,completeness,score:recommendationWeights.preference*preference+recommendationWeights.tier2*tier2+recommendationWeights.completeness*(completeness??0),factors:groups.length,reasons};
}
export function rankRecommendations(candidates:readonly RecommendationCandidate[],preferences:MatchingPreferences,actor:string,sort:RecommendationSort):RankedRecommendation[]{
 const unique=new Map<string,RecommendationCandidate>();for(const c of candidates)if(c.listing.ownerId!==actor&&!unique.has(c.listing.listingId))unique.set(c.listing.listingId,c);
 return [...unique.values()].map(candidate=>({candidate,...scoreRecommendation(candidate,preferences)})).filter(r=>r.factors>0&&r.preference>0).sort((a,b)=>(sort==='Best Match'?b.preference-a.preference:b.score-a.score)||b.preference-a.preference||b.candidate.publishedAt.localeCompare(a.candidate.publishedAt)||a.candidate.listing.listingId.localeCompare(b.candidate.listing.listingId));
}
