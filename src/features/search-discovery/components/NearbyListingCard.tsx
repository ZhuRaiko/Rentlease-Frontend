import type {NearbyListing} from '../models/GpsProximity';
import {listingCardFromNearby} from '../models/ListingCardModel';
import {ListingCard} from './ListingCard';

/** A listing from the nearby search: the shared card, with its distance and availability lines. */
export function NearbyListingCard({listing, onPress}: {listing: NearbyListing; onPress: () => void}) {
  return <ListingCard model={listingCardFromNearby(listing)} onPress={onPress} />;
}
