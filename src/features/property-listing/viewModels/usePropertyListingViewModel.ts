import { createPropertyLocationWorkflow } from './propertyLocationWorkflow';
import { propertyLocationService } from '../services/propertyLocationDependencies';
import { propertyAddressQuery } from '../models/PropertyLocationConfirmation';
import { createListingLifecycleWorkflow } from './listingLifecycleWorkflow';
import { listingLifecycleService } from '../services/listingLifecycleDependencies';
import { lifecycleActions, lifecycleLabel, lifecycleStatusLabel } from '../models/ListingLifecycle';
import { createListingPublicationWorkflow } from './listingPublicationWorkflow';
import { listingPublicationService } from '../services/listingPublicationDependencies';
import { publicationEligibility } from '../models/ListingPublication';
import { createListingDraftWorkflow } from './listingDraftWorkflow';
import { listingDraftService } from '../services/listingDraftDependencies';
import { applySavedListing, hasListingMinimum } from '../models/PersistedListingDraft';
import { createPropertyPhotoWorkflow } from './propertyPhotoWorkflow';
import { propertyPhotoService, selectPropertyPhoto } from '../services/propertyPhotoDependencies';
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
  const [showRealPublication, setShowRealPublication] = useState(false);
  const [screen, setScreen] = useState<ListingScreen>(initialScreen);
  const [history, setHistory] = useState<ListingScreen[]>([]);
  const [draft, setDraft] = useState<ListingDraft>(initialScreen === 'postingType' ? emptyListingDraft : figmaPreviewDraft);
  const savedDraft = useRef(draft);
  const [propertyCreation] = useState(() => createPropertyCreationWorkflow(propertyCreationService));
  const propertyState = useSyncExternalStore(propertyCreation.subscribe, propertyCreation.getSnapshot);
  useEffect(() => { propertyCreation.activate(); return () => propertyCreation.dispose(); }, [propertyCreation]);
  useEffect(() => { if (screen === 'propertySetup' && !propertyState.loaded && !propertyState.uncertain) void propertyCreation.initialize(); }, [propertyCreation, screen]);
  const [propertyLocation] = useState(() => createPropertyLocationWorkflow(propertyLocationService));
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
  useEffect(() => { if (screen !== 'propertySetup') propertyLocation.close(); }, [screen, propertyLocation]);
  const [propertyPhotos] = useState(() => createPropertyPhotoWorkflow(propertyPhotoService, selectPropertyPhoto));
  const photoState = useSyncExternalStore(propertyPhotos.subscribe, propertyPhotos.getSnapshot);
  useEffect(() => { propertyPhotos.activate(); return () => propertyPhotos.dispose(); }, [propertyPhotos]);
  useEffect(() => { propertyPhotos.setProperty(propertyState.propertyId); }, [propertyPhotos, propertyState.propertyId]);
  useEffect(() => { if ((screen === 'photoUpload' || screen === 'photoManager') && propertyState.propertyId) void propertyPhotos.load(); }, [propertyPhotos, screen, propertyState.propertyId]);
  const [listingDraftPersistence] = useState(() => createListingDraftWorkflow(listingDraftService, row => {
    setDraft(current => { const next = applySavedListing(current, row); savedDraft.current = next; return next; });
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
  const previousProperty = useRef<string | null>(null);
  useEffect(() => { listingDraftPersistence.activate(); return () => listingDraftPersistence.dispose(); }, [listingDraftPersistence]);
  useEffect(() => {
    if (previousProperty.current && previousProperty.current !== propertyState.propertyId) {
      setDraft(current => { const next = { ...current, title: '', description: '', askingRent: '', houseRules: '', rentalTerm: emptyListingDraft.rentalTerm, securityDepositMonths: '1', advanceRentMonths: '1', minimumStayMonths: '', availableDate: '', rules: [] }; savedDraft.current = next; return next; });
    }
    previousProperty.current = propertyState.propertyId;
    listingDraftPersistence.setProperty(propertyState.propertyId);
    publication.setProperty(propertyState.propertyId);
    lifecycle.setListing(null);
    if (propertyState.propertyId) void publication.restore().then(ok => {
      const current = publication.getSnapshot();
      if (ok && current.propertyId === propertyState.propertyId && (!current.status || current.status === 'draft') && !current.uncertain) void listingDraftPersistence.load();
    });
  }, [listingDraftPersistence, publication, lifecycle, propertyState.propertyId]);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const operationBusy = () => !active.current || propertyCreation.getSnapshot().busy || propertyPhotos.getSnapshot().busy || listingDraftPersistence.getSnapshot().busy || publication.getSnapshot().busy || lifecycle.getSnapshot().busy;
  function canWriteListing(): boolean {
    const current = lifecycle.getSnapshot();
    return active.current && !current.busy && !current.uncertain && current.loaded && (!current.row || current.row.status === 'draft');
  }
  function canChangeLifecycle(): boolean {
    return active.current && !propertyCreation.getSnapshot().busy && !propertyPhotos.getSnapshot().busy && !listingDraftPersistence.getSnapshot().busy && !listingDraftPersistence.getSnapshot().uncertain && !publication.getSnapshot().busy && !publication.getSnapshot().uncertain;
  }
  const publicationReadOnly = () => !!propertyCreation.getSnapshot().propertyId && (!canWriteListing() || !publication.getSnapshot().loaded || publication.getSnapshot().uncertain || (!!publication.getSnapshot().status && publication.getSnapshot().status !== 'draft'));
  const displayDraft = propertyState.propertyId ? { ...draft, photoCount: photoState.photos.length, coverPhotoIndex: Math.max(0, photoState.photos.findIndex(p => p.is_cover)) } : draft;
  const listingDraftDirty = JSON.stringify(draft) !== JSON.stringify(savedDraft.current);
  const navigation = useNavigationConfirmation(() => listingDraftDirty || propertyCreation.dirty() || propertyPhotos.dirty());
  const [listing, setListing] = useState<PropertyListingSummary>(initialPreviewListing);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [listingQuery, setListingQuery] = useState('');

  const missingRequirements = useMemo(
    () => requiredListingFields.filter((requirement) => requirement.isMissing(displayDraft)),
    [draft, propertyState.propertyId, photoState.photos],
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
  const requestNavigation = (action: () => void) => {
    if (operationBusy()) return;
    if (lifecycle.getSnapshot().confirmation) { lifecycle.cancel(); return; }
    navigation.requestNavigation(() => {
      if (operationBusy()) return;
      propertyLocation.close();
      propertyCreation.discardLocalEdits();
      propertyPhotos.discardLocalEdits();
      setDraft(savedDraft.current);
      action();
    });
  };

  const navigate = (nextScreen: ListingScreen) => {
    if (operationBusy()) return;
    if (screen === 'propertySetup' && nextScreen !== 'propertySetup') propertyLocation.close();
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    if (operationBusy()) return;
    if (lifecycle.getSnapshot().confirmation) { lifecycle.cancel(); return; }
    if (screen === 'propertySetup' && ['searching', 'candidates', 'map'].includes(propertyLocation.getSnapshot().stage)) { propertyLocation.cancel(); return; }
    if ((screen === 'photoUpload' || screen === 'photoManager') && propertyPhotos.back()) return;
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

  const startCreate = () => {
    savedDraft.current = emptyListingDraft;
    setDraft(emptyListingDraft);
    setIsEditing(false);
    navigate('postingType');
  };

  const choosePropertyType = (propertyType: PropertyType) => updateDraft('propertyType', propertyType);

  const toggleFurnished = () => updateDraft('furnished', !draft.furnished);

  const changeCounter = (field: CounterField, delta: number) => {
    setDraft((current) => ({ ...current, [field]: Math.max(0, current[field] + delta) }));
  };

  const toggleAmenity = (amenity: Amenity) => {
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

  const saveDraft = async () => {
    if (operationBusy() || publicationReadOnly()) return;
    const outcome = await listingDraftPersistence.save(draft);
    if (!active.current) return;
    if (outcome === 'blocked') return;
    syncListingSummary('draft');
    setHistory([]);
    setScreen('dashboard');
    setIsEditing(false);
    setNotice(outcome === 'saved' ? 'Listing draft saved to your account. It is not published.' : 'Progress is local to this session, not saved to your account. A saved property, title, description and positive monthly rent are required.');
  };

  const requestPublish = () => {
    if (operationBusy()) return;
    if (propertyCreation.getSnapshot().propertyId) {
      const error = publicationEligibility(propertyCreation.getSnapshot().propertyId, listingDraftPersistence.getSnapshot().lastConfirmed, draft, listingDraftPersistence.getSnapshot().uncertain);
      if (error || publicationReadOnly()) { publication.report(error ?? 'Check the current publication status before continuing.'); return; }
      navigate('publishConfirmation'); return;
    }
    navigate(missingRequirements.length > 0 ? 'missingRequirements' : 'publishConfirmation');
  };

  const loadFigmaSample = () => {
    if (propertyCreation.getSnapshot().propertyId || operationBusy()) return;
    setDraft(figmaPreviewDraft);
    setHistory((current) => [...current, screen]);
    setScreen('preview');
    setNotice('Complete Figma sample data loaded locally for frontend evaluation.');
  };

  const confirmPublish = async () => {
    if (operationBusy()) return;
    if (propertyCreation.getSnapshot().propertyId) {
      const success = await publication.publish(listingDraftPersistence.getSnapshot().lastConfirmed, draft, listingDraftPersistence.getSnapshot().uncertain);
      if (success && active.current) { setShowRealPublication(true); setHistory([]); setScreen('published'); setIsEditing(false); }
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

  return {
    ...navigation,
    requestNavigation,
    propertyCreation,
    propertyState,
    propertyLocation,
    locationState,
    openPropertyLocation: () => {
      const current = propertyCreation.getSnapshot();
      if (operationBusy() || screen !== 'propertySetup' || current.step !== 'address' || !current.loaded || current.propertyId || current.uncertain) return;
      if (!current.draft.city || !current.draft.barangay.trim() || !current.draft.addressLine1.trim()) return;
      void propertyLocation.open({ addressRevision: current.locationRevision, setupId: 'physical-property-setup', query: propertyAddressQuery(current.draft) });
    },
    propertyPhotos,
    photoState,
    publication,
    publicationState,
    listingDraftReadOnly: publicationReadOnly(),
    checkPublication: async () => { const ok = publication.getSnapshot().listingId ? await publication.reconcile() : await publication.restore(); if (ok && active.current && (!publication.getSnapshot().status || publication.getSnapshot().status === 'draft') && !publication.getSnapshot().uncertain) await listingDraftPersistence.reconcile(); },
    lifecycle,
    lifecycleState,
    realListing: lifecycleState.row ?? (publicationState.lastConfirmed?.status !== 'draft' ? publicationState.lastConfirmed : null),
    lifecycleStatusLabel,
    lifecycleLabel,
    lifecycleActions: lifecycleState.row && !lifecycleState.uncertain && lifecycleState.loaded ? lifecycleActions(lifecycleState.row.status) : [],
    lifecycleBlocked: !canChangeLifecycle() || lifecycleState.busy || lifecycleState.uncertain || !lifecycleState.loaded,
    showRealPublication,
    openPublishedListing: () => { if (operationBusy()) return; setShowRealPublication(true); navigate('published'); },
    listingDraftPersistence,
    listingDraftState,
    canPersistListing: hasListingMinimum(propertyState.propertyId, draft),
    saveDraftLabel: hasListingMinimum(propertyState.propertyId, draft) ? 'Save listing draft to account' : 'Keep local progress',
    editSavedListingDraft: () => { if (!publicationReadOnly() && propertyCreation.getSnapshot().propertyId) navigate('rentTerms'); },
    continueListingPreview: () => { if (propertyCreation.getSnapshot().propertyId) navigate('rentTerms'); },
    activeTab: listingActiveTab(screen),
    backFromWorkspace: (onClose: () => void) => {
      if (operationBusy()) return;
      if (screen === 'propertySetup') { goBack(); return; }
      if (screen === 'postingType') requestNavigation(onClose);
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
    goBack,
    goDashboard: () => { if (!operationBusy()) requestNavigation(goDashboard); },
    updateDraft,
    startCreate: () => { if (!operationBusy()) requestNavigation(startCreate); },
    setListingQuery,
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
