import {createContext} from 'react';
/**
 * True when a bottom navigation bar sits below the current content and already pads for the system bar, so a pinned footer must not add the
 * inset again. Read ONLY by the pinned footer components. The library's safe-area context is never overridden: useSafeAreaInsets() returns
 * the real inset everywhere, including inside the navigation bar itself.
 */
export const FooterInsetContext=createContext(false);
