import { Image, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DocumentPreviewPicker } from '../components/DocumentPreviewPicker';
import { SelectionRow } from '../components/SelectionRow';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { tierTwoStatusLabels } from '../models/TierTwoVerification';
import { tierThreeDocumentOptions, verificationPropertyLabel } from '../models/TierThreeVerification';
import type { TierThreeVerificationViewModel } from '../viewModels/useTierThreeVerificationViewModel';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';

const propertyIcon = require('../../../assets/verification/property.png');

export function TierThreeVerificationView({ viewModel: vm, onClose, onOverview }: { viewModel: TierThreeVerificationViewModel; onClose: () => void; onOverview: () => void }) {
  const property = vm.properties.find(item => item.id === vm.propertyId);
  const submission = vm.submission;
  const back = vm.screen === 'intro' ? onOverview : vm.goBack;
  const title = vm.screen === 'property' ? 'Select a property' : vm.screen === 'review' ? 'Review property verification' : vm.screen === 'status' ? 'Tier 3 status' : 'Tier 3 - Premium';
  return (
    <VerificationScaffold title={title} onBack={back} onClose={onClose}>
      {vm.screen === 'intro' ? <>
        <View style={styles.infoCard}>
          <Image resizeMode="contain" source={propertyIcon} style={styles.infoIcon} />
          <Text style={styles.infoTitle}>Verify a property you own</Text>
          <Text style={styles.infoBody}>Provide proof of ownership or authorization to lease for an existing property. Tier 2 is not required. Verification does not grant the Landlord role.</Text>
        </View>
        <AppButton disabled={vm.busy || !vm.loaded || vm.requiresRefresh} label="Choose property" onPress={() => vm.navigate('property')} />
      </> : null}
      {vm.screen === 'property' ? <>
        <Text style={styles.body}>Only properties belonging to your account are shown.</Text>
        {vm.loaded && !vm.isLoading && vm.properties.length === 0 ? <Text style={styles.notice}>No existing properties were found for your account. Tier 3 needs an existing owned property. Property creation is separate from verification.</Text> : null}
        {!vm.busy ? vm.properties.map(item => <SelectionRow key={item.id} label={verificationPropertyLabel(item)} detail={`Property ID: ${item.id}`} selected={item.id === vm.propertyId} onPress={() => void vm.selectProperty(item.id)} />) : null}
      </> : null}
      {property && vm.screen !== 'property' && vm.screen !== 'intro' ? <View style={styles.reviewCard}><Text style={styles.body}>{verificationPropertyLabel(property)}</Text><Text style={styles.body}>Property ID: {property.id}</Text></View> : null}
      {vm.screen === 'document' ? <>
        <Text style={styles.body}>Choose ownership or authorization proof, then select one file. Selection stays on your device until Submit.</Text>
        {!vm.busy && !vm.requiresRefresh ? tierThreeDocumentOptions.map(option => <SelectionRow key={option.value} label={option.label} selected={vm.documentType === option.value} onPress={() => vm.chooseDocumentType(option.value)} />) : null}
        {vm.documentType ? <DocumentPreviewPicker document={vm.selectedDocument} busy={vm.busy || vm.requiresRefresh} onSelect={() => void vm.pickDocument()} /> : null}
        <AppButton disabled={vm.busy || vm.requiresRefresh || !vm.documentType || !vm.selectedDocument} label="Review document" onPress={() => vm.navigate('review')} />
      </> : null}
      {vm.screen === 'review' ? <>
        <DocumentPreviewPicker document={vm.selectedDocument} busy={vm.busy} />
        <Text style={styles.body}>Document: {tierThreeDocumentOptions.find(option => option.value === vm.documentType)?.label}</Text>
        <Text style={styles.notice}>Submit creates a property verification request and uploads this private document for Admin review.</Text>
        <AppButton disabled={!vm.canSubmit} label={vm.isSubmitting ? 'Submitting...' : 'Submit for review'} onPress={() => void vm.submit()} />
      </> : null}
      {vm.screen === 'status' ? <>
        <Text accessibilityRole="header" style={styles.infoTitle}>{submission ? tierTwoStatusLabels[submission.status] : 'Status unavailable'}</Text>
        <Text style={styles.body}>{submission?.status === 'approved' ? 'This property verification was approved.' : 'Status is loaded from the backend. New submissions or replacement documents for this property are not available here.'}</Text>
        {submission && !submission.hasDocument ? <Text style={styles.notice}>No document attachment could be confirmed. This request may be incomplete. No automatic upload retry or cleanup was performed.</Text> : null}
        {submission?.rejection_reason ? <Text style={styles.body}>Rejection reason: {submission.rejection_reason}</Text> : null}
        {submission?.review_note ? <Text style={styles.body}>Review note: {submission.review_note}</Text> : null}
        {submission ? <Text style={styles.body}>Submitted: {formatVerificationDate(submission.submitted_at)}</Text> : null}
        {submission?.reviewed_at ? <Text style={styles.body}>Reviewed: {formatVerificationDate(submission.reviewed_at)}</Text> : null}
        <AppButton disabled={vm.busy} label="Choose another property" onPress={() => vm.navigate('property')} variant="secondary" />
      </> : null}
      {vm.isLoading ? <Text style={styles.body}>Loading property verification...</Text> : null}
      {vm.error ? <Text accessibilityRole="alert" style={styles.notice}>{vm.error}</Text> : null}
      <AppButton disabled={vm.busy} label={vm.isLoading ? 'Refreshing...' : 'Refresh Tier 3'} onPress={() => void vm.refresh()} variant="secondary" />
      <AppButton disabled={vm.busy} label="Back to verification levels" onPress={onOverview} variant="secondary" />
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  infoCard: { alignItems: 'center', backgroundColor: colors.premiumSurface, borderColor: colors.premiumBorder, borderRadius: radius.card, borderWidth: 1, gap: spacing.xs, padding: spacing.lg },
  infoIcon: { height: 66, width: 66 },
  infoTitle: { color: colors.premiumText, fontFamily: typography.family, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  infoBody: { color: colors.premiumText, fontFamily: typography.family, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.xs, padding: spacing.md },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 20 },
  notice: { backgroundColor: colors.warningSurface, borderRadius: radius.sm, color: colors.warning, fontFamily: typography.family, fontSize: 13, lineHeight: 18, padding: spacing.sm },
});
