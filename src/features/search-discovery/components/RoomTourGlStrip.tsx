import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { panoramaSideLabel, type PanoramaSide, type PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';
import { GL_READY_TIMEOUT_MS } from '../viewModels/roomTourGlGeometry';
import { glNudgeCommand, glReducedMotionCommand, glSetSideCommand, parseGlMessage } from '../viewModels/roomTourGlBridge';
import { buildRoomTourGlHtml } from '../viewModels/roomTourGlHtml';
import type { Edge } from '../viewModels/roomTourMotion';
import { roomTourWebView } from './roomTourWebView';

export interface RoomTourGlStripProps {
  panorama: PublicPropertyPanorama;
  /** The end the CURRENT side is entered at (a wrap enters at the end opposite to the one left through). Read when the side changes. */
  entry: Edge;
  reduceMotion: boolean;
  /** The first frame of this side has drawn. */
  onReady: (side: PanoramaSide) => void;
  /** Position across the photo, 0 to 1, at most about 30 times a second. */
  onPosition: (t: number) => void;
  /** The GL viewer cannot be used (missing module, no first frame in time, an error): the viewer switches to the flat strip for the rest of the session. */
  onUnavailable: (reason: string) => void;
  onPull?: (edge: Edge, dp: number) => void;
  onRelease?: (edge: Edge, dp: number) => void;
}

/** Any render failure inside the GL strip (including a missing native view) becomes "unavailable", never a crash or an error message. */
class GlBoundary extends Component<{ onFail: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail('render error'); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * The WebGL strip: a transparent WebView that draws the photo on the inside of a cylinder (see roomTourGlHtml.ts). Pure plumbing: it builds the page once, sends side and
 * reduced-motion changes with injectJavaScript, validates every message from the page (roomTourGlBridge.ts) and reports ready, position, pull, release and failure.
 * The page cannot navigate anywhere, has no storage and no file access, and only ever receives this project's public panorama URLs.
 */
export function RoomTourGlStrip(props: RoomTourGlStripProps) {
  const WebView = roomTourWebView();
  const { onUnavailable } = props;
  useEffect(() => { if (!WebView) onUnavailable('webview module missing'); }, [WebView, onUnavailable]);
  if (!WebView) return null;
  return <GlBoundary onFail={onUnavailable}><GlStripInner {...props} /></GlBoundary>;
}

function GlStripInner({ panorama, entry, reduceMotion, onReady, onPosition, onUnavailable, onPull, onRelease }: RoomTourGlStripProps) {
  const WebView = roomTourWebView()!;
  const ref = useRef<InstanceType<ReturnType<typeof roomTourWebView> & object> | null>(null);
  const first = useRef(panorama);   // the page is built once, for the first side; later sides are sent as commands
  const [html] = useState(() => { try { return buildRoomTourGlHtml({ imageUrl: first.current.url, aspect: first.current.width / first.current.height, reducedMotion: reduceMotion, entry }); } catch { return null; } });
  const shown = useRef(panorama.url);
  const [waiting, setWaiting] = useState<string | null>(panorama.url);   // the url whose first frame we are waiting for
  const send = useCallback((script: string | null) => { if (script) ref.current?.injectJavaScript(script); else onUnavailable('command rejected'); }, [onUnavailable]);
  useEffect(() => { if (!html) onUnavailable('page not built'); }, [html, onUnavailable]);
  useEffect(() => {
    if (panorama.url === shown.current) return;
    shown.current = panorama.url; setWaiting(panorama.url);
    send(glSetSideCommand(panorama.url, panorama.width / panorama.height, entry));
  }, [panorama.url, panorama.width, panorama.height, entry, send]);
  useEffect(() => { ref.current?.injectJavaScript(glReducedMotionCommand(reduceMotion)); }, [reduceMotion]);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => onUnavailable('no first frame in time'), GL_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting, onUnavailable]);
  if (!html) return null;
  const side = panorama.side;
  return <View accessible accessibilityLabel={`${panoramaSideLabel[side]} room tour. Swipe or use the scroll actions to look around.`} accessibilityActions={[{ name: 'increment', label: 'Look right' }, { name: 'decrement', label: 'Look left' }]}
    onAccessibilityAction={event => ref.current?.injectJavaScript(glNudgeCommand(event.nativeEvent.actionName === 'increment' ? 1 : -1))} style={styles.fill}>
    <WebView
      ref={ref} source={{ html, baseUrl: 'about:blank' }} originWhitelist={['about:blank']} style={styles.web} containerStyle={styles.web}
      javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} mixedContentMode="never" scrollEnabled={false} bounces={false} overScrollMode="never"
      setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} androidLayerType="hardware" automaticallyAdjustContentInsets={false}
      onShouldStartLoadWithRequest={request => request.url.startsWith('about:')}
      onMessage={event => {
        const message = parseGlMessage(event.nativeEvent.data);
        if (!message) return;
        if (message.type === 'ready') { setWaiting(null); onReady(shown.current === first.current.url ? first.current.side : panorama.side); }
        else if (message.type === 'error') onUnavailable(message.reason);
        else if (message.type === 'position') onPosition(message.t);
        else if (message.type === 'pull') onPull?.(message.edge, message.dp);
        else onRelease?.(message.edge, message.dp);
      }}
      onError={() => onUnavailable('webview error')} onHttpError={() => onUnavailable('webview http error')} onRenderProcessGone={() => onUnavailable('render process gone')} />
  </View>;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill as object },
  web: { flex: 1, backgroundColor: 'transparent' },
});
