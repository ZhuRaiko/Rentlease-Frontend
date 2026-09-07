import { ReferenceImageCrop } from '../../../shared/components/ReferenceImageCrop';
import type { ImageCrop } from '../models/SearchDiscovery';

const listingReference = require('../../../assets/property-listing/listing-detail-reference.png');

interface DiscoveryPropertyImageProps {
  crop: ImageCrop;
  borderRadius?: number;
}

export function DiscoveryPropertyImage({ crop, borderRadius = 0 }: DiscoveryPropertyImageProps) {
  return (
    <ReferenceImageCrop
      borderRadius={borderRadius}
      crop={crop}
      source={listingReference}
      sourceHeight={878}
      sourceWidth={229}
    />
  );
}
