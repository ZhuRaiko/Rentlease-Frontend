/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createNavigationConfirmation } from '../src/shared/viewModels/navigationConfirmation';
const read = (path: string) => readFileSync(path, 'utf8');

for (const [feature, name] of [
  ['messaging-viewing', 'MessagingViewing'],
  ['ratings-reports', 'RatingsReports'], ['notifications', 'Notifications'],
  ['rental-price-estimation', 'RentalPriceEstimation'], ['admin-moderation', 'AdminModeration'],
]) {
  test(`${name} registers feature-owned hardware Back and cleans it up`, () => {
    const flow = read(`src/features/${feature}/views/${name}FlowView.tsx`);
    if(feature==='notifications'){
      // Notifications now runs on the in-app notification workflow (the old permission-preview ViewModel is not mounted).
      // The center registers Back to close only while no nested target is open; an open target owns its own Back via closeTarget.
      assert.match(flow,/useEffect\(\(\)=>\{if\(active\)return;registerBackAction\?\.\(onClose\);return\(\)=>registerBackAction\?\.\(null\);\}\)/);
      assert.match(flow,/renderTarget\(active,closeTarget\)/);
      return;
    }
    const vm = read(`src/features/${feature}/viewModels/use${name}ViewModel.ts`);
    if(feature==='messaging-viewing'){
      assert.match(flow,/registerBackAction\?\.\(back\)/);
      assert.match(flow,/if\(returnToListing\)onRootBack\(\);else viewModel.backFromWorkspace\(onRootBack\)/);
      assert.match(flow,/return\(\)=>registerBackAction\?\.\(null\)/);
      assert.match(vm,/if\(state.selectedId\)workflow.closeThread\(\);else onClose\(\)/);
    }else{
      assert.match(flow, /registerBackAction\?\.\(\(\) => viewModel.backFromWorkspace\(on(?:Close|RootBack)\)\)/);
      assert.match(flow, /return \(\) => registerBackAction\?\.\(null\)/);
      // Same rule for every feature: a nested screen consumes Back first, and only an unconsumed Back closes the workspace.
      if(feature==='rental-price-estimation')assert.match(vm, /backFromWorkspace:\(onClose:\(\)=>void\)=>\{if\(!workflow\.back\(\)\)onClose\(\);\}/);
      else assert.match(vm, /backFromWorkspace:.*onClose\(\); else goBack\(\)/);
    }
  });
}
test('Maintenance Requests (the mounted TenancyCareWorkspaceView) registers hardware Back, closes a request before the workspace, and cleans up', () => {
  const view = read('src/features/tenancy/views/TenancyCareWorkspaceView.tsx');
  assert.match(view, /const back=\(\)=>\{if\(id\)setSelected\(null\);else onBack\(\);\}/);
  assert.match(view, /useEffect\(\(\)=>\{registerBackAction\(back\);return\(\)=>registerBackAction\(null\);\}\)/);
  assert.match(view, /<ScreenHeader title="Maintenance Requests" onBack=\{back\}\/>/);
  assert.match(read('App.tsx'), /<TenancyCareWorkspaceView [\s\S]*?onBack=\{\(\)=>setWorkspace\(\{type:'tenancy'\}\)\} registerBackAction=\{registerWorkspaceBack\}\/>/);
});
test('Modal only dispatches current account/workspace Back, without bypassing feature guards', () => {
  const app = read('App.tsx');
  assert.match(app, /registered\?\.workspace === workspace && registered\?\.userId === auth.account\?\.user.id/);
  assert.match(app, /else if \(workspaceBackAction.current\?\.workspace === workspace\) workspaceBackAction.current = null/);
  assert.doesNotMatch(app, /else openProfile\(\)/);
  assert.match(app, /workspaceOwner.current !== userId/);
  assert.match(app, /workspace.type === 'adminModeration' && !canEnterAdmin/);
});
test('Notifications visible close returns to Discovery; root hardware delegates nested permissions first', () => {
  const notifications = read('App.tsx').split('<NotificationsFlowView')[1] ?? '';
  assert.ok(notifications);
  assert.match(notifications, /onClose=\{openDiscovery\}/);
  assert.match(notifications, /registerBackAction=\{registerWorkspaceBack\}/);
});
test('Profile/edit/settings hardware Back is consumed in-app and sign-out dialog retains priority', () => {
  const app = read('App.tsx');
  assert.match(app, /\['profile', 'editProfile', 'settings'\]\.includes\(auth.screen\)/);
  assert.match(app, /auth.showSignOutConfirmation\) return/);
  assert.match(app, /auth.asyncState !== 'loading'\) auth.goBack\(\)/);
  assert.match(app, /return true;/);
  assert.match(app, /return \(\) => subscription.remove\(\)/);
});
test('Verification still resolves nested tier screens before dismissal and protects active operations', () => {
  const flow = read('src/features/user-verification/views/UserVerificationFlowView.tsx');
  assert.match(flow, /tierThree.goBack\(\)/);
  assert.match(flow, /else viewModel.goBack\(\)/);
  assert.match(flow, /!current.isSubmitting && !current.isSelectingDocument/);
});
test('Stay cancels a pending root exit; Leave executes it once', () => {
  let dismissed = 0;
  const guard = createNavigationConfirmation(() => true);
  guard.request(() => dismissed++);
  guard.cancel(); assert.equal(dismissed, 0);
  guard.request(() => dismissed++); guard.request(() => dismissed += 10);
  guard.confirm(); guard.confirm(); assert.equal(dismissed, 1);
  for (const [feature, name] of [['search-discovery', 'SearchDiscovery'], ['property-listing', 'PropertyListing']]) {
    const flow = read(`src/features/${feature}/views/${name}FlowView.tsx`);
    assert.match(flow, /viewModel.backFromWorkspace\(on(?:Close, onRootBack|RootBack)\)/);
    const vm = read(`src/features/${feature}/viewModels/use${name}ViewModel.ts`);
    assert.match(vm, /navigation.requestNavigation/);
  }
});

test('Profile-entered Matching Preferences hardware Back closes through the draft guard rather than opening Discovery home', () => {
  const vm = read('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts');
  assert.match(vm, /initialScreen === 'matchingPreferences' && screen === 'matchingPreferences' && history.length === 0/);
  assert.match(vm, /navigation.requestNavigation\(onClose\)/);
  const notifications = read('src/features/notifications/views/NotificationCenterView.tsx');
  assert.match(notifications, /onBack=\{onClose\}/);
  assert.doesNotMatch(notifications, /onClose=\{onClose\}/);
});
