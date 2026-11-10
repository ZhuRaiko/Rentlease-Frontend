import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {parseSearchListing,type SearchListing} from './ManualSearch';
export type SavedSort='recent'|'price_low'|'price_high';
export interface SavedRow {listingId:string;savedAt:string;listing:SearchListing|null}
export interface SavedPage {count:number;rows:SavedRow[]}
export class SavedError extends Error{constructor(message:string,readonly definitive=false){super(message);}}
export function parseSavedPage(value:unknown):SavedPage{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new SavedError('Saved listings could not be read.');const p=value as Record<string,unknown>;
 if(!Number.isSafeInteger(p.count)||Number(p.count)<0||!Array.isArray(p.rows)||p.rows.length>20||p.rows.length>Number(p.count))throw new SavedError('Saved listings could not be read.');
 const ids=new Set<string>();const rows=p.rows.map((raw:unknown)=>{const r=raw as Record<string,unknown>;if(!r||!isUuid(r.listingId)||ids.has(r.listingId)||typeof r.savedAt!=='string'||!Number.isFinite(Date.parse(r.savedAt)))throw new SavedError('Saved listing reference is invalid.');ids.add(r.listingId);const listing=r.listing===null?null:parseSearchListing(r.listing);if(listing&&listing.listingId!==r.listingId)throw new SavedError('Saved listing reference changed.');return{listingId:r.listingId,savedAt:r.savedAt,listing};});return{count:Number(p.count),rows};
}
export function parseSavedStates(value:unknown,ids:readonly string[]){if(!Array.isArray(value)||value.length!==new Set(ids).size)throw new SavedError('Saved status could not load.');const result:Record<string,boolean>={};for(const r of value){if(!r||!ids.includes(r.listingId)||typeof r.saved!=='boolean'||Object.hasOwn(result,r.listingId))throw new SavedError('Saved status could not load.');result[r.listingId]=r.saved;}return result;}
