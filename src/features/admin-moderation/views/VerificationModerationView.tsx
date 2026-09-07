import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  AdminHeading,
  AdminStatusPill,
  DetailCard,
  DetailRow,
  PriorityPill,
} from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

const idPreview = require('../../../assets/verification/id-example.png');
const propertyDocumentPreview = require('../../../assets/verification/property-document-preview.png');

export function VerificationModerationView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const submission = viewModel.selectedVerification;
  if (!submission) return null;

  if (viewModel.screen === 'verificationDetails') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Verification submission">
        <View style={styles.caseHeader}>
          <PriorityPill priority={submission.priority} />
          <Text style={styles.caseId}>{submission.id}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.applicantName}>{submission.applicantName}</Text>
        <Text style={styles.caseSubtitle}>Tier {submission.requestedTier} verification · Submitted {submission.age} ago</Text>
        <View style={styles.statusRow}><AdminStatusPill status={submission.status} /></View>

        <Text style={styles.sectionLabel}>SUBMISSION DETAILS</Text>
        <DetailCard>
          <DetailRow label="GOVERNMENT ID" value={submission.governmentIdType} />
          <DetailRow label="ID FILE" value={submission.governmentIdFile} />
          <DetailRow label="PROPERTY" value={submission.propertyName} />
          <DetailRow label="PROPERTY ADDRESS" value={submission.propertyAddress} />
          <DetailRow label="OWNERSHIP / AUTHORIZATION" value={submission.ownershipDocumentType} />
          <DetailRow label="DOCUMENT FILE" last value={submission.ownershipDocumentFile} />
        </DetailCard>

        <View style={styles.documentSummary}>
          <View style={styles.documentCount}><Text style={styles.documentCountValue}>{submission.requestedTier === 3 ? 2 : 1}</Text></View>
          <View style={styles.documentCopy}><Text style={styles.documentTitle}>Documents available</Text><Text style={styles.documentBody}>Inspect each local preview before making a decision.</Text></View>
          <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('verificationDocument')}><Text style={styles.openDocument}>View ›</Text></Pressable>
        </View>

        <View style={styles.actions}>
          <AppButton label="Approve verification" onPress={() => viewModel.navigate('approveVerification')} />
          <AppButton label="Request corrected information" onPress={() => viewModel.navigate('requestVerificationInfo')} variant="secondary" />
          <AppButton label="Reject verification" onPress={() => viewModel.navigate('rejectVerification')} variant="danger" />
        </View>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'verificationDocument') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Verification documents">
        <AdminHeading body="Inspect the local document previews and compare their details with the submission." eyebrow="DOCUMENT VIEWER" title="Review submitted files" />
        <Text style={styles.documentLabel}>GOVERNMENT ID · {submission.governmentIdType.toUpperCase()}</Text>
        <View style={styles.imageCard}>
          <Image resizeMode="contain" source={idPreview} style={styles.documentImage} />
          <View style={styles.localBadge}><Text style={styles.localBadgeText}>LOCAL SAMPLE · NOT A REAL ID</Text></View>
        </View>
        <Text style={styles.fileName}>{submission.governmentIdFile}</Text>
        {submission.requestedTier === 3 ? (
          <>
            <Text style={styles.documentLabel}>OWNERSHIP · {submission.ownershipDocumentType.toUpperCase()}</Text>
            <View style={[styles.imageCard, styles.propertyImageCard]}>
              <Image resizeMode="contain" source={propertyDocumentPreview} style={styles.documentImage} />
              <View style={styles.localBadge}><Text style={styles.localBadgeText}>LOCAL SAMPLE · NOT A REAL DOCUMENT</Text></View>
            </View>
            <Text style={styles.fileName}>{submission.ownershipDocumentFile}</Text>
          </>
        ) : null}
        <View style={styles.viewerNote}><Text style={styles.viewerNoteTitle}>Viewer limitations</Text><Text style={styles.viewerNoteBody}>Zoom, secure file retrieval, authenticity checks, and download auditing require confirmed backend and Storage contracts.</Text></View>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'approveVerification') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Approve verification">
        <AdminHeading body="Confirm that the submitted information supports the requested verification tier." eyebrow="APPROVAL REVIEW" title={`Approve Tier ${submission.requestedTier}?`} />
        <DetailCard>
          <DetailRow label="APPLICANT" value={submission.applicantName} />
          <DetailRow label="IDENTITY DOCUMENT" value={`${submission.governmentIdType} reviewed`} />
          <DetailRow label="PROPERTY DOCUMENT" value={submission.requestedTier === 3 ? `${submission.ownershipDocumentType} reviewed` : 'Not required for Tier 2'} />
          <DetailRow label="RESULT" last value={`Grant Tier ${submission.requestedTier} verification`} />
        </DetailCard>
        <View style={styles.checkList}>
          <CheckItem label="Applicant details are consistent" />
          <CheckItem label="Documents are readable in this preview" />
          <CheckItem label="Requested tier requirements are represented" />
        </View>
        <AppButton label="Confirm approval preview" onPress={viewModel.approveVerification} />
        <Text style={styles.previewNote}>This does not change a Supabase profile, role, or verification record.</Text>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'rejectVerification') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Reject verification">
        <AdminHeading body="Record a clear reason the applicant can understand before rejecting this submission preview." eyebrow="REJECTION" title="Why can’t this be approved?" />
        <ReasonOption label="Document details cannot be verified" onPress={() => viewModel.setVerificationNote('Document details cannot be verified.')} selected={viewModel.verificationNote.includes('cannot be verified')} />
        <ReasonOption label="Ownership or authorization is insufficient" onPress={() => viewModel.setVerificationNote('Ownership or authorization documentation is insufficient.')} selected={viewModel.verificationNote.includes('insufficient')} />
        <ReasonOption label="Information does not match the account" onPress={() => viewModel.setVerificationNote('Submitted information does not match the account profile.')} selected={viewModel.verificationNote.includes('does not match')} />
        <Text style={styles.inputLabel}>REJECTION NOTE</Text>
        <TextInput multiline onChangeText={viewModel.setVerificationNote} placeholder="Explain the rejection reason" placeholderTextColor={colors.textMuted} style={styles.textArea} textAlignVertical="top" value={viewModel.verificationNote} />
        <AppButton disabled={viewModel.verificationNote.trim().length < 10} label="Confirm rejection preview" onPress={viewModel.rejectVerification} variant="danger" />
      </AdminScaffold>
    );
  }

  return (
    <AdminScaffold onBack={viewModel.goBack} title="Request information">
      <AdminHeading body="Ask for only the corrected or additional material needed to complete this review." eyebrow="CORRECTION REQUIRED" title="What should the applicant provide?" />
      <ReasonOption label="Clearer government ID image" onPress={() => viewModel.setVerificationNote('Upload a clearer government ID image with all edges and details visible.')} selected={viewModel.verificationNote.includes('clearer government')} />
      <ReasonOption label="Correct property ownership document" onPress={() => viewModel.setVerificationNote('Upload the correct ownership or authorization document for the selected property.')} selected={viewModel.verificationNote.includes('correct ownership')} />
      <ReasonOption label="Additional authorization evidence" onPress={() => viewModel.setVerificationNote('Provide additional signed authorization showing permission to lease the property.')} selected={viewModel.verificationNote.includes('additional signed')} />
      <Text style={styles.inputLabel}>MESSAGE TO APPLICANT</Text>
      <TextInput multiline onChangeText={viewModel.setVerificationNote} placeholder="Describe exactly what must be corrected" placeholderTextColor={colors.textMuted} style={styles.textArea} textAlignVertical="top" value={viewModel.verificationNote} />
      <AppButton disabled={viewModel.verificationNote.trim().length < 10} label="Send request preview" onPress={viewModel.requestVerificationInformation} />
      <Text style={styles.previewNote}>No email, push notification, or database update will be sent.</Text>
    </AdminScaffold>
  );
}

function CheckItem({ label }: { label: string }) {
  return <View style={styles.checkItem}><View style={styles.checkCircle}><View style={styles.checkShort} /><View style={styles.checkLong} /></View><Text style={styles.checkLabel}>{label}</Text></View>;
}

function ReasonOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.reasonOption, selected && styles.reasonSelected]}>
      <Text style={styles.reasonLabel}>{label}</Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioCenter} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
