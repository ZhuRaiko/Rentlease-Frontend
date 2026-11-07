import type {PublicPropertyPhoto} from '../../../shared/models/PropertyMediaPath';
export interface ConversationProperty {listingId:string;propertyId:string;title:string;photos:PublicPropertyPhoto[];canViewListing:boolean;availability:string|null;photoError:boolean}
export function propertyAvailability(status:string,active:boolean,published:boolean,date:string|null,today:string,owner:boolean,rented:boolean,reserved:boolean,complete:boolean){
 if(rented)return 'Rented';
 if(reserved)return 'Reservation approved';
 if(status==='paused')return 'Paused';if(status==='archived')return 'Archived';
 if(!active||!published||status!=='active')return 'Unavailable';
 if(date&&date>today)return 'Available from '+date;
 // Only an actual owner can establish absence of all unit commitments from
 // complete participant-scoped results. A renter cannot see others' holds.
 return owner&&complete?'Available':null;
}
