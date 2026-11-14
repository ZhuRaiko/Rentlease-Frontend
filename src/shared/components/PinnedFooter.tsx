import {useContext,type ReactNode} from 'react';
import {StyleSheet,View} from 'react-native';
import type {ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {FooterInsetContext} from './FooterInsetContext';

/**
 * The one pinned-footer look: top hairline, subtle elevation, 48dp buttons from the caller, and bottom space of max(md, inset + sm)
 * whether Android uses gesture navigation or 3 buttons. The space is the footer's own padding (max(md, inset)) plus a small gap strip,
 * so ListingWizardScaffold can keep its pinned padding contract and still reach the same total. Where the bottom navigation owns the
 * bottom edge, ScreenContainer reports an inset of 0 and no extra space is added.
 */
export const pinnedFooterStyle:ViewStyle={alignSelf:'center',width:'100%',maxWidth:412,paddingHorizontal:spacing.lg,paddingTop:spacing.sm,gap:spacing.xs,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.background,elevation:8,shadowColor:colors.ink,shadowOffset:{width:0,height:-2},shadowOpacity:0.08,shadowRadius:6};
/** The footer box. Where a bottom navigation covers the edge, its bottom padding drops to spacing.md. */
export function PinnedFooterShell({style,children}:{style:ViewStyle|ViewStyle[];children:ReactNode}){
  const covered=useContext(FooterInsetContext),flat=StyleSheet.flatten(style);
  return <View style={covered?{...flat,paddingBottom:spacing.md}:flat}>{children}</View>;
}
/** The strip below the footer that completes max(md, inset + sm). Nothing where a bottom navigation covers the edge. */
export function PinnedFooterGap({style}:{style:ViewStyle}){
  return useContext(FooterInsetContext)?null:<View style={style}/>;
}
export function PinnedFooter({children}:{children:ReactNode}){
  const inset=useSafeAreaInsets().bottom,padding=Math.max(spacing.md,inset),gap=Math.max(spacing.md,inset+spacing.sm)-padding;
  return <><PinnedFooterShell style={[pinnedFooterStyle,{paddingBottom:padding}]}>{children}</PinnedFooterShell>{gap>0?<PinnedFooterGap style={{height:gap,backgroundColor:colors.background}}/>:null}</>;
}
