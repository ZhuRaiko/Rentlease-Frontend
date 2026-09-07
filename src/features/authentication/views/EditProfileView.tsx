import { StyleSheet, Text } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import { AuthField } from '../components/AuthField';
import { AuthScaffold } from '../components/AuthScaffold';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

interface EditProfileViewProps {
  viewModel: AuthProfilesViewModel;
}

export function EditProfileView({ viewModel }: EditProfileViewProps) {
  return (
    <AuthScaffold
      description="Update the profile information shown across RENTLEASE."
      onBack={viewModel.goBack}
      title="Edit profile"
    >
      <AuthField
        autoCapitalize="words"
        label="First name"
        onChangeText={(value) => viewModel.updateProfile('firstName', value)}
        value={viewModel.profile.firstName}
      />
      <AuthField
        autoCapitalize="words"
        label="Last name"
        onChangeText={(value) => viewModel.updateProfile('lastName', value)}
        value={viewModel.profile.lastName}
      />
      <AuthField
        autoCapitalize="words"
        label="Nickname"
        onChangeText={(value) => viewModel.updateProfile('nickname', value)}
        value={viewModel.profile.nickname}
      />
      <AuthField
        autoCapitalize="none"
        keyboardType="email-address"
        label="Email"
        onChangeText={(value) => viewModel.updateProfile('email', value)}
        value={viewModel.profile.email}
      />
      <AuthField
        keyboardType="phone-pad"
        label="Mobile number"
        onChangeText={(value) => viewModel.updateProfile('phone', value)}
        value={viewModel.profile.phone}
      />
      <AuthField
        autoCapitalize="words"
        label="City"
        onChangeText={(value) => viewModel.updateProfile('city', value)}
        value={viewModel.profile.city}
      />
      <Text style={styles.note}>Changes remain on-device and are not submitted to Supabase.</Text>
      <AuthButton label="Save profile preview" onPress={viewModel.saveProfile} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  note: {
    backgroundColor: colors.primaryPale,
    borderRadius: radius.sm,
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    padding: spacing.sm,
  },
});
