/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { authInputIdentity } from '../src/features/authentication/models/authInputPresentation';
import { initialRegistrationDraft } from '../src/features/authentication/models/AuthProfile';
import { validateRegistrationStep } from '../src/features/authentication/viewModels/registrationFlow';

function source(path: string) { return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function attributes(file: ts.SourceFile, tag: string, name: string) {
  const result: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === tag) for (const prop of node.attributes.properties) if (ts.isJsxAttribute(prop) && prop.name.getText(file) === name) result.push(prop.initializer?.getText(file) ?? 'true');
    ts.forEachChild(node, visit);
  }; visit(file); return result;
}
test('Email and the two password inputs cannot share a native identity or inherited email keyboard flags', () => {
  const identities = [authInputIdentity('Email address', false), authInputIdentity('Password', true), authInputIdentity('Confirm password', true)];
  assert.equal(new Set(identities).size, 3);
  const file = source('src/features/authentication/components/AuthField.tsx');
  const key = attributes(file, 'TextInput', 'key')[0] ?? '';
  assert.match(key, /authInputIdentity\(label, !!inputProps.secureTextEntry\)/); assert.doesNotMatch(key, /visible/);
  assert.deepEqual(attributes(file, 'TextInput', 'keyboardType'), ["{inputProps.secureTextEntry ? 'default' : inputProps.keyboardType}"]);
});
test('visibility starts hidden and toggles only its own flag without writing or clearing controlled values', () => {
  const file = source('src/features/authentication/components/AuthField.tsx');
  assert.match(file.text, /\[visible, setVisible\] = useState\(false\)/);
  assert.deepEqual(attributes(file, 'TextInput', 'secureTextEntry'), ['{!!inputProps.secureTextEntry && !visible}']);
  const toggle = attributes(file, 'Pressable', 'onPress')[0] ?? '';
  assert.match(toggle, /setVisible\(current => !current\)/); assert.doesNotMatch(toggle, /onChangeText|register|submit|navigate/);
  const values = Object.freeze({ ...initialRegistrationDraft, password: 'example-password', confirmPassword: 'example-password' });
  assert.equal(validateRegistrationStep('registrationPassword', values), null);
  assert.ok(validateRegistrationStep('registrationPassword', { ...values, confirmPassword: 'different' }));
  assert.equal(values.password, 'example-password'); assert.equal(values.confirmPassword, 'example-password');
});
test('Admin Dashboard is neutral and only offers recovery in actual error/uncertain-review states', () => {
  const file = source('src/features/admin-moderation/views/AdminDashboardView.tsx');
  assert.deepEqual(attributes(file, 'AdminScaffold', 'title'), ['"Admin Dashboard"']);
  assert.doesNotMatch(file.text, /Good morning|Refresh verifications/);
  const refresh = attributes(file, 'AppButton', 'onPress').filter(value => value.includes('refreshVerification'));
  assert.equal(refresh.length, 1);
  let recoveryOnly = false;
  const visit = (node: ts.Node) => { if (ts.isConditionalExpression(node) && node.condition.getText(file) === 'viewModel.dashboardNeedsRecovery' && node.whenTrue.getText(file).includes('refreshVerification')) recoveryOnly = true; ts.forEachChild(node, visit); }; visit(file); assert.ok(recoveryOnly);
  const vm = readFileSync('src/features/admin-moderation/viewModels/useAdminModerationViewModel.ts', 'utf8');
  assert.match(vm, /dashboardNeedsRecovery: !verification.reviewBusy && \(verification.status === 'error' \|\| verification.reviewNeedsRefresh\)/);
});
test('first marketplace entry waits for the device marker check; only explicit completion persists done', () => {
  const app = readFileSync('App.tsx', 'utf8');
  assert.match(app, /canEnterMarketplace = workspaceDestination === 'discovery' && !auth.matchingIntroductionGate/);
  assert.match(app, /await auth.completeMatchingIntroduction\(\)/);
  const vm = readFileSync('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts', 'utf8');
  const home = vm.slice(vm.indexOf('const openHome ='), vm.indexOf('const openSavedListings ='));
  assert.doesNotMatch(home, /onIntroductionComplete/);
  assert.match(vm, /const skipMatchingIntroduction = async/); assert.match(vm, /if \(!await finishIntroduction\(\)\) return/);
});
