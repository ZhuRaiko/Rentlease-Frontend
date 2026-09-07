import { StyleSheet, View } from 'react-native';

type DiscoveryIconName =
  | 'search'
  | 'filter'
  | 'map'
  | 'list'
  | 'bookmark'
  | 'location'
  | 'home'
  | 'gallery'
  | 'plus'
  | 'tenancy'
  | 'chat'
  | 'rating';

interface DiscoveryIconProps {
  name: DiscoveryIconName;
  color?: string;
  size?: number;
}

export function DiscoveryIcon({ name, color = '#000000', size = 22 }: DiscoveryIconProps) {
  if (name === 'search') {
    return (
      <View style={{ height: size, width: size }}>
        <View style={[styles.searchCircle, { borderColor: color, height: size * 0.67, width: size * 0.67 }]} />
        <View style={[styles.searchHandle, { backgroundColor: color, height: 2, left: size * 0.6, top: size * 0.68, width: size * 0.36 }]} />
      </View>
    );
  }

  if (name === 'filter') {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        {[0.24, 0.5, 0.76].map((position, index) => (
          <View key={position} style={[styles.filterLine, { backgroundColor: color, top: size * position, width: size * 0.9 }]}>
            <View style={[styles.filterKnob, { backgroundColor: color, left: index === 1 ? size * 0.2 : size * 0.58 }]} />
          </View>
        ))}
      </View>
    );
  }

  if (name === 'list') {
    return (
      <View style={[styles.iconBox, { gap: size * 0.16, height: size, width: size }]}>
        {[0, 1, 2].map((line) => (
          <View key={line} style={[styles.listLine, { backgroundColor: color, width: size * 0.86 }]} />
        ))}
      </View>
    );
  }

  if (name === 'bookmark') {
    return <View style={[styles.bookmark, { borderColor: color, height: size, width: size * 0.72 }]} />;
  }

  if (name === 'location') {
    return (
      <View style={[styles.locationPin, { borderColor: color, height: size, width: size * 0.78 }]}>
        <View style={[styles.locationDot, { backgroundColor: color, height: size * 0.23, width: size * 0.23 }]} />
      </View>
    );
  }

  if (name === 'home') {
    return (
      <View style={[styles.homeBody, { borderColor: color, height: size * 0.62, marginTop: size * 0.28, width: size * 0.78 }]}>
        <View style={[styles.homeRoof, { borderBottomColor: color, borderLeftWidth: size * 0.42, borderRightWidth: size * 0.42, borderBottomWidth: size * 0.35, top: -size * 0.37 }]} />
      </View>
    );
  }

  if (name === 'gallery') {
    return (
      <View style={[styles.gallery, { borderColor: color, height: size * 0.76, width: size }]}>
        <View style={[styles.gallerySun, { backgroundColor: color, height: size * 0.18, width: size * 0.18 }]} />
        <View style={[styles.galleryHill, { borderBottomColor: color, borderLeftWidth: size * 0.26, borderRightWidth: size * 0.26, borderBottomWidth: size * 0.24 }]} />
      </View>
    );
  }

  if (name === 'plus') {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        <View style={[styles.plusHorizontal, { backgroundColor: color, width: size * 0.76 }]} />
        <View style={[styles.plusVertical, { backgroundColor: color, height: size * 0.76 }]} />
      </View>
    );
  }

  if (name === 'tenancy') {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        <View style={[styles.tenantHead, { borderColor: color, height: size * 0.3, left: size * 0.18, top: size * 0.08, width: size * 0.3 }]} />
        <View style={[styles.tenantHead, { borderColor: color, height: size * 0.25, right: size * 0.08, top: size * 0.2, width: size * 0.25 }]} />
        <View style={[styles.tenantBody, { borderColor: color, bottom: size * 0.05, height: size * 0.42, left: size * 0.07, width: size * 0.56 }]} />
        <View style={[styles.tenantBody, { borderColor: color, bottom: size * 0.05, height: size * 0.34, right: 0, width: size * 0.42 }]} />
      </View>
    );
  }

  if (name === 'chat') {
    return (
      <View style={[styles.chatBubble, { borderColor: color, height: size * 0.72, width: size }]}>
        <View style={[styles.chatTail, { borderBottomColor: color, borderBottomWidth: size * 0.22, borderLeftWidth: size * 0.18 }]} />
      </View>
    );
  }

  if (name === 'rating') {
    return (
      <View style={[styles.iconBox, { height: size, width: size }]}>
        <View style={[styles.ratingPoint, { backgroundColor: color, height: size * 0.72, width: size * 0.72 }]} />
        <View style={[styles.ratingBar, { backgroundColor: color, height: size * 0.28, width: size }]} />
      </View>
    );
  }

  return (
    <View style={[styles.mapFrame, { borderColor: color, height: size, width: size }]}>
      <View style={[styles.mapFold, { backgroundColor: color, left: size * 0.33 }]} />
      <View style={[styles.mapFold, { backgroundColor: color, left: size * 0.66 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  searchCircle: { borderRadius: 100, borderWidth: 2, left: 1, position: 'absolute', top: 1 },
  searchHandle: { borderRadius: 2, position: 'absolute', transform: [{ rotate: '45deg' }] },
  filterLine: { borderRadius: 2, height: 2, position: 'absolute' },
  filterKnob: { borderRadius: 5, height: 7, position: 'absolute', top: -2.5, width: 7 },
  listLine: { borderRadius: 2, height: 2 },
  bookmark: { borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 2 },
  locationPin: { alignItems: 'center', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 2, justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  locationDot: { borderRadius: 100, transform: [{ rotate: '-45deg' }] },
  homeBody: { alignSelf: 'center', borderTopWidth: 0, borderWidth: 2, position: 'relative' },
  homeRoof: { borderLeftColor: 'transparent', borderRightColor: 'transparent', height: 0, left: -2, position: 'absolute', width: 0 },
  gallery: { borderRadius: 3, borderWidth: 2, overflow: 'hidden', position: 'relative' },
  gallerySun: { borderRadius: 100, position: 'absolute', right: 3, top: 3 },
  galleryHill: { borderLeftColor: 'transparent', borderRightColor: 'transparent', bottom: 0, height: 0, left: 2, position: 'absolute', width: 0 },
  mapFrame: { borderRadius: 3, borderWidth: 2, position: 'relative' },
  mapFold: { height: '100%', position: 'absolute', top: 0, transform: [{ rotate: '8deg' }], width: 1.5 },
  plusHorizontal: { borderRadius: 2, height: 2, position: 'absolute' },
  plusVertical: { borderRadius: 2, position: 'absolute', width: 2 },
  tenantHead: { borderRadius: 100, borderWidth: 1.7, position: 'absolute' },
  tenantBody: { borderRadius: 100, borderWidth: 1.7, position: 'absolute' },
  chatBubble: { borderRadius: 5, borderWidth: 1.8, marginTop: 1, position: 'relative' },
  chatTail: { borderLeftColor: 'transparent', bottom: -4, height: 0, left: 3, position: 'absolute', width: 0 },
  ratingPoint: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  ratingBar: { borderRadius: 2, position: 'absolute' },
});
