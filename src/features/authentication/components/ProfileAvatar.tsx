import { useWindowDimensions, type ImageSourcePropType } from 'react-native';
import {PublicAvatar} from '../../../shared/components/PublicIdentityBadge';
import { profileAvatarDiameter } from '../models/accountPresentation';

/** Presentation only. Photo sources must be supplied by an existing approved integration. */
export function ProfileAvatar({ initials, source }: { initials: string; source?: ImageSourcePropType }) {
  const { fontScale } = useWindowDimensions();
  const diameter = profileAvatarDiameter(fontScale);
  return <PublicAvatar size={diameter} url={source&&typeof source==='object'&&!Array.isArray(source)&&'uri' in source?source.uri:null}/>;
}
