import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { ListingDraft } from '@/features/listings/types';

const emptyDraft: ListingDraft = {
  title: '',
  description: '',
  city: 'Imus',
  address: 'Brgy. Alapan II-B, Imus, Cavite, Philippines',
  price: '',
  bedrooms: 2,
  bathrooms: 1,
  parkingSpaces: 1,
  sizeSqm: '110',
  propertyType: 'House',
  furnishingStatus: 'furnished',
  amenities: ['wifi', 'parking', 'air_conditioning'],
  lat: 14.4064,
  lng: 120.9405,
  paymentTerms: '1 month advance + 2 months deposit',
  usedSuggestedPrice: true,
};

type ListingDraftContextValue = {
  draft: ListingDraft;
  updateDraft: (values: Partial<ListingDraft>) => void;
  resetDraft: () => void;
};

const ListingDraftContext = createContext<ListingDraftContextValue | null>(null);

export function ListingDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<ListingDraft>(emptyDraft);

  const value = useMemo(
    () => ({
      draft,
      updateDraft: (values: Partial<ListingDraft>) => {
        setDraft((current) => ({ ...current, ...values }));
      },
      resetDraft: () => {
        setDraft(emptyDraft);
      },
    }),
    [draft]
  );

  return <ListingDraftContext.Provider value={value}>{children}</ListingDraftContext.Provider>;
}

export function useListingDraft() {
  const context = useContext(ListingDraftContext);

  if (!context) {
    throw new Error('useListingDraft must be used inside ListingDraftProvider.');
  }

  return context;
}
