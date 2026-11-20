/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverageNote, forYouState, infoBoxText, PREFERENCES_SAVED_NOTICE, rankLabel, SUGGESTIONS_NOTE} from '../src/features/search-discovery/models/ForYouPresentation';
import {createRecommendationWorkflow} from '../src/features/search-discovery/viewModels/recommendationWorkflow';
import {defaultSearchFilters} from '../src/features/search-discovery/models/ManualSearch';
import {recommendedMatchingPreferences as prefs} from '../src/features/search-discovery/models/SearchDiscovery';

test('the For You states that really exist, from preferences and the workflow phase', () => {
  assert.equal(forYouState(false, 'idle', 0), 'no-preferences');
  assert.equal(forYouState(false, 'success', 5), 'no-preferences', 'no saved preferences wins over any leftover ranking');
  assert.equal(forYouState(true, 'unavailable', 0), 'unavailable');
  assert.equal(forYouState(true, 'error', 0), 'error');
  assert.equal(forYouState(true, 'idle', 0), 'loading');
  assert.equal(forYouState(true, 'loading', 0), 'loading');
  assert.equal(forYouState(true, 'success', 0), 'empty');
  assert.equal(forYouState(true, 'success', 3), 'ranked');
  assert.equal(forYouState(true, undefined, 0), 'loading');
});

test('rank labels follow the ranking order: Top match, then #2, #3', () => {
  assert.deepEqual([0, 1, 2, 9].map(rankLabel), ['Top match', '#2', '#3', '#10']);
});

test('one info box keeps the same words and the real listing count', () => {
  assert.equal(infoBoxText('no-preferences', 0, false), null);
  const ranked = infoBoxText('ranked', 4, false)!;
  assert.equal(ranked, `${SUGGESTIONS_NOTE} Ranking covers 4 loaded listings. ${PREFERENCES_SAVED_NOTICE}`);
  assert.match(infoBoxText('ranked', 1, false)!, /Ranking covers 1 loaded listing\./);
  assert.match(infoBoxText('ranked', 100, true)!, /Ranking covers the first 100 recent filtered listings\./);
  assert.doesNotMatch(infoBoxText('empty', 0, false)!, /Ranking covers/, 'nothing scanned, nothing to count');
  assert.match(infoBoxText('empty', 12, false)!, /Ranking covers 12 loaded listings\./);
  for (const state of ['loading', 'error', 'unavailable'] as const) assert.doesNotMatch(infoBoxText(state, 0, false)!, /Ranking covers/, state);
  assert.equal(coverageNote(2, false), 'Ranking covers 2 loaded listings.');
});

// The ranking starts by itself when preferences exist (the view model configures the workflow) and the view model never needs a button to start it.
test('the ranking starts once, and is not requested again by repeated configure, refresh or a preference edit', async () => {
  let loads = 0;
  const wf = createRecommendationWorkflow({user: async () => 'a', load: async () => { loads++; return {candidates: [], limited: false, scanned: 0}; }} as any, 'a');
  wf.configure(prefs, defaultSearchFilters(), ''); wf.configure(prefs, defaultSearchFilters(), '');
  void wf.load(); void wf.load();
  await new Promise(r => setImmediate(r));
  assert.equal(loads, 1, 'duplicate triggers while loading send one request');
  assert.equal(wf.getSnapshot().phase, 'success');
  wf.configure({...prefs, maximumRent: prefs.maximumRent + 1000}, defaultSearchFilters(), '');
  await new Promise(r => setImmediate(r));
  assert.equal(loads, 1, 'changed preferences rerank the loaded pool without another search');
  wf.configure(prefs, {...defaultSearchFilters(), city: 'imus'} as any, '');
  await new Promise(r => setImmediate(r));
  assert.equal(loads, 2, 'changed filters need a new pool');
});

test('no scorable preferences means the unavailable state, with no request', async () => {
  let loads = 0;
  const wf = createRecommendationWorkflow({user: async () => 'a', load: async () => { loads++; return {candidates: [], limited: false, scanned: 0}; }} as any, 'a');
  wf.configure({...prefs, city: '', minimumRent: 0, maximumRent: 0, propertyKinds: [], minimumBedrooms: 0, minimumBathrooms: 0, furnishedOnly: false, amenities: []}, defaultSearchFilters(), '');
  await new Promise(r => setImmediate(r));
  assert.equal(loads, 0); assert.equal(wf.getSnapshot().phase, 'unavailable');
});
