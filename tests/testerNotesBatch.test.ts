/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import type { LandlordPortfolioItem } from '../src/features/property-listing/models/LandlordPortfolio';
import { philippineToday, portfolioAvailability } from '../src/features/property-listing/models/PortfolioCardPresentation';
import { requestCardActions, requestToggleLabel } from '../src/features/messaging-viewing/models/RequestCardActions';
import { avatarDiameter, avatarInitials } from '../src/shared/models/Avatar';
import { ratingScaleLabel, ratingScaleState } from '../src/shared/models/RatingScale';
import { colors } from '../src/shared/theme/colors';

// Small render harness: real .tsx files, function components expanded, native parts as strings, useState per render order.
function harness() {
  const states: any[] = []; let cursor = 0; const cache = new Map<string, any>();
  const useState = (initial: any) => { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], (v: any) => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; };
  const native: any = { useWindowDimensions: () => ({ width: 411, height: 900, fontScale: 1 }), StyleSheet: { create: (s: any) => s, flatten: (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) }, Platform: { OS: 'android' } };
  for (const n of ['Image', 'Modal', 'Pressable', 'Text', 'View']) native[n] = n;
  const load = (abs: string): any => {
    if (cache.has(abs)) return cache.get(abs);
    const actual = createRequire(abs), mod = { exports: {} as any }; cache.set(abs, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name.endsWith('/FullscreenDocumentImage')) return { FullscreenDocumentImage: 'Gallery' };
      if (name.endsWith('/PropertyPhotoThumbnail')) return { PropertyPhotoThumbnail: 'Thumbnail' };
      if (name.startsWith('.')) { const target = resolve(dirname(abs), name); if (existsSync(target + '.tsx')) return load(target + '.tsx'); }
      return actual(name);
    };
    new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, mod, mod.exports);
    cache.set(abs, mod.exports); return mod.exports;
  };
  const expand = (n: any): any => Array.isArray(n) ? n.map(expand) : !n || typeof n !== 'object' ? n : typeof n.type === 'function' ? expand(n.type(n.props)) : { ...n, props: { ...n.props, children: expand(n.props?.children) } };
  return { render: (path: string, name: string, props: any) => { cursor = 0; return expand(load(resolve(path))[name](props)); } };
}
const flat = (n: any): any[] => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n, ...flat(n.props?.children)] : typeof n === 'string' ? [n] : [];
const nodes = (t: any) => flat(t).filter(n => typeof n === 'object');
const text = (t: any) => flat(t).filter(n => typeof n === 'string').join('');
const style = (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean));

// ---- A. Avatar
test('avatar initials come from the public name only: up to two letters, uppercase, null when there is none', () => {
  assert.equal(avatarInitials('Maria Santos'), 'MS');
  assert.equal(avatarInitials('  em   cee  jr '), 'EC');
  assert.equal(avatarInitials('maria'), 'M');
  assert.equal(avatarInitials("O'Neil"), 'O');
  assert.equal(avatarInitials('_-Ana'), 'A');
  assert.equal(avatarInitials('Éva Ñu'), 'ÉÑ');
  assert.equal(avatarInitials(''), null);
  assert.equal(avatarInitials('   '), null);
  assert.equal(avatarInitials('--'), null);
  assert.equal(avatarInitials(null), null);
  assert.equal(avatarInitials(undefined), null);
});
test('avatar sizes snap to 36, 48 or 96', () => {
  assert.deepEqual([20, 33, 36, 37, 40, 42, 48, 49, 64, 80, 96, 140].map(avatarDiameter), [36, 36, 36, 48, 48, 48, 48, 96, 96, 96, 96, 96]);
});
test('avatar: photo wins, else initials on green, else the neutral silhouette; one circle size rule', () => {
  const h = harness(), path = 'src/shared/components/PublicIdentityBadge.tsx';
  const photo = nodes(h.render(path, 'PublicAvatar', { url: 'https://x/p.jpg', name: 'Maria Santos', size: 40 }));
  assert.ok(photo.some(n => n.type === 'Image'));
  assert.ok(!photo.some(n => n.type === 'Text'), 'no initials over a photo');
  assert.equal(style(photo.find(n => n.props?.importantForAccessibility)!.props.style).backgroundColor, colors.surfaceStrong, 'a photo circle keeps the neutral fill');
  const initialsTree = h.render(path, 'PublicAvatar', { name: 'Maria Santos', size: 96 }), initials = nodes(initialsTree);
  assert.equal(text(initialsTree), 'MS');
  const circle = initials.find(n => n.type === 'View' && n.props.importantForAccessibility === 'no-hide-descendants')!;
  const s = style(circle.props.style);
  assert.deepEqual([s.width, s.height, s.borderRadius, s.backgroundColor], [96, 96, 48, colors.primaryAction]);
  const noneTree = h.render(path, 'PublicAvatar', { size: 48 }), none = nodes(noneTree);
  assert.equal(text(noneTree), '');
  assert.equal(style(none.find(n => n.props?.importantForAccessibility)!.props.style).backgroundColor, colors.surfaceStrong, 'silhouette keeps the neutral fill');
  assert.equal(style(h.render(path, 'PublicAvatar', { name: 'A', size: 33 }).props.style).width, 36);
});

// ---- C. Rating scale
test('rating scale states: chosen solid, lower tinted, higher outlined; nothing chosen is all outlined', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(n => ratingScaleState(n, 3)), ['lower', 'lower', 'selected', 'higher', 'higher']);
  assert.deepEqual([1, 2, 3, 4, 5].map(n => ratingScaleState(n, 5)), ['lower', 'lower', 'lower', 'lower', 'selected']);
  assert.deepEqual([1, 2, 3, 4, 5].map(n => ratingScaleState(n, 1)), ['selected', 'higher', 'higher', 'higher', 'higher']);
  assert.deepEqual([1, 5].map(n => ratingScaleState(n, null)), ['higher', 'higher']);
});
test('rating labels say it in words', () => {
  assert.deepEqual([5, 4, 3, 2, 1].map(ratingScaleLabel), ['5 · Excellent', '4 · Good', '3 · Okay', '2 · Poor', '1 · Very poor']);
  assert.equal(ratingScaleLabel(null), 'Choose a rating from 1 to 5');
  assert.equal(ratingScaleLabel(9), 'Choose a rating from 1 to 5');
});
test('rating scale renders solid primaryAction with white text for the chosen number, 48dp buttons, label and state', () => {
  const picked: number[] = [];
  const tree = harness().render('src/shared/components/RatingScale.tsx', 'RatingScale', { value: 4, onChange: (n: number) => picked.push(n) });
  const buttons = nodes(tree).filter(n => n.type === 'Pressable');
  assert.equal(buttons.length, 5);
  assert.deepEqual(buttons.map(b => !!b.props.accessibilityState.selected), [false, false, false, true, false]);
  const chosen = style(buttons[3].props.style), lower = style(buttons[0].props.style), higher = style(buttons[4].props.style);
  assert.equal(chosen.backgroundColor, colors.primaryAction); assert.equal(lower.backgroundColor, colors.accountCredentialSurface); assert.equal(higher.backgroundColor, colors.background);
  assert.ok([chosen, lower, higher].every(s => s.minHeight === 48));
  assert.equal(style(nodes(buttons[3]).find(n => n.type === 'Text')!.props.style).color, colors.white);
  assert.match(text(tree), /4 · Good/); assert.doesNotMatch(text(tree), /\*/);
  buttons[1].props.onPress(); assert.deepEqual(picked, [2]);
  assert.equal(nodes(harness().render('src/shared/components/RatingScale.tsx', 'RatingScale', { value: 2, onChange() {}, disabled: true })).filter(n => n.type === 'Pressable').every(b => b.props.disabled === true), true);
});
test('every review screen uses the shared scale and the asterisk is gone', () => {
  assert.match(readFileSync('src/shared/components/RentalReviews.tsx', 'utf8'), /<RatingScale /);
  assert.doesNotMatch(readFileSync('src/shared/components/RentalReviews.tsx', 'utf8'), /String\(n\)\+'\*'/);
  assert.match(readFileSync('src/features/ratings-reports/views/ReviewFlowView.tsx', 'utf8'), /<RatingScale /);
});

// ---- F. Availability date
const itemWith = (available_from: string | null | undefined): LandlordPortfolioItem => ({ propertyId: 'p', property: {}, listings: [], currentListing: available_from === undefined ? null : { available_from }, coverPhoto: null, tier3: {} } as any);
test('availability row: only a date after today in Philippine time; past, today, no date and bad text show nothing', () => {
  const now = Date.parse('2026-11-14T10:00:00Z');
  assert.equal(philippineToday(now), '2026-11-14');
  assert.equal(portfolioAvailability(itemWith('2026-11-13'), now), null, 'past');
  assert.equal(portfolioAvailability(itemWith('2026-11-14'), now), null, 'today');
  assert.equal(portfolioAvailability(itemWith('2026-11-15'), now), 'Available from Nov 15, 2026', 'tomorrow');
  assert.equal(portfolioAvailability(itemWith('2027-01-02'), now), 'Available from Jan 2, 2027');
  assert.equal(portfolioAvailability(itemWith(null), now), null, 'no date');
  assert.equal(portfolioAvailability(itemWith(undefined), now), null, 'no listing');
  assert.equal(portfolioAvailability(itemWith('soon'), now), null, 'not a date');
  // 17:00 UTC on Nov 14 is already Nov 15 in Manila: Nov 15 is today there, Nov 16 is the future.
  const late = Date.parse('2026-11-14T17:00:00Z');
  assert.equal(philippineToday(late), '2026-11-15');
  assert.equal(portfolioAvailability(itemWith('2026-11-15'), late), null);
  assert.equal(portfolioAvailability(itemWith('2026-11-16'), late), 'Available from Nov 16, 2026');
});
test('card shows the availability row with Change, which runs the existing rental edit action', () => {
  const calls: string[] = [];
  const item: any = { propertyId: 'p', property: { id: 'p', property_type: 'house', city: 'imus', barangay: 'B', is_active: true }, listings: [], currentListing: { id: 'l', title: 'T', status: 'paused', asking_rent_monthly: 1, available_from: '2999-01-01', published_at: null }, coverPhoto: null, tier3: { status: 'approved' } };
  const render = (i: any) => harness().render('src/features/property-listing/components/PortfolioRentalCard.tsx', 'PortfolioRentalCard', { item: i, disabled: false, onAction: (k: string) => calls.push(k) });
  const tree = render(item);
  assert.match(text(tree), /Available from Jan 1, 2999/);
  nodes(tree).find(n => n.props?.accessibilityLabel?.endsWith('. Change'))!.props.onPress();
  assert.deepEqual(calls, ['editRental']);
  assert.doesNotMatch(text(render({ ...item, currentListing: { ...item.currentListing, available_from: '2000-01-01' } })), /Available from/);
});

// ---- E. Request cards
test('request card actions: pending shows Approve and Decline (or Cancel for the requester); others stay behind the toggle', () => {
  assert.deepEqual(requestCardActions(['approve', 'decline', 'reschedule', 'cancel'], true), { visible: ['approve', 'decline'], more: ['reschedule', 'cancel'] });
  assert.deepEqual(requestCardActions(['approve', 'decline', 'cancel'], true), { visible: ['approve', 'decline'], more: ['cancel'] });
  assert.deepEqual(requestCardActions(['cancel'], true), { visible: ['cancel'], more: [] }, 'requester');
  assert.deepEqual(requestCardActions(['reschedule', 'cancel'], true), { visible: ['cancel'], more: ['reschedule'] });
  assert.deepEqual(requestCardActions(['approve', 'decline', 'cancel'], false), { visible: [], more: ['approve', 'decline', 'cancel'] }, 'not pending: nothing promoted');
  assert.deepEqual(requestCardActions([], true), { visible: [], more: [] });
});
test('request card toggle wording', () => {
  assert.equal(requestToggleLabel(false, { visible: [], more: ['cancel'] }), 'Actions and history');
  assert.equal(requestToggleLabel(true, { visible: [], more: ['cancel'] }), 'Hide actions and history');
  assert.equal(requestToggleLabel(false, { visible: ['approve'], more: [] }), 'History');
  assert.equal(requestToggleLabel(true, { visible: ['approve'], more: [] }), 'Hide history');
  assert.equal(requestToggleLabel(false, { visible: ['approve'], more: ['cancel'] }), 'More actions and history');
  assert.equal(requestToggleLabel(true, { visible: ['approve'], more: ['cancel'] }), 'Hide more actions and history');
});
test('request screens use the shared card split and show counts and friendly empty states', () => {
  for (const f of ['PropertyViewingsView', 'RentalReservationsView']) {
    const src = readFileSync(`src/features/messaging-viewing/views/${f}.tsx`, 'utf8');
    assert.match(src, /requestCardActions\(/); assert.match(src, /requestToggleLabel\(/); assert.match(src, /size=\{48\}/); assert.match(src, /No (viewing|reservation) requests yet/);
  }
  assert.match(readFileSync('src/features/messaging-viewing/views/RequestManagementView.tsx', 'utf8'), /counts\[t\]/);
});
test('the Manage Requests overlay is inset below the status bar by the library SafeAreaView, not by a protected component', () => {
  const src = readFileSync('src/app/OwnedPropertiesWorkspace.tsx', 'utf8');
  assert.match(src, /from 'react-native-safe-area-context'/);
  assert.match(src, /<SafeAreaView edges=\{\['top','right','bottom','left'\]\}/);
  assert.doesNotMatch(src, /<View style=\{\{position:'absolute',inset:0/);
});

// ---- D. Chat property row
test('chat property row: collapsed by default in chat, expands on tap, one title line while the keyboard is open, full when not collapsible', () => {
  const path = 'src/features/messaging-viewing/components/ConversationPropertySummary.tsx';
  const context = { listingId: 'L', title: 'Real rental', photos: [], canViewListing: true, availability: 'Available', ownsProperty: true };
  const props = { context, title: 'Fallback', loading: false, error: null, onRetry() {}, onViewListing() {} };
  const h = harness();
  const collapsed = h.render(path, 'ConversationPropertySummary', { ...props, defaultCollapsed: true });
  assert.ok(!nodes(collapsed).some(n => flat(n.props?.children).includes('View Listing')), 'collapsed hides View Listing');
  nodes(collapsed).find(n => n.props?.accessibilityLabel === 'Show property details')!.props.onPress();
  assert.ok(nodes(h.render(path, 'ConversationPropertySummary', { ...props, defaultCollapsed: true })).some(n => flat(n.props?.children).includes('View Listing')), 'expanded shows it');
  const compact = harness().render(path, 'ConversationPropertySummary', { ...props, defaultCollapsed: true, compact: true });
  assert.equal(text(compact), 'Real rental');
  assert.ok(nodes(harness().render(path, 'ConversationPropertySummary', props)).some(n => flat(n.props?.children).includes('View Listing')), 'without defaultCollapsed it is the full block');
});
test('chat: bubbles name the other participant or say Them; Report participant is a menu item; two same-size actions hide with the keyboard', () => {
  const src = readFileSync('src/features/messaging-viewing/views/MessagingConversationView.tsx', 'utf8');
  assert.match(src, /identity\?\.nickname\?\?'Them'/); assert.doesNotMatch(src, /Other participant/);
  assert.match(src, /asMenuItem/); assert.match(src, /kind="user" contextId=\{conversation\.id\}/);
  assert.match(src, /vm\.keyboardOpen\?null:/); assert.match(src, /compact=\{!!vm\.keyboardOpen\}/);
  assert.match(readFileSync('src/features/messaging-viewing/viewModels/useMessagingViewingViewModel.ts', 'utf8'), /useKeyboardVisibility\(\)/);
});

// ---- B. Profile photo checkbox
test('profile photo: no checkbox gate, the same sentence is a visible note, and Save still sends confirmed through the same service call', () => {
  const editor = readFileSync('src/features/authentication/components/PublicIdentityEditor.tsx', 'utf8');
  assert.doesNotMatch(editor, /role="checkbox"|accessibilityRole="checkbox"|\[x\]/);
  assert.match(editor, /I understand the selected name and photo will be public\./);
  const vm = readFileSync('src/features/authentication/viewModels/useEditProfileViewModel.ts', 'utf8');
  assert.match(vm, /if\(identity\.consent\)identity\.workflow\.confirm\(true\);\s*await identity\.workflow\.save\(\);/);
  assert.doesNotMatch(vm, /identity\.confirmed/);
  // The workflow and service are unchanged: confirmed is still the value passed to service.save.
  assert.match(readFileSync('src/features/authentication/viewModels/publicIdentityWorkflow.ts', 'utf8'), /service\.save\(owner,pending\.id,pending\.version,pending\.nickname,pending\.path,pending\.confirmed,c\.signal\)/);
});

// ---- G. Duplicate saved indicator
test('Review shows "saved" once: the ViewModel no longer adds a second saved notice on the Review screen', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.doesNotMatch(vm, /screen==='postingReview'\)setComposerNotice\('Listing draft saved/);
  assert.match(vm, /screen==='postingReview'\)setComposerNotice\(null\)/);
  assert.match(readFileSync('src/features/property-listing/views/PostingReviewView.tsx', 'utf8'), /Draft saved\. Not published yet\./);
});
