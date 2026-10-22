import { Image, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { profileAvatarDiameter } from '../models/accountPresentation';
import { colors } from '../../../shared/theme/colors';
import { typography } from '../../../shared/theme/typography';

/** Presentation only. Photo sources must be supplied by an existing approved integration. */
export function ProfileAvatar({ initials, source }: { initials: string; source?: ImageSourcePropType }) {
  const { fontScale } = useWindowDimensions();
  const diameter = profileAvatarDiameter(fontScale);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.frame, { width: diameter, height: diameter, borderRadius: diameter / 2 }]}>
    {source ? <Image source={source} resizeMode="cover" style={styles.photo} /> : <Text style={styles.initials}>{initials || '?'}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  frame: { borderWidth: 2, borderColor: colors.accountCredentialInk, overflow: 'hidden', backgroundColor: colors.primaryAction, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  initials: { color: colors.white, fontFamily: typography.family, fontSize: 22, fontWeight: '600' },
});
