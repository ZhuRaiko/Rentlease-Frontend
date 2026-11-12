import {useDiscoverySaveToast} from './useDiscoverySaveToast';
import {useSavedListings} from './useSavedListings';
import {recommendationService} from '../services/recommendationDependencies';
import {createRecommendationWorkflow} from './recommendationWorkflow';
import type {RecommendationSort} from '../../property-recommendations/models/ContentRecommendation';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
import {publicIdentityLabel} from '../../../shared/models/PublicIdentity';
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
  // Form defaults are not user preferences until explicitly saved for this account.
  const [committedPreferences,setCommittedPreferences]=useState<{owner:string|undefined;value:MatchingPreferences|null}>(()=>({owner:options.accountId,value:options.initialPreferences??null}));
  const activePreferences=committedPreferences.owner===options.accountId?committedPreferences.value:null;
  const [recommendationSort,setRecommendationSort]=useState<RecommendationSort|null>(null);
  const recommendations=useMemo(()=>createRecommendationWorkflow(recommendationService,options.accountId),[options.accountId]);
  const recommendationState=useSyncExternalStore(recommendations.subscribe,recommendations.getSnapshot,recommendations.getSnapshot);
  useEffect(()=>{recommendations.activate();return()=>recommendations.dispose();},[recommendations]);
  useEffect(()=>{if(committedPreferences.owner!==options.accountId){const fresh=options.initialPreferences??recommendedMatchingPreferences;setMatchingPreferences(fresh);savedPreferences.current=fresh;}setRecommendationSort(null);setCommittedPreferences({owner:options.accountId,value:options.initialPreferences??null});},[options.accountId,options.initialPreferences]);

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
  useEffect(()=>{recommendations.configure(activePreferences,manualState.filters,manualState.query);},[recommendations,JSON.stringify(activePreferences),JSON.stringify(manualState.filters),manualState.query]);
  const rankedSearch=recommendationSort!==null&&activePreferences!==null;
  const rankedRows=recommendationSort==='Best Match'?recommendationState.bestMatch:recommendationState.recommended;
  const searchResultState=rankedSearch?{...manualState,rows:rankedRows.map(r=>r.candidate.listing),phase:recommendationState.phase==='success'?'success' as const:recommendationState.phase==='error'||recommendationState.phase==='unavailable'?'error' as const:'loading' as const,error:recommendationState.error??(recommendationState.phase==='unavailable'?'Choose supported Matching Preferences to rank rentals.':null),more:false,refreshing:false,hasMore:false}:manualState;
  const resultSortLabel=rankedSearch?recommendationSort:manualState.sort;
  const discoverRows=discoverState.rows;
  const ownerIdentities=usePublicIdentitiesViewModel(options.accountId,manualState.detail?[manualState.detail.ownerId]:[]);
  const [liveFilterDraft,setLiveFilterDraft] = useState<SearchFilters>(defaultSearchFilters);
  useEffect(() => { manual.activate(); return () => manual.dispose(); }, [manual]);
  useEffect(() => { if (screen !== 'searchLocation') return; const timer = setTimeout(() => { void manual.locations(query); }, 250); return () => { clearTimeout(timer); manual.cancelLocations(); }; }, [screen,query,manual]);
  const gpsState = useSyncExternalStore(gps.subscribe, gps.getSnapshot, gps.getSnapshot);
  useEffect(() => { gps.activate(); return () => gps.dispose(); }, [gps]);
  const bookmarks=useSavedListings(options.accountId,[...discoverState.rows,...manualState.rows,...recommendationState.recommended.map(r=>r.candidate.listing),...(manualState.detail?[manualState.detail]:[])].map(r=>r.listingId),screen==='savedListings');
  const saveToast=useDiscoverySaveToast(bookmarks.workflow,options.accountId,screen==='home');
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
    setRecommendationSort(null); void manual.search(nextQuery, typeof suggestion === 'string' ? undefined : { ...manualState.filters, city: suggestion.city as SearchFilters['city'] });
  };
  const submitSearch = () => { navigate('resultsList'); const filters = suggestedCity.current ? { ...manualState.filters, city: '' as const } : manualState.filters; suggestedCity.current = false; setRecommendationSort(null); void manual.search(query,filters); };

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

  const applyFilters = () => { setScreen('resultsList'); setRecommendationSort(null); void manual.search(query); };
  const openLiveFilters = () => { setLiveFilterDraft({ ...manualState.filters, types:[...manualState.filters.types], amenityIds:[...manualState.filters.amenityIds] }); navigate('filters'); void manual.catalogue(); };
  const applyLiveFilters = () => { setRecommendationSort(null); suggestedCity.current = false; setHistory(current => current.slice(0,-1)); setScreen('resultsList'); void manual.applyFilters(liveFilterDraft); };
  const chooseLiveSort = (value: SearchSort) => { setRecommendationSort(null); setHistory(current => current.slice(0,-1)); setScreen('resultsList'); void manual.sort(value); };

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
    setCommittedPreferences({owner:options.accountId,value:matchingPreferences});
    setNotice('Preferences kept for this session. Recommendations use your selected preferences.');
  };
  const skipMatchingIntroduction = async () => {
    if (!await finishIntroduction()) return;
    setMatchingPreferences(savedPreferences.current); setScreen('home'); setHistory([]);
  };

  const chooseSort = (nextSort: SortOption) => {
    if(nextSort==='Recommended'||nextSort==='Best Match'){if(!activePreferences){setNotice('Save Matching Preferences to enable preference-based sorting.');return;}setRecommendationSort(nextSort);setHistory(current=>current.slice(0,-1));setScreen('resultsList');return;}
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
  const toggleSaved = (id:string) => void bookmarks.workflow.toggle(id);
  const isSaved = (id:string) => bookmarks.state.states[id]===true;
  const savedControl=(id:string)=>({saved:bookmarks.state.states[id],busy:bookmarks.state.working!==null,locked:!!bookmarks.state.pending&&bookmarks.state.pending.id!==id,retry:bookmarks.state.pending?.id===id,desired:bookmarks.state.pending?.id===id?bookmarks.state.pending.saved:undefined,onPress:()=>bookmarks.state.pending?.id===id?bookmarks.retry():toggleSaved(id)});
  const showNoResultsPreview = () => { navigate('resultsList'); setRecommendationSort(null); void manual.search(query); };
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

  const openSavedListings = () => navigate('savedListings');

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
    saveToast,homeTab,openForYou:()=>setHomeTab('forYou'),discover,discoverState,discoverRows,
    recommendations,recommendationState,hasRecommendationPreferences:activePreferences!==null,rankedSearch,searchResultState,resultSortLabel,
    openRecommendedResults:()=>{setRecommendationSort('Recommended');setHistory(current=>[...current,screen]);setScreen('resultsList');},
    refreshDiscover:()=>{void discover.refresh();void recommendations.load();},
    retryResults:()=>rankedSearch?recommendations.load():manual.retry(),
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
    listingOwnerIdentity:manualState.detail?ownerIdentities[manualState.detail.ownerId]:undefined,
    listingOwnerLabel:publicIdentityLabel(manualState.detail?ownerIdentities[manualState.detail.ownerId]:undefined,'owner'),
    isOwnListing:!!manualState.detail&&manualState.detail.ownerId===options.accountId,
    contactOwner:async()=>{const id=await manual.startInquiry();if(id)options.onStartInquiry?.(id);},
    savedState:bookmarks.state,savedListings:bookmarks.workflow,savedRetry:bookmarks.retry,savedRefresh:bookmarks.refresh,savedControl,
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
