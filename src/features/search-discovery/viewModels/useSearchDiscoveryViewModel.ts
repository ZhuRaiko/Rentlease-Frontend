import { useNavigationConfirmation } from '../../../shared/viewModels/useNavigationConfirmation';
import {propertyOwnerLabel} from '../../../shared/models/PublicInquiryIdentity';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gpsProximityDependencies } from '../services/gpsProximityDependencies';
import { createGpsProximityWorkflow } from './gpsProximityWorkflow';
import { manualSearchService } from '../services/manualSearchDependencies';
import { createManualSearchWorkflow } from './manualSearchWorkflow';
import { defaultSearchFilters, type SearchFilters, type SearchSort, type AvailableLocation } from '../models/ManualSearch';

import {
  defaultDiscoveryFilters,
  matchingPreferenceFilters,
  recommendedMatchingPreferences,
  type DiscoveryFilters,
  type DiscoveryProperty,
  type DiscoveryScreen,
  type MatchingPreferences,
  type PropertyKind,
  type SortOption,
} from '../models/SearchDiscovery';

export function useSearchDiscoveryViewModel(
  initialScreen: 'home' | 'matchingPreferences' = 'home',
  options: { onStartInquiry?:((conversationId:string)=>void)|undefined; accountId?: string | undefined; initialPreferences?: MatchingPreferences | undefined; introduction?: boolean; onSavePreferences?: ((value: MatchingPreferences) => void) | undefined; onIntroductionComplete?: (() => Promise<boolean>) | undefined } = {},
) {
  const [screen, setScreen] = useState<DiscoveryScreen>(initialScreen);
  const [history, setHistory] = useState<DiscoveryScreen[]>([]);
  const [homeTab,setHomeTab]=useState<'discover'|'forYou'>('discover');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>(() => options.initialPreferences ? matchingPreferenceFilters(options.initialPreferences) : defaultDiscoveryFilters);
  const [filterDraft, setFilterDraft] = useState<DiscoveryFilters>(() => options.initialPreferences ? matchingPreferenceFilters(options.initialPreferences) : defaultDiscoveryFilters);
  const [matchingPreferences, setMatchingPreferences] = useState<MatchingPreferences>(
    options.initialPreferences ?? recommendedMatchingPreferences,
  );
  const savedPreferences = useRef(matchingPreferences);
  const [introductionPending, setIntroductionPending] = useState(options.introduction ?? false);
  const [introductionError, setIntroductionError] = useState<string | null>(null);
  const [isCompletingIntroduction, setIsCompletingIntroduction] = useState(false);
  const completionInFlight = useRef(false);
  const suggestedCity = useRef(false);
  const navigation = useNavigationConfirmation(screen === 'matchingPreferences' && JSON.stringify(matchingPreferences) !== JSON.stringify(savedPreferences.current));
  const [sortOption, setSortOption] = useState<SortOption>('Recommended');
  const gps = useMemo(() => createGpsProximityWorkflow(gpsProximityDependencies), [options.accountId]);
  const nearbyMapStyle = useMemo(()=>{try{return gpsProximityDependencies.mapStyle?.()??null;}catch{return null;}},[gps]);
  const manual = useMemo(() => createManualSearchWorkflow(manualSearchService), [options.accountId]);
  const discover=useMemo(()=>createManualSearchWorkflow(manualSearchService,{publishedOnly:true}),[options.accountId]);
  const discoverState=useSyncExternalStore(discover.subscribe,discover.getSnapshot,discover.getSnapshot);
  useEffect(()=>{discover.activate();setHomeTab('discover');return()=>discover.dispose();},[discover]);
  useEffect(()=>{if(screen==='home'&&homeTab==='discover')void discover.ensureLoaded();},[discover,screen,homeTab]);
  const manualState = useSyncExternalStore(manual.subscribe, manual.getSnapshot, manual.getSnapshot);
  const [liveFilterDraft,setLiveFilterDraft] = useState<SearchFilters>(defaultSearchFilters);
  useEffect(() => { manual.activate(); return () => manual.dispose(); }, [manual]);
  useEffect(() => { if (screen !== 'searchLocation') return; const timer = setTimeout(() => { void manual.locations(query); }, 250); return () => { clearTimeout(timer); manual.cancelLocations(); }; }, [screen,query,manual]);
  const gpsState = useSyncExternalStore(gps.subscribe, gps.getSnapshot, gps.getSnapshot);
  useEffect(() => { gps.activate(); return () => gps.dispose(); }, [gps]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const nearbyDetail = useRef(false);
  useEffect(() => { nearbyDetail.current=false; }, [options.accountId]);

  const navigate = (nextScreen: DiscoveryScreen) => {
    nearbyDetail.current=false;
    if (nextScreen !== 'nearbyResults' && nextScreen !== 'locationPermission') gps.reset();
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    if(screen==='propertyDetails' && nearbyDetail.current) {
      nearbyDetail.current=false;manual.cancelDetail();
      setHistory(current=>current.slice(0,-1));setScreen('nearbyResults');setNotice(null);return;
    }
    gps.reset();
    if (screen === 'propertyDetails') manual.cancelDetail();
    if (screen === 'matchingPreferences') setMatchingPreferences(savedPreferences.current);
    setHistory((current) => {
      const previous = current.at(-1) ?? 'home';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  // Legacy prototype Views keep a typed empty contract; real screens bind manualState only.
  const visibleProperties: DiscoveryProperty[] = [];
  const savedProperties: DiscoveryProperty[] = [];
  const selectedProperty = undefined as DiscoveryProperty | undefined;
  const suggestions = manualState.locations;
  const chooseSuggestion = (suggestion: AvailableLocation | string) => {
    const nextQuery = typeof suggestion === 'string' ? suggestion : suggestion.query;
    suggestedCity.current = typeof suggestion !== 'string';
    setQuery(nextQuery); navigate('resultsList');
    void manual.search(nextQuery, typeof suggestion === 'string' ? undefined : { ...manualState.filters, city: suggestion.city as SearchFilters['city'] });
  };
  const submitSearch = () => { navigate('resultsList'); const filters = suggestedCity.current ? { ...manualState.filters, city: '' as const } : manualState.filters; suggestedCity.current = false; void manual.search(query,filters); };

  const clearSearch = () => {
    gps.reset();
    setQuery('');
    setFilters(defaultDiscoveryFilters);
    manual.reset();
    setSortOption('Recommended');
    setScreen('home');
    setHistory([]);
  };

  const openFilters = () => {
    setFilterDraft(filters);
    navigate('filters');
  };

  const updateFilterDraft = <TField extends keyof DiscoveryFilters>(
    field: TField,
    value: DiscoveryFilters[TField],
  ) => setFilterDraft((current) => ({ ...current, [field]: value }));

  const toggleFilterPropertyKind = (kind: PropertyKind) => {
    setFilterDraft((current) => ({
      ...current,
      propertyKinds: current.propertyKinds.includes(kind)
        ? current.propertyKinds.filter((item) => item !== kind)
        : [...current.propertyKinds, kind],
    }));
  };

  const toggleFilterAmenity = (amenity: string) => {
    setFilterDraft((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

  const resetFilterDraft = () => setFilterDraft(defaultDiscoveryFilters);

  const applyFilters = () => { setScreen('resultsList'); void manual.search(query); };
  const openLiveFilters = () => { setLiveFilterDraft({ ...manualState.filters, types:[...manualState.filters.types], amenityIds:[...manualState.filters.amenityIds] }); navigate('filters'); void manual.catalogue(); };
  const applyLiveFilters = () => { suggestedCity.current = false; setHistory(current => current.slice(0,-1)); setScreen('resultsList'); void manual.applyFilters(liveFilterDraft); };
  const chooseLiveSort = (value: SearchSort) => { setHistory(current => current.slice(0,-1)); setScreen('resultsList'); void manual.sort(value); };

  const updateMatchingPreference = <TField extends keyof MatchingPreferences>(
    field: TField,
    value: MatchingPreferences[TField],
  ) => setMatchingPreferences((current) => ({ ...current, [field]: value }));

  const togglePreferencePropertyKind = (kind: PropertyKind) => {
    setMatchingPreferences((current) => ({
      ...current,
      propertyKinds: current.propertyKinds.includes(kind)
        ? current.propertyKinds.filter((item) => item !== kind)
        : [...current.propertyKinds, kind],
    }));
  };

  const togglePreferenceAmenity = (amenity: string) => {
    setMatchingPreferences((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

  const finishIntroduction = async () => {
    if (!introductionPending) return true;
    if (completionInFlight.current) return false;
    completionInFlight.current = true; setIsCompletingIntroduction(true); setIntroductionError(null);
    try {
      const complete = await options.onIntroductionComplete?.();
      if (!complete) { setIntroductionError('Could not remember your choice on this device. Please try Save or Skip again.'); return false; }
      setIntroductionPending(false); return true;
    } catch { setIntroductionError('Could not remember your choice on this device. Please try Save or Skip again.'); return false; }
    finally { completionInFlight.current = false; setIsCompletingIntroduction(false); }
  };
  const saveMatchingPreferences = async () => {
    if (completionInFlight.current) return;
    const preferenceFilters = matchingPreferenceFilters(matchingPreferences);
    savedPreferences.current = matchingPreferences;
    options.onSavePreferences?.(matchingPreferences);
    if (!await finishIntroduction()) return;
    setFilters(preferenceFilters); setQuery(''); setScreen('home'); setHistory([]);
    setNotice('Preferences kept for this session. Recommendations are not connected.');
  };
  const skipMatchingIntroduction = async () => {
    if (!await finishIntroduction()) return;
    setMatchingPreferences(savedPreferences.current); setScreen('home'); setHistory([]);
  };

  const chooseSort = (nextSort: SortOption) => {
    if (nextSort === 'Price: Low to High' || nextSort === 'Price: High to Low') chooseLiveSort(nextSort);
  };

  const movePreferenceItem = (
    field: 'unitSpecificationRanking' | 'amenityRanking' | 'factorRanking',
    index: number,
    direction: -1 | 1,
  ) => {
    setMatchingPreferences((current) => {
      const values = [...current[field]];
      const target = index + direction;
      if (target < 0 || target >= values.length) return current;
      const currentItem = values[index];
      const targetItem = values[target];
      if (currentItem === undefined || targetItem === undefined) return current;
      values[index] = targetItem;
      values[target] = currentItem;
      return { ...current, [field]: values };
    });
  };

  const requestCurrentLocation = () => {
    manual.reset();
    gps.reset();
    navigate('locationPermission');
  };

  const allowCurrentLocation = () => {
    setScreen('nearbyResults');
    void gps.start();
  };

  const declineCurrentLocation = () => goBack();

  const openProperty = (listingId: string) => {
    setGalleryIndex(0);
    if(screen==='nearbyResults') { nearbyDetail.current=true;setHistory(current=>[...current,screen]);setScreen('propertyDetails');setNotice(null); }
    else navigate('propertyDetails');
    void manual.openDetail(listingId);
  };
  const toggleSaved = (_listingId: string) => setNotice('Saved rentals are not connected yet.');
  const isSaved = (_listingId: string) => false;
  const showNoResultsPreview = () => { navigate('resultsList'); void manual.search(query); };
  const showSearchErrorPreview = showNoResultsPreview;
  const retrySearch = () => { setScreen('resultsList'); void manual.retry(); };

  const openHome = () => {
    setHomeTab('discover');setQuery('');
    manual.reset();
    suggestedCity.current = false;
    gps.reset();
    if (screen === 'propertyDetails') manual.cancelDetail();
    if (screen === 'matchingPreferences') setMatchingPreferences(savedPreferences.current);
    if (introductionPending) setIntroductionPending(false);
    setScreen('home');
    setHistory([]);
  };

  const openSavedListings = () => {
    gps.reset();
    setScreen('savedListings');
    setHistory([]);
  };

  const openMatchingPreferences = () => {
    gps.reset();
    setScreen('matchingPreferences');
    setHistory([]);
  };

  const closeFromWorkspace = (onClose: () => void) => { if (!completionInFlight.current) navigation.requestNavigation(introductionPending ? () => { void skipMatchingIntroduction(); } : onClose); };

  return {
    ...navigation,
    introductionPending,
    closeFromWorkspace,
    skipMatchingIntroduction,
    introductionError,
    isCompletingIntroduction,
    backFromWorkspace: (onClose: () => void, onRootBack: () => void) => {
      if (completionInFlight.current) return;
      if (introductionPending) navigation.requestNavigation(() => { void skipMatchingIntroduction(); });
      else if (screen === 'home') navigation.requestNavigation(onRootBack);
      else if (initialScreen === 'matchingPreferences' && screen === 'matchingPreferences' && history.length === 0) navigation.requestNavigation(onClose);
      else navigation.requestNavigation(goBack);
    },
    screen,
    homeTab,openForYou:()=>setHomeTab('forYou'),discover,discoverState,
    query,
    filters,
    filterDraft,
    matchingPreferences,
    sortOption,
    selectedProperty,
    visibleProperties,
    savedProperties,
    suggestions,
    gps,
    nearbyMapStyle,
    gpsState,
    manual, manualState, liveFilterDraft, setLiveFilterDraft, openLiveFilters, applyLiveFilters, chooseLiveSort,
    resetLiveFilters: () => setLiveFilterDraft(defaultSearchFilters()),
    galleryIndex,
    notice,
    navigate,
    goBack,
    setQuery,
    chooseSuggestion,
    submitSearch,
    clearSearch,
    openFilters,
    updateFilterDraft,
    toggleFilterPropertyKind,
    toggleFilterAmenity,
    resetFilterDraft,
    applyFilters,
    updateMatchingPreference,
    togglePreferencePropertyKind,
    togglePreferenceAmenity,
    saveMatchingPreferences,
    chooseSort,
    movePreferenceItem,
    requestCurrentLocation,
    allowCurrentLocation,
    declineCurrentLocation,
    openProperty,
    listingOwnerLabel:propertyOwnerLabel,
    isOwnListing:!!manualState.detail&&manualState.detail.ownerId===options.accountId,
    contactOwner:async()=>{const id=await manual.startInquiry();if(id)options.onStartInquiry?.(id);},
    toggleSaved,
    isSaved,
    setGalleryIndex,
    showNoResultsPreview,
    showSearchErrorPreview,
    retrySearch,
    openHome,
    openSavedListings,
    openMatchingPreferences,
    setNotice,
  };
}

export type SearchDiscoveryViewModel = ReturnType<typeof useSearchDiscoveryViewModel>;
