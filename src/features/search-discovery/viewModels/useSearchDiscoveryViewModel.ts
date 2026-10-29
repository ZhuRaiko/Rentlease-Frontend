import { useNavigationConfirmation } from '../../../shared/viewModels/useNavigationConfirmation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gpsProximityDependencies } from '../services/gpsProximityDependencies';
import { createGpsProximityWorkflow } from './gpsProximityWorkflow';

import {
  defaultDiscoveryFilters,
  matchingPreferenceFilters,
  locationSuggestions,
  previewDiscoveryProperties,
  recommendedMatchingPreferences,
  type DiscoveryFilters,
  type DiscoveryProperty,
  type DiscoveryScreen,
  type MatchingPreferences,
  type PropertyKind,
  type SortOption,
} from '../models/SearchDiscovery';

function matchesFilters(property: DiscoveryProperty, filters: DiscoveryFilters, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery =
    !normalizedQuery ||
    property.title.toLocaleLowerCase().includes(normalizedQuery) ||
    property.city.toLocaleLowerCase().includes(normalizedQuery) ||
    property.address.toLocaleLowerCase().includes(normalizedQuery);
  const matchesCity =
    !filters.city || property.city.toLocaleLowerCase() === filters.city.toLocaleLowerCase();
  const matchesKind =
    filters.propertyKinds.length === 0 || filters.propertyKinds.includes(property.propertyKind);
  const matchesAmenities = filters.amenities.every((amenity) =>
    property.amenities.includes(amenity),
  );

  return (
    matchesQuery &&
    matchesCity &&
    matchesKind &&
    matchesAmenities &&
    property.rent >= filters.minimumRent &&
    property.rent <= filters.maximumRent &&
    property.bedrooms >= filters.minimumBedrooms &&
    property.bathrooms >= filters.minimumBathrooms &&
    property.landArea >= filters.minimumLandArea &&
    (!filters.furnishedOnly || property.furnished)
  );
}

function sortProperties(properties: DiscoveryProperty[], sort: SortOption) {
  const next = [...properties];
  if (sort === 'Price: Low to High') return next.sort((a, b) => a.rent - b.rent);
  if (sort === 'Price: High to Low') return next.sort((a, b) => b.rent - a.rent);
  return next.sort((a, b) => b.matchScore - a.matchScore);
}

export function useSearchDiscoveryViewModel(
  initialScreen: 'home' | 'matchingPreferences' = 'home',
  options: { accountId?: string | undefined; initialPreferences?: MatchingPreferences | undefined; introduction?: boolean; onSavePreferences?: ((value: MatchingPreferences) => void) | undefined; onIntroductionComplete?: (() => Promise<boolean>) | undefined } = {},
) {
  const [screen, setScreen] = useState<DiscoveryScreen>(initialScreen);
  const [history, setHistory] = useState<DiscoveryScreen[]>([]);
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
  const navigation = useNavigationConfirmation(screen === 'matchingPreferences' && JSON.stringify(matchingPreferences) !== JSON.stringify(savedPreferences.current));
  const [sortOption, setSortOption] = useState<SortOption>('Recommended');
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    previewDiscoveryProperties[0]?.id ?? '',
  );
  const [savedPropertyIds, setSavedPropertyIds] = useState<string[]>([]);
  const gps = useMemo(() => createGpsProximityWorkflow(gpsProximityDependencies), [options.accountId]);
  const gpsState = useSyncExternalStore(gps.subscribe, gps.getSnapshot, gps.getSnapshot);
  useEffect(() => { gps.activate(); return () => gps.dispose(); }, [gps]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const navigate = (nextScreen: DiscoveryScreen) => {
    if (nextScreen !== 'nearbyResults' && nextScreen !== 'locationPermission') gps.reset();
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    gps.reset();
    if (screen === 'matchingPreferences') setMatchingPreferences(savedPreferences.current);
    setHistory((current) => {
      const previous = current.at(-1) ?? 'home';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const visibleProperties = useMemo(
    () =>
      sortProperties(
        previewDiscoveryProperties.filter((property) => matchesFilters(property, filters, query)),
        sortOption,
      ),
    [filters, query, sortOption],
  );

  const savedProperties = useMemo(
    () => previewDiscoveryProperties.filter((property) => savedPropertyIds.includes(property.id)),
    [savedPropertyIds],
  );

  const selectedProperty =
    previewDiscoveryProperties.find((property) => property.id === selectedPropertyId) ??
    previewDiscoveryProperties[0];

  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return locationSuggestions;
    return locationSuggestions.filter((suggestion) =>
      suggestion.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  const chooseSuggestion = (suggestion: string) => {
    const city = suggestion.split(',')[0]?.trim() ?? '';
    setQuery(city);
    setFilters((current) => ({ ...current, city }));
    setScreen('resultsList');
    setHistory((current) => [...current, 'searchLocation']);
  };

  const submitSearch = () => {
    const hasMatches = previewDiscoveryProperties.some((property) =>
      matchesFilters(property, filters, query),
    );
    navigate(hasMatches ? 'resultsList' : 'noResults');
  };

  const clearSearch = () => {
    gps.reset();
    setQuery('');
    setFilters(defaultDiscoveryFilters);
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

  const applyFilters = () => {
    setFilters(filterDraft);
    const hasMatches = previewDiscoveryProperties.some((property) =>
      matchesFilters(property, filterDraft, query),
    );
    setScreen(hasMatches ? 'resultsList' : 'noResults');
    setNotice(null);
  };

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
    setNotice('Preferences saved for this session. Only sample listings were filtered; no live recommendations were activated.');
  };
  const skipMatchingIntroduction = async () => {
    if (!await finishIntroduction()) return;
    setMatchingPreferences(savedPreferences.current); setScreen('home'); setHistory([]);
  };

  const chooseSort = (nextSort: SortOption) => {
    setSortOption(nextSort);
    setScreen('resultsList');
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
    gps.reset();
    navigate('locationPermission');
  };

  const allowCurrentLocation = () => {
    setScreen('nearbyResults');
    void gps.start();
  };

  const declineCurrentLocation = () => goBack();

  const openProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setGalleryIndex(0);
    navigate('propertyDetails');
  };

  const toggleSaved = (propertyId: string) => {
    setSavedPropertyIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId],
    );
  };

  const isSaved = (propertyId: string) => savedPropertyIds.includes(propertyId);

  const showNoResultsPreview = () => navigate('noResults');
  const showSearchErrorPreview = () => navigate('searchError');
  const retrySearch = () => {
    setNotice('Search preview restored. No network request was made.');
    setScreen('resultsList');
  };

  const openHome = () => {
    gps.reset();
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
    gpsState,
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
