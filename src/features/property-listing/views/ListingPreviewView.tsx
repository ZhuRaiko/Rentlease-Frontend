import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { FigmaReferenceCrop } from '../components/FigmaReferenceCrop';
import { ListingButton } from '../components/ListingButton';
import { ChoiceChip, SectionCard } from '../components/ListingControls';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

interface ListingPreviewViewProps {
  viewModel: PropertyListingViewModel;
  onClose: () => void;
}

export function ListingPreviewView({ viewModel, onClose }: ListingPreviewViewProps) {
  const { draft, screen } = viewModel;

  if (screen === 'missingRequirements') {
    return (
      <ListingWizardScaffold
        description="Complete these required fields before the listing can be published. Drafts may remain incomplete."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Missing information"
      >
        <View style={styles.requirements}>
          {viewModel.missingRequirements.map((requirement) => (
            <Pressable
              accessibilityRole="button"
              key={requirement.label}
              onPress={() => viewModel.navigate(requirement.target)}
              style={({ pressed }) => [styles.requirementRow, pressed && styles.pressed]}
            >
              <View style={styles.requirementDot} />
              <Text style={styles.requirementLabel}>{requirement.label}</Text>
              <Text style={styles.fixLabel}>Fix</Text>
            </Pressable>
          ))}
        </View>
        <ListingButton label="Save incomplete draft" onPress={viewModel.saveDraft} tone="outline" />
        <ListingButton label="Load complete Figma sample" onPress={viewModel.loadFigmaSample} />
        <Text style={styles.localOnly}>The sample button changes local frontend state only.</Text>
      </ListingWizardScaffold>
    );
  }

  if (screen === 'publishConfirmation') {
    return (
      <ListingWizardScaffold onBack={viewModel.goBack} onClose={onClose} title="Ready to publish?">
        <SectionCard>
          <Text style={styles.confirmTitle}>{draft.title}</Text>
          <Text style={styles.confirmCopy}>
            Your listing will appear as Published in this frontend preview. No Supabase record,
            Storage upload, notification, or moderation request will be created.
            Real publication is not connected. It must check qualifying Tier 3 approval for this specific property and all other publication requirements.
          </Text>
          <View style={styles.confirmFacts}>
            <Text style={styles.fact}>₱{draft.askingRent} / month</Text>
            <Text style={styles.fact}>{draft.photoCount} photos</Text>
            <Text style={styles.fact}>{draft.address}</Text>
          </View>
        </SectionCard>
        <ListingButton label="Publish listing preview" onPress={viewModel.confirmPublish} />
        <ListingButton label="Keep editing" onPress={viewModel.goBack} tone="outline" />
      </ListingWizardScaffold>
    );
  }

  return (
    <ListingWizardScaffold
      description="Review how the listing will appear to prospective tenants."
      onBack={viewModel.goBack}
      onClose={onClose}
      title="Listing preview"
    >
      <View style={styles.previewCard}>
        {viewModel.propertyState.propertyId ? (
          viewModel.photoState.photos.length ? <Image accessibilityLabel="Saved property photo" source={{ uri: (viewModel.photoState.photos.find(photo => photo.is_cover) ?? viewModel.photoState.photos[0])!.publicUrl }} style={{ width: '100%', aspectRatio: 225 / 132 }} /> : <View style={styles.photoMissing}><Text style={styles.photoMissingText}>No saved photos</Text></View>
        ) : draft.photoCount > 0 ? (
          <FigmaReferenceCrop crop={{ x: 2, y: 2, width: 225, height: 132 }} />
        ) : (
          <View style={styles.photoMissing}><Text style={styles.photoMissingText}>Photo required</Text></View>
        )}
        <View style={styles.previewCopy}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₱{draft.askingRent || '—'}<Text style={styles.perMonth}> /mo</Text></Text>
            <View style={styles.rating}><Text style={styles.ratingText}>4.6 See Reviews</Text></View>
          </View>
          <Text style={styles.location}>{draft.address || 'Location not provided'}</Text>
          <Text style={styles.title}>{draft.title || 'Untitled property'}</Text>
          <View style={styles.chips}>
            <ChoiceChip label={draft.propertyType ?? 'Property type required'} onPress={() => undefined} selected={draft.propertyType !== null} />
            <ChoiceChip label={draft.furnished ? 'Furnished' : 'Unfurnished'} onPress={() => undefined} selected={false} />
          </View>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <Text style={styles.description}>{draft.description || 'Description required before publishing.'}</Text>
          <View style={styles.specs}>
            <Text style={styles.spec}>{draft.bedrooms} Bedrooms</Text>
            <Text style={styles.spec}>{draft.bathrooms} Bathrooms</Text>
            <Text style={styles.spec}>{draft.landArea || '—'} sqm</Text>
          </View>
        </View>
      </View>
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <ListingButton label="Publish listing" onPress={viewModel.requestPublish} />
      <ListingButton label="Keep local progress" onPress={viewModel.saveDraft} tone="outline" />
    </ListingWizardScaffold>
  );
}

const styles = StyleSheet.create({
  requirements: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  requirementRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md },
  requirementDot: { backgroundColor: colors.warning, borderRadius: radius.pill, height: 9, width: 9 },
  requirementLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  fixLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  localOnly: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11, textAlign: 'center' },
  confirmTitle: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '800' },
  confirmCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19 },
  confirmFacts: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
  fact: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  previewCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  photoMissing: { alignItems: 'center', backgroundColor: colors.surface, height: 190, justifyContent: 'center' },
  photoMissingText: { color: colors.textMuted, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  previewCopy: { gap: spacing.sm, padding: spacing.md },
  priceRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  price: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '800' },
  perMonth: { fontSize: 11 },
  rating: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  ratingText: { color: colors.text, fontFamily: typography.family, fontSize: 9 },
  location: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 19, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionLabel: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '800', marginTop: spacing.sm },
  description: { color: colors.text, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
  specs: { flexDirection: 'row', gap: spacing.xs },
  spec: { backgroundColor: colors.surface, borderRadius: radius.sm, color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 10, fontWeight: '700', padding: spacing.xs, textAlign: 'center' },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17, padding: spacing.sm },
  pressed: { opacity: 0.72 },
});
