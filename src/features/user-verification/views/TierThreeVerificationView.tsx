import { DocumentReviewSummary } from '../components/DocumentReviewSummary';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { VerificationStatusIndicator } from '../../../shared/components/VerificationStatusIndicator';
import { verificationStatusPresentation } from '../../../shared/models/verificationPresentation';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DocumentPreviewPicker } from '../components/DocumentPreviewPicker';
import { SelectionRow } from '../components/SelectionRow';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { tierThreeDocumentOptions, verificationPropertyLabel } from '../models/TierThreeVerification';
import type { TierThreeVerificationViewModel } from '../viewModels/useTierThreeVerificationViewModel';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';

const propertyIcon = require('../../../assets/verification/property.png');

export function TierThreeVerificationView({ viewModel: vm, onClose, onOverview }: { viewModel: TierThreeVerificationViewModel; onClose: () => void; onOverview: () => void }) {
  const property = vm.properties.find(item => item.id === vm.propertyId);
  const submission = vm.submission;
  const back = vm.screen === 'intro' ? onOverview : vm.goBack;
  const title = vm.screen === 'property' ? 'Select a property' : vm.screen === 'documentType' ? 'Choose document type' : vm.screen === 'document' ? 'Select your document' : vm.screen === 'review' ? 'Confirm submission' : vm.screen === 'status' ? 'Property verification' : 'Tier 3 verification';
  const documentLabel = tierThreeDocumentOptions.find(option => option.value === vm.documentType)?.label;
  return (
    <VerificationScaffold title={title} onBack={back} onClose={onClose}>
      {vm.screen === 'intro' ? <>
        <Text style={styles.heading}>Verify a property you own</Text>
        <Text style={styles.body}>Provide proof of ownership or authorization to lease for an existing property. Tier 2 is not required. Verification does not grant the Landlord role.</Text>
        <AppButton disabled={vm.busy || !vm.loaded || vm.requiresRefresh} label="Choose property" onPress={() => vm.navigate('property')} />
      </> : null}
      {vm.screen === 'property' ? <>
        <Text style={styles.body}>Only properties belonging to your account are shown.</Text>
        {vm.loaded && !vm.isLoading && vm.properties.length === 0 ? <FeedbackNotice message="No properties are available for your account. Tier 3 needs an existing owned property. Property creation is separate from verification." /> : null}
        {!vm.busy ? vm.properties.map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === vm.propertyId }} key={item.id} onPress={() => void vm.selectProperty(item.id)} style={[styles.propertyRow, item.id === vm.propertyId && styles.selected]}>
          <View style={styles.propertyImage}><Image accessibilityLabel="Property placeholder" resizeMode="contain" source={propertyIcon} style={styles.propertyIcon} /></View>
          <View style={styles.propertyCopy}><Text style={styles.propertyTitle}>{verificationPropertyLabel(item)}</Text><Text style={styles.caption}>{item.id === vm.propertyId ? 'Selected property' : 'Select property'}</Text></View>
        </Pressable>) : null}
      </> : null}
      {property && vm.screen !== 'property' && vm.screen !== 'intro' ? <View style={styles.summary}><Text style={styles.caption}>Selected property</Text><Text style={styles.propertyTitle}>{verificationPropertyLabel(property)}</Text></View> : null}
      {vm.screen === 'documentType' ? <>
        <Text style={styles.body}>Choose the ownership or authorization proof you will provide.</Text>
        {!vm.busy && !vm.requiresRefresh ? tierThreeDocumentOptions.map(option => <SelectionRow key={option.value} label={option.label} selected={vm.documentType === option.value} onPress={() => vm.chooseDocumentType(option.value)} />) : null}
      </> : null}
      {vm.screen === 'document' ? <>
        <Text style={styles.propertyTitle}>{documentLabel}</Text>
        <Text style={styles.body}>Select one readable file. It stays on your device until you confirm submission.</Text>
        <DocumentPreviewPicker document={vm.selectedDocument} busy={vm.busy || vm.requiresRefresh} onSelect={() => void vm.pickDocument()} />
        <AppButton disabled={vm.busy || vm.requiresRefresh || !vm.documentType || !vm.selectedDocument} label="Submit for review" onPress={() => vm.navigate('review')} />
      </> : null}
      {vm.screen === 'review' ? <>
        <View style={styles.reviewCard}>
          <DocumentPreviewPicker
            document={vm.selectedDocument}
            busy={vm.busy}
            documentInformation={vm.selectedDocument ? (
              <DocumentReviewSummary document={vm.selectedDocument} typeLabel="Document type" typeValue={documentLabel} />
            ) : undefined}
          />
        </View>
        <FeedbackNotice message="Confirm to create a property verification request and upload this private document for Admin review." />
        <AppButton disabled={!vm.canSubmit} label={vm.isSubmitting ? 'Submitting...' : 'Confirm and submit'} onPress={() => void vm.submit()} />
        <AppButton disabled={vm.busy} label="Cancel" onPress={vm.goBack} variant="secondary" />
      </> : null}
      {vm.screen === 'status' ? <>
        {submission ? <VerificationStatusIndicator {...verificationStatusPresentation(submission.status)} /> : <Text style={styles.heading}>Status unavailable</Text>}
        <Text style={styles.body}>{submission?.status === 'approved' ? 'This property verification was approved. Approval applies to this property.' : 'New submissions or replacement documents for this property are not available here.'}</Text>
        {submission && !submission.hasDocument ? <FeedbackNotice tone="warning" message="No document attachment could be confirmed. This request may be incomplete. No automatic upload retry or cleanup was performed." /> : null}
        {submission?.rejection_reason ? <FeedbackNotice tone="error" message={`Rejection reason: ${submission.rejection_reason}`} /> : null}
        {submission?.review_note ? <Text style={styles.body}>Review note: {submission.review_note}</Text> : null}
        {submission ? <Text style={styles.body}>Submitted: {formatVerificationDate(submission.submitted_at)}</Text> : null}
        {submission?.reviewed_at ? <Text style={styles.body}>Reviewed: {formatVerificationDate(submission.reviewed_at)}</Text> : null}
        <AppButton disabled={vm.busy} label="Choose another property" onPress={() => vm.navigate('property')} variant="secondary" />
      </> : null}
      {vm.isLoading ? <Text accessibilityLiveRegion="polite" style={styles.body}>Loading property verification...</Text> : null}
      <FeedbackNotice tone="error" message={vm.error} />
      {vm.showRecovery ? <AppButton disabled={vm.busy} label={vm.isLoading ? 'Checking...' : 'Check status'} onPress={() => void vm.refresh()} variant="secondary" /> : null}
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '700' },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 15, lineHeight: 22 },
  summary: { backgroundColor: colors.surface, borderRadius: radius.md, gap: spacing.xs, padding: spacing.md },
  propertyRow: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.sm, minHeight: 88 },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryPale },
  propertyImage: { backgroundColor: colors.surface, borderRadius: radius.sm, height: 64, width: 64, justifyContent: 'center', alignItems: 'center' },
  propertyIcon: { height: 38, width: 38 }, propertyCopy: { flex: 1, gap: spacing.xs },
  propertyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, lineHeight: 23, fontWeight: '600' },
  caption: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19 },
});
