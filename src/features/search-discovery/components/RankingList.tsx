import {useRef, useState} from 'react';
import {PanResponder, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {canMoveDown, canMoveUp, dragTarget} from '../models/MatchingPreferenceForm';
import {Chevron, GripDots} from './PreferenceIcons';

/** Three tabs in one pill: Factors, Unit specs, Amenities. The active one is filled dark. */
export function RankingTabs({tabs, activeId, onSelect}: {tabs: readonly {id: string; label: string}[]; activeId: string; onSelect: (id: string) => void}) {
  return <View accessibilityRole="tablist" style={styles.tabs}>
    {tabs.map(tab => {
      const active = tab.id === activeId;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{selected: active}} onPress={() => onSelect(tab.id)} style={[styles.tab, active && styles.tabActive]}>
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

interface RowProps {
  value: string; index: number; length: number; offset: number; dragging: boolean;
  onMove: (direction: -1 | 1) => void; onDragStart: () => void; onDragMove: (distance: number) => void; onDragEnd: (distance: number) => void; onLayoutHeight: (height: number) => void;
}

function RankRow(props: RowProps) {
  const {value, index, length, offset, dragging} = props;
  const live = useRef(props);
  live.current = props;
  // Dragging is a convenience on the handle; the Up and Down buttons are the accessible way to reorder and always work.
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => live.current.onDragStart(),
    onPanResponderMove: (_event, gesture) => live.current.onDragMove(gesture.dy),
    onPanResponderRelease: (_event, gesture) => live.current.onDragEnd(gesture.dy),
    onPanResponderTerminate: () => live.current.onDragEnd(0),
  }));
  const up = canMoveUp(index), down = canMoveDown(index, length);
  return <View onLayout={event => props.onLayoutHeight(event.nativeEvent.layout.height)} style={[styles.row, dragging && styles.rowDragging, {transform: [{translateY: offset}]}]}>
    <View accessible={false} style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
    <Text style={styles.label}>{value}</Text>
    <View style={styles.controls}>
      <View {...pan.panHandlers} accessible={false} importantForAccessibility="no-hide-descendants" style={styles.handle}><GripDots color={dragging ? colors.primaryAction : colors.textMuted} /></View>
      <Pressable accessibilityLabel={`Move ${value} up`} accessibilityRole="button" accessibilityState={{disabled: !up}} disabled={!up} onPress={() => props.onMove(-1)} style={[styles.arrow, !up && styles.arrowOff]}><Chevron up /></Pressable>
      <Pressable accessibilityLabel={`Move ${value} down`} accessibilityRole="button" accessibilityState={{disabled: !down}} disabled={!down} onPress={() => props.onMove(1)} style={[styles.arrow, !down && styles.arrowOff]}><Chevron /></Pressable>
    </View>
  </View>;
}

/** One ranked list: number, drag handle, Up and Down on each row. The first Up and the last Down are disabled. */
export function RankingList({values, onMove}: {values: readonly string[]; onMove: (index: number, direction: -1 | 1) => void}) {
  const [drag, setDrag] = useState<{index: number; distance: number} | null>(null);
  const rowHeight = useRef(64);
  return <View>
    {values.map((value, index) => <View key={value} style={[styles.slot, index < values.length - 1 && styles.slotRule, drag?.index === index && styles.lifted]}>
      <RankRow
        dragging={drag?.index === index} index={index} length={values.length} offset={drag?.index === index ? drag.distance : 0} value={value}
        onDragStart={() => setDrag({index, distance: 0})}
        onDragMove={distance => setDrag({index, distance})}
        onDragEnd={distance => {
          const target = dragTarget(index, distance, rowHeight.current, values.length), step = target > index ? 1 : -1;
          for (let at = index; at !== target; at += step) onMove(at, step);
          setDrag(null);
        }}
        onLayoutHeight={height => { rowHeight.current = height; }}
        onMove={direction => onMove(index, direction)}
      />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  tabs: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs, backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.xxs},
  tab: {flexGrow: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.xs},
  tabActive: {backgroundColor: colors.ink},
  tabLabel: {flexShrink: 0, color: colors.ink, fontFamily: typography.family, fontSize: 14, fontWeight: '500'},
  tabLabelActive: {color: colors.white},
  slot: {borderRadius: radius.card},
  slotRule: {borderBottomWidth: 1, borderBottomColor: colors.outline},
  lifted: {zIndex: 2, elevation: 3},
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.xs, minHeight: 64, paddingVertical: spacing.xxs},
  rowDragging: {backgroundColor: colors.primaryPale},
  number: {width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center'},
  numberText: {color: colors.white, fontFamily: typography.family, fontSize: 13, fontWeight: '700'},
  label: {flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 140, color: colors.ink, fontFamily: typography.family, fontSize: 15, lineHeight: 21},
  controls: {flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginLeft: 'auto'},
  handle: {width: 40, height: 48, alignItems: 'center', justifyContent: 'center'},
  arrow: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  arrowOff: {opacity: 0.35},
});
