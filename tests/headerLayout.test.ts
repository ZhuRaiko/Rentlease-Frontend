/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

for (const path of ['src/features/user-verification/components/VerificationScaffold.tsx', 'src/features/authentication/components/AuthScaffold.tsx']) {
test(`${path}: navigation remains outside the scrolling body and delegates safe areas to its flow`, () => {
  const scaffold = readFileSync(path, 'utf8');
  const scrollStart = scaffold.indexOf('<ScrollView');
  const scrollEnd = scaffold.indexOf('</ScrollView>');
  assert.ok(scaffold.indexOf('<ScreenHeader') < scrollStart, 'Back/Close must not scroll out of the safe viewport');
  assert.doesNotMatch(scaffold.slice(scrollStart, scrollEnd), /<ScreenHeader/);
  assert.doesNotMatch(scaffold, /SafeAreaView|useSafeAreaInsets|StatusBar.currentHeight/);
  assert.match(scaffold, /onBack=\{onBack\}/);
});
}
