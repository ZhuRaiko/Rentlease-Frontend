import {KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {AppButton} from '../../../shared/components/AppButton';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {GlyphIcon} from '../../../shared/components/GlyphIcon';
import {KeyboardAwareScrollView as ScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {useBottomClearance} from '../../../shared/components/useBottomClearance';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {ui} from '../../../shared/theme/ui';
import {AboutFolded, ChoicePill, GroupTitle, NearbySwitchRow, PreferenceCard, PreferencePanel, StayChoice} from '../components/PreferenceCards';
import {PropertyPreferences} from '../components/PropertyPreferences';
import {CloseMark, ListMark, WalletMark} from '../components/PreferenceIcons';
import {aboutSummary, budgetSummary, cityLabel, mattersSummary, propertySummary, stayParts} from '../models/MatchingPreferenceForm';
import {renterProfiles, stayLengths} from '../models/SearchDiscovery';
import type {SearchDiscoveryViewModel} from '../viewModels/useSearchDiscoveryViewModel';
import {useMatchingPreferencesForm} from '../viewModels/useMatchingPreferencesForm';
import {LegacyBudgetBody, LegacyMattersBody} from './LegacyPreferenceSections';

const CITIES = ['Imus', 'Dasmariñas', 'Tagaytay'];

/** The Matching preferences screen. The preferences stay in the Discovery view model (session only); this view only presents them. */
export function MatchingPreferencesView({viewModel, onClose}: {viewModel: SearchDiscoveryViewModel; onClose: () => void}) {
  const preferences = viewModel.matchingPreferences, form = useMatchingPreferencesForm(), bottom = useBottomClearance();
  const {width, fontScale} = useWindowDimensions(), tight = fontScale > 1.2 || width < 360;
  const update = viewModel.updateMatchingPreference, busy = viewModel.isCompletingIntroduction;
  const aboutOpen = form.open === 'about';
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>Matching preferences</Text>
      <Pressable accessibilityLabel="Close" accessibilityRole="button" accessibilityState={{disabled: busy}} disabled={busy} onPress={onClose} style={styles.close}><CloseMark /></Pressable>
    </View>
    <ScrollView contentContainerStyle={[styles.content, {paddingBottom: bottom}]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <FeedbackNotice message={viewModel.notice} />
      {aboutOpen ? <View style={styles.intro}>
        <Text style={styles.introTitle}>A place that fits your needs</Text>
        <Text style={ui.supporting}>Every choice is optional. They are kept only while the app is open, set your Discover filters and For You picks, and can be edited later from Profile.</Text>
      </View> : null}

      {aboutOpen ? <PreferencePanel>
        <View style={styles.group}>
          <GroupTitle>What type of renter are you?</GroupTitle>
          <View style={styles.wrap}>{renterProfiles.map(profile => <ChoicePill key={profile} label={profile} selected={preferences.renterProfile === profile} onPress={() => update('renterProfile', profile)} />)}</View>
        </View>
        <View style={styles.group}>
          <GroupTitle>Preferred length of stay</GroupTitle>
          <View style={styles.wrap}>{stayLengths.map(length => <StayChoice key={length} {...stayParts(length)} label={length} full={tight} selected={preferences.stayLength === length} onPress={() => update('stayLength', length)} />)}</View>
        </View>
        <View style={styles.group}>
          <GroupTitle>City or area in Cavite</GroupTitle>
          <View style={styles.wrap}>{CITIES.map(city => <ChoicePill key={city} label={cityLabel(city)} selected={preferences.city === city} onPress={() => update('city', city)} />)}</View>
        </View>
      </PreferencePanel> : <AboutFolded summary={aboutSummary(preferences)} onChange={() => form.show('about')} />}

      <PreferenceCard icon={<GlyphIcon kind="house" size={24} />} onToggle={() => form.toggle('property')} open={form.open === 'property'} roomy={aboutOpen} summary={propertySummary(preferences)} title="Property">
        <PropertyPreferences onChange={update} onToggleAmenity={viewModel.togglePreferenceAmenity} onToggleKind={viewModel.togglePreferencePropertyKind} preferences={preferences} />
      </PreferenceCard>
      <PreferenceCard hint="Your monthly range for rent." icon={<WalletMark />} onToggle={() => form.toggle('budget')} open={form.open === 'budget'} roomy={aboutOpen} summary={budgetSummary(preferences)} title="Budget">
        <LegacyBudgetBody preferences={preferences} viewModel={viewModel} />
      </PreferenceCard>
      <PreferenceCard hint="Drag a row or use the arrows. Top matters most." icon={<ListMark />} onToggle={() => form.toggle('matters')} open={form.open === 'matters'} roomy={aboutOpen} summary={mattersSummary(preferences)} title="What matters most">
        <LegacyMattersBody preferences={preferences} viewModel={viewModel} />
      </PreferenceCard>

      <Text style={[ui.supporting, styles.optionalNote]}>Property, budget and what matters most are optional. They narrow your Discover results and shape your For You recommendations.</Text>
      <NearbySwitchRow value={preferences.prioritizeNearbyPlaces} onChange={next => update('prioritizeNearbyPlaces', next)} />
    </ScrollView>
    <View style={styles.footer}>
      <FeedbackNotice tone="error" message={viewModel.introductionError} />
      <AppButton label={busy ? 'Saving...' : viewModel.introductionPending ? 'Save and continue' : 'Save preferences'} disabled={busy} onPress={() => void viewModel.saveMatchingPreferences()} />
      {viewModel.introductionPending ? <Pressable accessibilityRole="button" accessibilityState={{disabled: busy}} disabled={viewModel.isCompletingIntroduction} style={styles.skip} onPress={() => void viewModel.skipMatchingIntroduction()}><Text style={styles.skipLabel}>Skip for now</Text></Pressable> : null}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.canvas},
  header: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 64, paddingHorizontal: spacing.md},
  title: {flex: 1, minWidth: 0, color: colors.textSecondary, fontFamily: typography.family, fontSize: 18, fontWeight: '700', paddingVertical: spacing.xs},
  close: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  content: {alignSelf: 'center', maxWidth: 460, width: '100%', paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: spacing.sm},
  intro: {gap: spacing.xs, paddingVertical: spacing.xs},
  introTitle: {...ui.pageTitle, fontSize: 24, lineHeight: 30},
  group: {gap: spacing.xs, paddingBottom: spacing.md},
  wrap: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  optionalNote: {paddingHorizontal: spacing.xxs},
  footer: {alignSelf: 'center', maxWidth: 460, width: '100%', gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, backgroundColor: colors.background, borderTopColor: colors.outline, borderTopWidth: 1},
  skip: {alignItems: 'center', justifyContent: 'center', minHeight: 48},
  skipLabel: {color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700'},
});
