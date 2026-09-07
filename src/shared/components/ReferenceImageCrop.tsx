import { useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';

interface ReferenceImageCropProps {
  source: ImageSourcePropType;
  sourceWidth: number;
  sourceHeight: number;
  crop: { x: number; y: number; width: number; height: number };
  borderRadius?: number;
}

export function ReferenceImageCrop({
  source,
  sourceWidth,
  sourceHeight,
  crop,
  borderRadius = 0,
}: ReferenceImageCropProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const scale = containerWidth > 0 ? containerWidth / crop.width : 1;

  return (
    <View
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={[styles.crop, { aspectRatio: crop.width / crop.height, borderRadius }]}
    >
      {containerWidth > 0 ? (
        <Image
          resizeMode="stretch"
          source={source}
          style={{
            height: sourceHeight * scale,
            left: -crop.x * scale,
            position: 'absolute',
            top: -crop.y * scale,
            width: sourceWidth * scale,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ crop: { overflow: 'hidden', width: '100%' } });
