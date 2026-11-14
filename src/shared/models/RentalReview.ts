import {isUuid} from '../../features/messaging-viewing/models/PersistentMessaging';
export type ReviewKind='property'|'user';export type ReviewStatus='pending'|'approved'|'rejected'|'hidden';
export interface ReviewRow {id:string;kind:ReviewKind;rating:number;text:string|null;revision:string;createdAt:string;status:ReviewStatus;propertyId:string|null;updatedAt:string|null;moderatedAt:string|null;history:{action:string;note:string|null;createdAt:string}[]}
export interface ReviewContext {tenancyId:string;propertyId:string;tenantId:string;landlordId:string;eligible:boolean;own:ReviewRow[];legacyUserReview:boolean}
export interface PublishedReviews {kind:ReviewKind;targetId:string;count:number;average:number|null;rows:ReviewRow[]}
export type ReviewScope={mode:'tenancy'|'property'|'user';id:string}|{mode:'moderation';status:ReviewStatus}|{mode:'tenancies'};
export type ReviewData={type:'context';value:ReviewContext}|{type:'public';value:PublishedReviews}|{type:'queue';rows:ReviewRow[]}|{type:'tenancies';rows:{id:string;title:string;ended:string}[]};
export type ReviewOperation={operationId:string;action:'submit';tenancyId:string;kind:ReviewKind;rating:number;text:string|null}|{operationId:string;action:'moderate';reviewId:string;revision:string;status:Exclude<ReviewStatus,'pending'>;note:string};
export class ReviewError extends Error{constructor(message:string,readonly uncertain=false,readonly definitive=false){super(message);}}
export const reviewStatuses:ReviewStatus[]=['pending','approved','rejected','hidden'];
export function reviewScopeKey(s:ReviewScope){return s.mode==='moderation'||s.mode==='tenancies'?s.mode:s.mode+':'+s.id;}
const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new ReviewError('Review response could not be verified.');return v as Record<string,unknown>;};
const string=(v:unknown,max=2000)=>{if(typeof v!=='string'||v.length>max)throw new ReviewError('Review text could not be verified.');return v;};
const uuid=(v:unknown)=>{const s=string(v,36);if(!isUuid(s))throw new ReviewError('Review binding could not be verified.');return s;};
const stamp=(v:unknown)=>{const s=string(v,50);if(!Number.isFinite(Date.parse(s)))throw new ReviewError('Review timestamp could not be verified.');return s;};
const arr=(v:unknown,max:number)=>{if(!Array.isArray(v)||v.length>max)throw new ReviewError('Review page could not be verified.');return v;};
function row(v:unknown,kind?:ReviewKind,state?:ReviewStatus):ReviewRow{const r=obj(v),k=kind??r.kind,s=state??r.status;if(!['property','user'].includes(String(k))||!reviewStatuses.includes(s as ReviewStatus)||typeof r.rating!=='number'||!Number.isInteger(r.rating)||r.rating<1||r.rating>5)throw new ReviewError('Review state/rating is invalid.');return{id:uuid(r.id),kind:k as ReviewKind,status:s as ReviewStatus,rating:r.rating,text:r.text===null?null:string(r.text),revision:uuid(r.revision),createdAt:stamp(r.createdAt),propertyId:r.propertyId==null?null:uuid(r.propertyId),updatedAt:r.updatedAt==null?null:stamp(r.updatedAt),moderatedAt:r.moderatedAt==null?null:stamp(r.moderatedAt),history:r.history===undefined?[]:arr(r.history,20).map(v=>{const h=obj(v);return{action:string(h.action,40),note:h.note===null?null:string(h.note,1000),createdAt:stamp(h.createdAt)};})};}
export function parseReviewContext(v:unknown,actor:string,id:string):ReviewContext{const r=obj(v);if(r.tenancyId!==id||!isUuid(actor)||![r.tenantId,r.landlordId].includes(actor)||r.tenantId===r.landlordId||typeof r.eligible!=='boolean'||typeof r.legacyUserReview!=='boolean')throw new ReviewError('Review eligibility could not be verified.');return{tenancyId:uuid(r.tenancyId),propertyId:uuid(r.propertyId),tenantId:uuid(r.tenantId),landlordId:uuid(r.landlordId),eligible:r.eligible,own:arr(r.own,2).map(v=>row(v)),legacyUserReview:r.legacyUserReview};}
export function parsePublishedReviews(v:unknown,kind:ReviewKind,target:string):PublishedReviews{const r=obj(v);if(r.kind!==kind||r.targetId!==target||typeof r.count!=='number'||!Number.isSafeInteger(r.count)||r.count<0||(r.count===0?r.average!==null:typeof r.average!=='number'||!Number.isFinite(r.average)||r.average<1||r.average>5))throw new ReviewError('Published review summary is invalid.');const rows=arr(r.rows,20).map(v=>row(v,kind,'approved'));if(rows.some(r=>kind==='property'&&r.propertyId!==target))throw new ReviewError('Property review binding changed.');return{kind,targetId:uuid(r.targetId),count:r.count,average:r.average as number|null,rows};}
export function parseModeration(v:unknown){return arr(v,20).map(v=>row(v));}
export function reviewTargets(c:ReviewContext,actor:string):ReviewKind[]{if(!c.eligible||![c.tenantId,c.landlordId].includes(actor))return[];return (actor===c.tenantId?['property','user'] as ReviewKind[]:['user'] as ReviewKind[]).filter(k=>!c.own.some(r=>r.kind===k)&&!(k==='user'&&c.legacyUserReview));}
export function validateReviewOperation(op:ReviewOperation){if(!['submit','moderate'].includes(op.action))throw new ReviewError('Invalid review action.');uuid(op.operationId);if(op.action==='submit'){uuid(op.tenancyId);if(!['property','user'].includes(op.kind)||!Number.isInteger(op.rating)||op.rating<1||op.rating>5||(op.text!==null&&typeof op.text!=='string')||(op.text?.length??0)>2000)throw new ReviewError('Choose 1-5 stars and write at most 2,000 characters.');}else{uuid(op.reviewId);uuid(op.revision);if(!['approved','rejected','hidden'].includes(op.status)||!op.note.trim()||op.note.trim().length>1000)throw new ReviewError('Enter a moderation note (1-1,000 characters).');}}

// ---- Split reviews (decision D1): the tenant reviews the property, the landlord rates the tenant.
export const REVIEW_SUBMITTED_NOTICE = 'Thanks. Your review will appear once it has been checked.';
export const REVIEW_NOT_ELIGIBLE_FALLBACK = 'You can review once the tenancy has ended.';

export interface ReviewScreen {
  role: 'tenant' | 'landlord';
  /** The ONE kind this person may submit here. The tenant is never offered a rating of the landlord. */
  kind: ReviewKind;
  title: string;
  helper: string;
  state: 'form' | 'reviewed' | 'not_eligible' | 'legacy';
  /** The person's own review of that kind, shown read-only. */
  own: ReviewRow | null;
  /** Any other reviews they already sent in this tenancy (for example an earlier rating of the landlord), also read-only. */
  earlier: ReviewRow[];
}

/** Who sees which screen, and in which state. Pure: everything comes from the already-loaded review context. */
export function reviewScreenFor(c: ReviewContext, actor: string): ReviewScreen | null {
  if (actor !== c.tenantId && actor !== c.landlordId) return null;
  const tenant = actor === c.tenantId, kind: ReviewKind = tenant ? 'property' : 'user';
  const own = c.own.find(r => r.kind === kind) ?? null;
  const state: ReviewScreen['state'] = own ? 'reviewed' : !c.eligible ? 'not_eligible' : !tenant && c.legacyUserReview ? 'legacy' : 'form';
  return {
    role: tenant ? 'tenant' : 'landlord', kind, state, own, earlier: c.own.filter(r => r.kind !== kind),
    title: tenant ? 'Review the property' : 'Rate your tenant',
    helper: tenant ? "Appears on the property's reviews after it has been checked." : "Appears on this tenant's profile.",
  };
}

const manilaToday = (now: number) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
/** "You can review after <date>" when the tenancy's end date is still ahead (Manila time), otherwise the plain fallback. */
export function reviewNotEligibleText(endDate: string | null | undefined, now: number = Date.now()): string {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < manilaToday(now)) return REVIEW_NOT_ELIGIBLE_FALLBACK;
  return `You can review after ${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${endDate}T00:00:00Z`))}.`;
}

/** What the person is told about a review they already sent. */
export const reviewStatusLabel = (status: ReviewStatus): string => status === 'pending' ? 'Waiting to be checked' : status === 'approved' ? 'Published' : 'Not published';

/** Plain text for a refused submit; anything else keeps the existing generic message. */
export function reviewSubmitErrorText(error: { message?: string | null | undefined }): string {
  const m = (error.message ?? '').toLowerCase();
  if (m.includes('completed tenancy required')) return REVIEW_NOT_ELIGIBLE_FALLBACK;
  if (m.includes('actual tenant required')) return 'Only the tenant can review the property.';
  return 'Review already exists, changed, or this action is unavailable. Refresh.';
}

export const LANDLORD_EXPERIENCE_TITLE = "Landlord's experience with this user";
export interface LandlordExperience { title: string; average: string; countLabel: string; rows: ReviewRow[] }
/** The profile section. Null (hidden) when there is no published review. Rows carry no reviewer identity, so none is shown. */
export function landlordExperienceView(d: PublishedReviews | null | undefined, limit = 3): LandlordExperience | null {
  if (!d || d.kind !== 'user' || d.count <= 0 || d.average === null || d.rows.length === 0) return null;
  const rows = [...d.rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit);
  return { title: LANDLORD_EXPERIENCE_TITLE, average: `${d.average.toFixed(1)} / 5`, countLabel: `${d.count} ${d.count === 1 ? 'review' : 'reviews'}`, rows };
}
