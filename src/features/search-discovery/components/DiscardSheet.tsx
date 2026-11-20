import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {AppButton} from '../../../shared/components/AppButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {ui} from '../../../shared/theme/ui';
import {PencilMark} from './PreferenceIcons';

export const DISCARD_TITLE = 'Discard your changes?';
export const DISCARD_BODY = 'You changed some preferences and haven’t saved them yet.';

/**
 * The "Discard your changes?" bottom sheet. It is shown only when the view model's navigation guard says there is something unsaved, so with no
 * changes Close never reaches it. Keep editing (also Back and a tap outside) stays; Discard changes carries on with the close.
 */
export function DiscardSheet({visible, onKeep, onDiscard}: {visible: boolean; onKeep: () => void; onDiscard: () => void}) {
  const insets = useSafeAreaInsets();
  return <Modal animationType="slide" onRequestClose={onKeep} statusBarTranslucent transparent visible={visible}>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Keep editing" accessibilityRole="button" onPress={onKeep} style={styles.scrim} />
      <View accessibilityViewIsModal style={[styles.sheet, {paddingBottom: spacing.lg + Math.max(insets.bottom, spacing.xs)}]}>
        <View accessible={false} style={styles.grip} />
        <View accessible={false} style={styles.icon}><PencilMark /></View>
        <Text accessibilityRole="header" style={styles.title}>{DISCARD_TITLE}</Text>
        <Text style={ui.body}>{DISCARD_BODY}</Text>
        <View style={styles.actions}>
          <AppButton label="Keep editing" onPress={onKeep} />
          <Pressable accessibilityRole="button" onPress={onDiscard} style={styles.discard}><Text style={styles.discardLabel}>Discard changes</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay},
  scrim: {flex: 1},
  sheet: {backgroundColor: colors.background, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm, alignSelf: 'center', width: '100%', maxWidth: 520},
  grip: {alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outline},
  icon: {width: 48, height: 48, borderRadius: 24, backgroundColor: colors.warningSurface, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs},
  title: {...ui.pageTitle},
  actions: {gap: spacing.sm, paddingTop: spacing.xs},
  discard: {minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, borderWidth: 1.5, borderColor: colors.restricted, backgroundColor: colors.background, paddingHorizontal: spacing.md},
  discardLabel: {color: colors.restricted, fontFamily: typography.family, fontSize: 16, fontWeight: '700'},
});
