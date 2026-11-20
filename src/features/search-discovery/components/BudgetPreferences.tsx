import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {ui} from '../../../shared/theme/ui';
import {formatPeso} from '../models/MatchingPreferenceForm';
import type {BudgetMode} from '../models/SearchDiscovery';
import {AlertMark} from './PreferenceIcons';

const amountFromText = (text: string): number => { const amount = Number(text.replace(/\D/g, '')); return Number.isFinite(amount) ? amount : 0; };
const shown = (amount: number): string => amount ? formatPeso(amount).slice(1) : '';

function Radio({on}: {on: boolean}) {
  return <View accessible={false} style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>;
}

function Amount({label, name, value, invalid, onChange}: {label: string; name: string; value: number; invalid: boolean; onChange: (amount: number) => void}) {
  return <View style={styles.amountBlock}>
    <Text style={ui.supporting}>{label}</Text>
    <View style={[styles.amount, invalid && styles.amountInvalid]}>
      <Text accessible={false} style={styles.peso}>₱</Text>
      <TextInput accessibilityLabel={name} inputMode="numeric" onChangeText={text => onChange(amountFromText(text))} placeholder={label === 'From' ? 'Minimum' : 'Maximum'} placeholderTextColor={colors.textMuted} style={styles.amountInput} value={shown(value)} />
    </View>
  </View>;
}

/**
 * The Budget card: two radio cards. "Estimate it for me" stores budgetMode "estimate"; "I will enter my own" stores "own" and shows the peso fields.
 * The two amounts are the same minimumRent and maximumRent as before, and choosing a mode never changes them.
 */
export function BudgetPreferences({mode, minimum, maximum, error, stacked = false, onMode, onMinimum, onMaximum}: {stacked?: boolean; mode: BudgetMode; minimum: number; maximum: number; error: string | null; onMode: (mode: BudgetMode) => void; onMinimum: (amount: number) => void; onMaximum: (amount: number) => void}) {
  return <View style={styles.stack}>
    <Pressable accessibilityRole="radio" accessibilityState={{selected: mode === 'estimate'}} onPress={() => onMode('estimate')} style={[styles.option, mode === 'estimate' && styles.optionOn]}>
      <Radio on={mode === 'estimate'} />
      <View style={styles.copy}><Text style={styles.optionTitle}>Estimate it for me</Text><Text style={ui.supporting}>Use RentLease price estimation.</Text></View>
    </Pressable>
    <View style={[styles.option, styles.ownOption, mode === 'own' && styles.optionOn]}>
      <Pressable accessibilityRole="radio" accessibilityState={{selected: mode === 'own'}} onPress={() => onMode('own')} style={styles.ownHead}>
        <Radio on={mode === 'own'} />
        <View style={styles.copy}><Text style={styles.optionTitle}>I will enter my own</Text><Text style={ui.supporting}>Monthly range in pesos.</Text></View>
      </Pressable>
      {mode === 'own' ? <>
        <View style={styles.amounts}>
          <Amount invalid={!!error} label="From" name="Minimum preferred monthly rent" onChange={onMinimum} value={minimum} />
          {stacked ? null : <Text accessible={false} style={styles.dash}>–</Text>}
          <Amount invalid={!!error} label="To" name="Maximum preferred monthly rent" onChange={onMaximum} value={maximum} />
        </View>
        {error ? <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}><AlertMark /><Text style={styles.errorText}>{error}</Text></View> : null}
      </> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  stack: {gap: spacing.sm},
  option: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 64, padding: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background},
  optionOn: {borderWidth: 2, borderColor: colors.primaryAction, backgroundColor: colors.primaryPale},
  ownOption: {flexDirection: 'column', gap: spacing.md},
  ownHead: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 48},
  copy: {flex: 1, minWidth: 0, gap: spacing.xxs},
  optionTitle: {color: colors.ink, fontFamily: typography.family, fontSize: 16, lineHeight: 22, fontWeight: '700'},
  radio: {width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.controlBorder, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxs},
  radioOn: {borderColor: colors.primaryAction},
  radioDot: {width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primaryAction},
  amounts: {flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: spacing.xs, rowGap: spacing.sm},
  amountBlock: {flex: 1, flexBasis: 120, minWidth: 0, gap: spacing.xxs},
  dash: {color: colors.textMuted, fontSize: 18, paddingBottom: spacing.sm},
  amount: {flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: spacing.sm, borderRadius: radius.card, borderWidth: 2, borderColor: colors.controlBorder, backgroundColor: colors.background},
  amountInvalid: {borderColor: colors.restricted, backgroundColor: colors.restrictedSurface},
  peso: {color: colors.textSecondary, fontFamily: typography.family, fontSize: 17, marginRight: spacing.xxs},
  amountInput: {flex: 1, minWidth: 0, color: colors.ink, fontFamily: typography.family, fontSize: 17, fontWeight: '700', paddingVertical: spacing.xs},
  error: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs},
  errorText: {flex: 1, minWidth: 0, color: colors.restricted, fontFamily: typography.family, fontSize: 14, lineHeight: 21},
});
