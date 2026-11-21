import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '../theme/colors';
import { ui } from '../theme/ui';

/**
 * A review text with the matched words highlighted. The parts come from the view model (code point spans already converted); this only renders them. The marked
 * part is bold and shaded, never color alone, and the parts always join back to the exact original text.
 */
export function HighlightedText({ segments, style }: { segments: readonly { text: string; marked: boolean }[]; style?: StyleProp<TextStyle> }) {
  return <Text style={[ui.body, style]}>{segments.map((part, index) => part.marked ? <Text key={index} style={styles.marked}>{part.text}</Text> : part.text)}</Text>;
}
const styles = StyleSheet.create({ marked: { fontWeight: '700', color: colors.ink, backgroundColor: colors.primaryPale } });
