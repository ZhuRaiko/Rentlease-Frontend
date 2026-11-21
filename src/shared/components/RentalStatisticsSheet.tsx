import {useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme/colors';
import {radius} from '../theme/radius';
import {spacing} from '../theme/spacing';
import {ui} from '../theme/ui';
import {SHEET_COPY,statisticsView,type AskingMarker,type StatisticsInput,type StatisticsView} from '../models/RentalStatistics';

type Tab='works'|'stats';
/**
 * The one "Statistical analysis" sheet, opened from every place the price estimate shows. A pinned header (title, one line, Close) and two tabs stay in view while the
 * body scrolls. The Close button, the Android back gesture and a tap outside the sheet all close it. The exact estimate and exact band show only here, and only when
 * the app has them; the accuracy sections never depend on them and nothing is ever invented.
 */
export function RentalStatisticsSheet({visible,input,onClose}:{visible:boolean;input:StatisticsInput;onClose:()=>void}){
  const insets=useSafeAreaInsets(),{fontScale}=useWindowDimensions(),[tab,setTab]=useState<Tab>('stats');
  // At large text sizes the pinned header would take about half of a small screen, so the one-line description scrolls with the content; the title, Close and tabs stay pinned.
  const large=fontScale>=1.3;
  useEffect(()=>{if(visible)setTab('stats');},[visible]);
  const view=statisticsView(input);
  if(!visible||!view)return null;
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close statistical analysis" style={StyleSheet.absoluteFill} onPress={onClose}/>
      <View accessibilityViewIsModal style={styles.sheet}>
        <View accessible={false} style={styles.grab}/>
        <View style={styles.head}>
          <View style={styles.headText}><Text accessibilityRole="header" style={styles.title}>{SHEET_COPY.title}</Text>{large?null:<Text style={ui.supporting}>{SHEET_COPY.subtitle}</Text>}</View>
          <Pressable accessibilityRole="button" accessibilityLabel={SHEET_COPY.close} onPress={onClose} style={styles.close}><Text accessible={false} style={styles.closeText}>{`✕ ${SHEET_COPY.close}`}</Text></Pressable>
        </View>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['works','stats'] as const).map(key=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:tab===key}} onPress={()=>setTab(key)} style={[styles.tab,tab===key&&styles.tabOn]}><Text style={[styles.tabText,tab===key&&styles.tabTextOn]}>{SHEET_COPY.tabs[key]}</Text></Pressable>)}
        </View>
        <View style={styles.rule}/>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.body,{paddingBottom:spacing.lg+insets.bottom}]}>
          {large?<Text style={ui.supporting}>{SHEET_COPY.subtitle}</Text>:null}
          {tab==='works'?<HowItWorks/>:<Statistics view={view} stacked={large}/>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function HowItWorks(){
  return <>
    {SHEET_COPY.steps.map((step,i)=><View key={step.title} style={[styles.card,styles.step]}>
      <View accessible={false} style={styles.stepNumber}><Text style={styles.stepNumberText}>{i+1}</Text></View>
      <View style={styles.grow}><Text style={styles.cardTitle}>{step.title}</Text><Text style={ui.body}>{step.text}</Text></View>
    </View>)}
    <Text style={ui.supporting}>{SHEET_COPY.worksNote}</Text>
  </>;
}

function Statistics({view,stacked}:{view:StatisticsView;stacked:boolean}){
  const {exact,band,accuracy,compare}=view;
  return <>
    {exact?<View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{SHEET_COPY.exactTitle}</Text>
      <Text style={ui.body}>{exact.intro}<Text style={styles.bold}>{exact.estimate}</Text>{exact.suffix}</Text>
    </View>:null}
    {band?<View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{SHEET_COPY.bandTitle}</Text>
      <View accessible accessibilityRole="image" accessibilityLabel={band.label}><BandGraphic estimateFraction={band.estimateFraction} marker={band.marker}/></View>
      <View style={styles.points}>
        <View style={[styles.point,styles.pointStart]}><Text style={styles.pointValue}>{band.low}</Text><Text style={ui.supporting}>{SHEET_COPY.bandLow}</Text></View>
        <View style={[styles.point,styles.pointCenter]}><Text style={[styles.pointValue,styles.pointValueGreen]}>{band.mid}</Text><Text style={ui.supporting}>{SHEET_COPY.bandMid}</Text></View>
        <View style={[styles.point,styles.pointEnd]}><Text style={styles.pointValue}>{band.high}</Text><Text style={ui.supporting}>{SHEET_COPY.bandHigh}</Text></View>
      </View>
      <Text style={ui.supporting}>{SHEET_COPY.bandNote}</Text>
    </View>:null}
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{SHEET_COPY.accuracyTitle}</Text>
      <View style={[styles.bigRow,stacked&&styles.bigStacked]}><Text style={styles.bigPercent}>{accuracy.percent}</Text><Text style={[ui.body,styles.bigText]}>{accuracy.sentence}</Text></View>
      <View style={styles.tiles}>{accuracy.tiles.map(t=><View key={t.label} style={styles.tile}><Text style={styles.tileValue}>{t.value}</Text><Text style={ui.supporting}>{t.label}</Text></View>)}</View>
      {accuracy.note?<View accessibilityRole="alert" style={styles.note}><Text accessible={false} style={styles.noteMark}>ⓘ</Text><Text style={[ui.body,styles.noteText]}>{accuracy.note}</Text></View>:null}
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{SHEET_COPY.compareTitle}</Text>
      <Text style={ui.supporting}>{SHEET_COPY.compareSub}</Text>
      <CompareBar label={SHEET_COPY.compareMedian} percent={compare.medianPercent} fraction={compare.medianFraction} model={false}/>
      <CompareBar label={SHEET_COPY.compareModel} percent={compare.modelPercent} fraction={compare.modelFraction} model/>
    </View>
    {/* TODO(thesis figure): "Actual versus predicted rent" scatter (thesis Figure 5.1.5). Omitted on purpose: no placeholder ships; add the real figure here when it is provided. */}
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{SHEET_COPY.keepTitle}</Text>
      {SHEET_COPY.keep.map(line=><View key={line} style={styles.bullet}><View accessible={false} style={styles.bulletDot}/><Text style={[ui.body,styles.grow]}>{line}</Text></View>)}
    </View>
    <Text style={ui.supporting}>{SHEET_COPY.source}</Text>
  </>;
}

/** The exact band as a bar with its two ends, the estimate, and the asking price as a dot (clamped to the edge, and labeled, when it is outside the band). */
function BandGraphic({estimateFraction,marker}:{estimateFraction:number;marker:AskingMarker|null}){
  const pct=(f:number)=>`${Math.min(1,Math.max(0,f))*100}%` as `${number}%`;
  return <View style={styles.bandWrap}>
    {marker?<Text style={[styles.markerLabel,marker.align==='start'?styles.alignStart:marker.align==='end'?styles.alignEnd:styles.alignCenter]}>{marker.label}</Text>:null}
    <View style={styles.bandTrack}>
      <View style={styles.bandRail}/>
      <View style={[styles.bandEnd,{left:0}]}/>
      <View style={[styles.bandEnd,{right:0}]}/>
      <View style={[styles.estimateTick,{left:pct(estimateFraction)}]}/>
      {marker?<View testID="asking-dot" style={[styles.askingDot,{left:pct(marker.fraction)}]}/>:null}
    </View>
  </View>;
}
function CompareBar({label,percent,fraction,model}:{label:string;percent:string;fraction:number;model:boolean}){
  return <View accessible accessibilityLabel={`${label}: ${percent}`} style={styles.compare}>
    <View style={styles.compareHead}><Text style={[ui.body,model&&styles.bold,styles.grow]}>{label}</Text><Text style={[ui.body,styles.bold,model&&styles.green]}>{percent}</Text></View>
    <View style={styles.barTrack}><View style={[styles.barFill,model?styles.barModel:styles.barMedian,{width:`${Math.min(1,Math.max(0,fraction))*100}%`}]}/></View>
  </View>;
}

const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay},
  sheet:{maxHeight:'92%',paddingTop:spacing.sm,gap:spacing.sm,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:colors.background},
  grab:{alignSelf:'center',width:40,height:4,borderRadius:2,backgroundColor:colors.border},
  head:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm,paddingHorizontal:spacing.md},headText:{flex:1,flexShrink:1,gap:2},title:{...ui.sectionTitle,fontWeight:'700',fontSize:20,lineHeight:26},
  close:{minHeight:48,minWidth:48,paddingHorizontal:spacing.sm,justifyContent:'center',alignItems:'center',borderRadius:radius.pill,borderWidth:1,borderColor:colors.outline,backgroundColor:colors.background},closeText:{...ui.body,fontWeight:'700'},
  tabs:{flexDirection:'row',marginHorizontal:spacing.md,padding:4,borderRadius:radius.pill,backgroundColor:colors.primaryPale},
  tab:{flex:1,minHeight:48,paddingHorizontal:spacing.xs,justifyContent:'center',alignItems:'center',borderRadius:radius.pill},tabOn:{backgroundColor:colors.ink},tabText:{...ui.body,fontWeight:'600',textAlign:'center'},tabTextOn:{color:colors.white,fontWeight:'700'},
  rule:{height:1,backgroundColor:colors.outline},scroll:{flexShrink:1},body:{padding:spacing.md,gap:spacing.sm},grow:{flex:1,flexShrink:1},
  card:{padding:spacing.md,gap:spacing.sm,borderRadius:radius.card,backgroundColor:colors.canvas},cardTitle:{...ui.sectionTitle,fontWeight:'700'},bold:{fontWeight:'700'},green:{color:colors.primaryAction},
  step:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},stepNumber:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:colors.primaryAction},stepNumberText:{...ui.body,fontWeight:'700',color:colors.white},
  bandWrap:{gap:spacing.xxs,paddingTop:spacing.xxs},markerLabel:{...ui.body,fontWeight:'700'},alignStart:{textAlign:'left'},alignCenter:{textAlign:'center'},alignEnd:{textAlign:'right'},
  bandTrack:{height:36,marginHorizontal:2,justifyContent:'center'},bandRail:{height:16,borderRadius:8,backgroundColor:colors.primaryPale,borderWidth:1,borderColor:colors.outline},
  bandEnd:{position:'absolute',top:6,width:3,height:24,borderRadius:2,backgroundColor:colors.primaryAction},estimateTick:{position:'absolute',top:0,width:5,height:36,marginLeft:-2,borderRadius:3,backgroundColor:colors.primaryAction},
  askingDot:{position:'absolute',top:8,width:20,height:20,marginLeft:-10,borderRadius:10,backgroundColor:colors.ink,borderWidth:3,borderColor:colors.white},
  points:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},point:{flexGrow:1,flexBasis:96,gap:2},pointStart:{alignItems:'flex-start'},pointCenter:{alignItems:'center'},pointEnd:{alignItems:'flex-end'},
  pointValue:{...ui.body,fontWeight:'700'},pointValueGreen:{color:colors.primaryAction},
  bigRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm},bigPercent:{...ui.pageTitle,fontSize:44,lineHeight:52,fontWeight:'700',color:colors.primaryAction},bigText:{flexGrow:1,flexShrink:1,flexBasis:190},bigStacked:{flexDirection:'column',alignItems:'flex-start'},
  tiles:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},tile:{flexGrow:1,flexBasis:96,padding:spacing.sm,gap:2,borderRadius:radius.panel,borderWidth:1,borderColor:colors.outline,backgroundColor:colors.background},tileValue:{...ui.sectionTitle,fontWeight:'700'},
  note:{flexDirection:'row',alignItems:'flex-start',gap:spacing.xs,padding:spacing.sm,borderRadius:radius.panel,borderWidth:1,borderColor:colors.propertyCredentialSurface,backgroundColor:colors.warningSurface},noteMark:{...ui.body,fontWeight:'700',color:colors.propertyProofInk},noteText:{flex:1,flexShrink:1,color:colors.propertyProofInk},
  compare:{gap:spacing.xxs},compareHead:{flexDirection:'row',alignItems:'center',gap:spacing.xs},barTrack:{height:24,borderRadius:12,overflow:'hidden',backgroundColor:colors.surfaceStrong},barFill:{height:24,borderRadius:12},barMedian:{backgroundColor:colors.controlBorder},barModel:{backgroundColor:colors.primaryAction},
  bullet:{flexDirection:'row',alignItems:'flex-start',gap:spacing.xs},bulletDot:{width:8,height:8,marginTop:8,borderRadius:4,backgroundColor:colors.primaryAction},
});
