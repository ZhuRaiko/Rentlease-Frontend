import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {manualSearchService} from '../services/manualSearchDependencies';
import {createManualSearchWorkflow} from './manualSearchWorkflow';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
import {publicIdentityLabel} from '../../../shared/models/PublicIdentity';
/** Existing detail workflow only: no Discover feed, GPS, or duplicate backend. */
export function useListingDetailViewModel(owner:string|undefined,id:string,onBack:()=>void){
 const manual=useMemo(()=>createManualSearchWorkflow(manualSearchService),[owner,id]);
 const manualState=useSyncExternalStore(manual.subscribe,manual.getSnapshot,manual.getSnapshot);
 const identities=usePublicIdentitiesViewModel(owner,manualState.detail?[manualState.detail.ownerId]:[]);
 useEffect(()=>{manual.activate();void manual.openDetail(id);return()=>manual.dispose();},[manual,id]);
 const listingOwnerIdentity=manualState.detail?identities[manualState.detail.ownerId]:undefined;
 return{manual,manualState,goBack:onBack,isOwnListing:!!manualState.detail&&manualState.detail.ownerId===owner,listingOwnerIdentity,listingOwnerLabel:publicIdentityLabel(listingOwnerIdentity,'owner')};
}
