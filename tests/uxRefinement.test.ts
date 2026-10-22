/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { accountStatusLabel } from '../src/features/authentication/models/accountPresentation';

const read = (path: string) => readFileSync(path, 'utf8');
const auth = 'src/features/authentication/';
const admin = 'src/features/admin-moderation/';
const verification = 'src/features/user-verification/';

// Wiring checks exercise the presentation boundary. They do not claim native rendering.
test('onboarding account options remain expandable and switch only through the existing Auth action', () => {
  const options = read(auth + 'components/OnboardingAccountOptions.tsx');
  assert.match(options, /accessibilityState=\{\{ expanded, disabled \}\}/);
  assert.match(options, /setExpanded\(value => !value\)/);
  assert.match(options, /onPress=\{onSwitch\}/);
  assert.doesNotMatch(options, /signOutAccount|supabase|accountService/);
  const registration = read(auth + 'views/RegistrationView.tsx');
  assert.match(registration, /onSwitch=\{\(\) => void viewModel.switchAccount\(\)\}/);
  assert.doesNotMatch(registration, /Refresh Tier 1 status|Sign out \/ use another account/);
  assert.match(registration, /viewModel.showVerificationRecovery \?/);
});

test('automatic Tier 1 checks bind foreground and one delayed check, clean up, and avoid explicit operations', () => {
  const vm = read(auth + 'viewModels/useAuthProfilesViewModel.ts');
  assert.match(vm, /AppState.addEventListener\('change'/);
  assert.match(vm, /next === 'active' && previous !== 'active'/);
  assert.match(vm, /!operationBusyRef.current && !!accountRef.current/);
  assert.match(vm, /screen === 'verificationPending' \? setTimeout/);
  assert.match(vm, /subscription.remove\(\); checker.dispose\(\)/);
  assert.match(vm, /clearTimeout\(timer\)/);
  assert.match(vm, /refresh\('background'\)/);
});

test('Profile retains essential account destinations and marketplace access without mode pills or duplicate rows', () => {
  const profile = read(auth + 'views/ProfileView.tsx');
  for (const label of ['Edit Profile', 'Verification', 'Matching Preferences', 'Account Settings', 'Ratings & Reports']) assert.ok(profile.includes(label), label);
  assert.match(profile, /\{marketplaceNavigation\}/);
  assert.doesNotMatch(profile, /Tenant mode|Landlord mode|Discover Properties|My Properties|onSwitchRole/);
  const app = read('App.tsx');
  assert.match(app, /marketplaceNavigation=\{canEnterMarketplace \? <RentLeaseBottomNavigation/);
  assert.match(app, /onListing=\{\(\) => openProperties\('dashboard'\)\}/);
  assert.match(app, /onPost=\{\(\) => openProperties\('postingType'\)\}/);
  assert.match(app, /const canEnterAdmin = workspaceDestination === 'adminModeration'/);
  assert.doesNotMatch(app, /set_user_roles|saveUserRoles/);
});

test('Matching Preferences Save and Skip stay outside the scrolling form and retain guarded VM actions', () => {
  const path = 'src/features/search-discovery/views/DiscoveryFilterView.tsx';
  const file = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callbacks: ts.JsxAttribute[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'onPress' && /saveMatchingPreferences\(\)|skipMatchingIntroduction\(\)/.test(node.getText(file))) callbacks.push(node);
    ts.forEachChild(node, visit);
  }; visit(file);
  assert.equal(callbacks.length, 2);
  for (const callback of callbacks) {
    let ancestor: ts.Node | undefined = callback;
    while (ancestor) {
      if (ts.isJsxElement(ancestor)) assert.notEqual(ancestor.openingElement.tagName.getText(file), 'ScrollView');
      ancestor = ancestor.parent;
    }
  }
  assert.match(file.text, /keyboardShouldPersistTaps="handled"/);
  assert.match(file.text, /disabled=\{viewModel.isCompletingIntroduction\}/);
});

test('Admin queue pulls authoritative data and retains contextual retry plus loading and review locks', () => {
  const queue = read(admin + 'views/AdminQueueView.tsx');
  assert.match(queue, /onRefresh=\{\(\) => void viewModel.refreshVerification\(\)\}/);
  assert.match(queue, /refreshing=\{viewModel.queueRefreshing\}/);
  assert.match(queue, /refreshEnabled=\{!viewModel.verification.reviewBusy\}/);
  assert.doesNotMatch(queue, /label=.*Refresh queue/);
  assert.match(queue, /viewModel.dashboardNeedsRecovery \?/);
  assert.match(read(admin + 'components/AdminScaffold.tsx'), /<RefreshControl refreshing=\{refreshing\} onRefresh=\{onRefresh\}/);
  const vm = read(admin + 'viewModels/useAdminModerationViewModel.ts');
  assert.match(vm, /current.status === 'loading' \|\| current.reviewBusy/);
  assert.match(vm, /return verificationQueue.refresh\(\)/);
});

test('displayed account statuses capitalize exact generated values without changing them', () => {
  for (const [value, label] of [['active', 'Active'], ['restricted', 'Restricted'], ['suspended', 'Suspended'], ['deleted', 'Deleted']] as const) assert.equal(accountStatusLabel(value), label);
  assert.equal(accountStatusLabel(null), 'Unknown');
  assert.match(read(auth + 'views/SettingsView.tsx'), /Account Status: \{viewModel.accountStatusLabel\}/);
});

test('verification overview uses actual Tier 2 status and explicitly per-property Tier 3 presentation', () => {
  const overview = read(verification + 'views/VerificationOverviewView.tsx');
  assert.match(overview, /tierTwoSubmissionPresentation\(viewModel.submission, viewModel.requiresRefresh\)/);
  assert.match(overview, /Checked per Property/);
  assert.doesNotMatch(overview, /tier3_verified_at|trust_score/);
  const card = read(verification + 'components/VerificationTierCard.tsx');
  assert.doesNotMatch(card, /premiumSurface|trustedSurface|paletteByTier/);
  assert.match(card, /tier === 1 \? null : disabled \|\| !onPress/);
});

test('shared navigation has wrapping titles and compact visuals with Android touch targets', () => {
  const header = read('src/shared/components/ScreenHeader.tsx');
  assert.doesNotMatch(header, /numberOfLines|allowFontScaling=\{false\}/);
  assert.match(header, /minHeight: 48, minWidth: 48/);
  for (const path of [auth + 'components/AuthScaffold.tsx', verification + 'components/VerificationScaffold.tsx', admin + 'components/AdminScaffold.tsx']) assert.match(read(path), /<ScreenHeader/);
});
