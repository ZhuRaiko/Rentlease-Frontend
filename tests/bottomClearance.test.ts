/// <reference types="node" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

/** Runs the real hook with the system inset replaced by a value. */
function clearance(inset: number): number {
  const file = resolve('src/shared/components/useBottomClearance.ts'), mod = {exports: {} as any};
  const stubs: Record<string, unknown> = {
    'react-native-safe-area-context': {useSafeAreaInsets: () => ({bottom: inset, top: 0, left: 0, right: 0})},
    '../theme/spacing': {spacing: {lg: 24, xl: 32}},
  };
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  new Function('require', 'module', 'exports', js)((key: string) => stubs[key], mod, mod.exports);
  return mod.exports.useBottomClearance();
}
test('the end of a scroll clears a 48dp navigation bar even when the host reports no inset', () => {
  assert.equal(clearance(0), 24 + 32);
  assert.equal(clearance(20), 24 + 32);
});
test('a larger system inset is added in full', () => {
  assert.equal(clearance(48), 24 + 48);
  assert.equal(clearance(34), 24 + 34);
});
