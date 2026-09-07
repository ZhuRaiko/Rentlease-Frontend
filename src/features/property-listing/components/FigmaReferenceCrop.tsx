import { ReferenceImageCrop } from '../../../shared/components/ReferenceImageCrop';

const listingReference = require('../../../assets/property-listing/listing-detail-reference.png');

const sourceWidth = 229;
const sourceHeight = 878;

interface FigmaReferenceCropProps {
  crop: { x: number; y: number; width: number; height: number };
  borderRadius?: number;
}

export function FigmaReferenceCrop({ crop, borderRadius = 0 }: FigmaReferenceCropProps) {
  return (
    <ReferenceImageCrop
      borderRadius={borderRadius}
      crop={crop}
      source={listingReference}
      sourceHeight={sourceHeight}
      sourceWidth={sourceWidth}
    />
  );
}
