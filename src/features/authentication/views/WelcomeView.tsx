import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthBrand } from '../components/AuthBrand';

const arrowForward = require('../../../assets/authentication/arrow-forward.png');

interface WelcomeViewProps {
  onSignIn: () => void;
  onCreateAccount: () => void;
}

interface ChoiceCardProps {
  title: string;
  description?: string;
  accent?: boolean;
  onPress: () => void;
}

function ChoiceCard({ title, description, accent = false, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        accent && styles.accentCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>{title}</Text>
        {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
      </View>
      <Image resizeMode="contain" source={arrowForward} style={styles.arrow} />
    </Pressable>
  );
}

export function WelcomeView({ onSignIn, onCreateAccount }: WelcomeViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.brandArea}>
        <AuthBrand />
      </View>
      <View style={styles.choices}>
        <ChoiceCard
          description="Click here to log-in"
          onPress={onSignIn}
          title="Already have an account?"
        />
        <ChoiceCard accent onPress={onCreateAccount} title="Let’s Make an Account!" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 412,
    paddingHorizontal: 21,
    paddingBottom: spacing.xl,
    width: '100%',
  },
  brandArea: { alignItems: 'center', marginTop: 184 },
  choices: { gap: spacing.lg, marginTop: 96 },
  choiceCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(147, 147, 147, 0.18)',
    borderRadius: radius.sm,
    flexDirection: 'row',
    minHeight: 170,
    paddingHorizontal: 20,
  },
  accentCard: { backgroundColor: colors.primarySoft },
  choiceText: { flex: 1, gap: spacing.sm },
  choiceTitle: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  choiceDescription: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 20,
    fontWeight: '300',
  },
  arrow: { height: 48, width: 28 },
  pressed: { opacity: 0.78 },
});
