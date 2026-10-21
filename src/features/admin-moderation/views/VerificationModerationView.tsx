import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FullscreenDocumentImage } from '../../../shared/components/FullscreenDocumentImage';
import { AppButton } from '../../../shared/components/AppButton';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AdminStatusPill, DetailCard, DetailRow } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { documentTypeLabel, formatVerificationDate, verificationStatusLabel, verificationTierLabel } from '../models/AdminVerification';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function VerificationModerationView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const detail = viewModel.selectedVerification;
  if (!detail) return (
    <AdminScaffold onBack={viewModel.goBack} title="Verification submission">
      <Text style={styles.viewerNoteBody}>{viewModel.verification.reviewBusy ? 'Review saved. Refreshing backend state...' : viewModel.verification.detailStatus === 'loading' ? 'Loading submission...' : viewModel.verification.detailError ?? 'Select a submission from the current queue.'}</Text>
      <AppButton disabled={viewModel.verification.reviewBusy} label="Back to verification queue" onPress={() => { viewModel.openSection('verificationQueue'); void viewModel.refreshVerification(); }} />
    </AdminScaffold>
  );
  const { item, documents } = detail;
  const preview = viewModel.verification.documentPreview;
  const review = viewModel.verification;
  const reviewTier = item.tier === 'tier_3_property' ? 'Tier 3 property' : 'Tier 2';
  return (
    <AdminScaffold onBack={viewModel.goBack} title={viewModel.screen === 'verificationDocument' ? 'Verification documents' : 'Verification submission'}>
      <View style={styles.caseHeader}><Text style={styles.caseId}>{item.submissionId}</Text></View>
      <Text accessibilityRole="header" style={styles.applicantName}>{item.displayName}</Text>
      <Text style={styles.caseSubtitle}>{verificationTierLabel(item.tier)} | {formatVerificationDate(item.submittedAt)}</Text>
      <View style={styles.statusRow}><AdminStatusPill status={verificationStatusLabel(item.status)} /></View>
      <Text style={styles.sectionLabel}>SUBMISSION DETAILS</Text>
      <DetailCard>
        <DetailRow label="USER ID" value={item.userId} />
        <DetailRow label="UPDATED" value={formatVerificationDate(item.updatedAt)} />
        <DetailRow label="TRUST SCORE" value={item.trustScore === null ? 'Not available' : String(item.trustScore)} />
        <DetailRow label="TIER 1 VERIFIED" value={item.tier1VerifiedAt ? formatVerificationDate(item.tier1VerifiedAt) : 'Not verified'} />
        <DetailRow label="TIER 2 VERIFIED" value={item.tier2VerifiedAt ? formatVerificationDate(item.tier2VerifiedAt) : 'Not verified'} />
        <DetailRow label="TIER 3 VERIFIED" value={item.tier3VerifiedAt ? formatVerificationDate(item.tier3VerifiedAt) : 'Not verified'} />
        {item.propertyId ? <DetailRow label="PROPERTY ID" value={item.propertyId} /> : null}
        <DetailRow label="SUBMITTED NOTE" value={item.submittedNote ?? 'No note provided'} last />
      </DetailCard>
      <View style={styles.documentSummary}>
        <View style={styles.documentCount}><Text style={styles.documentCountValue}>{documents.length}</Text></View>
        <View style={styles.documentCopy}><Text style={styles.documentTitle}>Documents attached</Text><Text style={styles.documentBody}>Private image previews are available on demand.</Text></View>
      </View>
      {documents.length === 0 ? <Text style={styles.viewerNoteBody}>No document attached</Text> : documents.map((document) => (
        <DetailCard key={document.id}>
          <DetailRow label="DOCUMENT TYPE" value={documentTypeLabel(document.document_type)} />
          <DetailRow label="FILE NAME" value={document.file_name ?? 'Filename unavailable'} />
          <DetailRow label="MIME TYPE" value={document.mime_type ?? 'Not available'} />
          <DetailRow label="ATTACHED" value={formatVerificationDate(document.created_at)} last />
          <View style={styles.previewAction}>
            {viewModel.canViewPrivateDocument(document.id) ? (
              <AppButton disabled={!!preview?.isOpening} label="View private document" onPress={() => void viewModel.openPrivateDocument(document.id)} />
            ) : <Text style={styles.viewerNoteBody}>Preview is not available for this file type.</Text>}
          </View>
        </DetailCard>
      ))}
      <View style={styles.actions}>
        {documents.length === 0 ? <AppButton disabled label="View private document" onPress={() => {}} /> : null}
        {viewModel.reviewActions.includes('under_review') ? <AppButton label="Start review" onPress={() => viewModel.requestReview('under_review')} /> : null}
        {viewModel.reviewActions.includes('approved') ? <AppButton label="Approve verification" onPress={() => viewModel.requestReview('approved')} /> : null}
        {viewModel.reviewActions.includes('rejected') ? <AppButton label="Reject verification" onPress={() => viewModel.requestReview('rejected')} variant="danger" /> : null}
        {review.reviewBusy ? <ActivityIndicator accessibilityLabel="Saving review and refreshing" color={colors.primary} /> : null}
        {review.reviewError ? <Text accessibilityRole="alert" style={styles.viewerNoteBody}>{review.reviewError}</Text> : null}
        {review.reviewNotice ? <Text accessibilityRole="alert" style={styles.viewerNoteBody}>{review.reviewNotice}</Text> : null}
        <AppButton disabled={review.reviewBusy} label="Refresh queue" variant="secondary" onPress={() => { viewModel.openSection('verificationQueue'); void viewModel.refreshVerification(); }} />
      </View>
      <Modal visible={!!review.reviewDialog} onRequestClose={viewModel.cancelReview} animationType="fade" presentationStyle="fullScreen">
        <ScreenContainer>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.actions}>
            <Text accessibilityRole="header" style={styles.documentTitle}>{review.reviewDialog === 'approved' ? `Approve ${reviewTier} verification?` : review.reviewDialog === 'rejected' ? `Reject ${reviewTier} verification` : `Start ${reviewTier} review?`}</Text>
            <Text style={styles.viewerNoteBody}>{review.reviewDialog === 'approved' ? item.tier === 'tier_3_property' ? 'Approve this property ownership or authorization proof? The backend requires a qualifying property document.' : 'This will verify the submitted identity document and complete Tier 2 verification for this user.' : review.reviewDialog === 'rejected' ? 'Explain why this verification submission is being rejected.' : 'Mark this submission as under review before making a decision.'}</Text>
            {review.reviewDialog === 'rejected' ? <>
              <Text style={styles.inputLabel}>Rejection reason (required)</Text>
              <TextInput accessibilityLabel="Rejection reason" multiline editable={!review.reviewBusy} onChangeText={viewModel.setRejectionReason} value={review.rejectionReason} style={styles.textArea} textAlignVertical="top" />
            </> : null}
            {review.reviewError ? <Text accessibilityRole="alert" style={styles.viewerNoteBody}>{review.reviewError}</Text> : null}
            <AppButton disabled={review.reviewBusy || (review.reviewDialog === 'rejected' && !review.rejectionReason.trim())} label={review.reviewBusy ? 'Saving review...' : review.reviewDialog === 'approved' ? 'Approve' : review.reviewDialog === 'rejected' ? 'Reject' : 'Start review'} onPress={() => void viewModel.confirmReview()} variant={review.reviewDialog === 'rejected' ? 'danger' : 'primary'} />
            <AppButton disabled={review.reviewBusy} label="Cancel" onPress={viewModel.cancelReview} variant="secondary" />
          </ScrollView>
        </ScreenContainer>
      </Modal>
      <FullscreenDocumentImage visible={!!preview?.isVisible} uri={preview?.signedUrl ?? null} title="Private verification document"
        description={preview ? `${documentTypeLabel(preview.documentType)} | ${preview.fileName ?? 'Filename unavailable'} | ${preview.mimeType ?? 'MIME type unavailable'}` : ''}
        loading={!!preview?.isOpening} error={preview?.error ?? null} onClose={viewModel.closePrivateDocument}
        onImageError={() => { if (preview) viewModel.privateDocumentFailed(preview.requestId); }} />
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  previewAction: { padding: spacing.sm },
  caseHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  caseId: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  applicantName: { color: colors.text, fontFamily: typography.family, fontSize: 27, fontWeight: '900', marginTop: spacing.md },
  caseSubtitle: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, marginTop: 4 },
  statusRow: { marginTop: spacing.sm },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  documentSummary: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  documentCount: { alignItems: 'center', backgroundColor: '#173C2C', borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  documentCountValue: { color: colors.white, fontFamily: typography.family, fontSize: 16, fontWeight: '900' },
  documentCopy: { flex: 1 },
  documentTitle: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  documentBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, marginTop: 3 },
  openDocument: { color: '#2E7552', fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  actions: { gap: spacing.xs, marginTop: spacing.lg },
  documentLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: spacing.xs },
  imageCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, height: 225, overflow: 'hidden', position: 'relative' },
  propertyImageCard: { height: 280 },
  documentImage: { height: '100%', width: '100%' },
  localBadge: { backgroundColor: colors.overlay, bottom: 0, left: 0, paddingVertical: 7, position: 'absolute', right: 0 },
  localBadgeText: { color: colors.white, fontFamily: typography.family, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  fileName: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, marginBottom: spacing.lg, marginTop: 5 },
  viewerNote: { backgroundColor: '#EAF1ED', borderRadius: radius.sm, gap: 4, padding: spacing.sm },
  viewerNoteTitle: { color: '#173C2C', fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  viewerNoteBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, lineHeight: 14 },
  checkList: { backgroundColor: colors.primaryPale, borderRadius: radius.card, gap: spacing.sm, marginVertical: spacing.lg, padding: spacing.md },
  checkItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  checkCircle: { backgroundColor: colors.primary, borderRadius: 10, height: 20, position: 'relative', width: 20 },
  checkShort: { backgroundColor: colors.white, height: 2, left: 4, position: 'absolute', top: 10, transform: [{ rotate: '45deg' }], width: 6 },
  checkLong: { backgroundColor: colors.white, height: 2, left: 8, position: 'absolute', top: 9, transform: [{ rotate: '-45deg' }], width: 9 },
  checkLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: spacing.sm, textAlign: 'center' },
  reasonOption: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', marginBottom: spacing.xs, minHeight: 56, padding: spacing.sm },
  reasonSelected: { backgroundColor: colors.restrictedSurface, borderColor: colors.restricted },
  reasonLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  radio: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 2, height: 20, justifyContent: 'center', width: 20 },
  radioSelected: { borderColor: colors.restricted },
  radioCenter: { backgroundColor: colors.restricted, borderRadius: 5, height: 10, width: 10 },
  inputLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.md },
  textArea: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 12, marginBottom: spacing.lg, minHeight: 130, padding: spacing.md },
});
