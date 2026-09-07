import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DocumentPreviewPicker } from '../components/DocumentPreviewPicker';
import { SelectionRow } from '../components/SelectionRow';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { governmentIdTypes } from '../models/Verification';
import type { UserVerificationViewModel } from '../viewModels/useUserVerificationViewModel';

const idIcon = require('../../../assets/verification/government-id.png');
const idGuide = require('../../../assets/verification/id-example.png');
const idPreview = require('../../../assets/verification/camera-preview.png');

interface TierTwoVerificationViewProps {
  viewModel: UserVerificationViewModel;
  onClose: () => void;
}

export function TierTwoVerificationView({
  viewModel,
  onClose,
}: TierTwoVerificationViewProps) {
  if (viewModel.screen === 'tier2Intro') {
    return (
      <VerificationScaffold
        description="Tier 2 is optional for all users and adds a Trusted badge after admin review."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Tier 2 — Trusted"
      >
        <View style={styles.infoCard}>
          <Image resizeMode="contain" source={idIcon} style={styles.infoIcon} />
          <Text style={styles.infoTitle}>Use one government-issued ID</Text>
          <Text style={styles.infoBody}>Make sure the document is current, readable, and photographed in good light.</Text>
        </View>
        <Image resizeMode="contain" source={idGuide} style={styles.guideImage} />
        <AppButton label="Choose ID type" onPress={() => viewModel.navigate('tier2IdType')} />
      </VerificationScaffold>
    );
  }

  if (viewModel.screen === 'tier2IdType') {
    return (
      <VerificationScaffold compact onBack={viewModel.goBack} onClose={onClose} title="ID Verification">
        <View style={styles.rows}>
          {governmentIdTypes.map((idType) => (
            <SelectionRow
              key={idType}
              label={idType}
              onPress={() => viewModel.selectGovernmentId(idType)}
            />
          ))}
        </View>
      </VerificationScaffold>
    );
  }

  if (viewModel.screen === 'tier2Review') {
    return (
      <VerificationScaffold
        description="Check the document details before creating a local pending-state preview."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Review your ID"
      >
        <View style={styles.reviewCard}>
          <Image resizeMode="cover" source={idPreview} style={styles.reviewImage} />
          <Text style={styles.reviewLabel}>ID type</Text>
          <Text style={styles.reviewValue}>{viewModel.draft.governmentIdType}</Text>
          <Text style={styles.reviewLabel}>Local sample file</Text>
          <Text style={styles.reviewValue}>{viewModel.draft.tier2FileName}</Text>
        </View>
        <Text style={styles.previewNotice}>Submitting creates only a local UI state. Nothing is uploaded or sent to Supabase.</Text>
        <AppButton label="Submit preview" onPress={viewModel.submitTierTwoPreview} />
      </VerificationScaffold>
    );
  }

  const isResubmission = viewModel.screen === 'tier2Resubmission';
  return (
    <VerificationScaffold
      description={
        isResubmission
          ? 'Correction required: provide a clear, uncropped image with all four corners visible.'
          : 'Make sure that your photo is shot in a well-lit environment.'
      }
      onBack={viewModel.goBack}
      onClose={onClose}
      title={isResubmission ? 'Resubmit your ID' : viewModel.draft.governmentIdType ?? 'Government ID'}
    >
      {isResubmission ? <Text style={styles.rejectionBanner}>Previous sample was marked blurry or cropped.</Text> : null}
      <DocumentPreviewPicker
        fileName={viewModel.draft.tier2FileName}
        image={idPreview}
        label={viewModel.draft.tier2FileName ? 'Replace local sample' : 'Select local sample'}
        onSelect={viewModel.selectTierTwoDocumentPreview}
      />
      {viewModel.notice ? <Text style={styles.previewNotice}>{viewModel.notice}</Text> : null}
      <AppButton
        disabled={!viewModel.draft.tier2FileName}
        label="Review document"
        onPress={() => viewModel.navigate('tier2Review')}
      />
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    alignItems: 'center',
    backgroundColor: colors.trustedSurface,
    borderColor: colors.trustedBorder,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  infoIcon: { height: 60, width: 60 },
  infoTitle: { color: colors.trustedText, fontFamily: typography.family, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  infoBody: { color: colors.trustedText, fontFamily: typography.family, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  guideImage: { alignSelf: 'center', height: 260, width: 210 },
  rows: { borderTopColor: colors.border, borderTopWidth: 1 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.xs, overflow: 'hidden', paddingBottom: spacing.md },
  reviewImage: { height: 260, width: '100%' },
  reviewLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 12, paddingHorizontal: spacing.md },
  reviewValue: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '700', paddingHorizontal: spacing.md },
  previewNotice: { backgroundColor: colors.warningSurface, borderRadius: radius.sm, color: colors.warning, fontFamily: typography.family, fontSize: 13, lineHeight: 18, padding: spacing.sm },
  rejectionBanner: { backgroundColor: colors.restrictedSurface, borderRadius: radius.sm, color: colors.restricted, fontFamily: typography.family, fontSize: 14, fontWeight: '700', padding: spacing.sm },
});
