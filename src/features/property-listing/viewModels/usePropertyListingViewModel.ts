import { useMemo, useState } from 'react';

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
  const [screen, setScreen] = useState<ListingScreen>(initialScreen);
  const [history, setHistory] = useState<ListingScreen[]>([]);
  const [draft, setDraft] = useState<ListingDraft>(figmaPreviewDraft);
  const [listing, setListing] = useState<PropertyListingSummary>(initialPreviewListing);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [listingQuery, setListingQuery] = useState('');

  const missingRequirements = useMemo(
    () => requiredListingFields.filter((requirement) => requirement.isMissing(draft)),
    [draft],
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

  const navigate = (nextScreen: ListingScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1) ?? 'dashboard';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
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
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const startCreate = () => {
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
    setDraft((current) => ({
      ...current,
      rules: current.rules.includes(rule)
        ? current.rules.filter((item) => item !== rule)
        : [...current.rules, rule],
    }));
  };

  const selectSamplePhotos = () => {
    setDraft((current) => ({ ...current, photoCount: 4, coverPhotoIndex: 0 }));
    setNotice('Four Figma sample photos selected locally. Nothing was uploaded.');
  };

  const removeSamplePhotos = () => {
    setDraft((current) => ({ ...current, photoCount: 0, coverPhotoIndex: 0 }));
    setNotice('Local photo selection cleared.');
  };

  const selectCoverPhoto = (coverPhotoIndex: number) => {
    setDraft((current) => ({ ...current, coverPhotoIndex }));
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

  const saveDraft = () => {
    syncListingSummary('draft');
    setHistory([]);
    setScreen('dashboard');
    setIsEditing(false);
    setNotice('Listing saved only in local preview state. No Supabase record was created.');
  };

  const requestPublish = () => {
    navigate(missingRequirements.length > 0 ? 'missingRequirements' : 'publishConfirmation');
  };

  const loadFigmaSample = () => {
    setDraft(figmaPreviewDraft);
    setHistory((current) => [...current, screen]);
    setScreen('preview');
    setNotice('Complete Figma sample data loaded locally for frontend evaluation.');
  };

  const confirmPublish = () => {
    syncListingSummary('published');
    setHistory([]);
    setScreen('published');
    setIsEditing(false);
    setNotice('Published state is local preview only. No backend submission occurred.');
  };

  const openListing = (listingId?: string) => {
    const selected = landlordListingPreviews.find((item) => item.id === listingId);
    if (selected) setListing(selected);
    navigate('published');
  };

  const openManagement = (listingId?: string) => {
    const selected = landlordListingPreviews.find((item) => item.id === listingId);
    if (selected) setListing(selected);
    navigate('management');
  };

  const startEdit = () => navigate('editListing');

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
    syncListingSummary(status);
    setHistory([]);
    setScreen('management');
    setNotice(`Listing is ${status} in local preview state only.`);
  };

  return {
    screen,
    draft,
    listing,
    listingQuery,
    filteredListingPreviews,
    notice,
    isEditing,
    missingRequirements,
    navigate,
    goBack,
    goDashboard,
    updateDraft,
    startCreate,
    setListingQuery,
    choosePropertyType,
    toggleFurnished,
    changeCounter,
    toggleAmenity,
    toggleRule,
    selectSamplePhotos,
    removeSamplePhotos,
    selectCoverPhoto,
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
