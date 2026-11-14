import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ui} from '../../../shared/theme/ui';
import type {ScrollView as NativeScrollView} from 'react-native';
import {KeyboardAwareScrollView as ScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import { useState, type PropsWithChildren, type RefObject, type ReactNode } from 'react';
import { Image, Pressable,  StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import type { EditorMenuItem } from '../models/UnfinishedPostMenu';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { pinnedFooterStyle, PinnedFooterGap, PinnedFooterShell } from '../../../shared/components/PinnedFooter';

const chevronIcon = require('../../../assets/verification/chevron-right.png');

interface ListingWizardScaffoldProps extends PropsWithChildren {
  onClose: () => void;
  onBack?: () => void;
  onNext?: () => void;
  step?: 1 | 2 | 3 | 4 | 5;
  stepLabel?: string;
  title?: string;
  description?: string;
  footer?:ReactNode;
  progress?:ReactNode;
  /** Header overflow menu (posting editor): leave the editor, delete an unfinished post. */
  menu?:EditorMenuItem[]|undefined;
  formFocus?:{scrollRef:RefObject<NativeScrollView|null>;contentRef:RefObject<View|null>};
}

export function ListingWizardScaffold({
  children,
  onClose,
  onBack,
  onNext,
  step,
  stepLabel,
  title,
  description, formFocus, footer, progress, menu,
}: ListingWizardScaffoldProps) {
  const insets=useSafeAreaInsets();
  const [menuOpen,setMenuOpen]=useState(false);
  const scroll = (
    <ScrollView
      style={[footer?styles.scrollArea:undefined,progress?{backgroundColor:colors.canvas}:null]}
      ref={formFocus?.scrollRef}
      contentContainerStyle={[styles.scrollContent,progress&&!footer?{paddingBottom:Math.max(spacing.xl,insets.bottom)}:null]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View collapsable={false} ref={formFocus?.contentRef}>
      <View style={[styles.topBar,progress?{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:56}:null]}>
        <Pressable
          accessibilityLabel={onBack ? 'Back' : 'Close'}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBack ?? onClose}
          style={progress?{minHeight:48,minWidth:48,justifyContent:'center'}:styles.closeButton}
        >
          {progress?<Text style={ui.body}>Back</Text>:<><View style={[styles.closeLine, styles.closeLineOne]} /><View style={[styles.closeLine, styles.closeLineTwo]} /></>}
        </Pressable>
        {progress&&title?<Text accessibilityRole="header" style={styles.barTitle}>{title}</Text>:null}
        {progress&&menu?.length?<Pressable accessibilityRole="button" accessibilityLabel="More options" accessibilityState={{expanded:menuOpen}} onPress={()=>setMenuOpen(open=>!open)} style={styles.menuButton}><Text style={ui.sectionTitle}>{'⋯'}</Text></Pressable>:null}
        {progress?<Pressable accessibilityRole="button" accessibilityLabel="Close posting" onPress={onClose} style={{minHeight:48,minWidth:48,justifyContent:'center'}}><Text style={ui.supporting}>Close</Text></Pressable>:null}
      </View>
      {menuOpen&&menu?.length?<View style={styles.menu}>{menu.map(entry=><View key={entry.key}><Pressable accessibilityRole="button" accessibilityState={{disabled:!!entry.disabled}} disabled={entry.disabled} onPress={()=>{setMenuOpen(false);entry.onPress();}} style={styles.menuItem}><Text style={[ui.body,entry.danger&&styles.menuDanger,entry.disabled&&styles.menuDisabled]}>{entry.label}</Text></Pressable>{entry.note?<Text style={[ui.supporting,styles.menuNote]}>{entry.note}</Text>:null}</View>)}</View>:null}
      {progress}
      {step ? (
        <>
          <View style={styles.progressTrack}>
            {[1, 2, 3, 4, 5].map((segment) => (
              <View
                key={segment}
                style={[styles.progressSegment, segment <= step && styles.progressSegmentActive]}
              />
            ))}
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>Step {step} of 5 — {stepLabel}</Text>
            {onNext ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={onNext}
                style={styles.nextButton}
              >
                <Text style={styles.nextLabel}>Next</Text>
                <Image resizeMode="contain" source={chevronIcon} style={styles.chevron} />
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
      <View style={styles.content}>
        {title&&!progress ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <View style={styles.body}>{children}</View>
      </View>
      </View>
    </ScrollView>
  );
  // Pinned footer: the shared look; bottom space = max(md, inset + sm) = this padding plus the gap strip below it.
  const pad=Math.max(spacing.md,insets.bottom),gap=Math.max(spacing.md,insets.bottom+spacing.sm)-pad;
  return footer?<View style={styles.frame}>{scroll}<PinnedFooterShell style={[pinnedFooterStyle,{paddingBottom:pad}]}>{footer}</PinnedFooterShell>{gap>0?<PinnedFooterGap style={{height:gap,backgroundColor:colors.background}}/>:null}</View>:scroll;
}

const styles = StyleSheet.create({
  frame:{flex:1},scrollArea:{flex:1},
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  menuButton:{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'},
  menu:{...ui.panel,marginHorizontal:spacing.lg,overflow:'hidden'},
  menuItem:{minHeight:48,justifyContent:'center',paddingHorizontal:spacing.md},
  menuDanger:{color:colors.restricted,fontWeight:'600'},menuDisabled:{opacity:0.6},
  menuNote:{paddingHorizontal:spacing.md,paddingBottom:spacing.sm},
  barTitle: { ...ui.sectionTitle, flex: 1, textAlign: 'center', paddingHorizontal: spacing.xs },
  topBar: { height: 62, justifyContent: 'center', paddingHorizontal: spacing.lg },
  closeButton: { height: 28, justifyContent: 'center', width: 28 },
  closeLine: {
    backgroundColor: colors.textMuted,
    height: 1.5,
    left: 4,
    position: 'absolute',
    width: 18,
  },
  closeLineOne: { transform: [{ rotate: '45deg' }] },
  closeLineTwo: { transform: [{ rotate: '-45deg' }] },
  progressTrack: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg },
  progressSegment: { backgroundColor: colors.border, flex: 1, height: 2 },
  progressSegmentActive: { backgroundColor: colors.primarySoft },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  stepLabel: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: '700',
  },
  nextButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  nextLabel: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  chevron: { height: 13, width: 13 },
  content: { alignSelf: 'center', maxWidth: 412, paddingHorizontal: spacing.lg, width: '100%' },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
    marginTop: spacing.lg,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  body: { gap: spacing.md, marginTop: spacing.lg },
});
