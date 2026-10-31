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
import { applySavedListing, hasListingMinimum, listingNumber, listingFieldIssue } from '../models/PersistedListingDraft';
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
  type Workspace = { propertyId: string | null; listingId: string | null; mode: 'none' | 'create' | 'compose' | 'manage'; item: LandlordPortfolioItem | null };
  const [workspace, setWorkspace] = useState<Workspace>({ propertyId: null, listingId: null, mode: initialScreen === 'postingType' ? 'create' : 'none', item: null });
  const workspaceRef = useRef(workspace), workspaceGeneration = useRef(0);
  const selectWorkspace = (next: Workspace) => { workspaceGeneration.current++; workspaceRef.current = next; setWorkspace(next); };
  const [portfolio] = useState(() => createLandlordPortfolioWorkflow(landlordPortfolioService));
  const portfolioState = useSyncExternalStore(portfolio.subscribe, portfolio.getSnapshot);
  useEffect(() => { portfolio.activate(); return () => portfolio.dispose(); }, [portfolio]);
  const [propertyValidationTarget,setPropertyValidationTarget]=useState<(PropertyValidationIssue & {requestId:number})|null>(null);
  const validationRequest=useRef(0);
  const composerSaving = useRef(false);
  const savedConfirmation = useRef<{propertyId:string;listingId:string;generation:number}|null>(null);
  const [composerPhase, setComposerPhase] = useState<'property' | 'photos' | 'draft' | null>(null);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [showRealPublication, setShowRealPublication] = useState(false);
  const [screen, setScreen] = useState<ListingScreen>(initialScreen);
  const [history, setHistory] = useState<ListingScreen[]>([]);
  const [draft, setDraft] = useState<ListingDraft>(emptyListingDraft);
  const savedDraft = useRef(draft);
  const [propertyAmenities] = useState(() => createPropertyAmenityWorkflow(propertyAmenityService));
  const amenityState = useSyncExternalStore(propertyAmenities.subscribe, propertyAmenities.getSnapshot);
  useEffect(() => { propertyAmenities.activate(); return () => propertyAmenities.dispose(); }, [propertyAmenities]);
  useEffect(() => { propertyAmenities.setProperty(workspace.propertyId); if (['listingComposer','listingDetails','preview','propertySetup'].includes(screen)) void propertyAmenities.load(); }, [propertyAmenities,workspace.propertyId,screen]);
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
  }));
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
  useEffect(() => { propertyPhotos.setProperty(workspace.propertyId, !!workspace.propertyId && workspace.item === null && propertyState.propertyId === workspace.propertyId); }, [propertyPhotos, workspace.propertyId]);
  useEffect(() => { if (!composerSaving.current && ['photoUpload', 'photoManager', 'listingComposer', 'listingDetails', 'preview'].includes(screen) && workspace.propertyId) void propertyPhotos.load(); }, [propertyPhotos, screen, workspace.propertyId]);
  const composedProperty = useRef<string | null>(null);
  useEffect(() => {
    if (composerSaving.current || !['propertySetup', 'listingComposer'].includes(screen) || propertyState.busy || propertyState.uncertain || propertyState.step !== 'created' || !isPropertyUuid(propertyState.propertyId) || composedProperty.current === propertyState.propertyId) return;
    if (!adoptCreatedProperty()) return;
    if (hasConfirmedPropertyLocation(propertyState.draft)) { setHistory([]); setScreen('listingComposer'); }
  }, [screen, propertyState.propertyId, propertyState.step, propertyState.busy, propertyState.uncertain]);
  const [listingDraftPersistence] = useState(() => createListingDraftWorkflow(listingDraftService, (row,source) => {
    portfolio.invalidate();
    const baseline=savedDraft.current;
    savedDraft.current=applySavedListing(baseline,row);
    // Capture the baseline outside the pure updater: development React may replay it.
    setDraft(current => {
      if(source==='save'||row.status!=='draft') return applySavedListing(current,row);
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
  const [publication] = useState(() => createListingPublicationWorkflow(listingPublicationService, row => listingDraftPersistence.adoptBackendListing(row), canWriteListing));
  const publicationState = useSyncExternalStore(publication.subscribe, publication.getSnapshot);
  useEffect(() => { publication.activate(); return () => publication.dispose(); }, [publication]);
  useEffect(() => { if (listingDraftState.lastConfirmed) publication.setDraft(listingDraftState.lastConfirmed); }, [publication, listingDraftState.lastConfirmed]);
  const [lifecycle] = useState(() => createListingLifecycleWorkflow(listingLifecycleService, row => {
    listingDraftPersistence.adoptBackendListing(row);
    publication.adoptLifecycle(row);
  }, canChangeLifecycle));
  const lifecycleState = useSyncExternalStore(lifecycle.subscribe, lifecycle.getSnapshot);
  useEffect(() => { lifecycle.activate(); return () => lifecycle.dispose(); }, [lifecycle]);
  useEffect(() => {
    const row = publicationState.lastConfirmed;
    if (row && row.status !== 'draft' && (lifecycle.getSnapshot().listingId !== row.id || lifecycle.getSnapshot().propertyId !== row.property_id)) {
      lifecycle.setListing(row); void lifecycle.restore();
    }
  }, [lifecycle, publicationState.lastConfirmed]);
  useEffect(() => { listingDraftPersistence.activate(); return () => listingDraftPersistence.dispose(); }, [listingDraftPersistence]);
  useEffect(() => {
    listingDraftPersistence.setProperty(workspace.propertyId);
    publication.setProperty(workspace.propertyId);
    lifecycle.setListing(null);
    if (workspace.item?.currentListing && workspace.item.currentListing.status !== 'draft') { lifecycle.setListing(workspace.item.currentListing); void lifecycle.restore(); }
    const token = workspaceGeneration.current;
    if (composerSaving.current) return;
    if (workspace.propertyId) void publication.restore(workspace.propertyId ? workspace.listingId : null).then(ok => {
      const current = publication.getSnapshot();
      if (ok && active.current && token === workspaceGeneration.current && current.propertyId === workspace.propertyId && (!current.status || current.status === 'draft') && !current.uncertain) void listingDraftPersistence.load(false, workspace.listingId);
    });
  }, [listingDraftPersistence, publication, lifecycle, workspace.propertyId, workspace.listingId]);
  useEffect(() => { if (screen === 'dashboard' || screen === 'empty') void portfolio.load(); }, [screen, portfolio]);
  useEffect(() => {
    if(!workspace.propertyId||workspace.item||propertyState.draft.propertyType)return;
    const item=portfolioState.items.find(item=>item.propertyId===workspace.propertyId);
    if(item){const next={...workspaceRef.current,item};workspaceRef.current=next;setWorkspace(next);}
    else if(!portfolioState.loaded&&!portfolioState.busy&&!portfolioState.error)void portfolio.load();
  },[workspace.propertyId,workspace.item,propertyState.draft.propertyType,portfolioState.items,portfolioState.loaded,portfolioState.busy,portfolioState.error]);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const operationBusy = () => !active.current || composerSaving.current || propertyCreation.getSnapshot().busy || propertyPhotos.getSnapshot().busy || listingDraftPersistence.getSnapshot().busy || publication.getSnapshot().busy || lifecycle.getSnapshot().busy;
  function canWriteListing(): boolean {
    const current = lifecycle.getSnapshot();
    return active.current && workspaceRef.current.item?.property.is_active !== false && !current.busy && !current.uncertain && current.loaded && (!current.row || current.row.status === 'draft');
  }
  function canChangeLifecycle(): boolean {
    return active.current && !propertyCreation.getSnapshot().busy && !propertyPhotos.getSnapshot().busy && !listingDraftPersistence.getSnapshot().busy && !listingDraftPersistence.getSnapshot().uncertain && !publication.getSnapshot().busy && !publication.getSnapshot().uncertain;
  }
  const publicationReadOnly = () => !!workspaceRef.current.propertyId && (!canWriteListing() || !publication.getSnapshot().loaded || publication.getSnapshot().uncertain || (!!publication.getSnapshot().status && publication.getSnapshot().status !== 'draft'));
  const displayDraft = workspace.propertyId ? { ...draft, photoCount: photoState.photos.length, coverPhotoIndex: Math.max(0, photoState.photos.findIndex(p => p.is_cover)) } : draft;
  const listingDraftDirty = JSON.stringify(draft) !== JSON.stringify(savedDraft.current);
  const navigation = useNavigationConfirmation(() => listingDraftDirty || ((workspaceRef.current.mode === 'create' || ['propertySetup', 'postingType'].includes(screen)) && propertyCreation.dirty()) || propertyPhotos.dirty());
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
    if (!active.current || propertyCreation.getSnapshot().busy || (!detach && operationBusy())) return;
    if (!detach && lifecycle.getSnapshot().confirmation) { lifecycle.cancel(); return; }
    navigation.requestNavigation(() => {
      if (!active.current || propertyCreation.getSnapshot().busy || (!detach && operationBusy())) return;
      propertyLocation.close();
      propertyCreation.discardLocalEdits();
      propertyPhotos.discardLocalEdits();
      setDraft(savedDraft.current);
      action();
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
    if (operationBusy()) return;
    if(['photoUpload','photoManager','listingComposer','listingDetails'].includes(nextScreen))adoptCreatedProperty();
    if (screen === 'propertySetup' && nextScreen !== 'propertySetup') propertyLocation.close();
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    if (propertyPhotos.getSnapshot().mediaViewerOpen) { propertyPhotos.closeMedia(); return; }
    if (operationBusy()) return;
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
    };
    if (leavesListingEditor(screen, history.at(-1) ?? 'dashboard')) requestNavigation(applyBack);
    else applyBack();
  };

  const goDashboard = () => {
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
    if (operationBusy() || publicationReadOnly()) return;
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const detachWorkspace = () => {
    savedConfirmation.current = null;
    setPropertyValidationTarget(null);
    composerSaving.current = false; setComposerPhase(null); setComposerNotice(null);
    selectWorkspace({ propertyId: null, listingId: null, mode: 'create', item: null });
    propertyPhotos.setProperty(null); listingDraftPersistence.setProperty(null); publication.setProperty(null); lifecycle.setListing(null);
    propertyLocation.close(); setShowRealPublication(false);
    savedDraft.current = emptyListingDraft; setDraft(emptyListingDraft); setIsEditing(false); setNotice(null);
  };
  const startCreate = (nextScreen: 'listingComposer' | 'postingType' = 'listingComposer') => {
    composerSaving.current = false; setComposerPhase(null); setComposerNotice(null);
    detachWorkspace(); setHistory([]); setScreen(nextScreen);
    void propertyCreation.startNew();
  };
  const openPortfolioItem = (propertyId: string) => {
    savedConfirmation.current = null;
    if (!active.current) return;
    const item = portfolio.select(propertyId); if (!item) return;
    setPropertyValidationTarget(null);
    const row = item.currentListing;
    composerSaving.current = false; setComposerPhase(null); setComposerNotice(null);
    propertyPhotos.setProperty(null); listingDraftPersistence.setProperty(null); publication.setProperty(null); lifecycle.setListing(null);
    selectWorkspace({ propertyId, listingId: row?.id ?? null, mode: row && row.status !== 'draft' ? 'manage' : 'compose', item });
    savedDraft.current = emptyListingDraft; setDraft(emptyListingDraft); setNotice(null);
    setShowRealPublication(!!row && row.status !== 'draft'); setHistory(['dashboard']);
    if (row && row.status !== 'draft') { lifecycle.setListing(row); setScreen('published'); }
    else setScreen(row?.status === 'draft' ? 'listingDetails' : 'listingComposer');
  };

  const choosePropertyType = (propertyType: PropertyType) => updateDraft('propertyType', propertyType);

  const toggleFurnished = () => updateDraft('furnished', !draft.furnished);

  const changeCounter = (field: CounterField, delta: number) => {
    setDraft((current) => ({ ...current, [field]: Math.max(0, current[field] + delta) }));
  };

  const toggleAmenity = (amenity: Amenity) => {
    if (operationBusy() || publicationReadOnly()) return;
    setDraft((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

  const toggleRule = (rule: PropertyRule) => {
    if (operationBusy() || publicationReadOnly()) return;
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
  const saveComposerDraft = async () => {
    if (operationBusy() || savedConfirmation.current || propertyCreation.getSnapshot().uncertain || listingDraftPersistence.getSnapshot().uncertain || (workspaceRef.current.propertyId && publicationReadOnly())) return;
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
    if (operationBusy()) return;
    if (workspaceRef.current.mode === 'create' && !workspaceRef.current.propertyId) { setComposerNotice('Save the property and listing draft before publication.'); return; }
    if (workspaceRef.current.propertyId) {
      const error = publicationEligibility(workspaceRef.current.propertyId, listingDraftPersistence.getSnapshot().lastConfirmed, draft, listingDraftPersistence.getSnapshot().uncertain);
      if (error || publicationReadOnly()) { publication.report(error ?? 'Check the current publication status before continuing.'); return; }
      publication.report(''); // A previously reported edit blocker is resolved at this boundary.
      navigate('publishConfirmation'); return;
    }
    navigate(missingRequirements.length > 0 ? 'missingRequirements' : 'publishConfirmation');
  };

  const loadFigmaSample = () => {
    if (workspaceRef.current.propertyId || workspaceRef.current.mode === 'create' || operationBusy()) return;
    setDraft(figmaPreviewDraft);
    setHistory((current) => [...current, screen]);
    setScreen('preview');
    setNotice('Complete Figma sample data loaded locally for frontend evaluation.');
  };

  const confirmPublish = async () => {
    if (operationBusy()) return;
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

  const selectedAmenityIds = workspace.propertyId ? amenityState.selectedIds : propertyState.draft.amenityIds;
  const physical = workspace.item?.property;
  const confirmedListing = listingDraftState.lastConfirmed?.property_id === workspace.propertyId && (!workspace.listingId || listingDraftState.lastConfirmed.id===workspace.listingId) ? listingDraftState.lastConfirmed : null;
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
    :workspace.propertyId?'Saved property selected. Continue to listing details.':'Property information is ready. It is not saved yet.';

  return {
    propertyValidationIssues:propertyIssues,propertyVisibleValidationIssues:propertyVisibleIssues,
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
    requestNavigation,
    propertyCreation,
    propertyState,
    publicationReview: publicationReviewSummary(workspace.propertyId, listingDraftState.lastConfirmed, draft, listingDraftState.uncertain),
    publicationReviewDisabled: operationBusy(),
    composerPhase, composerNotice, saveComposerDraft, openSavedDraft,
    composerSaveDisabled: operationBusy() || propertyState.uncertain || listingDraftState.uncertain || (!workspace.propertyId ? !propertyState.loaded : publicationReadOnly() || photoState.needsReconcile),
    composerPreview: history.includes('listingComposer') || history.includes('listingDetails') || screen === 'listingComposer' || screen === 'listingDetails',
    workspacePropertyId: workspace.propertyId, workspaceListingId: lifecycleState.listingId ?? listingDraftState.listingId ?? workspace.listingId, workspaceMode: workspace.mode,
    workspacePropertyActive: workspace.item?.property.is_active !== false,
    portfolio, portfolioState, portfolioItems: portfolio.filtered(), portfolioStatistics: portfolio.stats(),
    openPortfolioItem: (id: string) => requestNavigation(() => openPortfolioItem(id), true),
    propertyLocation,
    locationState,
    openPropertyLocation: () => {
      const current = propertyCreation.getSnapshot();
      if (operationBusy() || !['propertySetup', 'listingComposer'].includes(screen) || (screen === 'propertySetup' && current.step !== 'address') || !current.loaded || current.propertyId || current.uncertain) return;
      if (!current.draft.city || !current.draft.barangay.trim() || !current.draft.addressLine1.trim()) return;
      propertyCreation.markFieldTouched('location');
      void propertyLocation.open({ addressRevision: current.locationRevision, setupId: 'physical-property-setup', query: propertyAddressQuery(current.draft) });
    },
    propertyPhotos: {
      ...propertyPhotos,
      addPhotos: () => active.current && !composerSaving.current ? propertyPhotos.addPhotos() : Promise.resolve(),
      removePending: (index: number) => { if (active.current && !composerSaving.current) propertyPhotos.removePending(index); },
      requestRemove: (id: string) => { if (active.current && !composerSaving.current) propertyPhotos.requestRemove(id); },
      setCover: (id: string) => active.current && !composerSaving.current ? propertyPhotos.setCover(id) : Promise.resolve(),
    },
    photoState,
    mediaItems: propertyMediaItems(photoState.photos, photoState.pendingSelections, photoState.uncertainSelection, photoState.busy && photoState.batch.status === 'running'),
    nextListingDetails: () => {
      if(operationBusy())return;
      if(!workspaceRef.current.propertyId){const current=propertyCreation.getSnapshot();if(!current.loaded||current.uncertain||!requestPropertyValidation())return;}
      navigate('listingDetails');
    },
    editComposerProperty: () => { if (screen === 'listingDetails') goBack(); else navigate('listingComposer'); },
    propertySummary: workspace.item ? {
      floorTotalLabel: workspace.item.property.property_type==='house'?'stories':'floors in building',
      type: propertyTypeOptions.find(o => o.value === workspace.item!.property.property_type)?.label ?? 'Property',
      location: [workspace.item.property.barangay, propertyCityOptions.find(o => o.value === workspace.item!.property.city)?.label].filter(Boolean).join(', '),
      bedrooms: String(workspace.item.property.bedrooms), bathrooms: String(workspace.item.property.bathrooms), floorAreaSqm: String(workspace.item.property.floor_area_sqm ?? ''), floorNumber: workspace.item.property.property_type==='house'?'':String(workspace.item.property.floor_number ?? ''), totalFloors: String(workspace.item.property.total_floors ?? ''), maxOccupants: String(workspace.item.property.max_occupants ?? ''),
      furnishing: furnishingOptions.find(o => o.value === workspace.item!.property.furnishing_status)?.label ?? '', detailsAvailable: true,
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
    listingDraftPersistence,
    listingDraftState,
    canPersistListing: hasListingMinimum(workspace.propertyId, draft),
    saveDraftLabel: hasListingMinimum(workspace.propertyId, draft) ? 'Save listing draft to account' : 'Keep local progress',
    editSavedListingDraft: () => { if (!publicationReadOnly() && workspaceRef.current.propertyId) navigate('listingDetails'); },
    continueListingPreview: () => { if (workspaceRef.current.propertyId || adoptCreatedProperty()) navigate('listingComposer'); },
    openComposerPreview: () => {
      if (operationBusy()) return;
      if (screen === 'listingComposer') { setHistory(current => [...current, 'listingComposer', 'listingDetails']); setScreen('preview'); }
      else navigate('preview');
    },
    activeTab: workspace.item && ['listingComposer', 'listingDetails', 'photoManager', 'preview', 'publishConfirmation'].includes(screen) ? 'listing' as const : listingActiveTab(screen),
    backFromWorkspace: (onClose: () => void) => {
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
