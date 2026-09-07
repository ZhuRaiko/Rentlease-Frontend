import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { NotificationScaffold } from '../components/NotificationScaffold';
import type { NotificationsViewModel } from '../viewModels/useNotificationsViewModel';

function BellMark() {
  return (
    <View style={styles.bellSurface}>
      <View style={styles.bellBody} />
      <View style={styles.bellClapper} />
      <View style={styles.signalOne} />
      <View style={styles.signalTwo} />
    </View>
  );
}

function AndroidExample() {
  return (
    <View style={styles.phone}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:42</Text>
        <Text style={styles.statusIcons}>LTE  •  82%</Text>
      </View>
      <Text style={styles.androidDate}>MONDAY, SEPTEMBER 7</Text>
      <View style={styles.pushCard}>
        <View style={styles.appMark}><Text style={styles.appMarkText}>R</Text></View>
        <View style={styles.pushCopy}>
          <View style={styles.pushTitleRow}>
            <Text style={styles.pushApp}>RENTLEASE</Text>
            <Text style={styles.pushTime}>now</Text>
          </View>
          <Text style={styles.pushTitle}>Repair visit scheduled</Text>
          <Text style={styles.pushBody}>Your kitchen sink repair is scheduled for tomorrow at 10:30 AM.</Text>
        </View>
      </View>
      <View style={styles.wallpaperHouse}>
        <View style={styles.houseRoof} />
        <View style={styles.houseBody}>
          <View style={styles.houseDoor} />
          <View style={styles.houseWindow} />
        </View>
      </View>
    </View>
  );
}

interface NotificationPermissionViewProps {
  viewModel: NotificationsViewModel;
}

export function NotificationPermissionView({ viewModel }: NotificationPermissionViewProps) {
  if (viewModel.screen === 'androidExample') {
    return (
      <NotificationScaffold
        onBack={viewModel.goBack}
        title="Android notification"
        subtitle="Presentation reference"
      >
        <AndroidExample />
        <Text style={styles.referenceTitle}>What a push notification may look like</Text>
        <Text style={styles.referenceBody}>
          Android controls the final presentation, grouping and placement. This card is a visual
          reference only and does not send a device notification.
        </Text>
        <AppButton label="Back to notifications" onPress={viewModel.openCenter} variant="secondary" />
      </NotificationScaffold>
    );
  }

  if (viewModel.screen === 'permissionDenied') {
    return (
      <NotificationScaffold onBack={viewModel.goBack} title="Notifications are off">
        <View style={styles.permissionContent}>
          <BellMark />
          <Text accessibilityRole="header" style={styles.permissionTitle}>Push notifications are disabled</Text>
          <Text style={styles.permissionBody}>
            You can still read every update in Notification Center. To receive Android alerts,
            enable RENTLEASE notifications in your device settings.
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Android settings path</Text>
            <Text style={styles.infoBody}>Settings → Apps → RENTLEASE → Notifications</Text>
          </View>
          <AppButton
            label="Open settings (preview)"
            onPress={() => viewModel.setNotice('Device settings are not opened in this frontend preview.')}
          />
          <AppButton label="Try again" onPress={() => viewModel.navigate('permissionPrompt')} variant="secondary" />
          {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
        </View>
      </NotificationScaffold>
    );
  }

  return (
    <NotificationScaffold onBack={viewModel.goBack} title="Stay updated">
      <View style={styles.permissionContent}>
        <BellMark />
        <Text accessibilityRole="header" style={styles.permissionTitle}>Allow push notifications?</Text>
        <Text style={styles.permissionBody}>
          Get timely alerts about messages, viewing schedules, maintenance, verification, listings
          and account safety. You can change this later in Android settings.
        </Text>
        <View style={styles.benefits}>
          {['Viewing schedule changes', 'New messages and inquiries', 'Maintenance and verification updates'].map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
        <AppButton label="Enable notifications" onPress={viewModel.grantPermissionPreview} />
        <AppButton label="Preview denied state" onPress={viewModel.denyPermissionPreview} variant="secondary" />
        <Pressable accessibilityRole="button" onPress={viewModel.openCenter}>
          <Text style={styles.notNow}>Not now</Text>
        </Pressable>
        <Text style={styles.previewNote}>Frontend preview — no Android permission request is sent.</Text>
      </View>
    </NotificationScaffold>
  );
}

const styles = StyleSheet.create({
  permissionContent: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  bellSurface: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: 62, height: 124, justifyContent: 'center', marginBottom: spacing.xs, position: 'relative', width: 124 },
  bellBody: { borderColor: colors.primary, borderRadius: 25, borderWidth: 5, height: 47, width: 51 },
  bellClapper: { backgroundColor: colors.primary, borderRadius: 6, bottom: 31, height: 10, position: 'absolute', width: 17 },
  signalOne: { borderColor: colors.primary, borderRadius: 9, borderWidth: 2, height: 16, opacity: 0.5, position: 'absolute', right: 19, top: 26, transform: [{ rotate: '28deg' }], width: 8 },
  signalTwo: { borderColor: colors.primary, borderRadius: 9, borderWidth: 2, height: 16, left: 19, opacity: 0.5, position: 'absolute', top: 26, transform: [{ rotate: '-28deg' }], width: 8 },
  permissionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', maxWidth: 330, textAlign: 'center' },
  permissionBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 330, textAlign: 'center' },
  benefits: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.sm, marginVertical: spacing.xs, padding: spacing.md },
  benefitRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  check: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: 11, height: 22, justifyContent: 'center', width: 22 },
  checkText: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  benefitText: { color: '#474747', flex: 1, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  infoCard: { alignSelf: 'stretch', backgroundColor: colors.warningSurface, borderRadius: radius.card, padding: spacing.md },
  infoTitle: { color: colors.warning, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  infoBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, marginTop: 5 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, padding: spacing.sm, textAlign: 'center' },
  notNow: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, fontWeight: '800', padding: spacing.xs },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, textAlign: 'center' },
  phone: { backgroundColor: '#DDEEE7', borderColor: '#1F1F1F', borderRadius: 26, borderWidth: 7, height: 390, overflow: 'hidden', padding: spacing.md, position: 'relative' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between' },
  statusTime: { color: '#1B1B1B', fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  statusIcons: { color: '#1B1B1B', fontFamily: typography.family, fontSize: 9, fontWeight: '800' },
  androidDate: { color: '#53665D', fontFamily: typography.family, fontSize: 9, fontWeight: '900', marginTop: spacing.md, textAlign: 'center' },
  pushCard: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radius.md, elevation: 5, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  appMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, height: 28, justifyContent: 'center', width: 28 },
  appMarkText: { color: colors.white, fontFamily: typography.family, fontSize: 14, fontWeight: '900' },
  pushCopy: { flex: 1 },
  pushTitleRow: { flexDirection: 'row' },
  pushApp: { color: colors.textSecondary, flex: 1, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  pushTime: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8 },
  pushTitle: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '900', marginTop: 5 },
  pushBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 14, marginTop: 3 },
  wallpaperHouse: { alignItems: 'center', bottom: 0, left: 0, opacity: 0.33, position: 'absolute', right: 0 },
  houseRoof: { borderBottomColor: colors.primary, borderBottomWidth: 82, borderLeftColor: 'transparent', borderLeftWidth: 105, borderRightColor: 'transparent', borderRightWidth: 105, height: 0, width: 0 },
  houseBody: { backgroundColor: colors.primary, height: 90, position: 'relative', width: 178 },
  houseDoor: { backgroundColor: '#DDEEE7', bottom: 0, height: 54, left: 35, position: 'absolute', width: 31 },
  houseWindow: { backgroundColor: '#DDEEE7', height: 36, position: 'absolute', right: 31, top: 17, width: 43 },
  referenceTitle: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900', marginTop: spacing.lg, textAlign: 'center' },
  referenceBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18, marginBottom: spacing.md, marginTop: spacing.xs, textAlign: 'center' },
});
