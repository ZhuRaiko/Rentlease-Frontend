import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { experiencePreferenceOptions } from '../models/AuthProfile';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import { AuthField } from '../components/AuthField';
import { AuthScaffold } from '../components/AuthScaffold';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

export function EditProfileView({ viewModel }: { viewModel: AuthProfilesViewModel }) {
  const busy = viewModel.asyncState === 'loading';
  return <AuthScaffold formLayout backDisabled={busy} description="Update the public details on your RENTLEASE profile." onBack={viewModel.goBack} title="Edit profile">
    <AuthField editable={!busy} autoCapitalize="words" label="Display name" onChangeText={viewModel.setProfileName} value={viewModel.profileName} />
    <AuthField editable={!busy} label="Bio" multiline numberOfLines={4} onChangeText={viewModel.setProfileBio} placeholder="Tell others a little about yourself" value={viewModel.profileBio} />
    <Text style={styles.detail}>How do you usually use RentLease? (Optional)</Text>
    <Text style={styles.detail}>Sets your starting screen and profile label. You can always browse and post.</Text>
    <View accessibilityRole="radiogroup" style={styles.preferences}>
      {experiencePreferenceOptions.map(option => <Pressable key={option.value ?? 'unset'} accessibilityRole="radio" accessibilityState={{ checked: viewModel.profilePreference === option.value, disabled: busy }} disabled={busy} onPress={() => viewModel.setProfilePreference(option.value)} style={[styles.preference, viewModel.profilePreference === option.value && styles.selected]}>
        <Text style={styles.detail}>{option.label}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.note}>Email and phone are verified through Supabase Auth and cannot be changed here.</Text>
    <Text style={styles.detail}>Email: {viewModel.account?.user.email || 'Not available'}</Text>
    <Text style={styles.detail}>Phone: {viewModel.account?.user.phone || 'Not available'}</Text>
    <AuthButton disabled={!viewModel.canSaveProfile} label={busy ? 'Saving…' : 'Save changes'} onPress={() => void viewModel.saveProfile()} />
    <FeedbackNotice message={viewModel.notice} tone={viewModel.noticeTone} />
  </AuthScaffold>;
}

const styles = StyleSheet.create({
  preferences: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preference: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: colors.outline, borderRadius: 10, padding: spacing.sm },
  selected: { backgroundColor: colors.primaryPale, borderColor: colors.primaryAction },
  note: { backgroundColor: colors.primaryPale, color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 18, padding: spacing.sm },
  detail: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14 },
});
