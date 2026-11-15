/// <reference types="node" />
// Shared fallback stubs for the tests that transpile a View or ViewModel themselves and hand it a hand-written fake `require`.
//
// Why this exists: scripts/run-tests.cjs registers a loader for `.ts` only, so Node cannot `require` a `.tsx` component or the
// Flow-typed `react-native` source. Every shim used to carry its own list of stubs, and every new shared component or package
// broke the tests that did not know about it. A shim now keeps its test-specific stubs and ends with
//
//   const shared = sharedStub(absolute, name); if (shared) return shared; return actual(name);
//
// so anything it does not special-case is stubbed here instead of reaching the real `require`.
//
// What it stubs: `react-native`, `react-native-safe-area-context`, and any other `.tsx` module imported by the file under test.
// A `.tsx` module becomes an object whose PascalCase exports are string tags (the component name), so a rendered tree can be
// searched by `type`. Non-component exports of a `.tsx` module (hooks, helpers, constants) are NOT provided: a test that needs
// one must stub it explicitly, and gets a clear "is not a function" instead of silently wrong behavior.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const subscription = () => ({ remove() {} });
const window = { width: 411, height: 800, scale: 1, fontScale: 1 };

/** Real-shaped values for the non-component exports of `react-native` that views and hooks call. Components are string tags. */
const reactNativeBase: Record<string, unknown> = {
  StyleSheet: { create: (styles: unknown) => styles, flatten: (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)), hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} },
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
  useWindowDimensions: () => window,
  Dimensions: { get: () => window, addEventListener: subscription },
  PixelRatio: { get: () => 1, getFontScale: () => 1 },
  AccessibilityInfo: { announceForAccessibility() {}, isScreenReaderEnabled: async () => false, addEventListener: subscription },
  AppState: { currentState: 'active', addEventListener: subscription },
  Linking: { openURL: async () => {}, openSettings: async () => {}, canOpenURL: async () => false },
  Alert: { alert() {} },
  BackHandler: { addEventListener: subscription, exitApp() {} },
  Keyboard: { dismiss() {}, addListener: subscription },
};
const notAnExport = new Set(['__esModule', 'default', 'then']);
const tagged = (base: Record<string, unknown>) => new Proxy(base, {
  get: (target, key) => typeof key !== 'string' || notAnExport.has(key) ? undefined : key in target ? target[key] : key,
});

export const reactNativeStub = () => tagged({ ...reactNativeBase });

export const safeAreaStub = () => tagged({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: window.width, height: window.height }),
  initialWindowMetrics: null,
});

const exportsCache = new Map<string, Record<string, string>>();
/** PascalCase exports of a `.tsx` file, found with the TypeScript parser (the file is never executed). */
function componentExports(path: string): Record<string, string> {
  const cached = exportsCache.get(path); if (cached) return cached;
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set<string>();
  const exported = (node: ts.Node) => ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) statement.exportClause.elements.forEach(element => names.add(element.name.text));
    else if (ts.isFunctionDeclaration(statement) && exported(statement) && statement.name) names.add(statement.name.text);
    else if (ts.isClassDeclaration(statement) && exported(statement) && statement.name) names.add(statement.name.text);
    else if (ts.isVariableStatement(statement) && exported(statement)) statement.declarationList.declarations.forEach(declaration => { if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text); });
  }
  const result: Record<string, string> = {};
  for (const name of names) if (/^[A-Z]/.test(name)) result[name] = name;
  exportsCache.set(path, result);
  return result;
}

/** The `.tsx` file a relative import points at, or null. */
function tsxTarget(requestingFile: string, request: string): string | null {
  if (!request.startsWith('.')) return null;
  const base = resolve(dirname(requestingFile), request);
  for (const candidate of [`${base}.tsx`, resolve(base, 'index.tsx')]) if (existsSync(candidate)) return candidate;
  return null;
}

const samePath = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

/**
 * A stub for `request`, or undefined when the shim should fall through to the real `require`.
 * `underTest` is the file the shim is loading; its own `.tsx` is never stubbed, only the `.tsx` files it imports.
 */
export function sharedStub(underTest: string, request: string): unknown {
  if (request === 'react-native') return reactNativeStub();
  if (request === 'react-native-safe-area-context') return safeAreaStub();
  const target = tsxTarget(underTest, request);
  if (target && !samePath(target, underTest)) return componentExports(target);
  return undefined;
}
