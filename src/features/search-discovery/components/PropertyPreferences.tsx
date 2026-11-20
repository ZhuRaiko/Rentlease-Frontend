import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {propertyKindLabel} from '../models/MatchingPreferenceForm';
import {discoveryAmenities, propertyKinds, type MatchingPreferences, type PropertyKind} from '../models/SearchDiscovery';
import {ChoicePill, GroupTitle} from './PreferenceCards';
import {PlusMinus} from './PreferenceIcons';

/** A number with a minus and a plus button, 48dp each. 0 reads "Any". */
export function Stepper({label, value, step, onChange}: {label: string; value: number; step: number; onChange: (next: number) => void}) {
  return <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.controls}>
      <Pressable accessibilityLabel={`Decrease ${label}`} accessibilityRole="button" onPress={() => onChange(Math.max(0, value - step))} style={styles.button}><PlusMinus plus={false} /></Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.value}>{value || 'Any'}</Text>
      <Pressable accessibilityLabel={`Increase ${label}`} accessibilityRole="button" onPress={() => onChange(value + step)} style={styles.button}><PlusMinus plus /></Pressable>
    </View>
  </View>;
}

/** The Property card: type (pick any), the three unit specifications and amenities (pick any). Same choices and steps as before. */
export function PropertyPreferences({preferences, onChange, onToggleKind, onToggleAmenity}: {
  preferences: MatchingPreferences;
  onChange: <TField extends 'minimumLandArea' | 'minimumBedrooms' | 'minimumBathrooms'>(field: TField, value: MatchingPreferences[TField]) => void;
  onToggleKind: (kind: PropertyKind) => void;
  onToggleAmenity: (amenity: string) => void;
}) {
  return <>
    <View style={styles.group}>
      <GroupTitle note="pick any">Property type</GroupTitle>
      <View style={styles.wrap}>{propertyKinds.map(kind => <ChoicePill key={kind} multi label={propertyKindLabel(kind)} selected={preferences.propertyKinds.includes(kind)} onPress={() => onToggleKind(kind)} />)}</View>
    </View>
    <View style={styles.group}>
      <GroupTitle>Unit specifications</GroupTitle>
      <View style={styles.specs}>
        <Stepper label="Land Area (sqm)" step={10} value={preferences.minimumLandArea} onChange={next => onChange('minimumLandArea', next)} />
        <View style={styles.divider} />
        <Stepper label="Bedrooms" step={1} value={preferences.minimumBedrooms} onChange={next => onChange('minimumBedrooms', next)} />
        <View style={styles.divider} />
        <Stepper label="Bathrooms" step={1} value={preferences.minimumBathrooms} onChange={next => onChange('minimumBathrooms', next)} />
      </View>
    </View>
    <View style={styles.group}>
      <GroupTitle note="pick any">Amenities</GroupTitle>
      <View style={styles.wrap}>{discoveryAmenities.map(amenity => <ChoicePill key={amenity} multi label={amenity} selected={preferences.amenities.includes(amenity)} onPress={() => onToggleAmenity(amenity)} />)}</View>
    </View>
  </>;
}

const styles = StyleSheet.create({
  group: {gap: spacing.xs},
  wrap: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  specs: {borderWidth: 1, borderColor: colors.outline, borderRadius: radius.card, paddingHorizontal: spacing.sm},
  divider: {height: 1, backgroundColor: colors.outline},
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.xs, minHeight: 64, paddingVertical: spacing.xxs},
  label: {flexGrow: 1, flexShrink: 1, flexBasis: 132, minWidth: 132, color: colors.ink, fontFamily: typography.family, fontSize: 15, lineHeight: 21},
  controls: {flexDirection: 'row', alignItems: 'center', marginLeft: 'auto'},
  button: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center'},
  value: {minWidth: 44, textAlign: 'center', color: colors.ink, fontFamily: typography.family, fontSize: 17, fontWeight: '700'},
});
