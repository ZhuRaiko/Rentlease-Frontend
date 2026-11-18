import type { WebView } from 'react-native-webview';

type WebViewComponent = typeof WebView;

/**
 * The WebView component, or null when this build does not have the react-native-webview native module (for example a dev build made before the package was added).
 * The package throws while it is being required when its native module is missing, so requiring it here, in a try/catch, is the check. The result is remembered.
 */
let cached: WebViewComponent | null | undefined;
export function roomTourWebView(): WebViewComponent | null {
  if (cached !== undefined) return cached;
  try {
    const module = require('react-native-webview') as { WebView?: WebViewComponent };
    cached = module.WebView ?? null;
  } catch { cached = null; }
  return cached;
}
