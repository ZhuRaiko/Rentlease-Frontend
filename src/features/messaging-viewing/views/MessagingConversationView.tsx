import {ReportAction} from '../../../shared/components/Reporting';
import {ConversationPropertySummary} from '../components/ConversationPropertySummary';
import {PublicAvatar} from '../../../shared/components/PublicIdentityBadge';
import {ChatPersonTitle} from '../../../shared/components/ProfileSurfaces';
import {GlyphIcon} from '../../../shared/components/GlyphIcon';
import {publicIdentityLabel} from '../../../shared/models/PublicIdentity';
import {tenancyRoleTag} from '../../../shared/models/TenancyLink';
import {Fragment, useEffect, useRef, useState, type ReactNode} from 'react';
import {ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {AppButton} from '../../../shared/components/AppButton';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import type {PersistentMessage} from '../models/PersistentMessaging';
import {bubbleTime, dayChipBefore, rentingBanner} from '../models/ThreadPresentation';
import type {MessagingViewingViewModel} from '../viewModels/useMessagingViewingViewModel';

/** What the chat hands to the maintenance strip (built in the tenancy feature and passed in by the app shell). */
export interface MaintenanceStripSlot {tenancyId: string; role: 'tenant' | 'landlord'; onOpenRequest: (requestId: string) => void; onReportAnother: () => void}
export interface TenancyRequestTarget {tenancyId: string; panel: 'care' | 'report'; requestId?: string}

export function MessagingConversationView({viewModel: vm, onBack, onViewings, onReservations, onViewListing, renderMaintenance, onOpenTenancyRequest}: {viewModel: MessagingViewingViewModel; onBack: () => void; onViewings?: () => void; onReservations?: () => void; onViewListing?: ((id: string) => void) | undefined; renderMaintenance?: ((slot: MaintenanceStripSlot) => ReactNode) | undefined; onOpenTenancyRequest?: ((target: TenancyRequestTarget) => void) | undefined}) {
  const conversation = vm.conversation, list = useRef<FlatList<PersistentMessage> | null>(null), follow = useRef(true);
  const otherId = conversation ? (vm.owner === conversation.tenantId ? conversation.landlordId : conversation.tenantId) : null;
  const identity = otherId ? vm.publicIdentities?.[otherId] : undefined, relationship = vm.owner === conversation?.tenantId ? 'owner' : 'renter';
  const [menuOpen, setMenuOpen] = useState(false), tenant = !!conversation && vm.owner === conversation.tenantId, context = conversation ? vm.propertyContexts?.[conversation.listingId] : undefined;
  useEffect(() => { follow.current = true; }, [vm.selectedId]);
  useEffect(() => setMenuOpen(false), [vm.selectedId]);
  const name = publicIdentityLabel(identity, relationship);
  const link = conversation ? vm.tenancyLinks[conversation.id] : undefined, roleText = tenancyRoleTag(link, vm.owner);
  const loadMessages = () => void (conversation ? vm.refresh() : vm.selectedId && vm.workflow.open(vm.selectedId));
  const now = Date.now();
  return <View style={styles.screen}>
    <ScreenHeader title={conversation ? name : 'Conversation'} onBack={onBack}
      titleContent={conversation && otherId ? <View style={styles.person}><PublicAvatar url={identity?.avatarUrl} name={identity?.nickname} size={36} /><ChatPersonTitle accountId={vm.owner ?? undefined} personId={otherId} role={vm.owner === conversation.tenantId ? 'landlord' : 'tenant'} name={name} propertyTitle={conversation.listingTitle} subtitle={roleText} /></View> : undefined} />
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {conversation ? <ScrollView style={styles.contextScroll} contentContainerStyle={styles.context} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <View style={styles.contextRow}>
          <View style={styles.summary}><ConversationPropertySummary key={`${vm.owner}:${conversation.id}`} defaultCollapsed compact={!!vm.keyboardOpen} context={context} title={conversation.listingTitle ?? 'Listing unavailable'} loading={vm.propertyContextLoading ?? false} error={vm.propertyContextError ?? null} onRetry={vm.refreshPropertyContext} onViewListing={onViewListing} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="More options" accessibilityState={{expanded: menuOpen}} onPress={() => setMenuOpen(open => !open)} style={styles.more}><Text style={styles.moreGlyph}>{'⋯'}</Text></Pressable>
        </View>
        {menuOpen ? <View style={styles.menu}>
          {context?.canViewListing && onViewListing ? <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); onViewListing(context.listingId); }} style={styles.menuItem}><Text style={ui.body}>View listing</Text></Pressable> : null}
          {onViewings ? <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); onViewings(); }} style={styles.menuItem}><Text style={ui.body}>Viewings</Text></Pressable> : null}
          {onReservations ? <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); onReservations(); }} style={styles.menuItem}><Text style={ui.body}>Reservations</Text></Pressable> : null}
          <View style={styles.divider} /><ReportAction key={`${vm.owner}:${conversation.id}`} accountId={vm.owner ?? undefined} kind="user" contextId={conversation.id} asMenuItem />
        </View> : null}
        {vm.keyboardOpen ? null : <>
          {link ? <View accessible accessibilityLabel={rentingBanner(link.landlordId === vm.owner, name)} style={styles.banner}><GlyphIcon kind="house" size={22} color={colors.accountCredentialInk} /><Text style={styles.bannerText}>{rentingBanner(link.landlordId === vm.owner, name)}</Text></View> : null}
          {link && renderMaintenance && onOpenTenancyRequest ? renderMaintenance({tenancyId: link.tenancyId, role: link.landlordId === vm.owner ? 'landlord' : 'tenant', onOpenRequest: requestId => onOpenTenancyRequest({tenancyId: link.tenancyId, panel: 'care', requestId}), onReportAnother: () => onOpenTenancyRequest({tenancyId: link.tenancyId, panel: 'report'})}) : null}
          <View style={styles.contextActions}>{onViewings ? <Pressable accessibilityRole="button" style={styles.contextAction} onPress={onViewings}><Text style={styles.actionText}>{tenant ? 'Schedule Viewing' : 'Viewing requests'}</Text></Pressable> : null}{onReservations ? <Pressable accessibilityRole="button" style={styles.contextAction} onPress={onReservations}><Text style={styles.actionText}>{tenant ? 'Request Reservation' : 'Reservation requests'}</Text></Pressable> : null}</View>
        </>}
      </ScrollView> : null}
      {vm.connection === 'unavailable' ? <Text accessibilityLiveRegion="polite" style={styles.syncWarning}>Automatic updates unavailable. Pull to refresh.</Text> : null}
      <FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="none" ref={list} data={vm.messages} maintainVisibleContentPosition={{minIndexForVisible: 0}}
        onLayout={() => { if (follow.current) list.current?.scrollToEnd({animated: false}); }}
        onScroll={e => { const n = e.nativeEvent; follow.current = n.contentSize.height - n.layoutMeasurement.height - n.contentOffset.y < 80; }}
        onContentSizeChange={() => { if (follow.current) list.current?.scrollToEnd({animated: false}); }}
        keyExtractor={m => m.id} contentContainerStyle={styles.content} refreshing={vm.messageBusy} onRefresh={loadMessages}
        ListHeaderComponent={<View>
          {vm.messageBusy && !vm.messages.length ? <ActivityIndicator accessibilityLabel="Loading conversation" color={colors.primaryAction} /> : null}
          {vm.messageError ? <><Text accessibilityRole="alert" style={styles.error}>{vm.messageError}</Text><Pressable accessibilityRole="button" style={styles.action} onPress={loadMessages}><Text style={styles.link}>Retry messages</Text></Pressable></> : null}
          {vm.hasOlder ? <Pressable accessibilityRole="button" disabled={vm.olderBusy} style={styles.action} onPress={() => { follow.current = false; void vm.workflow.older(); }}><Text style={styles.link}>{vm.olderBusy ? 'Loading...' : 'Load earlier messages'}</Text></Pressable> : null}
        </View>}
        ListEmptyComponent={conversation && !vm.messageBusy && !vm.messageError ? <Text style={styles.copy}>No messages yet. Ask about availability or rental terms.</Text> : null}
        renderItem={({item, index}) => {
          const mine = item.senderId === vm.owner, chip = dayChipBefore(vm.messages, index, now), body = item.deleted ? 'Message removed' : item.body ?? (item.type === 'text' ? 'Message unavailable' : 'Non-text message');
          return <Fragment>
            {chip ? <View style={styles.dayRow}><View style={styles.dayChip}><Text style={styles.dayText}>{chip}</Text></View></View> : null}
            <View accessible accessibilityLabel={`${mine ? 'You' : identity?.nickname ?? 'Them'}, ${bubbleTime(item.createdAt)}: ${body}`} style={[styles.bubble, mine ? styles.outgoing : styles.incoming]}>
              <Text style={[styles.body, mine && styles.bodyMine]}>{body}</Text>
              <Text style={[styles.time, mine && styles.timeMine]}>{bubbleTime(item.createdAt)}</Text>
            </View>
          </Fragment>;
        }} />
      {conversation ? <View style={styles.composer}>{conversation.status !== 'open' ? <Text style={styles.copy}>This conversation is {conversation.status}. Its history is still available.</Text> : <><TextInput accessibilityLabel="Message" placeholder="Write a message" multiline maxLength={4000} editable={!vm.sending && !vm.uncertain} value={vm.composer} onChangeText={vm.workflow.setComposer} style={styles.input} />{vm.sendError ? <Text accessibilityRole="alert" style={styles.error}>{vm.sendError}</Text> : null}<AppButton label={vm.sending ? 'Sending...' : vm.uncertain ? 'Retry send' : 'Send message'} disabled={vm.sending || !vm.composer.trim()} onPress={() => void vm.workflow.send()} /></>}</View> : null}
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.canvas},
  person: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  // The header area never takes more than 45% of the screen (large text, a long strip): it scrolls, so the messages and the composer stay on screen.
  contextScroll: {flexGrow: 0, flexShrink: 0, maxHeight: '45%'},
  context: {padding: spacing.md, gap: spacing.xs},
  contextRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  summary: {flex: 1, minWidth: 0},
  more: {width: 48, height: 48, alignItems: 'center', justifyContent: 'center'},
  moreGlyph: {...ui.sectionTitle, color: colors.ink},
  menu: {borderWidth: 1, borderColor: colors.outline, borderRadius: radius.panel, overflow: 'hidden', backgroundColor: colors.background},
  menuItem: {minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md},
  divider: {height: 1, backgroundColor: colors.outline},
  banner: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primaryPale, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minHeight: 48},
  bannerText: {...ui.body, flex: 1, minWidth: 0, color: colors.accountCredentialInk},
  contextActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4},
  contextAction: {minHeight: 48, flex: 1, minWidth: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: colors.primaryAction, paddingHorizontal: 8},
  actionText: {...ui.body, color: colors.primaryAction, fontWeight: '700', textAlign: 'center'},
  syncWarning: {...ui.supporting, paddingHorizontal: spacing.md, paddingVertical: 6},
  copy: {...ui.supporting},
  content: {paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs, flexGrow: 1},
  dayRow: {alignItems: 'center', paddingVertical: spacing.xxs},
  dayChip: {backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 28, justifyContent: 'center'},
  dayText: {...ui.supporting, fontSize: 12, lineHeight: 16},
  bubble: {maxWidth: '88%', paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2, borderRadius: 18, gap: 2},
  outgoing: {alignSelf: 'flex-end', backgroundColor: colors.primaryAction, borderBottomRightRadius: 4},
  incoming: {alignSelf: 'flex-start', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.outline, borderBottomLeftRadius: 4},
  body: {...ui.body},
  bodyMine: {color: colors.white},
  time: {...ui.supporting, fontSize: 12, lineHeight: 16},
  timeMine: {color: colors.white, textAlign: 'right'},
  composer: {padding: spacing.sm, gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.outline, backgroundColor: colors.background},
  input: {...ui.body, borderWidth: 1, borderColor: colors.controlBorder, borderRadius: 10, padding: spacing.sm, minHeight: 48, maxHeight: 140},
  error: {...ui.supporting, color: colors.restricted},
  action: {minHeight: 48, justifyContent: 'center'},
  link: {...ui.supporting, color: colors.primaryAction},
});
