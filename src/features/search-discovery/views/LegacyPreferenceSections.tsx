import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { MatchingPreferences } from '../models/SearchDiscovery';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

// Transitional: the previous controls, kept working inside the new section cards until each section is rebuilt. Removed section by section.
function amountFromText(value: string) {
  const amount = Number(value.replace(/\D/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

type PreferenceTone = 'green' | 'orange' | 'purple' | 'dark';

function PreferenceChoice({
  label,
  selected,
  tone,
  onPress,
  wide = false,
}: {
  label: string;
  selected: boolean;
  tone: PreferenceTone;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.preferenceChoice,
        styles[`${tone}Choice`],
        wide && styles.preferenceChoiceWide,
        !selected && styles.preferenceChoiceIdle,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.preferenceChoiceLabel, !selected && styles.preferenceChoiceLabelIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PreferenceSection({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.preferenceSection}>
      <Text style={styles.preferenceSectionTitle}>{title}</Text>
      {body ? <Text style={styles.preferenceSectionBody}>{body}</Text> : null}
      {children}
    </View>
  );
}

export function LegacyBudgetBody({preferences, viewModel}: {preferences: MatchingPreferences; viewModel: SearchDiscoveryViewModel}) {
  return (
    <>
      <PreferenceSection
        body="Use RENTLEASE price estimation later, or enter your own monthly budget range now."
        title="Rental Budget Range"
      >
        <View style={styles.budgetModeRow}>
          <PreferenceChoice
            label="Yes, estimate budget range"
            onPress={() => viewModel.updateMatchingPreference('budgetMode', 'estimate')}
            selected={preferences.budgetMode === 'estimate'}
            tone="dark"
          />
          <PreferenceChoice
            label="No thanks, I have my own."
            onPress={() => viewModel.updateMatchingPreference('budgetMode', 'own')}
            selected={preferences.budgetMode === 'own'}
            tone="dark"
          />
        </View>
        <View style={styles.budgetRow}>
          <View style={styles.amountField}>
            <Text style={styles.amountPrefix}>₱</Text>
            <TextInput
              accessibilityLabel="Minimum preferred monthly rent"
              inputMode="numeric"
              onChangeText={(text) => viewModel.updateMatchingPreference('minimumRent', amountFromText(text))}
              placeholder="Minimum"
              placeholderTextColor={colors.textMuted}
              style={styles.amountInput}
              value={preferences.minimumRent ? String(preferences.minimumRent) : ''}
            />
          </View>
          <Text style={styles.rangeTo}>to</Text>
          <View style={styles.amountField}>
            <Text style={styles.amountPrefix}>₱</Text>
            <TextInput
              accessibilityLabel="Maximum preferred monthly rent"
              inputMode="numeric"
              onChangeText={(text) => viewModel.updateMatchingPreference('maximumRent', amountFromText(text))}
              placeholder="Maximum"
              placeholderTextColor={colors.textMuted}
              style={styles.amountInput}
              value={preferences.maximumRent ? String(preferences.maximumRent) : ''}
            />
          </View>
        </View>
      </PreferenceSection>

    </>
  );
}

const styles = StyleSheet.create({
  preferenceSection: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  preferenceSectionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '700', lineHeight: 25 },
  preferenceSectionBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19 },
  preferenceChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  preferenceChoice: { alignItems: 'center', borderRadius: radius.pill, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  preferenceChoiceWide: { flexBasis: '100%' },
  greenChoice: { backgroundColor: colors.primaryAction },
  orangeChoice: { backgroundColor: colors.primaryAction },
  purpleChoice: { backgroundColor: colors.primaryAction },
  darkChoice: { backgroundColor: colors.primaryAction },
  preferenceChoiceIdle: { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderWidth: 1 },
  preferenceChoiceLabel: { color: colors.white, fontFamily: typography.family, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  preferenceChoiceLabelIdle: { color: colors.textSecondary },
  specificationCard: { borderColor: colors.border, borderRadius: 26, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rankingList: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  rankingRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 58, paddingHorizontal: spacing.sm },
  rankingNumber: { alignItems: 'center', backgroundColor: colors.text, borderRadius: radius.pill, height: 28, justifyContent: 'center', width: 28 },
  rankingNumberText: { color: colors.white, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  rankingLabel: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  rankButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 48, paddingHorizontal: spacing.xs },
  rankButtonDisabled: { opacity: 0.28 },
  rankButtonLabel: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  budgetModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  budgetRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  amountField: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: 'row', minHeight: 48, paddingHorizontal: spacing.sm },
  amountPrefix: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  amountInput: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 13, paddingVertical: spacing.sm },
  rangeTo: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11 },
  pressed: { opacity: 0.72 },
});
