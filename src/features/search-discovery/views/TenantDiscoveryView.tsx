import { InterfaceIcon } from '../../../shared/components/InterfaceIcon';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton, DiscoveryHeader, DiscoverySearchBar } from '../components/DiscoveryControls';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

const profileAvatar = require('../../../assets/authentication/profile-avatar.png');
const rentLeaseHome = require('../../../assets/authentication/rentlease-home.png');

interface TenantDiscoveryViewProps {
  viewModel: SearchDiscoveryViewModel;
  onClose: () => void;
  onOpenNotifications: () => void;
}

export function TenantDiscoveryView({ viewModel, onClose, onOpenNotifications }: TenantDiscoveryViewProps) {
  if (viewModel.screen !== 'home') return <View style={styles.screen}><DiscoveryHeader onBack={viewModel.goBack} title="Discovery"/><View style={styles.stateScreen}><Text style={styles.stateTitle}>This feature is not connected yet</Text><Text style={styles.stateBody}>Saved rentals and map results are deferred. Search real available rentals instead.</Text><DiscoveryButton label="Search rentals" onPress={() => viewModel.navigate('searchLocation')}/></View></View>;

  if (viewModel.screen === 'home') {
    return (
      <View style={styles.screen}>
        <View style={styles.feedHeader}>
          <View style={styles.wordmark}>
            <Text accessibilityRole="header" style={styles.wordmarkText}>RentLease</Text>
            <Image resizeMode="contain" source={rentLeaseHome} style={styles.wordmarkIcon} />
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="Open Notifications" accessibilityRole="button" onPress={onOpenNotifications} style={styles.headerAction}>
              <InterfaceIcon name="notifications" color={colors.text} />
            </Pressable>
            <Pressable accessibilityLabel="Open Profile" accessibilityRole="button" onPress={onClose} style={styles.headerAction}>
              <Image resizeMode="cover" source={profileAvatar} style={styles.headerAvatar} />
            </Pressable>
          </View>
        </View>
        <View style={styles.feedTabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} style={styles.feedTabTarget} onPress={() => viewModel.navigate('searchLocation')}>
            <Text style={styles.feedTabMuted}>Discover</Text>
          </Pressable>
          <View style={styles.tabDivider} />
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} style={styles.feedTabTarget} onPress={viewModel.openHome}>
            <Text style={styles.feedTabActive}>For You</Text>
          </Pressable>
        </View>
        {viewModel.notice ? <Text style={styles.feedNotice}>{viewModel.notice}</Text> : null}
        <ScrollView style={styles.feedScroll} contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={styles.stateTitle}>No community posts yet.</Text>
          <Text style={styles.stateBody}>Posts from landlords and the RentLease community will appear here.</Text>
          <DiscoveryButton label="Discover rentals" onPress={() => viewModel.navigate('searchLocation')} />
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  feedHeader: { ...ui.rule, backgroundColor: colors.background, alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', minHeight: 64, gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  wordmark: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs, flex: 1, minWidth: 0 },
  wordmarkText: { color: colors.ink, fontFamily: typography.family, fontSize: 23, fontWeight: '700', letterSpacing: -0.5, flexShrink: 1 },
  wordmarkIcon: { height: 26, width: 26 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  headerAction: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
  headerAvatar: { borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 33, width: 33 },
  feedTabs: { backgroundColor: colors.background, alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 50, justifyContent: 'center' },
  feedTabTarget: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  feedTabMuted: { ...ui.supporting, fontSize: 14 },
  feedTabActive: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700', borderBottomWidth: 2, borderBottomColor: colors.primaryAction, paddingVertical: spacing.xs },
  tabDivider: { backgroundColor: colors.text, height: 18, width: 1 },
  feedNotice: { ...ui.supporting, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  feedScroll: { flex: 1 },
  feedContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, maxWidth: 600, width: '100%', alignSelf: 'center' },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, padding: spacing.sm },
  searchPad: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  toolbar: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  viewToggle: { backgroundColor: colors.surface, borderRadius: radius.sm, flexDirection: 'row', padding: spacing.xxs },
  toggleButton: { alignItems: 'center', borderRadius: radius.firm, flexDirection: 'row', gap: spacing.xxs, minHeight: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  toggleButtonActive: { backgroundColor: colors.primaryAction },
  toggleLabel: { ...ui.supporting, fontWeight: '700' },
  toggleLabelActive: { color: colors.white },
  toolButton: { ...ui.control, alignItems: 'center', flexDirection: 'row', gap: spacing.xxs, paddingHorizontal: spacing.sm },
  toolLabel: { ...ui.supporting, color: colors.ink, fontWeight: '700' },
  resultCount: { ...ui.supporting },
  listContent: { gap: spacing.md, padding: spacing.lg },
  mapContent: { gap: spacing.md, padding: spacing.lg },
  stateScreen: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
  stateGraphic: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 96, justifyContent: 'center', width: 96 },
  stateGraphicError: { backgroundColor: colors.restrictedSurface },
  stateTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  stateBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, maxWidth: 330, textAlign: 'center' },
});
