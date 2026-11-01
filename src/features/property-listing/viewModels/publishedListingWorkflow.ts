import {createListingDraftWorkflow} from './listingDraftWorkflow';
import type {PublishedListingService} from '../services/publishedListingService';
import type {SavedListingDraft} from '../models/PersistedListingDraft';
export function createPublishedListingWorkflow(service:PublishedListingService,onConfirmed:(row:SavedListingDraft,source:'load'|'save'|'adopt')=>void,canWrite=()=>true){return createListingDraftWorkflow(service,onConfirmed,canWrite,'published');}
