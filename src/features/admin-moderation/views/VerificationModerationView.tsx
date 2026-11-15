import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { FullscreenDocumentImage } from '../../../shared/components/FullscreenDocumentImage';
import { identityLocationChanged } from '../../../shared/models/PropertyIdentity';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import {
  AdminBottomSheet, AdminCard, AdminCheckbox, AdminChip, AdminChipRow, AdminDiffCard, AdminDiffRow, AdminDisclosure, AdminSectionLabel, DetailRow,
} from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { documentTypeLabel, formatVerificationDate, verificationStatusLabel, verificationTierLabel } from '../models/AdminVerification';
import { summarizeIdentityChanges } from '../models/AdminQueuePresentation';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function VerificationModerationView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const detail = viewModel.selectedVerification;
  if (!detail) return (
    <AdminScaffold onBack={viewModel.goBack} title="Review submission">
      <Text style={ui.body}>{viewModel.verification.reviewBusy ? 'Review saved. Refreshing backend state...' : viewModel.verification.detailStatus === 'loading' ? 'Loading submission...' : viewModel.verification.detailError ?? 'Select a submission from the current queue.'}</Text>
      <AppButton disabled={viewModel.verification.reviewBusy} label="Back to verification queue" onPress={() => void viewModel.returnToVerificationQueue()} />
    </AdminScaffold>
  );
  const { item, documents, identity } = detail;
  const preview = viewModel.verification.documentPreview;
  const review = viewModel.verification;
  const reviewTier = item.tier === 'tier_3_property' ? 'Tier 3 property' : 'Tier 2';
  const changes = identity?.same_asset_required ? summarizeIdentityChanges(identity) : null;
  // Tier 3 corrections need the "same physical property" confirmation; Tier 2 never shows it.
  const needsSameAsset = review.reviewDialog === 'approved' && !!identity?.same_asset_required;
  const dialog = review.reviewDialog;
  const confirmDisabled = review.reviewBusy || (dialog === 'rejected' && !review.rejectionReason.trim()) || (needsSameAsset && !review.sameAssetConfirmed);
  const showApproveBlock = viewModel.reviewActions.includes('approved') && !!viewModel.approveBlockedReason;
  const footer = viewModel.reviewActions.length > 0 ? (
    <View style={styles.footerRow}>
      {viewModel.reviewActions.includes('under_review') ? <View style={styles.footerButton}><AppButton label="Start review" onPress={() => viewModel.requestReview('under_review')} /></View> : null}
      {viewModel.reviewActions.includes('rejected') ? <View style={styles.footerButton}><AppButton label="Reject" onPress={() => viewModel.requestReview('rejected')} variant="danger" /></View> : null}
      {viewModel.reviewActions.includes('approved') ? <View style={styles.footerButton}><AppButton disabled={!!viewModel.approveBlockedReason} label="Approve" onPress={() => viewModel.requestReview('approved')} /></View> : null}
    </View>
  ) : undefined;
  return (
    <AdminScaffold footer={footer} onBack={viewModel.goBack} title="Review submission">
      <Text accessibilityRole="header" style={styles.name}>{item.displayName}</Text>
      <AdminChipRow>
        <AdminChip label={verificationTierLabel(item.tier)} />
        <AdminChip label={verificationStatusLabel(item.status)} tone={item.status === 'under_review' ? 'info' : item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'} />
      </AdminChipRow>
      <Text style={styles.submitted}>Submitted {formatVerificationDate(item.submittedAt)}</Text>

      {review.reviewBusy ? <ActivityIndicator accessibilityLabel="Saving review and refreshing" color={colors.primaryAction} /> : null}
      <View style={styles.notices}>
        {showApproveBlock ? <FeedbackNotice tone="warning" message={`Approval is blocked\n${viewModel.approveBlockedReason}`} /> : null}
        {!dialog ? <FeedbackNotice tone="error" message={review.reviewError} /> : null}
        <FeedbackNotice tone="success" message={review.reviewNotice} />
        {review.reviewNeedsRefresh ? <AppButton disabled={review.reviewBusy} label="Reload verification queue" onPress={() => void viewModel.returnToVerificationQueue()} variant="secondary" /> : null}
      </View>

      {identity ? <>
        {changes ? <>
          <AdminSectionLabel>{`Requested changes (${changes.changed.length})`}</AdminSectionLabel>
          {changes.changed.length > 0 ? (
            <AdminDiffCard>{changes.changed.map((change, index) => <AdminDiffRow from={change.from} key={change.key} label={change.label} last={index === changes.changed.length - 1} to={change.to} />)}</AdminDiffCard>
          ) : <Text style={ui.supporting}>No address fields differ. Only the confirmed location is proposed to change.</Text>}
          {changes.unchanged.length > 0 ? (
            <AdminDisclosure title={`Unchanged fields (${changes.unchanged.length})`}>
              {changes.unchanged.map((field) => <DetailRow key={field.key} label={field.label} value={field.value} />)}
            </AdminDisclosure>
          ) : null}
        </> : <>
          <AdminSectionLabel>Property identity being verified</AdminSectionLabel>
          <AdminCard>{summarizeIdentityChanges(identity).unchanged.map((field) => <DetailRow key={field.key} label={field.label} value={field.value} />)}</AdminCard>
        </>}
        <View style={styles.notices}>
          <FeedbackNotice tone="info" message={`${identityLocationChanged(identity.current, identity.proposed) ? 'Private and public location changes are proposed. Confirm the evidence describes the same physical rental. ' : 'Confirmed location is unchanged. '}Exact coordinates stay private. A relocation, split, merge or another unit needs a new property.`} />
        </View>
      </> : null}

      <AdminSectionLabel>{`Evidence (${documents.length} ${documents.length === 1 ? 'document' : 'documents'})`}</AdminSectionLabel>
      {documents.length === 0 ? <Text style={ui.body}>No document attached</Text> : documents.map((document) => (
        <AdminCard key={document.id}>
          <Text style={styles.cardTitle}>{documentTypeLabel(document.document_type)}</Text>
          <Text style={ui.supporting}>{`${document.file_name ?? 'Filename unavailable'} · ${document.mime_type ?? 'File type not available'} · ${formatVerificationDate(document.created_at)}`}</Text>
          {viewModel.canViewPrivateDocument(document.id)
            ? <AppButton disabled={!!preview?.isOpening} label="View private document" onPress={() => void viewModel.openPrivateDocument(document.id)} variant="secondary" />
            : <Text style={ui.supporting}>Preview is not available for this file type.</Text>}
        </AdminCard>
      ))}
      {item.submittedNote ? <><AdminSectionLabel>Applicant note</AdminSectionLabel><Text style={ui.body}>{item.submittedNote}</Text></> : null}

      <AdminSectionLabel>Applicant</AdminSectionLabel>
      <AdminChipRow>
        <AdminChip label={item.tier1VerifiedAt ? 'Tier 1 verified' : 'Tier 1 not verified'} tone={item.tier1VerifiedAt ? 'success' : 'neutral'} />
        <AdminChip label={item.tier2VerifiedAt ? 'Tier 2 verified' : 'Tier 2 not verified'} tone={item.tier2VerifiedAt ? 'success' : 'neutral'} />
        <AdminChip label={item.tier3VerifiedAt ? 'Tier 3 account verified' : 'Tier 3 account not verified'} tone={item.tier3VerifiedAt ? 'success' : 'neutral'} />
        <AdminChip label={item.trustScore === null ? 'Trust score not available' : `Trust score ${item.trustScore}`} />
      </AdminChipRow>
      <AdminDisclosure title="IDs and technical details">
        <DetailRow label="User ID" value={item.userId} />
        <DetailRow label="Submission ID" value={item.submissionId} />
        {item.propertyId ? <DetailRow label="Property ID" value={item.propertyId} /> : null}
        <DetailRow label="Updated" value={formatVerificationDate(item.updatedAt)} />
        {!item.submittedNote ? <DetailRow label="Note" value="No note provided" /> : null}
      </AdminDisclosure>

      <AdminBottomSheet closeDisabled={review.reviewBusy} onClose={viewModel.cancelReview} title={dialog === 'approved' ? `Approve ${reviewTier} verification?` : dialog === 'rejected' ? `Reject ${reviewTier} verification?` : `Start ${reviewTier} review?`} visible={!!dialog}>
        <Text style={ui.supporting}>{dialog === 'approved' ? item.tier === 'tier_3_property' ? (identity?.same_asset_required ? 'The backend requires a qualifying property document. This applies the requested address changes to the property.' : 'The backend requires a qualifying property document. This verifies the property ownership or authorization proof.') : 'This verifies the submitted identity document and completes Tier 2 verification for this user.' : dialog === 'rejected' ? 'Explain why this verification submission is being rejected.' : 'Mark this submission as under review before making a decision.'}</Text>
        {dialog === 'rejected' ? <>
          <Text style={styles.fieldLabel}>Rejection reason (required)</Text>
          <TextInput accessibilityLabel="Rejection reason" editable={!review.reviewBusy} multiline onChangeText={viewModel.setRejectionReason} style={styles.textArea} textAlignVertical="top" value={review.rejectionReason} />
        </> : null}
        {needsSameAsset ? <AdminCheckbox checked={review.sameAssetConfirmed} disabled={review.reviewBusy} label="I confirm the evidence describes the same physical property." onChange={viewModel.setSameAssetConfirmed} /> : null}
        <FeedbackNotice tone="error" message={review.reviewError} />
        <AppButton disabled={confirmDisabled} label={review.reviewBusy ? 'Saving review...' : dialog === 'approved' ? 'Approve' : dialog === 'rejected' ? 'Reject' : 'Start review'} onPress={() => void viewModel.confirmReview()} variant={dialog === 'rejected' ? 'danger' : 'primary'} />
        <AppButton disabled={review.reviewBusy} label="Cancel" onPress={viewModel.cancelReview} variant="secondary" />
      </AdminBottomSheet>

      <FullscreenDocumentImage description={preview ? `${documentTypeLabel(preview.documentType)} | ${preview.fileName ?? 'Filename unavailable'} | ${preview.mimeType ?? 'MIME type unavailable'}` : ''} error={preview?.error ?? null} loading={!!preview?.isOpening}
        onClose={viewModel.closePrivateDocument} onImageError={() => { if (preview) viewModel.privateDocumentFailed(preview.requestId); }} title="Private verification document" uri={preview?.signedUrl ?? null} visible={!!preview?.isVisible} />
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  name: { ...ui.pageTitle },
  submitted: { ...ui.supporting, marginTop: spacing.xs },
  notices: { gap: spacing.xs, marginTop: spacing.xs },
  cardTitle: { ...ui.body, fontWeight: '600' },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  footerButton: { flexBasis: 140, flexGrow: 1, flexShrink: 1 },
  fieldLabel: { ...ui.supporting, fontWeight: '700', marginTop: spacing.xs },
  textArea: { borderColor: colors.controlBorder, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontFamily: typography.family, fontSize: 16, lineHeight: 22, minHeight: 96, padding: spacing.sm },
});
