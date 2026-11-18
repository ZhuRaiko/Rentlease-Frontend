/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {bubbleTime, dayChipBefore, dayLabel, rentingBanner} from '../src/features/messaging-viewing/models/ThreadPresentation';
import {maintenanceStrip, STRIP_LIMIT} from '../src/features/tenancy/models/ConversationMaintenance';
import type {CareContext, CareRequest} from '../src/features/tenancy/models/TenancyCare';
import type {Conversation} from '../src/features/messaging-viewing/models/PersistentMessaging';
function component(path:string,extra:Record<string,any>={}){const file=resolve(path),actual=createRequire(file),mod={exports:{} as any},slots:any[]=[];let cursor=0;const jsx=(type:any,props:any)=>({type,props});const req=(key:string):any=>extra[key]??(key==='react'?{useState:(v:any)=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],(next:any)=>slots[i]=typeof next==='function'?next(slots[i]):next];},useEffect:()=>{},useRef:()=>({current:null})}:key==='react/jsx-runtime'?{jsx,jsxs:jsx}:key==='react-native'?new Proxy({StyleSheet:{create:(v:any)=>v}},{get:(o:any,k)=>o[k]??k}):key.endsWith('/YourListingLabel')?{YourListingLabel:'YourListingLabel'}:key.endsWith('/Reporting')?{ReportAction:'ReportAction',ReportingWorkspace:'ReportingWorkspace'}:key.endsWith('/RequestWorkspaces')?{ViewingsWorkspace:'ViewingsWorkspace',ReservationsWorkspace:'ReservationsWorkspace'}:key.endsWith('/RequestManagementView')?{RequestManagementView:'RequestManagement'}:key.endsWith('/RefreshHint')?{RefreshHint:'RefreshHint'}:key.endsWith('/PublicIdentityBadge')?{PublicAvatar:'Avatar'}:key.endsWith('/PropertyPhotoThumbnail')?{PropertyPhotoThumbnail:'Thumbnail'}:key.endsWith('/FullscreenDocumentImage')?{FullscreenDocumentImage:'Gallery'}:key.endsWith('/ScreenHeader')?{ScreenHeader:'Header'}:actual(key));new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(req,mod,mod.exports);return{exports:mod.exports,render:(name:string,props:any)=>{cursor=0;return mod.exports[name](props);}};}
function nodes(tree:any,out:any[]=[]):any[]{if(Array.isArray(tree)){tree.forEach(v=>nodes(v,out));return out;}if(tree&&typeof tree==='object'){out.push(tree);nodes(tree.props?.children,out);}return out;}

const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ME = id(1), OTHER = id(2), TENANCY = id(9), CONV = id(30);
// 2026-11-18T05:00:00Z is 1:00 PM on 18 Nov in Manila.
const NOW = Date.parse('2026-11-18T05:00:00Z');

test('bubble time is Philippine time; the day chip says Today, Yesterday or a date', () => {
  assert.equal(bubbleTime('2026-11-17T17:11:00Z'), '1:11 AM');
  assert.equal(bubbleTime('2026-11-18T04:00:00Z'), '12:00 PM');
  assert.equal(dayLabel('2026-11-17T17:11:00Z', NOW), 'Today');
  assert.equal(dayLabel('2026-11-17T01:00:00Z', NOW), 'Yesterday');
  assert.equal(dayLabel('2026-11-12T01:00:00Z', NOW), 'Nov 12');
});

test('a day chip shows before the first message and whenever the day changes, never between two messages of one day', () => {
  const rows = [{createdAt: '2026-11-17T01:00:00Z'}, {createdAt: '2026-11-17T02:00:00Z'}, {createdAt: '2026-11-17T17:00:00Z'}];
  assert.deepEqual(rows.map((_, i) => dayChipBefore(rows, i, NOW)), ['Yesterday', null, 'Today']);
  assert.equal(dayChipBefore(rows, 9, NOW), null);
});

test('the green banner text: the owner sees who rents, the renter sees who the landlord is', () => {
  assert.equal(rentingBanner(true, 'Mae'), 'Mae is renting this property now');
  assert.equal(rentingBanner(false, 'Nightcity'), 'You are renting this property. Nightcity is your landlord.');
});

const req = (n: number, status: CareRequest['status'], priority = 'normal'): CareRequest => ({id: id(100 + n), title: 'Request ' + n, description: 'd'.repeat(12), category: 'plumbing', priority, status, response: null, revision: id(200 + n), createdAt: `2026-11-17T17:0${n}:00Z`, updatedAt: `2026-11-17T17:0${n}:00Z`});
const care = (requests: CareRequest[]): CareContext => ({tenancyId: TENANCY, tenantId: OTHER, landlordId: ME, status: 'active', today: '2026-11-18', schedule: [], obligations: [], obligationsLimited: false, reminders: [], requests});

test('the strip lists open requests only; resolved, rejected and cancelled ones do not count', () => {
  const s = maintenanceStrip(care([req(1, 'submitted'), req(2, 'resolved'), req(3, 'cancelled'), req(4, 'rejected'), req(5, 'in_progress')]));
  assert.equal(s.openCount, 2);
  assert.deepEqual(s.items.map(i => i.id), [id(105), id(101)], 'newest first');
  assert.equal(maintenanceStrip(care([req(1, 'resolved')])).openCount, 0);
  assert.equal(maintenanceStrip(care([])).openCount, 0);
});

test('the strip shows the urgent flag, a plain status word and the category with the time sent', () => {
  const s = maintenanceStrip(care([req(1, 'submitted', 'urgent'), req(2, 'acknowledged'), req(3, 'scheduled')]));
  const by = Object.fromEntries(s.items.map(i => [i.id, i]));
  assert.equal(by[id(101)]!.urgent, true);
  assert.equal(by[id(102)]!.urgent, false);
  assert.deepEqual([by[id(101)]!.status, by[id(102)]!.status, by[id(103)]!.status], ['Sent', 'Seen', 'In progress']);
  assert.equal(by[id(101)]!.meta, 'Plumbing · sent 1:01 AM');
});

test('at most three requests are listed, and the header still counts all open ones', () => {
  const s = maintenanceStrip(care([1, 2, 3, 4, 5].map(n => req(n, 'submitted'))));
  assert.equal(STRIP_LIMIT, 3);
  assert.equal(s.items.length, 3);
  assert.equal(s.openCount, 5);
});

const conversation = (): Conversation => ({id: CONV, listingId: id(20), listingTitle: 'Condo', tenantId: OTHER, landlordId: ME, status: 'open', participantName: null, activityAt: '2026-11-18T01:00:00Z', latestBody: 'hi', latestType: 'text'});
function renderThread(link: unknown, owner = ME) {
  const slots: any[] = [], opened: any[] = [];
  const view = component('src/features/messaging-viewing/views/MessagingConversationView.tsx', {'../components/ConversationPropertySummary': {ConversationPropertySummary: 'PropertySummary'}, '../../../shared/components/AppButton': {AppButton: 'Button'}, '../../../shared/components/ProfileSurfaces': {ChatPersonTitle: 'ChatPersonTitle'}, '../../../shared/components/GlyphIcon': {GlyphIcon: 'GlyphIcon'}});
  const vm = {owner, selectedId: CONV, conversation: conversation(), publicIdentities: {[OTHER]: {nickname: 'Mae'}, [ME]: {nickname: 'Nightcity'}}, propertyContexts: {}, tenancyLinks: link ? {[CONV]: link} : {}, messages: [], composer: '', connection: 'connected', workflow: {}};
  const tree = view.render('MessagingConversationView', {viewModel: vm, renderMaintenance: (slot: any) => { slots.push(slot); return {type: 'Strip', props: {}}; }, onOpenTenancyRequest: (t: any) => opened.push(t)});
  return {all: nodes(tree), slots, opened};
}
const link = {tenancyId: TENANCY, conversationId: CONV, tenantId: OTHER, landlordId: ME, propertyId: id(10)};

test('no active tenancy: no banner, no strip; an active tenancy: the banner and the strip with the right role', () => {
  const none = renderThread(null);
  assert.equal(none.slots.length, 0);
  assert.ok(!none.all.some(n => n.type === 'GlyphIcon'));
  const owner = renderThread(link);
  assert.equal(owner.slots.length, 1);
  assert.equal(owner.slots[0].role, 'landlord');
  assert.equal(owner.slots[0].tenancyId, TENANCY);
  assert.ok(owner.all.some(n => n.props?.accessibilityLabel === 'Mae is renting this property now'));
  const renter = renderThread(link, OTHER);
  assert.equal(renter.slots[0].role, 'tenant');
  assert.ok(renter.all.some(n => n.props?.accessibilityLabel === 'You are renting this property. Nightcity is your landlord.'));
});

test('Open request and Report another issue hand the tenancy and the request to the shell', () => {
  const r = renderThread(link, OTHER);
  r.slots[0].onOpenRequest(id(101));
  r.slots[0].onReportAnother();
  assert.deepEqual(r.opened, [{tenancyId: TENANCY, panel: 'care', requestId: id(101)}, {tenancyId: TENANCY, panel: 'report'}]);
});
