import {useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {RefreshHint} from '../../../shared/components/RefreshHint';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {publicIdentityLabel} from '../../../shared/models/PublicIdentity';
import {tenancyRoleTag} from '../../../shared/models/TenancyLink';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {ConversationCard, ConversationSkeleton} from '../components/ConversationCard';
import {conversationFilters, filterConversations, messageDay, showInboxSkeleton, type ConversationFilter} from '../models/ConversationFilter';
import type {MessagingViewingViewModel} from '../viewModels/useMessagingViewingViewModel';

function Pill({label, selected, onPress}: {label: string; selected?: boolean; onPress: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityState={selected === undefined ? undefined : {selected}} onPress={onPress} style={[styles.pill, selected && styles.pillSelected]}>
    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
  </Pressable>;
}

export function MessagingInboxView({viewModel: vm, onClose, onViewings, onReservations, onMyRequests}: {viewModel: MessagingViewingViewModel; onClose: () => void; onViewings?: () => void; onReservations?: () => void; onMyRequests?: () => void}) {
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const {fontScale, width} = useWindowDimensions();
  // Large text or a narrow screen: the title keeps the whole row and "My requests" joins the filter pills.
  const tight = fontScale > 1.2 || width < 360;
  const rows = filterConversations(vm.inbox, filter, vm.owner);
  const skeleton = showInboxSkeleton(vm.inboxBusy, vm.inbox.length, !!vm.inboxError);
  const topAction = onMyRequests ? {label: 'My requests', press: onMyRequests} : onViewings ? {label: 'Viewings', press: onViewings} : null;
  return <View style={styles.screen}>
    <ScreenHeader title="Messages" onBack={onClose} titleContent={<Text accessibilityRole="header" style={ui.pageTitle}>Messages</Text>} action={topAction && !tight ? <Pill label={topAction.label} onPress={topAction.press} /> : undefined} />
    <View style={styles.pills}>{topAction && tight ? <Pill label={topAction.label} onPress={topAction.press} /> : null}{conversationFilters.map(f => <Pill key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />)}</View>
    <FlatList data={skeleton ? [] : rows} keyExtractor={c => c.id} refreshing={false} onRefresh={vm.refresh} contentContainerStyle={styles.content} ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListHeaderComponent={<View style={styles.section}>
        {!onMyRequests && onReservations ? <Pressable accessibilityRole="button" style={styles.action} onPress={onReservations}><Text style={styles.link}>Rental reservations</Text></Pressable> : null}
        {vm.connection === 'unavailable' ? <Text accessibilityLiveRegion="polite" style={ui.supporting}>Automatic updates unavailable. Pull to refresh.</Text> : null}
        {vm.propertyContextError ? <Pressable accessibilityRole="button" accessibilityLabel="Retry property information" onPress={vm.refreshPropertyContext} style={styles.action}><Text style={ui.supporting}>{vm.propertyContextError} Retry</Text></Pressable> : null}
        <RefreshHint refreshing={vm.inboxBusy && vm.inbox.length > 0} failed={!!vm.inboxRefreshError} onRetry={() => void vm.workflow.inbox()} />
        {skeleton ? <ConversationSkeleton /> : null}
        {vm.inboxError ? <><Text accessibilityRole="alert" style={[ui.supporting, {color: colors.restricted}]}>{vm.inboxError}</Text><Pressable accessibilityRole="button" onPress={() => void vm.workflow.inbox()} style={styles.action}><Text style={styles.link}>Retry inbox</Text></Pressable></> : null}
      </View>}
      ListEmptyComponent={!vm.inboxBusy && !vm.inboxError ? <View style={styles.section}>
        {vm.inbox.length ? <><Text style={ui.sectionTitle}>No conversations here</Text><Text style={ui.supporting}>This filter covers the conversations loaded so far. Choose All to see every one.</Text></>
          : <><Text style={ui.sectionTitle}>No conversations yet</Text><Text style={ui.supporting}>Open a rental in Discover and choose Contact Owner to start a real inquiry.</Text></>}
      </View> : null}
      renderItem={({item}) => {
        const otherId = vm.owner === item.tenantId ? item.landlordId : item.tenantId;
        const participant = vm.publicIdentities?.[otherId], label = publicIdentityLabel(participant, vm.owner === item.tenantId ? 'owner' : 'renter'), property = vm.propertyContexts?.[item.listingId];
        const title = property?.title ?? item.listingTitle ?? 'Listing unavailable';
        return <ConversationCard name={label} avatarUrl={participant?.avatarUrl} avatarName={participant?.nickname} verified={participant?.idVerified === true} day={messageDay(item.activityAt)} title={title}
          owned={property?.ownsProperty === true} roleTag={tenancyRoleTag(vm.tenancyLinks[item.id], vm.owner)} preview={item.latestBody ?? (item.latestType ? 'Non-text message' : 'No messages yet')} photos={property?.photos ?? []}
          accessibilityLabel={`Open conversation with ${label} about ${property?.title ?? item.listingTitle ?? 'this rental'}`} onPress={() => vm.openConversation(item.id)} />;
      }}
      ListFooterComponent={vm.inboxMore ? <Pressable accessibilityRole="button" disabled={vm.inboxBusy} onPress={() => void vm.workflow.inbox(true)} style={styles.action}><Text style={styles.link}>Load more conversations</Text></Pressable> : null} />
  </View>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.canvas},
  pills: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm},
  pill: {minHeight: 48, paddingHorizontal: spacing.md + 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  pillSelected: {backgroundColor: colors.ink, borderColor: colors.ink},
  pillText: {...ui.body, fontWeight: '500', color: colors.ink},
  pillTextSelected: {color: colors.white},
  content: {paddingHorizontal: spacing.md, paddingBottom: spacing.md},
  gap: {height: spacing.xs},
  section: {gap: spacing.xs, paddingBottom: spacing.xs},
  action: {minHeight: 48, justifyContent: 'center'},
  link: {...ui.supporting, color: colors.primaryAction, fontWeight: '600'},
});
