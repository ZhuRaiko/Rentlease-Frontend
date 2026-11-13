import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import {
  actionConfirmLabel, actionEffectText, ADMIN_REASON_MAX, ADMIN_REASON_MIN, endDatePresets, endsAtFor, validateActionReason,
  type EndPresetId,
} from '../models/AdminActions';
import type { ActionDraft } from '../viewModels/adminActionsWorkflow';
import { AdminBottomSheet, AdminPills } from './AdminCards';

interface AdminActionSheetProps {
  draft: ActionDraft | null;
  busy: boolean;
  error: string | null;
  onChange: (patch: { reason?: string; endsPreset?: EndPresetId }) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for suspend, restore and remove: target, reason, optional end date (suspend), plain-language effect, then confirm. */
export function AdminActionSheet({ draft, busy, error, onChange, onConfirm, onCancel }: AdminActionSheetProps) {
  const action = draft?.action ?? 'restore_account';
  const reasonLength = Array.from((draft?.reason ?? '').trim()).length;
  const invalid = draft ? validateActionReason(draft.reason) : null;
  const destructive = action === 'suspend_account' || action === 'remove_listing';
  const previewEnds = draft && action === 'suspend_account' ? endsAtFor(draft.endsPreset) : null;
  // Backdrop tap, Back and Cancel all go through here: a typed reason is never discarded silently.
  const requestClose = () => {
    if (busy) return;
    if (draft && draft.reason.trim().length > 0) {
      Alert.alert('Discard this reason?', 'The reason you typed will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onCancel }]);
      return;
    }
    onCancel();
  };
  return (
    <AdminBottomSheet closeDisabled={busy} onClose={requestClose} title={`${actionConfirmLabel(action)}?`} visible={!!draft}>
      {draft ? <>
        <Text style={ui.supporting}>{`Target: ${draft.targetLabel}`}</Text>
        <Text style={styles.fieldLabel}>{`Reason (${ADMIN_REASON_MIN} to ${ADMIN_REASON_MAX} characters, saved in the audit log)`}</Text>
        <TextInput accessibilityLabel="Reason for this action" editable={!busy} maxLength={ADMIN_REASON_MAX} multiline onChangeText={(reason) => onChange({ reason })} style={styles.textArea} textAlignVertical="top" value={draft.reason} />
        <Text style={ui.supporting}>{`${reasonLength} of ${ADMIN_REASON_MAX} characters`}</Text>
        {action === 'suspend_account' ? <>
          <Text style={styles.fieldLabel}>End date (optional)</Text>
          <AdminPills disabled={busy} onSelect={(endsPreset) => onChange({ endsPreset })} options={endDatePresets} selected={draft.endsPreset} />
        </> : null}
        <FeedbackNotice tone={destructive ? 'warning' : 'info'} message={actionEffectText(action, previewEnds)} />
        <FeedbackNotice tone="error" message={error} />
        <AppButton disabled={busy || !!invalid} label={busy ? 'Saving...' : actionConfirmLabel(action)} onPress={onConfirm} variant={destructive ? 'danger' : 'primary'} />
        <AppButton disabled={busy} label="Cancel" onPress={requestClose} variant="secondary" />
      </> : null}
    </AdminBottomSheet>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...ui.supporting, fontWeight: '700', marginTop: spacing.xs },
  textArea: { borderColor: colors.controlBorder, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontFamily: typography.family, fontSize: 16, lineHeight: 22, minHeight: 96, padding: spacing.sm },
});
