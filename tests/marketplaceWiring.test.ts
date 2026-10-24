/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Integration wiring checks, not native interaction tests.
function source(path: string) { return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function attributes(file: ts.SourceFile, name: string) {
  const result: string[] = [];
  const visit = (node: ts.Node) => { if (ts.isJsxAttribute(node) && node.name.getText(file) === name && node.initializer) result.push(node.initializer.getText(file)); ts.forEachChild(node, visit); }; visit(file); return result;
}
function functionBody(file: ts.SourceFile, name: string) {
  let body = '';
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(file) === name && node.initializer && ts.isArrowFunction(node.initializer)) body = node.initializer.body.getText(file); ts.forEachChild(node, visit); }; visit(file); return body;
}
test('all root toolbar consumers receive Landlord membership, not preferred UI mode', () => {
  const file = source('App.tsx'); const values = attributes(file, 'isLandlord');
  assert.equal(values.length, 6); assert.ok(values.every(value => value === '{auth.hasLandlordRole}'));
  assert.equal(attributes(file, 'onSwitchRole').length, 0);
  assert.match(file.text, /marketplaceNavigation=/);
  assert.match(functionBody(file, 'openDiscovery'), /setPreferredRole\(auth.hasTenantRole \? 'tenant' : 'landlord'\)/);
  assert.match(functionBody(file, 'openProperties'), /propertiesWorkspace\(access, initialScreen\)/);
});
test('root Android Back delegates to feature actions, and listing Close/tab exits use the ViewModel guard', () => {
  const app = source('App.tsx'); assert.ok(attributes(app, 'onRequestClose').some(value => value.includes('registered.action()')));
  const listing = source('src/features/property-listing/views/PropertyListingFlowView.tsx');
  for (const name of ['onChat', 'onDiscover', 'onTenancy']) assert.ok(attributes(listing, name).some(value => value.includes('viewModel.requestNavigation(')));
  assert.match(functionBody(listing, 'close'), /viewModel.requestNavigation\(onClose\)/);
  const discovery = source('src/features/search-discovery/views/SearchDiscoveryFlowView.tsx');
  assert.match(functionBody(discovery, 'close'), /viewModel.closeFromWorkspace\(onClose\)/);
  const vm = source('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts');
  assert.match(functionBody(vm, 'closeFromWorkspace'), /navigation.requestNavigation\(introductionPending/);
  assert.match(functionBody(vm, 'closeFromWorkspace'), /skipMatchingIntroduction\(\)/);
});
test('preference Skip and discarded internal Back restore the saved snapshot without saving or external calls', () => {
  const file = source('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts');
  for (const name of ['openHome', 'goBack']) {
    const body = functionBody(file, name);
    assert.match(body, /setMatchingPreferences\(savedPreferences.current\)/);
    assert.doesNotMatch(body, /onSavePreferences|fetch\(|supabase/);
  }
  assert.match(functionBody(file, 'saveMatchingPreferences'), /options.onSavePreferences\?\.\(matchingPreferences\)/);
});
test('navigation changes preserve backend boundaries and feature isolation', () => {
  for (const path of ['App.tsx', 'src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts', 'src/features/property-listing/views/PropertyListingFlowView.tsx', 'src/features/search-discovery/views/SearchDiscoveryFlowView.tsx']) {
    const file = source(path);
    const imports = file.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text);
    if (path !== 'App.tsx') assert.ok(imports.every(value => !value.includes('/features/') || !value.includes('/viewModels/')), path);
    assert.ok(imports.every(value => !value.includes('/supabase')), path);
    if (path.endsWith('.tsx')) assert.ok(imports.every(value => !value.includes('/services/')), path);
    else assert.ok(imports.filter(value => value.includes('/services/')).every(value => path.includes('property-listing') && ['../services/propertyCreationDependencies', '../services/propertyPhotoDependencies', '../services/listingDraftDependencies'].includes(value)), path);
  }
});
