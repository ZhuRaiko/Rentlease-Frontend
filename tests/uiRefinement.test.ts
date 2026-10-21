/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Source-wiring checks complement workflow tests; these do not render native UI.
function source(path: string) { return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function elements(file: ts.SourceFile, tag: string) {
  const result: Array<ts.JsxOpeningElement | ts.JsxSelfClosingElement> = [];
  const visit = (node: ts.Node) => { if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === tag) result.push(node); ts.forEachChild(node, visit); };
  visit(file); return result;
}
function attr(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
  return node.attributes.properties.find((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText() === name)?.initializer?.getText();
}
test('Login uses password visibility, keyboard focus/submit and busy controls through existing VM actions', () => {
  const file = source('src/features/authentication/views/SignInView.tsx');
  const fields = elements(file, 'AuthField'); assert.equal(fields.length, 2);
  assert.match(attr(fields[0]!, 'onSubmitEditing') ?? '', /passwordInput.current\?\.focus\(\)/);
  assert.ok(fields[1]!.attributes.properties.some(item => ts.isJsxAttribute(item) && item.name.getText() === 'allowVisibilityToggle'));
  assert.match(attr(fields[1]!, 'onSubmitEditing') ?? '', /!busy.*viewModel.submitSignIn\(\)/);
  assert.ok(fields.every(field => attr(field, 'editable') === '{!busy}'));
});
test('Tier 3 confirm is the only submit binding and Cancel uses VM Back without any write', () => {
  const file = source('src/features/user-verification/views/TierThreeVerificationView.tsx');
  const buttons = elements(file, 'AppButton');
  const submit = buttons.filter(button => attr(button, 'onPress')?.includes('vm.submit()'));
  assert.equal(submit.length, 1);
  let ancestor: ts.Node | undefined = submit[0]; let reviewOnly = false;
  while (ancestor) { if (ts.isConditionalExpression(ancestor) && ancestor.condition.getText(file) === "vm.screen === 'review'") reviewOnly = true; ancestor = ancestor.parent; }
  assert.ok(reviewOnly);
  assert.ok(buttons.some(button => attr(button, 'onPress') === "{() => vm.navigate('review')}"));
  assert.ok(buttons.some(button => attr(button, 'onPress') === '{vm.goBack}'));
});
test('ordinary Tier 2/Tier 3 refresh controls are conditional on ViewModel recovery state', () => {
  for (const path of ['VerificationOverviewView', 'VerificationStatusView', 'TierThreeVerificationView']) {
    const file = source(`src/features/user-verification/views/${path}.tsx`);
    const refresh = elements(file, 'AppButton').filter(button => attr(button, 'onPress')?.includes('.refresh()'));
    assert.equal(refresh.length, 1);
    let ancestor: ts.Node | undefined = refresh[0]; let recoveryOnly = false;
    while (ancestor) { if (ts.isConditionalExpression(ancestor) && ancestor.condition.getText(file).endsWith('.showRecovery')) recoveryOnly = true; ancestor = ancestor.parent; }
    assert.ok(recoveryOnly, path);
  }
});
