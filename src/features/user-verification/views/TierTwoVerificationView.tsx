import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DocumentPreviewPicker } from '../components/DocumentPreviewPicker';
import { SelectionRow } from '../components/SelectionRow';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { tierTwoDocumentOptions } from '../models/TierTwoVerification';
import type { TierTwoVerificationViewModel } from '../viewModels/useTierTwoVerificationViewModel';

const idIcon = require('../../../assets/verification/government-id.png');

interface TierTwoVerificationViewProps {
  viewModel: TierTwoVerificationViewModel;
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
        <AppButton label="Choose ID type" onPress={() => viewModel.navigate('tier2IdType')} />
      </VerificationScaffold>
    );
  }

  if (viewModel.screen === 'tier2IdType') {
    return (
      <VerificationScaffold compact onBack={viewModel.goBack} onClose={onClose} title="ID Verification">
        <View style={styles.rows}>
          {tierTwoDocumentOptions.map(({ label: idType }) => (
            <SelectionRow
              key={idType}
              label={idType}
              onPress={() => viewModel.chooseId(idType)}
            />
          ))}
        </View>
      </VerificationScaffold>
    );
  }

  if (viewModel.screen === 'tier2Review') {
    return (
      <VerificationScaffold
        description="Confirm the ID type and selected file. Submitting will start or resume your pending application and upload this document."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Review and Submit"
      >
        <View style={styles.reviewCard}>
          <DocumentPreviewPicker document={viewModel.selectedDocument} busy={viewModel.busy} />
          <Text style={styles.reviewLabel}>ID type</Text>
          <Text style={styles.reviewValue}>{viewModel.selectedIdLabel}</Text>
        </View>
        <Text style={styles.previewNotice}>{viewModel.isSubmitting ? 'Sending your verification document…' : 'This file stays on your device until you submit.'}</Text>
        <FeedbackNotice tone="error" message={viewModel.error} />
        {viewModel.requiresRefresh ? <AppButton disabled={viewModel.busy} label={viewModel.isLoading ? 'Refreshing…' : 'Check status'} onPress={() => void viewModel.refresh()} variant="secondary" /> : null}
        <AppButton disabled={!viewModel.canSubmit} label={viewModel.isSubmitting ? 'Submitting…' : 'Confirm and Submit'} onPress={() => void viewModel.submit()} />
      </VerificationScaffold>
    );
  }

  return (
    <VerificationScaffold
      description="Choose a clear document from your device. It stays local until you submit."
      onBack={viewModel.goBack}
      onClose={onClose}
      title={viewModel.selectedIdLabel ?? 'Government ID'}
    >
      <DocumentPreviewPicker
        document={viewModel.selectedDocument}
        busy={viewModel.isSelectingDocument}
        onSelect={() => void viewModel.pickDocument()}
      />
      <FeedbackNotice tone="error" message={viewModel.error} />
      <AppButton
        disabled={!viewModel.canSubmit}
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
