import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { CHIP_COLORS } from '../theme/statusColors';
import { ui } from '../theme/ui';
import type { Chip } from '../models/StatusChip';

/** Status as a chip. Colors come from CHIP_COLORS (existing theme tokens only). */
export function StatusChip({ chip, onPhoto = false }: { chip: Chip; onPhoto?: boolean }) {
  const c = CHIP_COLORS[chip.tone];
  return <View accessible accessibilityLabel={`Status: ${chip.label}`} style={[styles.chip, { backgroundColor: c.backgroundColor, borderColor: c.borderColor }, onPhoto && styles.onPhoto]}><Text style={[styles.chipText, { color: c.color }]}>{chip.label}</Text></View>;
}
export type ButtonTone = 'primary' | 'secondary' | 'warning' | 'dangerOutline';
/** One 48dp button family: green, outline, amber (waiting on you) and red outline (ending). */
export function StatusButton({ label, onPress, tone = 'secondary', disabled = false, accessibilityLabel }: { label: string; onPress: () => void; tone?: ButtonTone; disabled?: boolean; accessibilityLabel?: string }) {
  const filled = tone === 'primary' || tone === 'warning';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, tone === 'primary' && styles.primary, tone === 'warning' && styles.warning, tone === 'secondary' && styles.secondary, tone === 'dangerOutline' && styles.dangerOutline, disabled && styles.disabled, pressed && { opacity: .85 }]}>
    <Text style={[styles.buttonText, filled ? { color: colors.white } : tone === 'dangerOutline' ? { color: colors.restricted } : { color: colors.ink }]}>{label}</Text></Pressable>;
}
export function ButtonRow({ children }: { children: ReactNode }) { return <View style={styles.row}>{children}</View>; }
/** Each button takes at least half a row, and wraps below at large text or narrow screens. */
export function Slot({ children }: { children: ReactNode }) { return <View style={styles.slot}>{children}</View>; }
export function Cell({ label, value }: { label: string; value: string }) { return <View style={styles.cell}><Text style={ui.supporting}>{label}</Text><Text style={styles.cellValue}>{value}</Text></View>; }
export function CellRow({ children }: { children: ReactNode }) { return <View style={styles.cells}>{children}</View>; }
const styles=StyleSheet.create({
  chip:{alignSelf:'flex-start',borderRadius:radius.pill,borderWidth:1,paddingHorizontal:spacing.sm,paddingVertical:2},onPhoto:{borderWidth:0},chipText:{...ui.supporting,fontWeight:'700',fontSize:12,lineHeight:18},
  button:{minHeight:48,borderRadius:radius.control,paddingHorizontal:spacing.md,paddingVertical:spacing.xs,alignItems:'center',justifyContent:'center'},buttonText:{...ui.body,fontWeight:'700',textAlign:'center'},
  primary:{backgroundColor:colors.primaryAction},warning:{backgroundColor:colors.warning},secondary:{backgroundColor:colors.background,borderWidth:1.5,borderColor:colors.controlBorder},dangerOutline:{backgroundColor:colors.background,borderWidth:1.5,borderColor:colors.restricted},disabled:{opacity:.5},
  row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},slot:{flexGrow:1,flexBasis:130},
  cells:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},cell:{flexGrow:1,flexBasis:130,padding:spacing.sm,gap:2,borderRadius:radius.control,backgroundColor:colors.surface},cellValue:{...ui.body,fontWeight:'700'},
});
