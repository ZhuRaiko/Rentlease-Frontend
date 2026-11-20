import {useEffect, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {ui} from '../../../shared/theme/ui';
import {bathroomsText, bedroomsText, rentText, type ListingCardModel} from '../models/ListingCardModel';
import {ArrowRight, BathMark, BedMark, PhotoMark, PinMark, StarMark} from './ListingIcons';
import {CheckMark} from './PreferenceIcons';
import {SaveListingButton, type SaveControl} from './SaveListingButton';

function Fact({icon, text}: {icon: 'bed' | 'bath'; text: string}) {
  return <View style={styles.fact}>
    <View accessible={false} style={styles.factIcon}>{icon === 'bed' ? <BedMark size={18} /> : <BathMark size={18} />}</View>
    <Text style={styles.factText}>{text}</Text>
  </View>;
}

/**
 * The one listing card, used by Discover, For You, Saved listings, search results and the nearby list. Photo (or a "No photo" block), property type,
 * save heart, price, title, place, bedroom and bathroom chips and a View rental details button. The photo and the body both open the details; the
 * heart is its own target. `rank` (Top match, #2) and `fit` (why it fits) are shown only when a screen supplies them.
 */
export function ListingCard({model, onPress, save, rank, fit = []}: {model: ListingCardModel; onPress: () => void; save?: SaveControl | undefined; rank?: string | undefined; fit?: readonly string[]}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [model.thumbnailUrl]);
  const beds = bedroomsText(model.bedrooms), baths = bathroomsText(model.bathrooms), price = rentText(model.rent);
  const showPhoto = !!model.thumbnailUrl && !failed;
  return <View style={styles.card}>
    <View style={styles.media}>
      <Pressable accessible={false} onPress={onPress} style={styles.photoTarget}>
        {showPhoto
          ? <Image accessibilityLabel="Property cover photo" onError={() => setFailed(true)} resizeMethod="resize" source={{uri: model.thumbnailUrl!}} style={styles.photo} />
          : <View style={[styles.photo, styles.noPhoto]}><PhotoMark /><Text style={styles.noPhotoText}>No photo</Text></View>}
      </Pressable>
      {model.propertyType ? <View pointerEvents="none" style={styles.typeTag}><Text style={styles.typeText}>{model.propertyType}</Text></View> : null}
      {rank ? <View pointerEvents="none" style={styles.rank}>{rank === 'Top match' ? <StarMark /> : null}<Text style={styles.rankText}>{rank}</Text></View> : null}
      {save ? <View style={styles.heart}><SaveListingButton control={save} /></View> : null}
    </View>
    <Pressable accessibilityLabel={`View ${model.title}, ${price}${model.rent === null ? '' : ' per month'}${model.location ? `, ${model.location}` : ''}`} accessibilityRole="button" onPress={onPress} style={({pressed}) => [styles.body, pressed && styles.pressed]}>
      <Text style={styles.price}>{price}{model.rent === null ? '' : <Text style={styles.period}>{' / month'}</Text>}</Text>
      <Text style={styles.title}>{model.title}</Text>
      <View style={styles.place}><PinMark /><Text style={styles.placeText}>{model.location || 'Public location unavailable'}</Text></View>
      {beds || baths ? <View style={styles.facts}>{beds ? <Fact icon="bed" text={beds} /> : null}{baths ? <Fact icon="bath" text={baths} /> : null}</View> : null}
      {model.notes.map(note => <Text key={note} style={ui.supporting}>{note}</Text>)}
      {fit.length ? <View style={styles.fit}>
        <Text style={styles.fitTitle}>Why it fits</Text>
        <View style={styles.fitChips}>{fit.map(reason => <View key={reason} style={styles.fitChip}><CheckMark size={14} /><Text style={styles.fitText}>{reason}</Text></View>)}</View>
      </View> : null}
      <View style={styles.button}><Text style={styles.buttonText}>View rental details</Text><ArrowRight /></View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: {backgroundColor: colors.background, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.card + 4, overflow: 'hidden', marginBottom: spacing.md},
  media: {aspectRatio: 1.8, backgroundColor: colors.surface},
  photoTarget: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0},
  photo: {width: '100%', height: '100%'},
  noPhoto: {alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface},
  noPhotoText: {...ui.supporting, color: colors.textSecondary},
  typeTag: {position: 'absolute', top: spacing.sm, left: spacing.sm, maxWidth: '62%', minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.background},
  typeText: {color: colors.ink, fontFamily: typography.family, fontSize: 13, fontWeight: '700'},
  rank: {position: 'absolute', bottom: spacing.sm, left: spacing.sm, minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.ink},
  rankText: {color: colors.white, fontFamily: typography.family, fontSize: 13, fontWeight: '700'},
  heart: {position: 'absolute', top: spacing.sm, right: spacing.sm},
  body: {padding: spacing.md, gap: spacing.xs},
  pressed: {opacity: 0.75},
  price: {color: colors.ink, fontFamily: typography.family, fontSize: 24, lineHeight: 30, fontWeight: '800'},
  period: {color: colors.textSecondary, fontSize: 14, fontWeight: '400'},
  title: {color: colors.ink, fontFamily: typography.family, fontSize: 17, lineHeight: 24, fontWeight: '700'},
  place: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs},
  placeText: {...ui.supporting, flex: 1, minWidth: 0, fontSize: 15},
  facts: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xxs},
  fact: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.pill, paddingVertical: spacing.xxs, paddingLeft: spacing.xxs, paddingRight: spacing.sm, maxWidth: '100%'},
  factIcon: {width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center'},
  factText: {flexShrink: 1, color: colors.ink, fontFamily: typography.family, fontSize: 15, lineHeight: 21},
  fit: {gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.sm, marginTop: spacing.xs},
  fitTitle: {...ui.supporting, fontWeight: '700'},
  fitChips: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  fitChip: {flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 32, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primaryPale},
  fitText: {flexShrink: 1, color: colors.primaryAction, fontFamily: typography.family, fontSize: 13, fontWeight: '500'},
  button: {minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primaryPale},
  buttonText: {color: colors.primaryAction, fontFamily: typography.family, fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1},
});
