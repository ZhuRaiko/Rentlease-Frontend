/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

const ACCOUNT = '00000000-0000-4000-8000-000000000001';

function renderHome(accountId: string | undefined, overview: unknown) {
  const file = resolve('src/features/ratings-reports/views/RatingsReportsHomeView.tsx'), mod = {exports: {} as any};
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (key === 'react-native') return new Proxy({StyleSheet: {create: (x: any) => x}}, {get: (x: any, k) => x[k] ?? k});
    if (key.endsWith('/useReviewsOverview')) return {useReviewsOverview: () => ({data: overview, busy: false, error: null, refresh() {}})};
    if (key.endsWith('/models/ReviewsOverview')) return require('../src/shared/models/ReviewsOverview');
    if (key.endsWith('/colors')) return {colors: {}};
    if (key.endsWith('/ui')) return {ui: {}};
    if (key.endsWith('/radius')) return {radius: {}};
    if (key.endsWith('/spacing')) return {spacing: {}};
    return new Proxy({}, {get: (_x, k) => String(k)}); // every other import is a stand-in element named after itself
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText)(mock, mod, mod.exports);
  return mod.exports.RatingsReportsHomeView({accountId, onClose() {}, viewModel: {notice: null, startReview() {}, navigate() {}}, onReviewProperty() {}});
}
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
const text = (n: any) => [n.props?.children].flat(Infinity).filter(c => typeof c === 'string').join('');
const overview = {waiting: [{tenancyId: 'a', title: 'Condo', ended: '2027-02-17'}], reviews: [], stays: 1};

test('the participant list is back, as its own section below the new sections, for the signed-in user (kind "user", read-only)', () => {
  const all = nodes(renderHome(ACCOUNT, overview));
  const list = all.findIndex(n => n.type === 'PublishedRentalReviews');
  assert.ok(list >= 0, 'the list is on the screen');
  const props = all[list].props;
  assert.deepEqual([props.kind, props.targetId, props.accountId], ['user', ACCOUNT, ACCOUNT]);
  const order = (label: string) => all.findIndex(n => n.type === 'Text' && text(n) === label);
  assert.ok(order('Report a concern') >= 0 && order('Report a concern') < list, 'below Report a concern, so below the waiting card and Your reviews as well');
  assert.ok(all.findIndex(n => n.type === 'AppButton' && n.props.label === 'Review this property') < list);
});

test('signed out: no participant list is asked for', () => {
  assert.ok(!nodes(renderHome(undefined, null)).some(n => n.type === 'PublishedRentalReviews'));
});

test('the screen itself offers no way to rate a tenant: only the property review and the list of completed rentals', () => {
  const labels = nodes(renderHome(ACCOUNT, overview)).filter(n => n.type === 'AppButton').map(n => n.props.label);
  assert.deepEqual(labels, ['Review this property']);
  assert.ok(!nodes(renderHome(ACCOUNT, overview)).some(n => n.type === 'TenancyReviewPanel' || n.type === 'TenancyReviewChooser'));
});
