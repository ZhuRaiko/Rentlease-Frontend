export type NearbyFailure='timeout'|'rate_limit'|'query'|'response'|'unavailable'|'network'|'rejected';
export class NearbyPlacesError extends Error {constructor(message:string,readonly kind:NearbyFailure='unavailable',readonly status?:number,readonly retryAfterMs?:number){super(message);this.name='NearbyPlacesError';}}
import {placeCategories,straightLineMeters,validPoint,type NearbyPlace,type PublicPoint} from './NearbyPlace.ts';
export interface NearbyPlacesResult{rows:NearbyPlace[];stale:boolean;fetchedAt:string;expiresAt:string;limited:boolean;}
export function parseNearbyPlacesRows(value:unknown,origin?:PublicPoint):NearbyPlace[]{
 if(!Array.isArray(value)||value.length>80)throw Error('Invalid nearby data');const seen=new Set<string>();
 return value.map(r=>{if(!r||typeof r.providerId!=='string'||!r.providerId||r.providerId.length>512||seen.has(r.providerId)||typeof r.name!=='string'||!r.name.trim()||r.name.length>240||!placeCategories.includes(r.category)||!r.location||!validPoint(r.location)||!Number.isFinite(r.distanceMeters)||r.distanceMeters<0||r.distanceMeters>2000)throw Error('Invalid nearby data');seen.add(r.providerId);
 if(origin&&Math.abs(straightLineMeters(origin,r.location)-r.distanceMeters)>2)throw Error('Invalid nearby distance');
 return{providerId:r.providerId,name:r.name,category:r.category,location:{latitude:r.location.latitude,longitude:r.location.longitude},distanceMeters:r.distanceMeters};});
}
export function parseNearbyPlacesResult(raw:any,listingId:string):NearbyPlacesResult{
 if(raw?.listingId!==listingId||raw.provider!=='geoapify'||typeof raw.stale!=='boolean'||typeof raw.limited!=='boolean'||!Number.isFinite(Date.parse(raw.fetchedAt))||!Number.isFinite(Date.parse(raw.expiresAt))||Date.parse(raw.fetchedAt)>Date.now()+60000||Date.parse(raw.expiresAt)<=Date.parse(raw.fetchedAt)||(!raw.stale&&Date.parse(raw.expiresAt)<=Date.now()))throw Error('Invalid nearby result');
 return{rows:parseNearbyPlacesRows(raw.rows),stale:raw.stale,fetchedAt:raw.fetchedAt,expiresAt:raw.expiresAt,limited:raw.limited};
}
