export interface Conversation {id:string;listingId:string;listingTitle:string|null;tenantId:string;landlordId:string;participantName:string|null;status:string;activityAt:string;latestBody:string|null;latestType:string|null}
export interface PersistentMessage {id:string;conversationId:string;senderId:string;body:string|null;type:string;createdAt:string;deleted:boolean}
export class MessagingError extends Error {constructor(message:string,readonly identity=false,readonly uncertain=false){super(message);this.name='MessagingError';}}
export const isUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validateMessage(body:string):string {const text=body.trim();if(!text||[...text].length>4000)throw new MessagingError('Enter a message of 1 to 4,000 characters.');return text;}
export function messageTime(value:string){return new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
