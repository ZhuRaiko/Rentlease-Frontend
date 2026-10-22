import { Modal, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';

export function NavigationConfirmation({ visible, onCancel, onConfirm }: { visible: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.dialog}>
      <Text accessibilityRole="header" style={styles.title}>Leave this preview?</Text>
      <Text style={styles.body}>You have unsaved changes. Stay to continue editing, or leave without saving.</Text>
      <AppButton label="Stay here" onPress={onCancel} />
      <AppButton label="Leave without saving" onPress={onConfirm} variant="danger" />
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.overlay },
  dialog: { width: '100%', maxWidth: 380, padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.background, gap: spacing.md },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '700' },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 15, lineHeight: 22 },
});
