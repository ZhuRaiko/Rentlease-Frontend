import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DocumentPreviewPicker } from '../components/DocumentPreviewPicker';
import { SelectionRow } from '../components/SelectionRow';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { ownershipDocumentTypes, previewProperties } from '../models/Verification';
import type { UserVerificationViewModel } from '../viewModels/useUserVerificationViewModel';

const propertyIcon = require('../../../assets/verification/property.png');

interface TierThreeVerificationViewProps {
  viewModel: UserVerificationViewModel;
  onClose: () => void;
}

export function TierThreeVerificationView({
  viewModel,
  onClose,
}: TierThreeVerificationViewProps) {
  if (viewModel.screen === 'tier3Intro') {
    return (
      <VerificationScaffold
        description="Complete Tier 3 to qualify as a Landlord by providing proof of ownership or authorization to lease."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Tier 3 — Premium"
      >
        <View style={styles.infoCard}>
          <Image resizeMode="contain" source={propertyIcon} style={styles.infoIcon} />
          <Text style={styles.infoTitle}>Verify one property</Text>
          <Text style={styles.infoBody}>Choose a listing and provide one supported ownership or authorization document.</Text>
        </View>
        <View style={styles.benefitCard}>
          <Text style={styles.benefitTitle}>Premium benefits</Text>
          <Text style={styles.benefitBody}>Listing visibility priority and a Premium badge after admin approval.</Text>
        </View>
        <AppButton label="Choose property" onPress={() => viewModel.navigate('tier3Property')} />
      </VerificationScaffold>
    );
  }

  if (viewModel.screen === 'tier3Property') {
    return (
      <VerificationScaffold
        compact
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Select a property"
      >
        <View style={styles.rows}>
          {previewProperties.map((property) => (
            <SelectionRow
              detail={property.address}
              key={property.id}
              label={property.title}
              onPress={() => viewModel.selectProperty(property.id)}
              selected={viewModel.draft.propertyId === property.id}
            />
          ))}
        </View>
      </VerificationScaffold>
    );
  }

  if (viewModel.screen === 'tier3Review') {
    const property = previewProperties.find((item) => item.id === viewModel.draft.propertyId);
    return (
      <VerificationScaffold
        description="Review your local selection. Property verification submission is not connected yet."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Review landlord verification"
      >
        <View style={styles.reviewCard}>
          <DocumentPreviewPicker document={viewModel.draft.tier3Document} />
          <Text style={styles.reviewLabel}>Property</Text>
          <Text style={styles.reviewValue}>{property?.title}</Text>
          <Text style={styles.reviewLabel}>Document</Text>
          <Text style={styles.reviewValue}>{viewModel.draft.ownershipDocumentType}</Text>
        </View>
        <Text style={styles.previewNotice}>This file is only selected on your device. Nothing has been uploaded or submitted.</Text>
        <AppButton disabled label="Submission not connected" onPress={() => {}} />
      </VerificationScaffold>
    );
  }

  return (
    <VerificationScaffold
      compact
      description="Choose a document type, then select a file from your device. Nothing will be uploaded."
      onBack={viewModel.goBack}
      onClose={onClose}
      title="Landlord Verification"
    >
      <View style={styles.rows}>
        {ownershipDocumentTypes.map((documentType) => (
          <SelectionRow
            key={documentType}
            label={documentType}
            onPress={() => viewModel.selectOwnershipDocument(documentType)}
            selected={viewModel.draft.ownershipDocumentType === documentType}
          />
        ))}
      </View>
      <View style={styles.paddedContent}>
        {viewModel.draft.ownershipDocumentType ? (
          <DocumentPreviewPicker
            document={viewModel.draft.tier3Document}
            busy={viewModel.isSelectingDocument}
            onSelect={() => void viewModel.selectTierThreeDocument()}
          />
        ) : null}
        {viewModel.notice ? <Text style={styles.previewNotice}>{viewModel.notice}</Text> : null}
        <AppButton
          disabled={viewModel.isSelectingDocument || !viewModel.draft.ownershipDocumentType || !viewModel.draft.tier3Document}
          label="Review document"
          onPress={() => viewModel.navigate('tier3Review')}
        />
      </View>
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  infoCard: { alignItems: 'center', backgroundColor: colors.premiumSurface, borderColor: colors.premiumBorder, borderRadius: radius.card, borderWidth: 1, gap: spacing.xs, padding: spacing.lg },
  infoIcon: { height: 66, width: 66 },
  infoTitle: { color: colors.premiumText, fontFamily: typography.family, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  infoBody: { color: colors.premiumText, fontFamily: typography.family, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  benefitCard: { backgroundColor: colors.restrictedSurface, borderRadius: radius.card, gap: spacing.xs, padding: spacing.md },
  benefitTitle: { color: colors.premiumText, fontFamily: typography.family, fontSize: 16, fontWeight: '800' },
  benefitBody: { color: colors.premiumText, fontFamily: typography.family, fontSize: 14, lineHeight: 20 },
  rows: { borderTopColor: colors.border, borderTopWidth: 1 },
  paddedContent: { gap: spacing.md, paddingHorizontal: 25 },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.xs, overflow: 'hidden', paddingBottom: spacing.md },
  reviewImage: { height: 260, width: '100%' },
  reviewLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 12, paddingHorizontal: spacing.md },
  reviewValue: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '700', paddingHorizontal: spacing.md },
  previewNotice: { backgroundColor: colors.warningSurface, borderRadius: radius.sm, color: colors.warning, fontFamily: typography.family, fontSize: 13, lineHeight: 18, padding: spacing.sm },
});
