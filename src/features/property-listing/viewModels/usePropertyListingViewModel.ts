import {createUnfinishedPostWorkflow} from './unfinishedPostWorkflow';
import {unfinishedPostService} from '../services/unfinishedPostDependencies';
import type {PredictionReceipt} from '../../../shared/models/RentalPrediction';
import {propertyMeasurementWarnings} from '../../../shared/models/PropertyMeasurementQuality';
import {createPropertyIdentityWorkflow} from './propertyIdentityWorkflow';
import {propertyIdentityService} from '../services/propertyIdentityDependencies';
import {createPropertyRoutineWorkflow} from './propertyRoutineWorkflow';
import {propertyRoutineService} from '../services/propertyRoutineDependencies';
import type {PropertyEditContext} from '../models/PropertyRoutineEdit';
import {createPublishedListingWorkflow} from './publishedListingWorkflow';
import {publishedListingService} from '../services/publishedListingDependencies';
import { measureHydration, traceHydration } from '../services/draftHydrationDiagnostics';
import {canReviewPortfolioPublication} from '../models/PropertyVerificationPresentation';
import {createPropertyVerificationEntry} from './propertyVerificationEntryWorkflow';
import {propertyVerificationService} from '../services/propertyVerificationDependencies';
import { createPropertyAmenityWorkflow } from './propertyAmenityWorkflow';
import { propertyAmenityService } from '../services/propertyAmenityDependencies';
import { togglePropertyAmenity } from '../models/PropertyAmenity';
import { listingCompleteness } from '../models/ListingCompleteness';
import { availabilityDateToLocal } from '../models/AvailabilityDate';
import { propertyMediaItems } from '../models/PropertyMedia';
import { createLandlordPortfolioWorkflow } from './landlordPortfolioWorkflow';
import { landlordPortfolioService } from '../services/landlordPortfolioDependencies';
import { portfolioTierLabels, type LandlordPortfolioItem } from '../models/LandlordPortfolio';
import { createPropertyLocationWorkflow } from './propertyLocationWorkflow';
import { propertyLocationService } from '../services/propertyLocationDependencies';
import { propertySectionLabels, propertyValidationIssues, type PropertyValidationIssue, propertyFloorIssues, hasConfirmedPropertyLocation, propertyTypeOptions, propertyCityOptions, furnishingOptions, isPropertyUuid } from '../models/DraftProperty';
import { propertyAddressQuery } from '../models/PropertyLocationConfirmation';
import { createListingLifecycleWorkflow } from './listingLifecycleWorkflow';
import { listingLifecycleService } from '../services/listingLifecycleDependencies';
import { lifecycleActions, lifecycleLabel, lifecycleStatusLabel } from '../models/ListingLifecycle';
import { createListingPublicationWorkflow } from './listingPublicationWorkflow';
import { listingPublicationService } from '../services/listingPublicationDependencies';
import { publicationEligibility, publicationReviewSummary } from '../models/ListingPublication';
import { createListingDraftWorkflow } from './listingDraftWorkflow';
import { listingDraftService } from '../services/listingDraftDependencies';
import { applySavedListing, listingFieldsEqual, hasListingMinimum, listingNumber, listingFieldIssue } from '../models/PersistedListingDraft';
import { createPropertyPhotoWorkflow } from './propertyPhotoWorkflow';
import { propertyPhotoService, selectPropertyPhoto, selectPropertyPhotos } from '../services/propertyPhotoDependencies';
import { createPropertyCreationWorkflow } from './propertyCreationWorkflow';
import { propertyCreationService } from '../services/propertyCreationDependencies';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigationConfirmation } from '../../../shared/viewModels/useNavigationConfirmation';
import { leavesListingEditor, listingActiveTab } from '../models/listingNavigation';

import {
  emptyListingDraft,
  figmaPreviewDraft,
  initialPreviewListing,
  landlordListingPreviews,
  requiredListingFields,
  type Amenity,
  type ListingDraft,
  type ListingScreen,
  type ListingStatus,
  type PropertyListingSummary,
  type PropertyRule,
  type PropertyType,
} from '../models/PropertyListing';

type CounterField = 'bedrooms' | 'bathrooms' | 'parkingSpaces';

export function usePropertyListingViewModel(initialScreen: ListingScreen = 'dashboard') {
  type Workspace = { propertyId: string | null; listingId: string | null; mode: 'none' | 'create' | 'compose' | 'manage' | 'editPublished'; item: LandlordPortfolioItem | null };
  const [workspace, setWorkspace] = useState<Workspace>({ propertyId: null, listingId: null, mode: initialScreen === 'postingType' ? 'create' : 'none', item: null });
  const [unfinishedPost]=useState(()=>createUnfinishedPostWorkflow(unfinishedPostService,id=>{
    if(workspaceRef.current.propertyId===id){detachWorkspace();setHistory([]);setScreen('dashboard');}
    portfolio.invalidate();setNotice('Unfinished post deleted.');
  }));
  const unfinishedPostState=useSyncExternalStore(unfinishedPost.subscribe,unfinishedPost.getSnapshot);
  useEffect(()=>{unfinishedPost.activate();return()=>unfinishedPost.dispose();},[unfinishedPost]);

  const [workspaceEpoch,setWorkspaceEpoch]=useState(0);
  const [hydrationInitialized,setHydrationInitialized]=useState(-1);
  const hydrationReady=useRef(-1),hydrationStarted=useRef(0);
  const [hydrationDeadline,setHydrationDeadline]=useState<number|null>(null);
  const workspaceRef = useRef(workspace), workspaceGeneration = useRef(0);
  const pendingPortfolioReview=useRef<{propertyId:string;listingId:string;generation:number}|null>(null);
  const selectWorkspace = (next: Workspace) => { propertyRoutine.close(); propertyIdentity.close(); setEditedProperty(null); pendingPortfolioReview.current=null; propertyVerification.setProperty(next.propertyId); workspaceGeneration.current++; hydrationStarted.current=Date.now();setHydrationDeadline(null);setWorkspaceEpoch(workspaceGeneration.current); workspaceRef.current = next; setWorkspace(next); };
  const [editedProperty,setEditedProperty]=useState<PropertyEditContext|null>(null);
  const [propertyRoutine]=useState(()=>createPropertyRoutineWorkflow(propertyRoutineService,row=>{
    if(!active.current||workspaceRef.current.propertyId!==row.property_id)return;
    setEditedProperty(row);portfolio.invalidate();
    propertyAmenities.setProperty(null);propertyAmenities.setProperty(row.property_id);void propertyAmenities.load();
    void publication.restore(workspaceRef.current.listingId);
  }));
  const [propertyIdentity]=useState(()=>createPropertyIdentityWorkflow(propertyIdentityService,propertyLocationService,()=>{portfolio.invalidate();void propertyVerification.refresh();}));
  const propertyIdentityState=useSyncExternalStore(propertyIdentity.subscribe,propertyIdentity.getSnapshot);
  const identityLocationState=useSyncExternalStore(propertyIdentity.location.subscribe,propertyIdentity.location.getSnapshot);
  useEffect(()=>{propertyIdentity.activate();return()=>propertyIdentity.dispose();},[propertyIdentity]);
  const propertyRoutineState=useSyncExternalStore(propertyRoutine.subscribe,propertyRoutine.getSnapshot);
  useEffect(()=>{propertyRoutine.activate();return()=>propertyRoutine.dispose();},[propertyRoutine]);
  useEffect(()=>{const c=propertyRoutineState.context;if(c&&c.property_id===workspaceRef.current.propertyId)setEditedProperty(c);},[propertyRoutineState.context]);
  const [portfolio] = useState(() => createLandlordPortfolioWorkflow(landlordPortfolioService));
  const portfolioState = useSyncExternalStore(portfolio.subscribe, portfolio.getSnapshot);
  useEffect(() => { portfolio.activate(); return () => portfolio.dispose(); }, [portfolio]);
  const [propertyValidationTarget,setPropertyValidationTarget]=useState<(PropertyValidationIssue & {requestId:number})|null>(null);
  const validationRequest=useRef(0);
  const composerSaving = useRef(false);
  const savedConfirmation = useRef<{propertyId:string;listingId:string;generation:number}|null>(null);
  const [composerPhase, setComposerPhase] = useState<'property' | 'photos' | 'draft' | null>(null);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [propertyVerification] = useState<ReturnType<typeof createPropertyVerificationEntry>>(()=>createPropertyVerificationEntry(propertyVerificationService,()=>!operationBusy()));
  const propertyVerificationState=useSyncExternalStore(propertyVerification.subscribe,propertyVerification.getSnapshot);
  useEffect(()=>{propertyVerification.activate();return()=>propertyVerification.dispose();},[propertyVerification]);
  const [showRealPublication, setShowRealPublication] = useState(false);
  const [screen, setScreen] = useState<ListingScreen>(initialScreen);
  useEffect(()=>{propertyVerification.setProperty(workspace.propertyId);if(['listingDetails','publishConfirmation'].includes(screen))void measureHydration('verification',()=>propertyVerification.refresh(),workspaceEpoch);},[propertyVerification,workspace.propertyId,screen]);
  const [history, setHistory] = useState<ListingScreen[]>([]);
  const [draft, setDraft] = useState<ListingDraft>(emptyListingDraft);
  const savedDraft = useRef(draft);
  const [propertyAmenities] = useState(() => createPropertyAmenityWorkflow(propertyAmenityService));
  const amenityState = useSyncExternalStore(propertyAmenities.subscribe, propertyAmenities.getSnapshot);
  useEffect(() => { propertyAmenities.activate(); return () => propertyAmenities.dispose(); }, [propertyAmenities]);
  useEffect(() => { propertyAmenities.setProperty(workspace.propertyId); if (['listingComposer','listingDetails','preview','propertySetup'].includes(screen) && !propertyAmenities.getSnapshot().loaded) void measureHydration('amenities',()=>propertyAmenities.load().then(()=>!propertyAmenities.getSnapshot().error),workspaceEpoch); }, [propertyAmenities,workspace.propertyId,screen,workspaceEpoch]);
  const [propertyCreation] = useState(() => createPropertyCreationWorkflow(propertyCreationService));
  const propertyState = useSyncExternalStore(propertyCreation.subscribe, propertyCreation.getSnapshot);
  useEffect(()=>{setPropertyValidationTarget(null);},[propertyState.draft]);
  useEffect(() => { propertyCreation.activate(); return () => propertyCreation.dispose(); }, [propertyCreation]);
  useEffect(() => { if (screen === 'propertySetup' && !propertyState.loaded && !propertyState.uncertain) void propertyCreation.initialize(); }, [propertyCreation, screen]);
  useEffect(() => { if (screen === 'listingComposer' && workspace.mode === 'create' && !propertyCreation.getSnapshot().loaded && !propertyCreation.getSnapshot().uncertain) void propertyCreation.startNew(); }, [screen, propertyCreation]);
  const [propertyLocation] = useState(() => createPropertyLocationWorkflow(propertyLocationService, (location, confirmedRevision) => {
    const current = propertyCreation.getSnapshot();
    if (!active.current || !current.loaded || current.busy || current.propertyId || current.uncertain || current.locationRevision !== confirmedRevision) return false;
    propertyCreation.provideConfirmedLocation(location, confirmedRevision);
    const accepted = propertyCreation.getSnapshot();
    return accepted.locationRevision === confirmedRevision && hasConfirmedPropertyLocation(accepted.draft)
      && accepted.draft.exactLatitude === location.exactLatitude && accepted.draft.exactLongitude === location.exactLongitude
      && accepted.draft.publicLatitude === location.publicLatitude && accepted.draft.publicLongitude === location.publicLongitude;
  },()=>propertyCreation.invalidateLocation()));
  const locationState = useSyncExternalStore(propertyLocation.subscribe, propertyLocation.getSnapshot);
  useEffect(() => { propertyLocation.activate(); return () => propertyLocation.dispose(); }, [propertyLocation]);
  useEffect(() => {
    // Synchronous subscription invalidates requests at the address-edit event, before React renders.
    const sync = () => {
      const current = propertyCreation.getSnapshot();
      propertyLocation.syncContext(current.loaded && !current.propertyId && !current.uncertain ? { addressRevision: current.locationRevision, setupId: 'physical-property-setup', query: propertyAddressQuery(current.draft) } : null);
    };
    const unsubscribe = propertyCreation.subscribe(sync); sync(); return unsubscribe;
  }, [propertyCreation, propertyLocation]);
  useEffect(() => { if (screen !== 'propertySetup' && screen !== 'listingComposer') propertyLocation.close(); }, [screen, propertyLocation]);
  const [propertyPhotos] = useState(() => createPropertyPhotoWorkflow(propertyPhotoService, selectPropertyPhoto, selectPropertyPhotos));
  const photoState = useSyncExternalStore(propertyPhotos.subscribe, propertyPhotos.getSnapshot);
  useEffect(() => { propertyPhotos.activate(); return () => propertyPhotos.dispose(); }, [propertyPhotos]);
  useEffect(() => { propertyPhotos.setProperty(workspace.propertyId, !!workspace.propertyId && workspace.item === null && propertyState.propertyId === workspace.propertyId); }, [propertyPhotos, workspace.propertyId,workspaceEpoch]);
  useEffect(() => { if (!composerSaving.current && ['photoUpload', 'photoManager', 'listingComposer', 'listingDetails', 'preview'].includes(screen) && workspace.propertyId && !propertyPhotos.getSnapshot().loaded) void measureHydration('photos',()=>propertyPhotos.load().then(()=>!propertyPhotos.getSnapshot().error),workspaceEpoch); }, [propertyPhotos, screen, workspace.propertyId,workspaceEpoch]);
  const composedProperty = useRef<string | null>(null);
  useEffect(() => {
    if (composerSaving.current || !['propertySetup', 'listingComposer'].includes(screen) || propertyState.busy || propertyState.uncertain || propertyState.step !== 'created' || !isPropertyUuid(propertyState.propertyId) || composedProperty.current === propertyState.propertyId) return;
    if (!adoptCreatedProperty()) return;
    if (hasConfirmedPropertyLocation(propertyState.draft)) { setHistory([]); setScreen('listingComposer'); }
  }, [screen, propertyState.propertyId, propertyState.step, propertyState.busy, propertyState.uncertain]);
  const [listingDraftPersistence] = useState(() => createListingDraftWorkflow(listingDraftService, (row,source) => {
    if(source==='save')portfolio.invalidate();
    const baseline=savedDraft.current;
    savedDraft.current=applySavedListing(baseline,row);
    // Capture the baseline outside the pure updater: development React may replay it.
    setDraft(current => {
      if(source==='save') return applySavedListing(current,row);
      // Initial reads must not erase rental fields entered before property save.
      // Keep the authoritative baseline separate so those edits remain guarded.
      const next=applySavedListing(current,row);
      for(const field of Object.keys(current) as (keyof ListingDraft)[]) {
        if(JSON.stringify(current[field])!==JSON.stringify(baseline[field])) Object.assign(next,{[field]:current[field]});
      }
      return next;
    });
  }, canWriteListing));
  const listingDraftState = useSyncExternalStore(listingDraftPersistence.subscribe, listingDraftPersistence.getSnapshot);
  const [publishedContent] = useState(()=>createPublishedListingWorkflow(publishedListingService,(row,source)=>{
    const baseline=savedDraft.current;savedDraft.current=applySavedListing(baseline,row);
    setDraft(current=>{const next=applySavedListing(current,row);if(source!=='save')for(const field of Object.keys(current) as (keyof ListingDraft)[])if(JSON.stringify(current[field])!==JSON.stringify(baseline[field]))Object.assign(next,{[field]:current[field]});return next;});
    if(source==='save')portfolio.invalidate();
  },()=>active.current&&workspaceRef.current.mode==='editPublished'&&!composerSaving.current));
  const publishedContentState=useSyncExternalStore(publishedContent.subscribe,publishedContent.getSnapshot);
  useEffect(()=>{publishedContent.activate();return()=>publishedContent.dispose();},[publishedContent]);
  const [publication] = useState(() => createListingPublicationWorkflow(listingPublicationService, row => {if(workspaceRef.current.mode==='editPublished')publishedContent.adoptBackendListing(row);else listingDraftPersistence.adoptBackendListing(row);}, canWriteListing));
  const publicationState = useSyncExternalStore(publication.subscribe, publication.getSnapshot);
  useEffect(() => { publication.activate(); return () => publication.dispose(); }, [publication]);
  useEffect(() => { if (listingDraftState.lastConfirmed) { if(listingDraftState.lastConfirmed.status==='draft')publication.setDraft(listingDraftState.lastConfirmed);else publication.adoptLifecycle(listingDraftState.lastConfirmed); } }, [publication, listingDraftState.lastConfirmed]);
  const [lifecycle] = useState(() => createListingLifecycleWorkflow(listingLifecycleService, row => {
    listingDraftPersistence.adoptBackendListing(row);
    publication.adoptLifecycle(row);
  }, canChangeLifecycle));
  const lifecycleState = useSyncExternalStore(lifecycle.subscribe, lifecycle.getSnapshot);
  useEffect(() => { lifecycle.activate(); return () => lifecycle.dispose(); }, [lifecycle]);
  useEffect(() => {
    if(workspaceRef.current.mode==='editPublished')return;
    const row = publicationState.lastConfirmed;
    if (row && row.status !== 'draft' && (lifecycle.getSnapshot().listingId !== row.id || lifecycle.getSnapshot().propertyId !== row.property_id)) {
      lifecycle.setListing(row); void lifecycle.restore();
    }
  }, [lifecycle, publicationState.lastConfirmed]);
  useEffect(() => { listingDraftPersistence.activate(); return () => listingDraftPersistence.dispose(); }, [listingDraftPersistence]);
  useEffect(() => {
    listingDraftPersistence.setProperty(workspace.propertyId);
    publishedContent.setProperty(workspace.mode==='editPublished'?workspace.propertyId:null);
    publication.setProperty(workspace.propertyId);
    lifecycle.setListing(null);
    if (workspace.mode!=='editPublished' && workspace.item?.currentListing && workspace.item.currentListing.status !== 'draft') { lifecycle.setListing(workspace.item.currentListing); void lifecycle.restore(); }
    const token = workspaceGeneration.current;
    if (composerSaving.current) return;
    if (workspace.propertyId) void measureHydration('publication_lookup',()=>publication.restore(workspace.propertyId ? workspace.listingId : null),workspaceEpoch).then(ok => {
      const current = publication.getSnapshot();
      if(ok&&active.current&&token===workspaceGeneration.current&&workspaceRef.current.mode==='editPublished'&&current.lastConfirmed){return publishedContent.initializeFromSnapshot(current.lastConfirmed).then(()=>{if(active.current&&token===workspaceGeneration.current)setHydrationInitialized(token);});}
      if (ok && active.current && token === workspaceGeneration.current && current.propertyId === workspace.propertyId && (!current.status || current.status === 'draft') && !current.uncertain) {if(current.lastConfirmed?.status==='draft')return listingDraftPersistence.initializeFromSnapshot(current.lastConfirmed).then(()=>{if(active.current&&token===workspaceGeneration.current)setHydrationInitialized(token);});else return listingDraftPersistence.load(false, workspace.listingId).then(()=>{if(active.current&&token===workspaceGeneration.current)setHydrationInitialized(token);});}
      if(active.current&&token===workspaceGeneration.current)setHydrationInitialized(token);
    });
  }, [listingDraftPersistence, publication, lifecycle, workspace.propertyId, workspace.listingId,workspaceEpoch]);
  useEffect(() => { if (screen === 'dashboard' || screen === 'empty') void portfolio.load(); }, [screen, portfolio]);
  useEffect(() => {
    if(!workspace.propertyId||workspace.item||propertyState.draft.propertyType)return;
    const item=portfolioState.items.find(item=>item.propertyId===workspace.propertyId);
    if(item){const next={...workspaceRef.current,item};workspaceRef.current=next;setWorkspace(next);}
    else if(!portfolioState.loaded&&!portfolioState.busy&&!portfolioState.error)void portfolio.load();
  },[workspace.propertyId,workspace.item,propertyState.draft.propertyType,portfolioState.items,portfolioState.loaded,portfolioState.busy,portfolioState.error]);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const operationBusy = ():boolean => unfinishedPost.getSnapshot().busy || propertyIdentity.getSnapshot().busy || propertyRoutine.getSnapshot().busy || publishedContent.getSnapshot().busy || !active.current || propertyVerification.getSnapshot().opening || !!propertyVerification.getSnapshot().entryPropertyId || composerSaving.current || propertyCreation.getSnapshot().busy || propertyPhotos.getSnapshot().busy || listingDraftPersistence.getSnapshot().busy || publication.getSnapshot().busy || lifecycle.getSnapshot().busy;
  const deletedWorkspace=()=>{const status=unfinishedPost.getSnapshot().status;return !!workspaceRef.current.propertyId&&status?.propertyId===workspaceRef.current.propertyId&&status.state!=='live';};
  function canWriteListing(): boolean {
    if(deletedWorkspace())return false;
    const current = lifecycle.getSnapshot();
    return active.current && propertyRoutine.getSnapshot().status==='idle' && !propertyRoutine.getSnapshot().busy && workspaceRef.current.item?.property.is_active !== false && !current.busy && !current.uncertain && current.loaded && (!current.row || current.row.status === 'draft');
  }
  function canChangeLifecycle(): boolean {
    if(deletedWorkspace())return false;
    return active.current && propertyRoutine.getSnapshot().status==='idle' && !propertyRoutine.getSnapshot().busy && !propertyCreation.getSnapshot().busy && !propertyPhotos.getSnapshot().busy && !listingDraftPersistence.getSnapshot().busy && !listingDraftPersistence.getSnapshot().uncertain && !publication.getSnapshot().busy && !publication.getSnapshot().uncertain;
  }
  const publicationReadOnly = () => workspaceRef.current.mode==='editPublished'? !publishedContent.getSnapshot().loaded||publishedContent.getSnapshot().uncertain||!['active','paused'].includes(publishedContent.getSnapshot().lastConfirmed?.status??'') : !!workspaceRef.current.propertyId && (!canWriteListing() || !publication.getSnapshot().loaded || publication.getSnapshot().uncertain || (!!publication.getSnapshot().status && publication.getSnapshot().status !== 'draft'));
  const editingPublished=workspace.mode==='editPublished';
  const contentState=editingPublished?publishedContentState:listingDraftState;
  const savedDraftEntry=editingPublished||workspace.mode==='compose'&&workspace.item?.currentListing?.status==='draft'&&!!workspace.listingId;
  const hydrationFailure=savedDraftEntry?(hydrationDeadline===workspaceEpoch?'Saved details are taking too long to load. Retry or return to My Rentals.':publicationState.error || (contentState.errorSource==='load'?contentState.error:null) || (!photoState.loaded?photoState.error:null) || amenityState.error):null;
  const hydrationLoaded=hydrationInitialized===workspaceEpoch&&!!savedDraftEntry&&photoState.propertyId===workspace.propertyId&&amenityState.propertyId===workspace.propertyId&&publicationState.propertyId===workspace.propertyId&&publicationState.loaded&&!publicationState.busy&&contentState.loaded&&!contentState.busy&&!contentState.uncertain&&contentState.lastConfirmed?.id===workspace.listingId&&photoState.loaded&&!photoState.busy&&amenityState.loaded&&!amenityState.busy;
  const draftHydration={status:!savedDraftEntry?'idle' as const:hydrationReady.current===workspaceEpoch?'ready' as const:hydrationFailure?'error' as const:hydrationLoaded?'ready' as const:'loading' as const,error:hydrationFailure};
  useEffect(()=>{
    if(!savedDraftEntry)return;
    if(draftHydration.status==='ready'){if(hydrationReady.current!==workspaceEpoch)traceHydration({stage:'total',request:workspaceEpoch,durationMs:Date.now()-hydrationStarted.current,result:'success',code:'none'});hydrationReady.current=workspaceEpoch;return;}
    if(draftHydration.status==='error'){traceHydration({stage:'total',request:workspaceEpoch,durationMs:Date.now()-hydrationStarted.current,result:'error',code:'unknown'});return;}
    if(draftHydration.status==='loading'){const timer=setTimeout(()=>setHydrationDeadline(workspaceEpoch),30000);return()=>clearTimeout(timer);}
  },[workspaceEpoch,draftHydration.status,savedDraftEntry]);
  const initialHydrationPending=()=>(workspaceRef.current.mode==='editPublished'||workspaceRef.current.mode==='compose'&&workspaceRef.current.item?.currentListing?.status==='draft')&&hydrationReady.current!==workspaceGeneration.current;
  const leaveInitialHydration=()=>{if(!initialHydrationPending())return false;if(workspaceRef.current.mode==='editPublished'&&history.at(-1)==='published'){returnToManagedListing();return true;}traceHydration({stage:'total',request:workspaceGeneration.current,durationMs:Date.now()-hydrationStarted.current,result:'cancelled',code:'none'});detachWorkspace();propertyAmenities.setProperty(null);setHistory([]);setScreen('dashboard');return true;};
  const displayDraft = workspace.propertyId ? { ...draft, photoCount: photoState.photos.length, coverPhotoIndex: Math.max(0, photoState.photos.findIndex(p => p.is_cover)) } : draft;
  const listingDraftDirty = contentState.lastConfirmed ? !listingFieldsEqual(draft,savedDraft.current) : JSON.stringify(draft) !== JSON.stringify(savedDraft.current);
  const navigationScope=useRef<'workspace'|'propertyReturn'>('workspace');
  const navigation = useNavigationConfirmation(() => navigationScope.current==='propertyReturn'?(propertyIdentity.dirty()||propertyRoutine.dirty()):propertyIdentity.dirty() || propertyRoutine.dirty() || listingDraftDirty || ((workspaceRef.current.mode === 'create' || ['propertySetup', 'postingType'].includes(screen)) && propertyCreation.dirty()) || propertyPhotos.dirty());
  const [listing, setListing] = useState<PropertyListingSummary>(initialPreviewListing);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [listingQuery, setListingQuery] = useState('');

  const missingRequirements = useMemo(
    () => requiredListingFields.filter((requirement) => requirement.isMissing(displayDraft)),
    [draft, workspace.propertyId, photoState.photos],
  );

  const filteredListingPreviews = useMemo(() => {
    const query = listingQuery.trim().toLocaleLowerCase();
    if (!query) return landlordListingPreviews;
    return landlordListingPreviews.filter(
      (item) =>
        item.title.toLocaleLowerCase().includes(query) ||
        item.address.toLocaleLowerCase().includes(query) ||
        item.unitCode.toLocaleLowerCase().includes(query),
    );
  }, [listingQuery]);

  // Query workflow dirty state at the exit event, not only at the last React render.
  const requestNavigation = (action: () => void, detach = false) => {
    if(active.current&&initialHydrationPending()){leaveInitialHydration();action();return;}
    if (!active.current || propertyVerification.getSnapshot().entryPropertyId || propertyCreation.getSnapshot().busy || (!detach && operationBusy())) return;
    if (!detach && lifecycle.getSnapshot().confirmation) { lifecycle.cancel(); return; }
    navigationScope.current='workspace';
    navigation.requestNavigation(() => {
      if (!active.current || propertyCreation.getSnapshot().busy || (!detach && operationBusy())) return;
      propertyLocation.close();
      propertyCreation.discardLocalEdits();
      propertyPhotos.discardLocalEdits();
      propertyRoutine.discard();
      propertyRoutine.close();propertyIdentity.discard();propertyIdentity.close();
      setDraft(savedDraft.current);
      action();
    });
  };

  const requestPropertyNavigation=(action:()=>void)=>{
    if(!active.current||operationBusy())return;
    navigationScope.current='propertyReturn';
    navigation.requestNavigation(()=>{
      if(!active.current||operationBusy())return;
      propertyRoutine.discard();propertyRoutine.close();propertyIdentity.discard();propertyIdentity.close();navigationScope.current='workspace';action();
    });
  };

  // Bind the confirmed receipt at the interaction boundary as well as the
  // render effect. A fast tap must not reach photos with a null workspace ID.
  function adoptCreatedProperty() {
    const created=propertyCreation.getSnapshot(), current=workspaceRef.current;
    if(!active.current||created.busy||created.uncertain||created.step!=='created'||!isPropertyUuid(created.propertyId))return false;
    if(current.propertyId)return current.propertyId===created.propertyId;
    composedProperty.current=created.propertyId;
    propertyPhotos.setProperty(created.propertyId,true);
    listingDraftPersistence.setProperty(created.propertyId);publication.setProperty(created.propertyId);lifecycle.setListing(null);
    selectWorkspace({propertyId:created.propertyId,listingId:null,mode:'compose',item:null});
    portfolio.invalidate();return true;
  }

  const navigate = (nextScreen: ListingScreen) => {
    if (initialHydrationPending() || operationBusy() || propertyRoutine.getSnapshot().status==='loading') return;
    if(['photoUpload','photoManager','listingComposer','listingDetails'].includes(nextScreen))adoptCreatedProperty();
    if (screen === 'propertySetup' && nextScreen !== 'propertySetup') propertyLocation.close();
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    if(unfinishedPost.getSnapshot().confirming){unfinishedPost.cancel();return;}
    if(leaveInitialHydration())return;
    if (propertyPhotos.getSnapshot().mediaViewerOpen) { propertyPhotos.closeMedia(); return; }
    if (operationBusy()) return;
    if(screen==='identityEdit'){if(['searching','candidates','map'].includes(propertyIdentity.location.getSnapshot().stage)){propertyIdentity.location.cancel();return;}const id=workspaceRef.current.propertyId;requestPropertyNavigation(()=>{setHistory(current=>current.slice(0,-1));setScreen('propertyEdit');if(id)void propertyRoutine.open(id);});return;}
    if(screen==='propertyEdit'){requestPropertyNavigation(()=>{setHistory(current=>{setScreen(current.at(-1)??'dashboard');return current.slice(0,-1);});});return;}
    if(screen==='listingDetails'&&workspaceRef.current.mode==='editPublished'){requestNavigation(history.at(-1)==='published'?returnToManagedListing:goDashboard);return;}
    if (screen === 'listingDetails') { setScreen('listingComposer'); setHistory(current => current.at(-1) === 'listingComposer' ? current.slice(0, -1) : current); return; }
    if (lifecycle.getSnapshot().confirmation) { lifecycle.cancel(); return; }
    if (['propertySetup', 'listingComposer'].includes(screen) && ['searching', 'candidates', 'map'].includes(propertyLocation.getSnapshot().stage)) { propertyLocation.cancel(); return; }
    if (['photoUpload', 'photoManager', 'listingComposer'].includes(screen) && propertyPhotos.back()) return;
    if (screen === 'propertySetup') { if (propertyCreation.back()) return; propertyLocation.close(); }
    const applyBack = () => {
      setHistory((current) => {
        const previous = current.at(-1) ?? 'dashboard';
        setScreen(previous);
        return current.slice(0, -1);
      });
      setNotice(null);
      if(screen==='photoManager' && workspaceRef.current.propertyId){portfolio.invalidate();if(workspaceRef.current.mode==='manage')void lifecycle.restore();}
    };
    if (leavesListingEditor(screen, history.at(-1) ?? 'dashboard')) requestNavigation(applyBack);
    else applyBack();
  };

  const goDashboard = () => {
    if(leaveInitialHydration())return;
    savedConfirmation.current = null;
    setHistory([]);
    setScreen('dashboard');
    setNotice(null);
    setIsEditing(false);
  };

  const updateDraft = <TField extends keyof ListingDraft>(
    field: TField,
    value: ListingDraft[TField],
  ) => {
    if (initialHydrationPending() || operationBusy() || publicationReadOnly()) return;
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const detachWorkspace = () => {
    savedConfirmation.current = null;
    setPropertyValidationTarget(null);
    composerSaving.current = false; setComposerPhase(null); setComposerNotice(null);
    selectWorkspace({ propertyId: null, listingId: null, mode: 'create', item: null });
    propertyPhotos.setProperty(null); publishedContent.setProperty(null); listingDraftPersistence.setProperty(null); publication.setProperty(null); lifecycle.setListing(null);
    propertyLocation.close(); setShowRealPublication(false);
    savedDraft.current = emptyListingDraft; setDraft(emptyListingDraft); setIsEditing(false); setNotice(null);
  };
  const startCreate = (nextScreen: 'listingComposer' | 'postingType' = 'listingComposer') => {
    composerSaving.current = false; setComposerPhase(null); setComposerNotice(null);
    detachWorkspace(); setHistory([]); setScreen(nextScreen);
    void propertyCreation.startNew();
  };
  const openPortfolioItem = (propertyId: string, publishedEdit=false,fromManagement=false) => {
    savedConfirmation.current = null;
    if (!active.current) return;
    const selected=portfolio.select(propertyId);
    const managedRow=lifecycle.getSnapshot().row??publication.getSnapshot().lastConfirmed;
    const item=fromManagement&&workspaceRef.current.item&&managedRow?.property_id===propertyId?{...workspaceRef.current.item,currentListing:managedRow}:selected;if(!item)return;
    setPropertyValidationTarget(null);
    const row = item.currentListing;
    if(publishedEdit&&(!row||!['active','paused'].includes(row.status)||!item.property.is_active))return;
    composerSaving.current = false; setComposerPhase(null); setComposerNotice(null);
    propertyPhotos.setProperty(null); publishedContent.setProperty(null); propertyAmenities.setProperty(null); listingDraftPersistence.setProperty(null); publication.setProperty(null); lifecycle.setListing(null);
    selectWorkspace({ propertyId, listingId: row?.id ?? null, mode: publishedEdit?'editPublished':row && row.status !== 'draft' ? 'manage' : 'compose', item });
    savedDraft.current = emptyListingDraft; setDraft(emptyListingDraft); setNotice(null);
    setShowRealPublication(!!row && row.status !== 'draft'); setHistory(fromManagement?['dashboard','published']:['dashboard']);
    if(publishedEdit)setScreen('listingDetails');
    else if (row && row.status !== 'draft') { lifecycle.setListing(row); setScreen('published'); }
    else setScreen(row?.status === 'draft' ? 'listingDetails' : 'listingComposer');
  };

  function returnToManagedListing() {
    const current=workspaceRef.current;
    const row=publishedContent.getSnapshot().lastConfirmed??publication.getSnapshot().lastConfirmed??current.item?.currentListing;
    if(!row||!current.propertyId){goDashboard();return;}
    const physical=editedProperty;
    publishedContent.setProperty(null);
    selectWorkspace({...current,mode:'manage',item:current.item?{...current.item,currentListing:row}:null});
    setEditedProperty(physical);lifecycle.setListing(row);setShowRealPublication(true);setHistory(['dashboard']);setScreen('published');
  }

  const choosePropertyType = (propertyType: PropertyType) => updateDraft('propertyType', propertyType);

  const toggleFurnished = () => updateDraft('furnished', !draft.furnished);

  const changeCounter = (field: CounterField, delta: number) => {
    setDraft((current) => ({ ...current, [field]: Math.max(0, current[field] + delta) }));
  };

  const toggleAmenity = (amenity: Amenity) => {
    if (initialHydrationPending() || operationBusy() || publicationReadOnly()) return;
    setDraft((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

  const toggleRule = (rule: PropertyRule) => {
    if (initialHydrationPending() || operationBusy() || publicationReadOnly()) return;
    setDraft(current => {
      const lines = current.houseRules.split('\n').map(line => line.trim()).filter(Boolean);
      const houseRules = (lines.includes(rule) ? lines.filter(line => line !== rule) : [...lines, rule]).join('\n');
      return { ...current, houseRules, rules: houseRules.split('\n').filter(line => ['No smoking', 'Pets allowed', 'No loud parties', 'Visitors allowed'].includes(line)) as PropertyRule[] };
    });
  };

  const confirmPin = () => {
    setDraft((current) => ({
      ...current,
      address: current.address || figmaPreviewDraft.address,
      pinConfirmed: true,
    }));
    navigate('amenities');
  };

  const syncListingSummary = (status: ListingStatus) => {
    setListing((current) => ({
      ...current,
      title: draft.title.trim() || 'Untitled property draft',
      address: draft.address.trim() || 'Address not provided',
      rent: draft.askingRent.trim() || '0',
      status,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      landArea: draft.landArea.trim() || '0',
    }));
  };

  const showDraftSaved = () => {
    const row = listingDraftPersistence.getSnapshot().lastConfirmed;
    if (!active.current || !row || row.status !== 'draft' || row.property_id !== workspaceRef.current.propertyId || listingDraftPersistence.getSnapshot().uncertain) return;
    savedConfirmation.current = {propertyId:row.property_id,listingId:row.id,generation:workspaceGeneration.current};
    setHistory([]); setScreen('draftSaved'); setIsEditing(false);
    setComposerNotice('Listing draft saved. Nothing has been published.');
  };
  const openSavedDraft = () => {
    const receipt = savedConfirmation.current, row = listingDraftPersistence.getSnapshot().lastConfirmed;
    if (operationBusy() || !receipt || receipt.generation !== workspaceGeneration.current || receipt.propertyId !== workspaceRef.current.propertyId || row?.id !== receipt.listingId || row.status !== 'draft') return;
    savedConfirmation.current = null; setHistory(['dashboard']); setScreen('preview'); setComposerNotice(null);
  };
  const saveDraft = async () => {
    if(initialHydrationPending())return;
    if (operationBusy() || savedConfirmation.current || publicationReadOnly()) return;
    const token = workspaceGeneration.current;
    const outcome = await listingDraftPersistence.save(draft);
    if (!active.current || token !== workspaceGeneration.current) return;
    if (outcome === 'blocked') return;
    if (outcome === 'saved') { showDraftSaved(); return; }
    syncListingSummary('draft');
    setHistory([]);
    setScreen('dashboard');
    setIsEditing(false);
    setNotice('Progress is local to this session, not saved to your account. A saved property, title, description and positive monthly rent are required.');
  };

  function focusPropertyIssue(issue:PropertyValidationIssue) {
    if(operationBusy()||workspaceRef.current.propertyId||propertyCreation.getSnapshot().uncertain)return;
    propertyCreation.markValidationAttempt();
    if(screen==='propertySetup')propertyCreation.focusValidationSection(issue.section);
    else if(screen!=='listingComposer'){if(screen==='listingDetails')goBack();else navigate('listingComposer');}
    setPropertyValidationTarget({...issue,requestId:++validationRequest.current});
  }
  function requestPropertyValidation() {
    if(operationBusy())return false;
    propertyCreation.markValidationAttempt();
    const issue=propertyValidationIssues(propertyCreation.getSnapshot().draft)[0];
    if(!workspaceRef.current.propertyId&&issue){focusPropertyIssue(issue);return false;}setPropertyValidationTarget(null);return true;
  }
  const savePublishedChanges=async()=>{
    if(initialHydrationPending()||operationBusy()||publishedContent.getSnapshot().uncertain||publishedContent.getSnapshot().conflict||!listingDraftDirty||listingFieldIssue(draft))return;
    const token=workspaceGeneration.current;const result=await publishedContent.save({...draft});
    if(!active.current||token!==workspaceGeneration.current||result!=='saved')return;
    const row=publishedContent.getSnapshot().lastConfirmed;if(!row)return;
    const item=workspaceRef.current.item;
    selectWorkspace({...workspaceRef.current,mode:'manage',item:item?{...item,currentListing:row,listings:item.listings.map(l=>l.id===row.id?row:l)}:null});
    lifecycle.setListing(row);setShowRealPublication(true);setHistory(['dashboard']);setScreen('published');setNotice('Listing changes saved. Publication status is unchanged.');
  };
  const saveComposerDraft = async () => {
    if(initialHydrationPending())return;
    if(workspaceRef.current.mode==='editPublished'){await savePublishedChanges();return;}
    if (operationBusy() || savedConfirmation.current || propertyCreation.getSnapshot().uncertain || (listingDraftPersistence.getSnapshot().uncertain || listingDraftPersistence.getSnapshot().conflict) || (workspaceRef.current.propertyId && publicationReadOnly())) return;
    if(workspaceRef.current.propertyId&&listingDraftPersistence.getSnapshot().lastConfirmed&&(!listingDraftDirty&&!propertyPhotos.getSnapshot().pendingSelections.length||!!listingFieldIssue(draft)))return;
    if(!requestPropertyValidation())return;
    const submittedDraft = { ...draft };
    composerSaving.current = true; setComposerNotice(null); setComposerPhase(workspaceRef.current.propertyId ? 'draft' : 'property');
    let token = workspaceGeneration.current;
    const live = () => active.current && token === workspaceGeneration.current;
    try {
      let propertyId = workspaceRef.current.propertyId;
      if (!propertyId) {
        setComposerPhase('property');
        await propertyCreation.submit(true);
        if (!live()) return;
        const created = propertyCreation.getSnapshot();
        if (!created.propertyId || created.uncertain) return;
        propertyId = created.propertyId; composedProperty.current = propertyId;
        propertyPhotos.setProperty(propertyId, true);
        listingDraftPersistence.setProperty(propertyId); publication.setProperty(propertyId); lifecycle.setListing(null);
        selectWorkspace({ propertyId, listingId: null, mode: 'compose', item: null }); token = workspaceGeneration.current;
        portfolio.invalidate(); setComposerNotice('Property saved. Listing details are not saved yet.');
        const restored = await publication.restore(); if (!live() || !restored || publication.getSnapshot().uncertain) return;
        await listingDraftPersistence.load(); if (!live()) return;
      }
      setComposerPhase('photos');
      if (!propertyPhotos.getSnapshot().loaded) await propertyPhotos.load();
      if (!live()) return;
      let media = propertyPhotos.getSnapshot();
      if (!media.loaded || media.needsReconcile) { setComposerNotice('Property saved. Check photo status before continuing. Listing details are not saved yet.'); return; }
      if (media.pendingSelections.length) await propertyPhotos.resumeQueue();
      if (!live()) return;
      media = propertyPhotos.getSnapshot();
      if (media.needsReconcile || media.pendingSelections.length || media.busy) { setComposerNotice('Property saved. Photos need attention before the listing draft can be saved.'); return; }
      if (!hasListingMinimum(propertyId, submittedDraft)) { setComposerNotice('Property and confirmed photos saved. Listing details remain local; add a title, description and positive monthly rent, then Save draft.'); return; }
      setComposerPhase('draft');
      const outcome = await listingDraftPersistence.save(submittedDraft);
      if (!live()) return;
      if (outcome === 'saved') { showDraftSaved(); return; }
      setComposerNotice('Property and confirmed photos are retained. Check the listing draft details or save status before continuing.');
    } finally { if (live()) { composerSaving.current = false; setComposerPhase(null); } }
  };

  const requestPublish = () => {
    if(workspaceRef.current.mode==='editPublished')return;
    if(initialHydrationPending())return;
    if (operationBusy()) return;
    if(listingDraftPersistence.getSnapshot().conflict){publication.report('Load the latest saved version before reviewing publication.');return;}
    if (workspaceRef.current.mode === 'create' && !workspaceRef.current.propertyId) { setComposerNotice('Save the property and listing draft before publication.'); return; }
    if (workspaceRef.current.propertyId) {
      const error = publicationEligibility(workspaceRef.current.propertyId, listingDraftPersistence.getSnapshot().lastConfirmed, draft, listingDraftPersistence.getSnapshot().uncertain);
      if (error || publicationReadOnly()) { publication.report(error ?? 'Check the current publication status before continuing.'); return; }
      publication.report(''); // A previously reported edit blocker is resolved at this boundary.
      navigate('publishConfirmation'); return;
    }
    navigate(missingRequirements.length > 0 ? 'missingRequirements' : 'publishConfirmation');
  };

  const openPortfolioVerification = async (propertyId:string) => {
    if(operationBusy()||!portfolio.getSnapshot().items.some(item=>item.propertyId===propertyId))return;
    const token=workspaceGeneration.current;
    await propertyVerification.openForProperty(propertyId);
    if(active.current&&token===workspaceGeneration.current&&propertyVerification.getSnapshot().status==='approved'&&!propertyVerification.getSnapshot().entryPropertyId)await portfolio.load();
  };
  const closePropertyVerification = async () => {
    const token=workspaceGeneration.current;
    await propertyVerification.close();
    if(active.current&&token===workspaceGeneration.current&&screen==='identityEdit')await propertyIdentity.reload();
    if(active.current&&token===workspaceGeneration.current&&(screen==='dashboard'||screen==='empty'))await portfolio.load();
  };
  const reviewPortfolioPublication = (propertyId:string) => {
    if(operationBusy()||pendingPortfolioReview.current)return;
    const item=portfolio.getSnapshot().items.find(item=>item.propertyId===propertyId);
    if(!item||!canReviewPortfolioPublication(item)||!item.currentListing)return;
    requestNavigation(()=>{openPortfolioItem(propertyId);pendingPortfolioReview.current={propertyId,listingId:item.currentListing!.id,generation:workspaceGeneration.current};},true);
  };
  useEffect(()=>{
    const target=pendingPortfolioReview.current;
    if(!target)return;
    if(!active.current||target.generation!==workspaceGeneration.current||target.propertyId!==workspace.propertyId){pendingPortfolioReview.current=null;return;}
    if(publicationState.error||listingDraftState.error){pendingPortfolioReview.current=null;return;}
    if(initialHydrationPending()||operationBusy()||!publicationState.loaded||!listingDraftState.loaded)return;
    const row=listingDraftState.lastConfirmed;
    if(!row||row.id!==target.listingId)return;
    pendingPortfolioReview.current=null;
    if(row.status!=='draft'){setShowRealPublication(true);setHistory([]);setScreen('published');return;}
    requestPublish();
  },[workspace.propertyId,workspace.listingId,listingDraftState,publicationState,lifecycleState,photoState,draft,composerPhase,draftHydration.status]);

  const loadFigmaSample = () => {
    if (workspaceRef.current.propertyId || workspaceRef.current.mode === 'create' || operationBusy()) return;
    setDraft(figmaPreviewDraft);
    setHistory((current) => [...current, screen]);
    setScreen('preview');
    setNotice('Complete Figma sample data loaded locally for frontend evaluation.');
  };

  const confirmPublish = async () => {
    if (operationBusy()||listingDraftPersistence.getSnapshot().conflict) return;
    if (workspaceRef.current.mode === 'create' && !workspaceRef.current.propertyId) { setComposerNotice('Save the property and listing draft before publication.'); return; }
    const token = workspaceGeneration.current;
    if (workspaceRef.current.propertyId) {
      const success = await publication.publish(listingDraftPersistence.getSnapshot().lastConfirmed, draft, listingDraftPersistence.getSnapshot().uncertain);
      if (success && active.current && token === workspaceGeneration.current) { setShowRealPublication(true); setHistory([]); setScreen('published'); setIsEditing(false); }
      return;
    }
    syncListingSummary('published');
    setHistory([]);
    setScreen('published');
    setIsEditing(false);
    setNotice('Published state is local preview only. No backend submission occurred.');
  };

  const openListing = (listingId?: string) => {
    if (operationBusy()) return;
    setShowRealPublication(false);
    const selected = landlordListingPreviews.find((item) => item.id === listingId);
    if (selected) setListing(selected);
    navigate('published');
  };

  const openManagement = (listingId?: string) => {
    if (operationBusy()) return;
    setShowRealPublication(false);
    const selected = landlordListingPreviews.find((item) => item.id === listingId);
    if (selected) setListing(selected);
    navigate('management');
  };

  const startEdit = () => { if (!showRealPublication) navigate('editListing'); };

  const editDetails = () => {
    setIsEditing(true);
    navigate('basicInfo');
  };

  const finishEdit = () => {
    syncListingSummary(listing.status);
    setHistory([]);
    setScreen('management');
    setIsEditing(false);
    setNotice('Listing changes are stored only in local preview state.');
  };

  const setListingStatus = (status: ListingStatus) => {
    if (showRealPublication || operationBusy()) return;
    syncListingSummary(status);
    setHistory([]);
    setScreen('management');
    setNotice(`Listing is ${status} in local preview state only.`);
  };

  const deletionCandidate=!!workspace.propertyId&&(!workspace.item||workspace.item.listings.every(l=>l.status==='draft'&&l.published_at===null));
  useEffect(()=>{void unfinishedPost.open(deletionCandidate?workspace.propertyId:null);},[unfinishedPost,workspaceEpoch,deletionCandidate]);
  useEffect(()=>{if(screen==='dashboard')void unfinishedPost.refreshPending();},[unfinishedPost,screen]);
  useEffect(()=>{if(unfinishedPostState.status?.state==='cleanup_pending')portfolio.invalidate();},[unfinishedPostState.status?.propertyId,unfinishedPostState.status?.state]);
  const deletionBlocked=propertyState.uncertain||listingDraftState.uncertain||listingDraftState.conflict||photoState.needsReconcile||photoState.pendingSelections.length>0||propertyRoutineState.uncertain||propertyIdentityState.uncertain;
  const selectedAmenityIds = workspace.propertyId ? amenityState.selectedIds : propertyState.draft.amenityIds;
  // Creation freezes this draft after a confirmed receipt; never project location/address.
  const createdDraft=propertyState.propertyId===workspace.propertyId&&propertyState.step==='created'&&!propertyState.uncertain&&hasConfirmedPropertyLocation(propertyState.draft)?propertyState.draft:null;
  const optionalNumber=(value:string|undefined)=>!value?.trim()?null:Number(value);
  const createdPhysical=createdDraft?{property_type:createdDraft.propertyType,city:createdDraft.city,barangay:createdDraft.barangay,total_floors:optionalNumber(createdDraft.totalFloors),max_occupants:optionalNumber(createdDraft.maxOccupants),furnishing_status:createdDraft.furnishingStatus,bedrooms:Number(createdDraft.bedrooms),bathrooms:Number(createdDraft.bathrooms),floor_area_sqm:optionalNumber(createdDraft.floorAreaSqm),floor_number:createdDraft.propertyType==='house'?null:optionalNumber(createdDraft.floorNumber),property_subtype:createdDraft.propertySubtype||null,lot_area_sqm:optionalNumber(createdDraft.lotAreaSqm),parking_spaces:optionalNumber(createdDraft.parkingSpaces)}:null;
  const physical = editedProperty?.property_id===workspace.propertyId?editedProperty:workspace.item?.property??createdPhysical;
  const confirmedListing = contentState.lastConfirmed?.property_id === workspace.propertyId && (!workspace.listingId || contentState.lastConfirmed.id===workspace.listingId) ? contentState.lastConfirmed : null;
  const completeness = listingCompleteness({title:draft.title,description:draft.description,rent:listingNumber(draft.askingRent),availableDate:!!availabilityDateToLocal(draft.availableDate),
    floorArea:physical ? physical.floor_area_sqm!==null : !!propertyState.draft.floorAreaSqm.trim()&&Number.isFinite(Number(propertyState.draft.floorAreaSqm))&&Number(propertyState.draft.floorAreaSqm)>0,
    maxOccupants:physical ? physical.max_occupants!==null : !!propertyState.draft.maxOccupants.trim()&&Number.isSafeInteger(Number(propertyState.draft.maxOccupants))&&Number(propertyState.draft.maxOccupants)>0,
    location:workspace.propertyId ? amenityState.hasPrivateLocation || propertyState.propertyId===workspace.propertyId&&hasConfirmedPropertyLocation(propertyState.draft) : hasConfirmedPropertyLocation(propertyState.draft),
    photoCount:photoState.photos.length+photoState.pendingSelections.length,amenityCount:selectedAmenityIds.length},confirmedListing?.completeness_score);
  const listingValidationIssue = listingFieldIssue(draft);
  const propertyIssues=workspace.propertyId?[]:propertyValidationIssues(propertyState.draft);
  const propertyVisibleIssues=propertyIssues.filter(issue=>propertyState.validationAttempted||propertyState.touchedFields[issue.field]||(issue.section==='floors'&&(propertyState.touchedFields.floorNumber||propertyState.touchedFields.totalFloors)));
  const floorIssues=propertyVisibleIssues.some(issue=>issue.section==='floors')?propertyFloorIssues(propertyState.draft):{floorNumber:null,totalFloors:null};
  const propertyFormReady=!!workspace.propertyId||propertyIssues.length===0;
  const propertyNextDisabled=operationBusy()||(!workspace.propertyId&&(!propertyState.loaded||propertyState.uncertain))||!propertyFormReady;
  const firstPropertyIssue=propertyIssues[0];
  const propertyNextStatus=!workspace.propertyId&&propertyState.uncertain?'Check property creation status before continuing.'
    :!workspace.propertyId&&!propertyState.loaded?'Checking property setup...'
    :operationBusy()?'Finish the current operation before continuing.'
    :firstPropertyIssue?(firstPropertyIssue.kind==='required'?firstPropertyIssue.message:`Check ${propertySectionLabels[firstPropertyIssue.section].toLowerCase()}.`)
    :workspace.propertyId?'Saved property selected. Continue to listing details.':'Property information is ready. Next saves the property before listing details.';

  return {
    unfinishedPost,unfinishedPostState,
    resumeUnfinishedPostCleanup:(id:string)=>{if(!operationBusy()&&(screen==='dashboard'||workspaceRef.current.propertyId===id))void unfinishedPost.resume(id);},
    requestUnfinishedPostDeletion:()=>{if(!operationBusy()&&!deletionBlocked)unfinishedPost.requestConfirmation();},
    confirmUnfinishedPostDeletion:()=>{if(!operationBusy()&&!deletionBlocked)void unfinishedPost.confirm();},
    unfinishedPostDeletionDisabled:operationBusy()||!!deletionBlocked,
    propertyIdentity,propertyIdentityState,identityLocationState,
    reloadIdentityCorrection:()=>{const id=propertyIdentity.getSnapshot().propertyId;if(id)requestPropertyNavigation(()=>{void propertyIdentity.open(id);});},
    openIdentityCorrection:()=>{const id=workspaceRef.current.propertyId;if(!id||operationBusy()||propertyIdentity.getSnapshot().status!=='idle')return;requestPropertyNavigation(()=>{navigate('identityEdit');void propertyIdentity.open(id);});},
    openIdentityVerification:()=>{if(!operationBusy()&&['draft','submitted','rejected'].includes(propertyIdentity.getSnapshot().context?.correction?.status??''))void propertyVerification.openCorrection();},
    propertyRoutine,propertyRoutineState,
    propertyEditAvailable:!!workspace.propertyId&&workspace.item?.property.is_active!==false&&(!initialHydrationPending()||draftHydration.status==='ready'),
    openPropertyDetails:()=>{const id=workspaceRef.current.propertyId;if(operationBusy()||initialHydrationPending()||!id||propertyRoutine.getSnapshot().status!=='idle')return;navigate('propertyEdit');void propertyRoutine.open(id);},
    reloadPropertyDetails:()=>{const id=propertyRoutine.getSnapshot().propertyId;if(id)requestPropertyNavigation(()=>void propertyRoutine.open(id));},
    propertyValidationIssues:propertyIssues,propertyVisibleValidationIssues:propertyVisibleIssues,
    propertyMeasurementWarnings:propertyMeasurementWarnings({floor_area_sqm:propertyState.draft.floorAreaSqm.trim()?Number(propertyState.draft.floorAreaSqm):null,bedrooms:propertyState.draft.bedrooms.trim()?Number(propertyState.draft.bedrooms):null,bathrooms:propertyState.draft.bathrooms.trim()?Number(propertyState.draft.bathrooms):null}),
    propertyFormReady,propertyNextDisabled,propertyNextStatus,
    propertyReadinessReviewAvailable:!operationBusy()&&!workspace.propertyId&&propertyState.loaded&&!propertyState.uncertain&&propertyIssues.length>0,
    reviewPropertyReadiness:()=>{if(!operationBusy())requestPropertyValidation();},
    propertyValidationTarget,focusPropertyIssue,requestPropertyValidation,
    submitProperty:async()=>{if(requestPropertyValidation())await propertyCreation.submit();},
    propertyFloorIssues: floorIssues,
    completeness, propertyValidationIssue:propertyVisibleIssues[0]??null, listingValidationIssue,
    propertyAmenities,amenityState,selectedAmenityIds,
    togglePropertyAmenity:(id:number)=>{const state=propertyAmenities.getSnapshot();if(!active.current||operationBusy()||workspaceRef.current.propertyId||!state.loaded||state.busy)return;propertyCreation.updateField('amenityIds',togglePropertyAmenity(propertyCreation.getSnapshot().draft.amenityIds,id,state.catalog));},
    ...navigation,
    propertyReturnConfirmation:navigationScope.current==='propertyReturn',
    cancelNavigation:()=>{navigationScope.current='workspace';navigation.cancelNavigation();},
    confirmNavigation:()=>{navigation.confirmNavigation();navigationScope.current='workspace';},
    requestNavigation,
    propertyCreation,
    propertyState,
    publishedEditing:editingPublished,
    publicationReview: {...publicationReviewSummary(workspace.propertyId, listingDraftState.lastConfirmed, draft, listingDraftState.uncertain),...(editingPublished?{visible:false}:{}),...(listingDraftState.conflict?{state:'Draft',message:'Load the latest saved version before reviewing publication.'}:{})},
    publicationReviewDisabled: operationBusy(),
    propertyVerificationState, propertyVerification,
    openPropertyVerification:()=>{if(!operationBusy() && propertyVerification.getSnapshot().propertyId===workspaceRef.current.propertyId)void propertyVerification.open();},
    closePropertyVerification, openPortfolioVerification, reviewPortfolioPublication, portfolioActionsDisabled:operationBusy(),
    composerPhase, composerNotice, saveComposerDraft, openSavedDraft,
    draftHydration,
    retryDraftHydration:()=>{if(!initialHydrationPending())return;propertyPhotos.setProperty(null);propertyAmenities.setProperty(null);publishedContent.setProperty(null);listingDraftPersistence.setProperty(null);publication.setProperty(null);selectWorkspace({...workspaceRef.current});},
    composerSaveDisabled: !!(contentState.lastConfirmed&&(!listingDraftDirty&&!photoState.pendingSelections.length||listingValidationIssue)) || (editingPublished ? initialHydrationPending()||operationBusy()||publishedContentState.uncertain||publishedContentState.conflict||publicationReadOnly() : initialHydrationPending() || operationBusy() || propertyState.uncertain || listingDraftState.uncertain || listingDraftState.conflict || (!workspace.propertyId ? !propertyState.loaded : publicationReadOnly() || photoState.needsReconcile)),
    composerPreview: history.includes('listingComposer') || history.includes('listingDetails') || screen === 'listingComposer' || screen === 'listingDetails',
    applyRentalEstimate:(result:PredictionReceipt)=>{
      const current=workspaceRef.current;
      const matches=result.target.propertyId===current.propertyId||!!current.listingId&&result.target.listingId===current.listingId;
      if(!active.current||!current.propertyId||!matches||result.currency!=='PHP'||!Number.isFinite(result.estimatedMonthlyRent)||result.estimatedMonthlyRent<=0||propertyRoutine.dirty()||propertyIdentity.dirty())return;
      updateDraft('askingRent',String(Math.round(result.estimatedMonthlyRent*100)/100));
    },
    estimationProperty:physical?{property_subtype:'property_subtype' in physical?physical.property_subtype:null,lot_area_sqm:'lot_area_sqm' in physical?physical.lot_area_sqm:null,parking_spaces:'parking_spaces' in physical?physical.parking_spaces:null,edit_version:'edit_version' in physical?physical.edit_version:null,property_type:physical.property_type,city:physical.city,furnishing_status:physical.furnishing_status,bedrooms:physical.bedrooms,bathrooms:physical.bathrooms,floor_area_sqm:physical.floor_area_sqm,floor_number:physical.floor_number,is_active:workspace.item?.property.is_active,landlord_id:'owner_id' in physical?physical.owner_id:'landlord_id' in physical?physical.landlord_id:undefined}:null,
    workspacePropertyId: workspace.propertyId, workspaceListingId: lifecycleState.listingId ?? listingDraftState.listingId ?? workspace.listingId, workspaceMode: workspace.mode,
    workspacePropertyActive: workspace.item?.property.is_active !== false,
    portfolio, portfolioState, portfolioItems: portfolio.filtered(), portfolioStatistics: portfolio.stats(),
    editManagedListing:()=>{const id=workspaceRef.current.propertyId,row=lifecycle.getSnapshot().row??publication.getSnapshot().lastConfirmed;if(!id||!row||!['active','paused'].includes(row.status)||operationBusy())return;requestNavigation(()=>{const physical=editedProperty;openPortfolioItem(id,true,true);setEditedProperty(physical);});},
    openPortfolioProperty:(id:string)=>{if(operationBusy())return;requestNavigation(()=>{openPortfolioItem(id);if(workspaceRef.current.propertyId!==id)return;setHistory(['dashboard']);setScreen('propertyEdit');void propertyRoutine.open(id);},true);},
    editPortfolioListing:(id:string)=>requestNavigation(()=>openPortfolioItem(id,true),true),
    openPortfolioItem: (id: string) => requestNavigation(() => openPortfolioItem(id), true),
    propertyLocation,
    locationState,
    openPropertyLocation: () => {
      const current = propertyCreation.getSnapshot();
      if (operationBusy() || !['propertySetup', 'listingComposer'].includes(screen) || (screen === 'propertySetup' && current.step !== 'address') || !current.loaded || current.propertyId || current.uncertain) return;
      if (!current.draft.city || !current.draft.barangay.trim() || !current.draft.addressLine1.trim()) return;
      propertyCreation.markFieldTouched('location');
      void propertyLocation.open({ addressRevision: current.locationRevision, setupId: 'physical-property-setup', query: propertyAddressQuery(current.draft) },hasConfirmedPropertyLocation(current.draft)?current.draft:undefined);
    },
    propertyPhotos: {
      ...propertyPhotos,
      reorder:(ids:string[])=>!operationBusy()?propertyPhotos.reorder(ids):Promise.resolve(),
      saveDetail:()=>!operationBusy()?propertyPhotos.saveDetail():Promise.resolve(),
      select: () => !operationBusy() ? propertyPhotos.select() : Promise.resolve(),
      upload: () => !operationBusy() ? propertyPhotos.upload() : Promise.resolve(),
      addPhotos: () => !operationBusy() ? propertyPhotos.addPhotos() : Promise.resolve(),
      resumeQueue: () => !operationBusy() ? propertyPhotos.resumeQueue() : Promise.resolve(),
      removePending: (index:number) => {if(!operationBusy())propertyPhotos.removePending(index);},
      requestRemove: (id:string) => {if(!operationBusy())propertyPhotos.requestRemove(id);},
      confirmRemove: () => !operationBusy() ? propertyPhotos.confirmRemove() : Promise.resolve(),
      setCover: (id:string) => !operationBusy() ? propertyPhotos.setCover(id) : Promise.resolve(),
      saveAlt: (id:string) => !operationBusy() ? propertyPhotos.saveAlt(id) : Promise.resolve(),
      move: (id:string,direction:-1|1) => !operationBusy() ? propertyPhotos.move(id,direction) : Promise.resolve(),
    },
    photoState,
    mediaItems: propertyMediaItems(photoState.photos, photoState.pendingSelections, photoState.uncertainSelection, photoState.busy && photoState.batch.status === 'running'),
    nextListingDetails: async () => {
      if(initialHydrationPending()||operationBusy())return;
      if(!workspaceRef.current.propertyId){
        const current=propertyCreation.getSnapshot();
        if(!current.loaded||current.uncertain||!requestPropertyValidation())return;
        let token=workspaceGeneration.current;
        composerSaving.current=true;setComposerPhase('property');setComposerNotice(null);
        try {
          await propertyCreation.submit(true);
          if(!active.current||token!==workspaceGeneration.current)return;
          if(!adoptCreatedProperty())return;
          token=workspaceGeneration.current;
          setComposerNotice('Property saved. Set your asking rent and save the listing draft when ready.');
        } finally {
          if(active.current&&token===workspaceGeneration.current){composerSaving.current=false;setComposerPhase(null);}
        }
      }
      navigate('listingDetails');
    },
    editComposerProperty: () => { if(editingPublished)return; if (screen === 'listingDetails') goBack(); else navigate('listingComposer'); },
    propertySummary: physical ? {
      floorTotalLabel: physical.property_type==='house'?'stories':'floors in building',
      type: propertyTypeOptions.find(o => o.value === physical.property_type)?.label ?? 'Property',
      location: [physical.barangay, propertyCityOptions.find(o => o.value === physical.city)?.label].filter(Boolean).join(', '),
      bedrooms: String(physical.bedrooms), bathrooms: String(physical.bathrooms), floorAreaSqm: String(physical.floor_area_sqm ?? ''), floorNumber: physical.property_type==='house'?'':String(physical.floor_number ?? ''), totalFloors: String(physical.total_floors ?? ''), maxOccupants: String(physical.max_occupants ?? ''),
      furnishing: furnishingOptions.find(o => o.value === physical.furnishing_status)?.label ?? '', detailsAvailable: true,
    } : {
      floorTotalLabel: propertyState.draft.propertyType==='house'?'stories':'floors in building',
      type: propertyTypeOptions.find(o => o.value === propertyState.draft.propertyType)?.label ?? 'Saved property',
      location: [propertyState.draft.barangay, propertyCityOptions.find(o => o.value === propertyState.draft.city)?.label].filter(Boolean).join(', '),
      bedrooms: propertyState.draft.bedrooms, bathrooms: propertyState.draft.bathrooms, floorAreaSqm: propertyState.draft.floorAreaSqm, floorNumber: propertyState.draft.propertyType==='house'?'':propertyState.draft.floorNumber, totalFloors: propertyState.draft.totalFloors, maxOccupants: propertyState.draft.maxOccupants,
      furnishing: furnishingOptions.find(o => o.value === propertyState.draft.furnishingStatus)?.label ?? '', detailsAvailable: propertyState.draft.propertyType !== null,
    },
    publication,
    publicationState,
    listingDraftReadOnly: publicationReadOnly(),
    propertyVerificationLabel: workspace.item ? portfolioTierLabels[workspace.item.tier3.status] : null,
    listingEditExplanation: !workspace.propertyId || !publicationReadOnly() ? null
      : workspace.item?.property.is_active === false ? 'This property is inactive. Draft editing is unavailable.'
      : publicationState.busy || !publicationState.loaded ? 'Checking this saved listing before editing. Your local details are retained.'
      : publicationState.uncertain || lifecycleState.uncertain ? 'Check the unresolved listing status before making further changes.'
      : publicationState.status && publicationState.status !== 'draft' ? 'This listing is no longer a draft. Content editing is unavailable; use its listing management actions.'
      : 'Listing access could not be confirmed. Check its status before editing.',
    checkPublication: async () => { const ok = publication.getSnapshot().listingId ? await publication.reconcile() : await publication.restore(); if (ok && active.current && (!publication.getSnapshot().status || publication.getSnapshot().status === 'draft') && !publication.getSnapshot().uncertain) await listingDraftPersistence.reconcile(); },
    lifecycle,
    lifecycleState,
    realListing: lifecycleState.row ?? (publicationState.lastConfirmed?.status !== 'draft' ? publicationState.lastConfirmed : null) ?? (workspace.mode === 'manage' ? workspace.item?.currentListing ?? null : null),
    lifecycleStatusLabel,
    lifecycleLabel,
    lifecycleActions: lifecycleState.row && !lifecycleState.uncertain && lifecycleState.loaded ? lifecycleActions(lifecycleState.row.status) : [],
    lifecycleBlocked: !canChangeLifecycle() || lifecycleState.busy || lifecycleState.uncertain || !lifecycleState.loaded,
    showRealPublication,
    openPublishedListing: () => { if (operationBusy()) return; setShowRealPublication(true); navigate('published'); },
    listingDraftPersistence:editingPublished?publishedContent:listingDraftPersistence,
    listingDraftState:contentState,
    canPersistListing: hasListingMinimum(workspace.propertyId, draft),
    saveDraftLabel: hasListingMinimum(workspace.propertyId, draft) ? 'Save listing draft to account' : 'Keep local progress',
    editSavedListingDraft: () => { if (!publicationReadOnly() && workspaceRef.current.propertyId) navigate('listingDetails'); },
    continueListingPreview: () => { if (workspaceRef.current.propertyId || adoptCreatedProperty()) navigate('listingComposer'); },
    openComposerPreview: () => {
      if(editingPublished)return;
      if (initialHydrationPending() || operationBusy()) return;
      if (screen === 'listingComposer') { setHistory(current => [...current, 'listingComposer', 'listingDetails']); setScreen('preview'); }
      else navigate('preview');
    },
    activeTab: workspace.item && ['listingComposer', 'listingDetails', 'photoManager', 'preview', 'publishConfirmation'].includes(screen) ? 'listing' as const : listingActiveTab(screen),
    backFromWorkspace: (onClose: () => void) => {
      if(unfinishedPost.getSnapshot().confirming){unfinishedPost.cancel();return;}
      if(leaveInitialHydration())return;
      if (propertyPhotos.getSnapshot().mediaViewerOpen) { propertyPhotos.closeMedia(); return; }
      if (operationBusy()) return;
      if (screen === 'propertySetup') { goBack(); return; }
      if (screen === 'listingComposer' && workspaceRef.current.mode === 'create' && !history.length) requestNavigation(onClose);
      else if (screen === 'postingType') requestNavigation(onClose);
      else if (history.length > 0) goBack();
      else if (screen !== 'dashboard' && screen !== 'empty') requestNavigation(goDashboard);
      else requestNavigation(onClose);
    },
    screen,
    draft: displayDraft,
    listing,
    listingQuery,
    filteredListingPreviews,
    notice,
    isEditing,
    missingRequirements,
    navigate,
    beginPropertySetup: () => { if (active.current && screen === 'postingType') navigate('listingComposer'); },
    goBack,
    goDashboard: () => { if (!operationBusy()) requestNavigation(goDashboard); },
    updateDraft,
    startCreate: () => requestNavigation(startCreate, true),
    openPostingType: () => requestNavigation(() => startCreate('postingType'), true),
    setListingQuery: (value: string) => { setListingQuery(value); portfolio.setQuery(value); },
    choosePropertyType,
    toggleFurnished,
    changeCounter,
    toggleAmenity,
    toggleRule,
    confirmPin,
    saveDraft,
    requestPublish,
    loadFigmaSample,
    confirmPublish,
    openListing,
    openManagement,
    startEdit,
    editDetails,
    finishEdit,
    setListingStatus,
    setNotice,
  };
}

export type PropertyListingViewModel = ReturnType<typeof usePropertyListingViewModel>;
