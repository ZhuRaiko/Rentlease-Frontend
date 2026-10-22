/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { colors } from '../src/shared/theme/colors';
import { verificationStatusPresentation } from '../src/shared/models/verificationPresentation';

const read = (path: string) => readFileSync(path, 'utf8');

test('visible Profile Back and Android Back share one guarded root return action', () => {
  const app = read('App.tsx');
  assert.match(app, /onProfileBack=\{!workspace && allowedProfileReturn \? returnFromProfile : undefined\}/);
  assert.match(app, /BackHandler.addEventListener\('hardwareBackPress', \(\) => \{\s*returnFromProfile\(\);\s*return true;/);
  assert.match(app, /workspace \|\| auth.screen !== 'profile' \|\| !allowedProfileReturn \|\| auth.showSignOutConfirmation/);
  assert.match(app, /return \(\) => subscription.remove\(\)/);
  assert.match(app, /if \(profileReturnTarget && !allowedProfileReturn\) setProfileReturnTarget\(null\)/);
  assert.match(app, /workspaceBackAction.current\(\)/);
  const profile = read('src/features/authentication/views/ProfileView.tsx');
  assert.match(profile, /<ScreenHeader title="Profile" onBack=\{onBack\}/);
});

test('Discovery Notifications follows the guarded feature callback to the existing root preview', () => {
  const app = read('App.tsx');
  assert.match(app, /onOpenNotifications=\{\(\) => \{ if \(canEnterMarketplace\) setWorkspace\(\{ type: 'notifications' \}\); \}\}/);
  const flow = read('src/features/search-discovery/views/SearchDiscoveryFlowView.tsx');
  assert.match(flow, /onOpenNotifications=\{\(\) => viewModel.requestNavigation\(onOpenNotifications\)\}/);
  const home = read('src/features/search-discovery/views/TenantDiscoveryView.tsx');
  assert.match(home, /accessibilityLabel="Open Notifications".*onPress=\{onOpenNotifications\}/);
  assert.match(home, /viewModel.navigate\('searchLocation'\)/);
  assert.match(home, /onPress=\{viewModel.openHome\}/);
  assert.doesNotMatch(read('src/features/authentication/views/ProfileView.tsx'), /label="Notifications"/);
});

test('Verification and Ratings actions use distinct decorative icons with accessible row labels', () => {
  const profile = read('src/features/authentication/views/ProfileView.tsx');
  assert.match(profile, /leading=\{<InterfaceIcon name="verification" \/>\} label="Verification"/);
  assert.match(profile, /leading=\{<InterfaceIcon name="reviews" \/>\} label="Ratings & Reports"/);
  assert.match(read('src/features/authentication/components/ProfileActionRow.tsx'), /accessibilityLabel=\{detail \? `\$\{label\}. \$\{detail\}` : label\}/);
});

function luminance(hex: string) {
  const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
test('tier identity pairs maintain readable contrast and do not replace semantic statuses', () => {
  const pairs = [[colors.primaryAction, colors.primaryPale], [colors.identityInk, colors.identitySurface], [colors.propertyProofInk, colors.propertyProofSurface]];
  for (const [ink, surface] of pairs) assert.ok((luminance(surface!) + 0.05) / (luminance(ink!) + 0.05) >= 4.5);
  assert.deepEqual((['pending', 'under_review', 'approved', 'rejected', 'cancelled', 'revoked'] as const).map(status => verificationStatusPresentation(status).label), ['Pending', 'Under Review', 'Verified', 'Rejected', 'Cancelled', 'Revoked']);
  const card = read('src/features/user-verification/components/VerificationTierCard.tsx');
  assert.match(card, /Tier \{tier\} \/ \{identity.name\}/);
  assert.match(card, /<VerificationStatusBadge \{\.\.\.presentation\}/);
});

test('rejected Tier 2 action binds only local recovery selection, without direct backend writes', () => {
  const status = read('src/features/user-verification/views/VerificationStatusView.tsx');
  assert.match(status, /Submit Corrected Documents/);
  assert.match(status, /onPress=\{viewModel.startRecovery\}/);
  assert.doesNotMatch(status, /createSubmission|\.submit\(|tier2Upload|resubmit\(/);
  const workflow = read('src/features/user-verification/viewModels/tierTwoVerificationWorkflow.ts');
  assert.match(workflow, /tierTwoRecoveryKind\(state.submission\)/);
});
