import type { ImageSourcePropType } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { OtpCodeInput } from '../../../shared/components/OtpCodeInput';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import type { UserVerificationViewModel } from '../viewModels/useUserVerificationViewModel';

const emailIcon = require('../../../assets/verification/email.png');
const phoneIcon = require('../../../assets/verification/phone.png');
const unlockIcon = require('../../../assets/verification/unlock.png');

interface TierOneVerificationViewProps {
  viewModel: UserVerificationViewModel;
  onClose: () => void;
}

interface RequirementProps {
  image: ImageSourcePropType;
  title: string;
  copy: string;
}

function Requirement({ image, title, copy }: RequirementProps) {
  return (
    <View style={styles.requirement}>
      <Image resizeMode="contain" source={image} style={styles.requirementIcon} />
      <View style={styles.requirementCopy}>
        <Text style={styles.requirementTitle}>{title}</Text>
        <Text style={styles.requirementBody}>{copy}</Text>
      </View>
    </View>
  );
}

export function TierOneVerificationView({
  viewModel,
  onClose,
}: TierOneVerificationViewProps) {
  if (viewModel.screen === 'tier1Intro') {
    return (
      <VerificationScaffold
        description="Tier 1 is mandatory for every RENTLEASE account."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Tier 1 verification"
      >
        <Requirement image={emailIcon} title="Confirm your email" copy={viewModel.draft.email} />
        <Requirement image={phoneIcon} title="Confirm your mobile number" copy={viewModel.draft.mobile} />
        <Requirement image={unlockIcon} title="Unlock application access" copy="Both contact methods must be confirmed." />
        <AppButton label="Start verification" onPress={() => viewModel.navigate('tier1Email')} />
      </VerificationScaffold>
    );
  }

  if (viewModel.screen === 'tier1Email') {
    return (
      <VerificationScaffold
        description={`A confirmation code would be sent to ${viewModel.draft.email}. Delivery is disconnected; enter four digits to preview the flow.`}
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Email verification"
      >
        <OtpCodeInput
          onChangeDigit={(index, digit) => viewModel.updateCodeDigit('emailCode', index, digit)}
          value={viewModel.draft.emailCode}
        />
        <Text style={styles.previewNotice}>No email was sent and no backend verification occurred.</Text>
        <AppButton
          disabled={!/^\d{4}$/.test(viewModel.draft.emailCode)}
          label="Confirm email preview"
          onPress={() => viewModel.navigate('tier1Mobile')}
        />
      </VerificationScaffold>
    );
  }

  return (
    <VerificationScaffold
      description={`An SMS code would be sent to ${viewModel.draft.mobile}. Delivery is disconnected; enter four digits to preview the flow.`}
      onBack={viewModel.goBack}
      onClose={onClose}
      title="Mobile number verification"
    >
      <OtpCodeInput
        onChangeDigit={(index, digit) => viewModel.updateCodeDigit('mobileCode', index, digit)}
        value={viewModel.draft.mobileCode}
      />
      <Text style={styles.previewNotice}>No SMS was sent and no backend verification occurred.</Text>
      <AppButton
        disabled={!/^\d{4}$/.test(viewModel.draft.mobileCode)}
        label="Complete Tier 1 preview"
        onPress={viewModel.completeTierOne}
      />
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  requirement: {
    alignItems: 'center',
    backgroundColor: colors.tierOneSurface,
    borderColor: colors.tierOneBorder,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 88,
    padding: spacing.md,
  },
  requirementIcon: { height: 34, opacity: 0.7, width: 34 },
  requirementCopy: { flex: 1, gap: spacing.xxs },
  requirementTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800' },
  requirementBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13 },
  previewNotice: {
    backgroundColor: colors.warningSurface,
    borderRadius: radius.sm,
    color: colors.warning,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    padding: spacing.sm,
  },
});
