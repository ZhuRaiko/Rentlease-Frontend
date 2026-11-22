/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aboutSummary, budgetSummary, cityLabel, formatPeso, initialPreferenceSection, mattersSummary, preferencesChanged, propertySummary, stayParts, toggleSection} from '../src/features/search-discovery/models/MatchingPreferenceForm';
import {recommendedMatchingPreferences as base, stayLengths} from '../src/features/search-discovery/models/SearchDiscovery';

test('About you is the open card first; opening another card closes it, and tapping the open card closes it', () => {
  assert.equal(initialPreferenceSection, 'about');
  let open = toggleSection(initialPreferenceSection, 'property');
  assert.equal(open, 'property', 'About you folds when Property opens');
  open = toggleSection(open, 'budget');
  assert.equal(open, 'budget', 'one open at a time: Property closed');
  open = toggleSection(open, 'matters');
  assert.equal(open, 'matters');
  assert.equal(toggleSection(open, 'matters'), null, 'tapping the open card closes it');
  assert.equal(toggleSection(null, 'about'), 'about', 'Change reopens About you');
});

test('live summaries: About you, Property, Budget and What matters most follow the preferences', () => {
  assert.equal(aboutSummary(base), 'Student · Long-term · Imus City');
  assert.equal(aboutSummary({...base, renterProfile: 'Family', stayLength: 'Transient or short-term', city: 'Dasmariñas'}), 'Family · Transient · City of Dasmariñas');
  assert.equal(propertySummary(base), 'House, Apartment · 40 sqm · 1 bed · 1 bath');
  assert.equal(propertySummary({...base, propertyKinds: ['Studio'], minimumLandArea: 0, minimumBedrooms: 2, minimumBathrooms: 3}), 'Studio · 2 beds · 3 baths');
  assert.equal(propertySummary({...base, propertyKinds: [], minimumLandArea: 0, minimumBedrooms: 0, minimumBathrooms: 0}), 'Any type');
  assert.equal(budgetSummary(base), '₱15,000–₱65,000 a month');
  assert.equal(budgetSummary({...base, budgetMode: 'estimate'}), budgetSummary({...base, budgetMode: 'own'}), 'an older estimate-mode save reads from its stored amounts like any other');
  assert.equal(budgetSummary({...base, minimumRent: 0}), 'Up to ₱65,000 a month');
  assert.equal(budgetSummary({...base, maximumRent: 0}), 'From ₱15,000 a month');
  assert.equal(budgetSummary({...base, minimumRent: 0, maximumRent: 0}), 'Not set');
  assert.equal(mattersSummary(base), 'Location, Budget, Unit specifications');
  assert.equal(mattersSummary({...base, factorRanking: ['Budget', 'Location', 'Amenities', 'Unit specifications']}), 'Budget, Location, Amenities');
});

test('length-of-stay cards split the stored label into a title and a detail; the stored values are unchanged', () => {
  assert.deepEqual(stayLengths.map(length => stayParts(length).title), ['Transient', 'Short-term', 'Medium-term', 'Long-term']);
  assert.deepEqual(stayLengths.map(length => stayParts(length).detail), ['Short-term', 'Less than 1 month', '1–6 months', '6+ months']);
  assert.equal(cityLabel('Imus'), 'Imus City');
  assert.equal(cityLabel('Dasmariñas'), 'City of Dasmariñas');
  assert.equal(formatPeso(1234567), '₱1,234,567');
});

test('changed means different from the opening or last saved values, and an edit that is reverted is not a change', () => {
  assert.equal(preferencesChanged(base, base), false);
  assert.equal(preferencesChanged({...base, minimumBedrooms: 2}, base), true);
  assert.equal(preferencesChanged({...base, minimumBedrooms: base.minimumBedrooms}, base), false);
});
