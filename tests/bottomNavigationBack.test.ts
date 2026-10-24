/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createMarketplaceExitConfirmation } from '../src/shared/viewModels/marketplaceExitConfirmation';
import { createNavigationConfirmation } from '../src/shared/viewModels/navigationConfirmation';
const read = (p: string) => readFileSync(p, 'utf8');
test('bottom destination Back is distinct from explicit Profile entry', () => {
  const app = read('App.tsx');
  for (const name of ['PropertyListingFlowView', 'MessagingViewingFlowView', 'MaintenanceRequestsFlowView']) {
    const flow = app.split(`<${name}`)[1]?.split('/>')[0] ?? '';
    assert.match(flow, /onRootBack=\{openDiscovery\}/);
    assert.match(flow, /onClose=\{openProfile\}/);
  }
  assert.match(app.split('<SearchDiscoveryFlowView')[1] ?? '', /onRootBack=\{requestMarketplaceExit\}/);
});
test('Listings dashboard has no Back to Profile action; nested Close and guarded Back remain', () => {
  const flow = read('src/features/property-listing/views/PropertyListingFlowView.tsx');
  assert.doesNotMatch(flow, /Back to Profile|profileAction/);
  assert.match(flow, /viewModel.backFromWorkspace\(onRootBack\)/);
  assert.match(flow, /viewModel.requestNavigation\(onClose\)/);
});

function exitHarness() {
  let confirm = () => {}; let cancel = () => {}; let exits = 0; let prompts = 0;
  const confirmation = createMarketplaceExitConfirmation({ showConfirmation: (yes, no) => { prompts++; confirm = yes; cancel = no; }, exit: () => { exits++; } });
  return { confirmation, confirm: () => confirm(), cancel: () => cancel(), exits: () => exits, prompts: () => prompts };
}
test('Discovery root requests one confirmation; Cancel stays without exit', () => {
  const h = exitHarness(); h.confirmation.request(() => true); h.confirmation.request(() => true);
  assert.equal(h.prompts(), 1); assert.equal(h.exits(), 0);
  h.cancel(); h.confirm(); assert.equal(h.exits(), 0);
  h.confirmation.request(() => true); assert.equal(h.prompts(), 2);
});
test('explicit confirmation exits once; stale account/role/workspace or disposal never exits', () => {
  const h = exitHarness(); h.confirmation.request(() => true); h.confirm(); h.confirm(); assert.equal(h.exits(), 1);
  let current = true; h.confirmation.request(() => current); current = false; h.confirm(); assert.equal(h.exits(), 1);
  h.confirmation.request(() => true); h.confirmation.invalidate(); h.confirm(); assert.equal(h.exits(), 1);
  h.confirmation.request(() => false); assert.equal(h.prompts(), 3);
});
test('draft Stay/Leave is resolved before root Back callback and only Leave navigates once', () => {
  let discovery = 0; const guard = createNavigationConfirmation(() => true);
  guard.request(() => discovery++); guard.cancel(); assert.equal(discovery, 0);
  guard.request(() => discovery++); guard.confirm(); guard.confirm(); assert.equal(discovery, 1);
  const listing = read('src/features/property-listing/viewModels/usePropertyListingViewModel.ts');
  assert.match(listing, /if \(screen === 'postingType'\) requestNavigation\(onClose\);\s*else if \(history.length > 0\) goBack\(\)/);
  assert.match(listing, /else requestNavigation\(onClose\)/);
});
test('Discovery nested and Profile-origin preferences Back precede marketplace exit', () => {
  const vm = read('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts');
  assert.match(vm, /screen === 'home'\) navigation.requestNavigation\(onRootBack\)/);
  assert.match(vm, /initialScreen === 'matchingPreferences'.*navigation.requestNavigation\(onClose\)/);
  assert.match(vm, /else navigation.requestNavigation\(goBack\)/);
  const flow = read('src/features/search-discovery/views/SearchDiscoveryFlowView.tsx');
  assert.match(flow, /viewModel.backFromWorkspace\(onClose, onRootBack\)/);
  assert.match(flow, /<NavigationConfirmation/);
});
test('Android service uses a native cancelable dialog and exitApp only on confirmation path', () => {
  const service = read('src/shared/services/androidAppExitService.ts');
  assert.match(service, /Alert.alert\('Exit RentLease\?'/);
  assert.match(service, /text: 'Cancel', style: 'cancel', onPress: cancel/);
  assert.match(service, /text: 'Exit', onPress: confirm/);
  assert.match(service, /onDismiss: cancel/);
  assert.match(service, /BackHandler.exitApp\(\)/);
  const hook = read('src/shared/viewModels/useMarketplaceExitConfirmation.ts');
  assert.match(hook, /current.userId === userId/);
  assert.match(hook, /current.workspace === workspace/);
  assert.match(hook, /workspace\?\.type === 'discovery'/);
  assert.match(read('App.tsx'), /canEnterMarketplace && !canEnterAdmin/);
});
