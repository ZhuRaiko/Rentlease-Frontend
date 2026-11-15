import { useWindowDimensions, type ImageSourcePropType } from 'react-native';
import {PublicAvatar} from '../../../shared/components/PublicIdentityBadge';
import { profileAvatarDiameter } from '../models/accountPresentation';

/** Presentation only. Photo sources must be supplied by an existing approved integration. */
export function ProfileAvatar({ initials, source, name }: { initials: string; source?: ImageSourcePropType; name?: string | null | undefined }) {
  const { fontScale } = useWindowDimensions();
  const diameter = profileAvatarDiameter(fontScale);
  return <PublicAvatar size={diameter} name={name} url={source&&typeof source==='object'&&!Array.isArray(source)&&'uri' in source?source.uri:null}/>;
}
