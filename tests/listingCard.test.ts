/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Constants} from '../src/shared/services/supabase/database.types';
import {bathroomsText, bedroomsText, listingCardFromNearby, listingCardFromSearch, locationText, propertyTypeLabel, rentDigits, rentText} from '../src/features/search-discovery/models/ListingCardModel';
import {cardHarness} from './savedListingsPresentation.test';

const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
const texts=(tree:any)=>nodes(tree).filter(n=>n.type==='Text').map(n=>[n.props.children].flat(Infinity).filter(c=>typeof c==='string').join(''));
const base={id:'l1',title:'Condo',thumbnailUrl:null,propertyType:'Condominium',rent:'3,050',location:'Maharlika West, Tagaytay',bedrooms:1,bathrooms:1,notes:[]};

test('every property type value in the database types has a normal-capitals label', () => {
  const expected: Record<string, string> = {apartment: 'Apartment', boarding_house: 'Boarding house', bedspace: 'Bedspace', room: 'Room', studio: 'Studio', condominium: 'Condominium', house: 'House', dormitory: 'Dormitory', other: 'Other'};
  const values = [...Constants.public.Enums.property_type] as string[];
  assert.deepEqual([...values].sort(), Object.keys(expected).sort(), 'a new database value must get a label here');
  for (const value of values) { assert.equal(propertyTypeLabel(value), expected[value], value); assert.match(propertyTypeLabel(value), /^[A-Z]/); assert.doesNotMatch(propertyTypeLabel(value), /_/); }
});
test('the type label has a safe fallback for unknown, odd-cased and empty values', () => {
  assert.equal(propertyTypeLabel('tiny_house'), 'Tiny house');
  assert.equal(propertyTypeLabel('  student__dorm '), 'Student dorm');
  assert.equal(propertyTypeLabel('CONDOMINIUM'), 'Condominium');
  assert.equal(propertyTypeLabel(''), ''); assert.equal(propertyTypeLabel(null), ''); assert.equal(propertyTypeLabel(undefined), '');
});
test('bedroom and bathroom text is singular for 1, plural above, and hidden for 0, missing or not a number', () => {
  assert.deepEqual([1, 2, 5].map(bedroomsText), ['1 bedroom', '2 bedrooms', '5 bedrooms']);
  assert.deepEqual([1, 2].map(bathroomsText), ['1 bathroom', '2 bathrooms']);
  for (const none of [0, null, undefined, NaN, -1]) { assert.equal(bedroomsText(none), null); assert.equal(bathroomsText(none), null); }
});
test('rent: whole numbers are grouped, decimal strings keep their decimals, a missing rent says so', () => {
  assert.equal(rentDigits(22000), '22,000'); assert.equal(rentDigits('18500.50'), '18,500.50'); assert.equal(rentDigits('9000'), '9,000'); assert.equal(rentDigits(null), null); assert.equal(rentDigits(''), null);
  assert.equal(rentText('22,000'), 'PHP 22,000'); assert.equal(rentText(null), 'Rent not provided');
  assert.equal(locationText('Anabu II-A', 'imus'), 'Anabu II-A, Imus'); assert.equal(locationText('', 'dasmarinas'), 'Dasmariñas'); assert.equal(locationText(null, null), '');
});
test('the search and nearby adapters carry only what those lists already load', () => {
  const search = listingCardFromSearch({listingId: 'a', title: 'T', rent: 22000, city: 'imus', barangay: 'Anabu II-A', propertyType: 'boarding_house', bedrooms: 0, bathrooms: 2, thumbnailUrl: null} as any);
  assert.deepEqual([search.propertyType, search.rent, search.location, search.bedrooms, search.bathrooms, search.notes], ['Boarding house', '22,000', 'Anabu II-A, Imus', 0, 2, []]);
  const nearby = listingCardFromNearby({listingId: 'b', title: '', askingRentMonthly: '9000.5', propertyType: 'studio', city: 'tagaytay', barangay: 'Poblacion', distanceMeters: 250, availableFrom: null, thumbnailUrl: 'u'} as any);
  assert.deepEqual([nearby.title, nearby.rent, nearby.propertyType, nearby.bedrooms, nearby.bathrooms, nearby.notes], ['Rental listing', '9,000.5', 'Studio', null, null, ['250 m away', 'Availability date not provided']]);
});

test('the card text: price and period, type tag, title, place, chips with correct grammar, and one View rental details button', () => {
  const all = texts(cardHarness()({model: {...base, bedrooms: 2, bathrooms: 1}, onPress() {}}));
  for (const text of ['PHP 3,050', ' / month', 'Condominium', 'Condo', 'Maharlika West, Tagaytay', '2 bedrooms', '1 bathroom', 'View rental details']) assert.ok(all.includes(text), text);
  assert.ok(all.every(t => !/1 bedrooms|0 bedrooms|0 bathrooms/.test(t)));
});
test('zero or missing bedrooms hide that chip; both missing hides the chip row', () => {
  assert.ok(!texts(cardHarness()({model: {...base, bedrooms: 0, bathrooms: 2}, onPress() {}})).some(t => /bedroom/.test(t)));
  assert.ok(texts(cardHarness()({model: {...base, bedrooms: 0, bathrooms: 2}, onPress() {}})).includes('2 bathrooms'));
  const none = texts(cardHarness()({model: {...base, bedrooms: null, bathrooms: null}, onPress() {}}));
  assert.ok(!none.some(t => /bedroom|bathroom/.test(t)));
});
test('rank and why-it-fits show only when a screen supplies them', () => {
  const plain = texts(cardHarness()({model: base, onPress() {}}));
  assert.ok(!plain.includes('Top match') && !plain.includes('Why it fits'));
  const ranked = texts(cardHarness()({model: base, onPress() {}, rank: 'Top match', fit: ['Preferred city', 'Within your budget']}));
  for (const text of ['Top match', 'Why it fits', 'Preferred city', 'Within your budget']) assert.ok(ranked.includes(text), text);
});
test('the save heart keeps its 48dp target and its existing labels', () => {
  const source = readFileSync('src/features/search-discovery/components/SaveListingButton.tsx', 'utf8');
  assert.match(source, /minWidth:48,minHeight:48/);
  for (const label of ['Save listing', 'Remove from Saved Listings', 'Retry saving listing']) assert.ok(source.includes(label), label);
});

// Every screen that shows listings renders the one card: no screen draws its own.
test('Discover, For You, Saved listings, search results and the nearby list all render the shared card', () => {
  const uses = (file: string, name: string) => assert.match(readFileSync(file, 'utf8'), new RegExp(`<${name}\\b`), `${file} renders ${name}`);
  uses('src/features/search-discovery/views/TenantDiscoveryView.tsx', 'SearchListingCard');
  uses('src/features/search-discovery/views/SavedListingsView.tsx', 'SearchListingCard');
  uses('src/features/search-discovery/views/LiveSearchViews.tsx', 'SearchListingCard');
  uses('src/features/search-discovery/views/NearbyListingsView.tsx', 'NearbyListingCard');
  uses('src/features/search-discovery/components/SearchListingCard.tsx', 'ListingCard');
  uses('src/features/search-discovery/components/NearbyListingCard.tsx', 'ListingCard');
  for (const file of ['SearchListingCard', 'NearbyListingCard']) assert.doesNotMatch(readFileSync(`src/features/search-discovery/components/${file}.tsx`, 'utf8'), /StyleSheet|<Image|<Pressable/, `${file} draws nothing of its own`);
});
