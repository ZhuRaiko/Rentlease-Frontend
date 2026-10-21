import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { StyleSheet, Text } from 'react-native';

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
    <Text style={styles.note}>Email and phone are verified through Supabase Auth and cannot be changed here.</Text>
    <Text style={styles.detail}>Email: {viewModel.account?.user.email || 'Not available'}</Text>
    <Text style={styles.detail}>Phone: {viewModel.account?.user.phone || 'Not available'}</Text>
    <AuthButton disabled={busy || !viewModel.profileName.trim()} label={busy ? 'Saving…' : 'Save profile'} onPress={() => void viewModel.saveProfile()} />
    <FeedbackNotice message={viewModel.notice} tone={viewModel.noticeTone} />
  </AuthScaffold>;
}

const styles = StyleSheet.create({
  note: { backgroundColor: colors.primaryPale, color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 18, padding: spacing.sm },
  detail: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14 },
});
