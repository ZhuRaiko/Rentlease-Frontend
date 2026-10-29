import { FullscreenDocumentImage } from '../../../shared/components/FullscreenDocumentImage';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
export function PropertyMediaViewer({ viewModel: vm }: { viewModel: PropertyListingViewModel }) {
  const index = vm.photoState.activeMediaIndex, item = vm.mediaItems[index];
  return <FullscreenDocumentImage visible={vm.photoState.mediaViewerOpen && !!item} uri={item?.uri ?? null}
    title={`Photo ${index + 1} of ${vm.mediaItems.length}`} description={item?.status ?? ''} onClose={vm.propertyPhotos.closeMedia}
    {...(index > 0 ? { onPrevious: vm.propertyPhotos.previousMedia } : {})}
    {...(index < vm.mediaItems.length - 1 ? { onNext: vm.propertyPhotos.nextMedia } : {})} />;
}
