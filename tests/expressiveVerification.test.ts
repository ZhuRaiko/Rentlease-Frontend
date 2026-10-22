/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verificationTierIdentities } from '../src/shared/models/verificationTierIdentity';
import { accountVerificationSummary, profileVerificationIndicator, profileAvatarDiameter } from '../src/features/authentication/models/accountPresentation';
import { verificationStatusPresentation } from '../src/shared/models/verificationPresentation';
import { tierTwoSubmissionPresentation } from '../src/features/user-verification/models/TierTwoVerification';
import { colors } from '../src/shared/theme/colors';
const read = (p: string) => readFileSync(p, 'utf8');
function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
test('credential identities are unique and all body/header color pairs meet 4.5:1 contrast', () => {
  const identities = Object.values(verificationTierIdentities);
  assert.equal(new Set(identities.map(i => i.name)).size, 3);
  for (const { ink, surface } of identities) assert.ok((luminance(surface) + 0.05) / (luminance(ink) + 0.05) >= 4.5);
  assert.ok((luminance(colors.white) + 0.05) / (luminance(colors.profileBackdrop) + 0.05) >= 4.5);
  assert.ok((luminance(colors.white) + 0.05) / (luminance(colors.profileBackdropLayer) + 0.05) >= 4.5);
});
test('Profile tier keys coordinate identity without inferring status or property approval', () => {
  const summary = accountVerificationSummary({ tier1_verified_at: 'date', tier2_verified_at: null, tier3_verified_at: 'date' }, ['landlord']);
  assert.deepEqual(summary.map(i => verificationTierIdentities[i.tier].name), ['Account', 'Identity', 'Property']);
  assert.deepEqual(summary.map(i => i.status.label), ['Verified', 'Not Verified', 'Verified']);
  assert.match(summary[2]!.detail, /Account-level indication.*each individual property/);
  assert.equal(accountVerificationSummary(null, ['tenant'])[2]!.status.label, 'Not Applicable');
});
test('all submission decisions stay distinct from credential palettes', () => {
  assert.deepEqual((['pending', 'under_review', 'approved', 'rejected', 'cancelled', 'revoked'] as const).map(s => verificationStatusPresentation(s).label), ['Pending', 'Under Review', 'Verified', 'Rejected', 'Cancelled', 'Revoked']);
  const partial = { status: 'pending', hasDocument: false } as Parameters<typeof tierTwoSubmissionPresentation>[0];
  assert.equal(tierTwoSubmissionPresentation(partial).label, 'Incomplete Upload');
  assert.equal(tierTwoSubmissionPresentation(partial, true).label, 'Status Unconfirmed');
});
test('both screens share identity tokens while semantic badges and guarded actions remain', () => {
  const card = read('src/features/user-verification/components/VerificationTierCard.tsx');
  const summary = read('src/features/authentication/components/AccountVerificationSummary.tsx');
  for (const source of [card, summary]) assert.match(source, /verificationTierIdentities/);
  assert.match(read('src/shared/models/verificationPresentation.ts'), /status.tone === 'success'/);
  assert.match(card, /<VerificationStatusIndicator \{\.\.\.presentation\}/);
  assert.match(summary, /\{item.status.label\}/);
  assert.doesNotMatch(summary, /<VerificationStatusBadge/);
  assert.match(card, /tier === 1 \? null : disabled \|\| !onPress/);
  const overview = read('src/features/user-verification/views/VerificationOverviewView.tsx');
  assert.match(overview, /Approval applies to the selected property only/);
});
test('curved Profile identity preserves editing, account content and scalable text', () => {
  const profile = read('src/features/authentication/views/ProfileView.tsx');
  assert.match(profile, /<ProfileAvatar initials=\{initials\}/);
  assert.doesNotMatch(profile, /styles.backdropLayer/);
  assert.match(read('src/features/authentication/components/ProfileAvatar.tsx'), /backgroundColor: colors.primaryAction/);
  const summary = read('src/features/authentication/components/AccountVerificationSummary.tsx');
  assert.doesNotMatch(summary, /item.detail|rowBody:|styles.rowHeading/);
  assert.match(summary, /flexWrap: 'wrap'/);
  assert.match(profile, /viewModel.navigate\('editProfile'\)/);
  assert.match(profile, /viewModel.account.profile.bio/);
  assert.match(profile, /roleLabels.join/);
  assert.match(profile, /<ScreenHeader title="Profile" onBack=\{onBack\}/);
  for (const p of ['src/features/authentication/components/AccountVerificationSummary.tsx', 'src/features/user-verification/components/VerificationTierCard.tsx', 'src/features/authentication/views/ProfileView.tsx']) {
    assert.doesNotMatch(read(p), /allowFontScaling=\{false\}|maxFontSizeMultiplier|numberOfLines|adjustsFontSizeToFit/);
    assert.doesNotMatch(read(p), /from.*(?:supabase|services|otherFeature)/);
  }
});

test('Profile overhaul uses one compact ledger, with real tier/status labels and no repeated explanations', () => {
  const profile = read('src/features/authentication/views/ProfileView.tsx');
  const summary = read('src/features/authentication/components/AccountVerificationSummary.tsx');
  assert.doesNotMatch(profile, /styles.profileIsland|styles.profileCard|styles.profileActions/);
  assert.doesNotMatch(summary, /item.detail/);
  assert.match(summary, /item.label.*item.status.label/);
  assert.match(summary, /account-level indication, not verification of every property/);
  assert.match(summary, /Account required.*Identity and Property optional/);
  assert.match(profile, /onOpenMatchingPreferences\?\.\(\)/);
  assert.match(profile, /onOpenRatingsReports\?\.\(\)/);
  assert.match(profile, /onOpenAdminModeration\?\.\(\)/);
  assert.match(profile, /viewModel.navigate\('settings'\)/);
  assert.match(profile, /\{marketplaceNavigation\}/);
});
test('Tenant, Landlord, dual-role, Admin and absent-profile summaries retain backend timestamp/applicability semantics', () => {
  for (const roles of [['tenant'], ['landlord'], ['tenant', 'landlord'], ['admin']] as const) {
    const missing = accountVerificationSummary(null, [...roles]);
    assert.deepEqual(missing.map(item => item.tier), [1, 2, 3]);
    assert.ok(missing.every(item => item.status.label !== 'Verified'));
    const verified = accountVerificationSummary({ tier1_verified_at: 'date', tier2_verified_at: 'date', tier3_verified_at: 'date' }, [...roles]);
    assert.ok(verified.every(item => item.status.label === 'Verified'));
  }
});

test('Profile status indicators distinguish confirmed, pending, negative and unverified without changing labels', () => {
  assert.equal(profileVerificationIndicator({ label: 'Verified', tone: 'success' }), 'check');
  for (const label of ['Pending', 'Under Review']) assert.equal(profileVerificationIndicator({ label, tone: label === 'Pending' ? 'warning' : 'info' }), 'pending');
  for (const label of ['Rejected', 'Revoked']) assert.equal(profileVerificationIndicator({ label, tone: 'error' }), 'error');
  assert.equal(profileVerificationIndicator({ label: 'Not Applicable', tone: 'info' }), 'unavailable');
  for (const label of ['Not Verified', 'Cancelled', 'Incomplete Upload', 'Status Unconfirmed']) assert.equal(profileVerificationIndicator({ label, tone: 'info' }), 'unverified');
});
test('calmer Profile places name with avatar, removes the extra eyebrow and keeps professional grouped sections', () => {
  const profile = read('src/features/authentication/views/ProfileView.tsx');
  const identity = profile.split('<View style={styles.identityTop}>')[1]?.split('profile.bio')[0] ?? '';
  assert.match(identity, /<ProfileAvatar/);
  assert.match(identity, /styles.membership/);
  assert.match(identity, /styles.name.*viewModel.displayName/);
  assert.doesNotMatch(profile, /Make it yours|Your RentLease|styles.eyebrow|fontSize: 34/);
  assert.match(profile, /'Preferences'/);
  assert.match(profile, /minWidth: 0/);
  assert.match(profile, /paddingTop: spacing.lg/);
});

test('avatar diameter preserves equal circular dimensions as accessibility fonts grow', () => {
  assert.equal(profileAvatarDiameter(1), 64);
  for (const scale of [1, 1.5, 2, 3]) assert.ok(profileAvatarDiameter(scale) >= 32 * scale + 24);
  const source = read('src/features/authentication/components/ProfileAvatar.tsx');
  assert.match(source, /width: diameter, height: diameter, borderRadius: diameter \/ 2/);
  assert.match(source, /overflow: 'hidden'/);
  assert.match(source, /resizeMode="cover"/);
  assert.match(source, /initials \|\| '\?'/);
});
test('Profile and detailed verification share light status indicators without changing supplied labels', () => {
  for (const path of ['src/features/authentication/components/AccountVerificationSummary.tsx', 'src/features/user-verification/components/VerificationTierCard.tsx', 'src/features/user-verification/views/VerificationStatusView.tsx', 'src/features/user-verification/views/TierThreeVerificationView.tsx']) {
    assert.match(read(path), /<VerificationStatusIndicator/);
    assert.doesNotMatch(read(path), /<VerificationStatusBadge/);
  }
  const indicator = read('src/shared/components/VerificationStatusIndicator.tsx');
  assert.match(indicator, /accessibilityLabel=\{label\}/);
  assert.match(indicator, /\{label\}/);
  assert.doesNotMatch(indicator, /backgroundColor|numberOfLines|allowFontScaling/);
});
test('full verification uses firmly framed sections while retaining requirements, feedback and guarded actions', () => {
  const card = read('src/features/user-verification/components/VerificationTierCard.tsx');
  assert.match(card, /borderBottomWidth: 3/);
  assert.doesNotMatch(card, /styles.statusArea|styles.credential|styles.markText/);
  assert.match(card, /items.map/);
  assert.match(card, /tier === 1 \? null : disabled \|\| !onPress/);
  const status = read('src/features/user-verification/views/VerificationStatusView.tsx');
  for (const detail of ['rejection_reason', 'review_note', 'submitted_at', 'reviewed_at', 'startRecovery']) assert.ok(status.includes(detail));
});

test('Profile navigation icons use neutral gray while edit keeps brand emphasis', () => {
  const row = read('src/features/authentication/components/ProfileActionRow.tsx');
  assert.match(row, /icon: \{ height: 24, tintColor: colors.textSecondary, width: 24 \}/);
  assert.match(row, /iconSlot/);
  assert.match(read('src/features/authentication/views/ProfileView.tsx'), /name="reviews" color=\{colors.textSecondary\}/);
  assert.match(read('src/shared/components/InterfaceIcon.tsx'), /color = colors.primaryAction/);
  assert.match(read('src/features/authentication/views/ProfileView.tsx'), /editIcon:.*tintColor: colors.primaryAction/);
});
test('Verification headings own their status and avoid repeated tier/domain or completed-account footers', () => {
  const card = read('src/features/user-verification/components/VerificationTierCard.tsx');
  const heading = card.split('<View style={styles.headingCopy}>')[1]?.split('</View>')[0] ?? '';
  assert.match(heading, /<VerificationStatusIndicator/);
  assert.match(heading, /\{subtitle\}/);
  assert.doesNotMatch(card, /styles.tier\}/);
  assert.match(card, /tier === 1 \? null : disabled \|\| !onPress/);
  const overview = read('src/features/user-verification/views/VerificationOverviewView.tsx');
  assert.doesNotMatch(overview, /Your foundation for RentLease|Tier 1 verified|tierTwoStatusLabels/);
  assert.match(overview, /View submission/);
  assert.match(overview, /View incomplete upload/);
  assert.match(overview, /Approval applies to the selected property only/);
});
