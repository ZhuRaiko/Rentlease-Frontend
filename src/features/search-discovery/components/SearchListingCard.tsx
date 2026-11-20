import type {SearchListing} from '../models/ManualSearch';
import {listingCardFromSearch} from '../models/ListingCardModel';
import {ListingCard} from './ListingCard';
import type {SaveControl} from './SaveListingButton';

/** A listing from the real search: the shared card, nothing else. Discover, For You, Saved listings and search results all render it. */
export function SearchListingCard({listing, onPress, save, rank, fit}: {listing: SearchListing; onPress: () => void; save?: SaveControl | undefined; rank?: string | undefined; fit?: readonly string[] | undefined}) {
  return <ListingCard fit={fit ?? []} model={listingCardFromSearch(listing)} onPress={onPress} rank={rank} save={save} />;
}
