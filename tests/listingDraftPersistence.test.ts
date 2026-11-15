/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { emptyListingDraft } from '../src/features/property-listing/models/PropertyListing';
import { applySavedListing, hasListingMinimum, listingDraftPayload, listingDraftValidation, rentalTermOptions, ListingDraftError, type SavedListingDraft } from '../src/features/property-listing/models/PersistedListingDraft';
import { draftSaveDiagnostic } from '../src/features/property-listing/services/listingDraftDiagnostics';
import { createListingDraftService } from '../src/features/property-listing/services/listingDraftService';
import { createListingDraftWorkflow } from '../src/features/property-listing/viewModels/listingDraftWorkflow';
const propertyId = '10000000-0000-4000-8000-000000000001', listingId = '20000000-0000-4000-8000-000000000001', owner = '30000000-0000-4000-8000-000000000001';
const form = () => ({ ...emptyListingDraft, title: ' A rental home ', description: ' Two rooms and a kitchen ', askingRent: '12,500.50', houseRules: ' No smoking ', rentalTerm: 'either' as const, securityDepositMonths: '2', advanceRentMonths: '1', minimumStayMonths: '6', availableDate: '2026-11-01' });
const row = (): SavedListingDraft => ({ edit_version:'50000000-0000-4000-8000-000000000001', id: listingId, property_id: propertyId, landlord_id: owner, title: 'A rental home', description: 'Two rooms and a kitchen', asking_rent_monthly: 12500.5, house_rules: 'No smoking', rental_term: 'either', security_deposit_months: 2, advance_rent_months: 1, minimum_stay_months: 6, available_from: '2026-11-01', status: 'draft', completeness_score: 0.6, created_at: '2026-10-24T00:00:00Z', updated_at: '2026-10-24T00:00:00Z', published_at: null, paused_at: null, archived_at: null, removed_at: null, removal_reason: null });
function harness() {
  let userId = owner, active = true, saved: SavedListingDraft | null = null, calls = 0, payload: unknown = null;
  let rpcError: { code: string; message: string } | null = null, invalid: unknown = undefined, wait: Promise<void> | null = null;
  let readFail = false, loseResponse = false, diskFail = false;
  const filters: Record<string, unknown>[] = [], journal = new Map<string, string>();
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table: string) {
      const scoped: Record<string, unknown> = {}; const query = {
        select: (_: string) => query, eq: (name: string, value: unknown) => { scoped[name] = value; return query; },
        order: (_: string, __: unknown) => query, limit: (n: number) => { assert.equal(n, 1); return query; },
        maybeSingle: async () => {
          if (table === 'properties') return { data: userId === owner && active ? { id: propertyId, landlord_id: owner, is_active: true } : null, error: null };
          assert.equal(table, 'listings'); filters.push(scoped);
          return { data: saved, error: readFail ? { message: 'private read error' } : null };
        },
      }; return query;
    },
    async rpc(name: string, args: any) {
      assert.ok(name==='save_listing_draft'||name==='update_listing_draft');if(name==='update_listing_draft'){assert.equal(args.p_listing_id,listingId);assert.equal(args.p_expected_edit_version,saved?.edit_version);} calls++; payload = args; if (wait) await wait;
      if (rpcError) return { data: null, error: rpcError };
      if (invalid !== undefined) return { data: invalid, error: null };
      saved = { ...row(),edit_version: name==='update_listing_draft'?'50000000-0000-4000-8000-000000000002':row().edit_version!, title: args.p_title, description: args.p_description, asking_rent_monthly: args.p_asking_rent_monthly, available_from: args.p_available_from ?? null };
      return { data: loseResponse ? null : [{ listing_id: listingId, listing_status: 'draft',edit_version:saved.edit_version, completeness_score: 0.6, created_at: saved.created_at, updated_at: saved.updated_at }], error: loseResponse ? { code: '', message: 'private timeout detail' } : null };
    },
  } as unknown as SupabaseClient<Database>;
  const service = createListingDraftService(() => client, { getItem: async k => journal.get(k) ?? null, setItem: async (k, v) => { if (diskFail) throw Error('disk'); journal.set(k, v); }, removeItem: async k => { journal.delete(k); } });
  const applied: SavedListingDraft[] = [];
  const flow = createListingDraftWorkflow(service, r => applied.push(r));
  return { service, flow, journal, filters, applied, calls: () => calls, payload: () => payload, saved: () => saved, setSaved: (v: SavedListingDraft | null) => { saved = v; }, user: (v: string) => { userId = v; }, inactive: () => { active = false; }, rpcError: (v: typeof rpcError) => { rpcError = v; }, invalid: (v: unknown) => { invalid = v; }, delay: (v: Promise<void>) => { wait = v; }, readFail: (v: boolean) => { readFail = v; }, loseResponse: (v: boolean) => { loseResponse = v; }, diskFail: () => { diskFail = true; }, ready: async () => { flow.setProperty(propertyId); await flow.load(); } };
}
const context = { propertyId, userId: owner };

test('listing minimum requires real property UUID, nonblank title/description and positive monthly rent', () => {
  assert.equal(hasListingMinimum(propertyId, form()), true);
  for (const id of [null, 'preview-property']) { assert.equal(hasListingMinimum(id, form()), false); assert.throws(() => listingDraftPayload(id!, form())); }
  for (const f of [{ ...form(), title: ' ' }, { ...form(), description: ' ' }, { ...form(), askingRent: '0' }, { ...form(), askingRent: '-1' }, { ...form(), askingRent: '1 peso' }]) {
    assert.equal(hasListingMinimum(propertyId, f), false); assert.ok(listingDraftValidation(propertyId, f));
  }
});
test('RPC payload maps only supported fields and numeric month values, never backend-owned columns', () => {
  const legacy = { ...form(), advancePayment: 'unsupported preview text' };
  const p = listingDraftPayload(propertyId, legacy);
  assert.deepEqual(p, { p_property_id: propertyId, p_title: 'A rental home', p_description: 'Two rooms and a kitchen', p_asking_rent_monthly: 12500.5, p_house_rules: 'No smoking', p_rental_term: 'either', p_security_deposit_months: 2, p_advance_rent_months: 1, p_minimum_stay_months: 6, p_available_from: '2026-11-01' });
  for (const key of ['landlord_id', 'status', 'completeness_score', 'published_at', 'paused_at', 'archived_at', 'removed_at', 'removal_reason', 'created_at', 'updated_at']) assert.ok(!Object.keys(p).some(k => k === key || k === `p_${key}`));
});
test('rental terms map exactly and unknown display labels are rejected', () => {
  assert.deepEqual(rentalTermOptions.map(o => o.value), ['short_term', 'long_term', 'either']);
  for (const term of ['short_term', 'long_term', 'either'] as const) assert.equal(listingDraftPayload(propertyId, { ...form(), rentalTerm: term }).p_rental_term, term);
  assert.throws(() => listingDraftPayload(propertyId, { ...form(), rentalTerm: 'Long term' as never }));
});
test('payment/month/date domains reject ambiguous strings and calendar-invalid dates', () => {
  for (const change of [{ securityDepositMonths: '-1' }, { advanceRentMonths: 'two months' }, { minimumStayMonths: '1.5' }, { minimumStayMonths: '32768' }, { availableDate: '2026-02-30' }, { availableDate: 'November 1, 2026' }, { askingRent: '1,2,3' }]) assert.ok(listingDraftValidation(propertyId, { ...form(), ...change }));
  const p = listingDraftPayload(propertyId, { ...form(), securityDepositMonths: '0', advanceRentMonths: '0', minimumStayMonths: '', availableDate: '', houseRules: '' });
  assert.equal(p.p_security_deposit_months, 0); assert.equal(p.p_advance_rent_months, 0); assert.ok(!('p_available_from' in p)); assert.ok(!('p_minimum_stay_months' in p)); assert.ok(!('p_house_rules' in p));
});
test('confirmed save creates and then updates the same real draft UUID through the RPC', async () => {
  const h = harness(); await h.ready(); assert.equal(await h.flow.save(form()), 'saved');
  assert.equal(h.flow.getSnapshot().listingId, listingId); assert.equal(h.flow.getSnapshot().lastConfirmed?.status, 'draft');
  await h.flow.save({ ...form(), title: 'Updated' }); assert.equal(h.flow.getSnapshot().listingId, listingId); assert.equal(h.calls(), 2); assert.equal(h.flow.getSnapshot().lastConfirmed?.title, 'Updated');
});
test('existing own draft reload scopes property, owner and draft status and populates only listing fields', async () => {
  const h = harness(); h.setSaved(row()); await h.ready();
  assert.equal(h.flow.getSnapshot().listingId, listingId); assert.equal(h.applied.length, 1);
  assert.deepEqual(h.filters[0], { property_id: propertyId, landlord_id: owner, status: 'draft' });
  const physical = { ...form(), address: 'Keep physical address', landArea: '999', bedrooms: 3 };
  const merged = applySavedListing(physical, row()); assert.equal(merged.address, physical.address); assert.equal(merged.landArea, '999'); assert.equal(merged.bedrooms, 3);
});
test('early incomplete progress stays local and never claims backend success', async () => {
  const h = harness(); assert.equal(await h.flow.save(form()), 'local'); assert.equal(h.calls(), 0);
  assert.match(h.flow.getSnapshot().notice ?? '', /not saved to your account/); assert.equal(h.flow.getSnapshot().listingId, null);
  await h.ready(); assert.equal(await h.flow.save({ ...form(), description: '' }), 'local'); assert.equal(h.calls(), 0);
});
test('valid prerequisites use real backend save; invalid optional fields cannot silently fall back to local success', async () => {
  const h = harness(); await h.ready(); assert.equal(await h.flow.save({ ...form(), advanceRentMonths: 'bad' }), 'blocked'); assert.equal(h.calls(), 0);
  assert.equal(await h.flow.save(form()), 'saved'); assert.match(h.flow.getSnapshot().notice ?? '', /saved to your account/);
});
test('service rejects missing/non-owned/inactive property before RPC without Tier 3 checks', async () => {
  const h = harness(); await assert.rejects(h.service.context('fake'));
  h.inactive(); await assert.rejects(h.service.save(context, form())); assert.equal(h.calls(), 0);
  const other = harness(); other.user('another'); await assert.rejects(other.service.save(context, form())); assert.equal(other.calls(), 0);
  assert.doesNotMatch(readFileSync('src/features/property-listing/services/listingDraftService.ts', 'utf8'), /tier3|\.insert\(|\.update\(/ );
});
test('rapid save taps are excluded by both workflow and service guards', async () => {
  const h = harness(); await h.ready(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
  const first = h.flow.save(form()); assert.equal(await h.flow.save(form()), 'blocked'); release(); await first; assert.equal(h.calls(), 1);
  const second = harness(); let releaseAgain!: () => void; second.delay(new Promise<void>(r => { releaseAgain = r; }));
  const pending = second.service.save(context, form()); await assert.rejects(second.service.save(context, form())); releaseAgain(); await pending; assert.equal(second.calls(), 1);
});
test('uncertain committed response blocks another save and reconciles by reading current draft', async () => {
  const h = harness(); await h.ready(); h.loseResponse(true); assert.equal(await h.flow.save(form()), 'blocked');
  assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.journal.size, 1); assert.equal(h.flow.getSnapshot().notice, null);
  await h.flow.save(form()); assert.equal(h.calls(), 1);
  assert.equal(await h.flow.reconcile(), true); assert.equal(h.flow.getSnapshot().listingId, listingId); assert.equal(h.journal.size, 0); assert.match(h.flow.getSnapshot().notice ?? '', /does not prove/);
});
test('unknown outcome with no confirmed row remains uncertain without blind RPC retry', async () => {
  const h = harness(); await h.ready(); h.rpcError({ code: '', message: 'private timeout' }); await h.flow.save(form());
  await h.flow.reconcile(); await h.flow.save(form()); assert.equal(h.calls(), 1); assert.equal(h.flow.getSnapshot().uncertain, true); assert.doesNotMatch(h.flow.getSnapshot().error ?? '', /private timeout/);
});
test('durable pending markers block a reopened workflow until explicit reconciliation', async () => {
  const h = harness(); h.loseResponse(true); await assert.rejects(h.service.save(context, form()));
  const reopened = createListingDraftWorkflow(h.service, () => {}); reopened.setProperty(propertyId); await reopened.load();
  assert.equal(reopened.getSnapshot().uncertain, true); await reopened.save(form()); assert.equal(h.calls(), 1); await reopened.reconcile(); assert.equal(reopened.getSnapshot().listingId, listingId);
});
test('unexpected RPC shapes and non-draft status are never presented as success', async () => {
  for (const result of [null, [], {}, [{ listing_id: listingId, listing_status: 'active' }], [{ listing_id: 'fake', listing_status: 'draft' }]]) {
    const h = harness(); h.invalid(result); await h.ready(); assert.equal(await h.flow.save(form()), 'blocked'); assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().listingId, null);
  }
});
test('refresh failure after RPC confirmation remains uncertain and never reports saved', async () => {
  const h = harness(); await h.ready(); h.readFail(true); await h.flow.save(form());
  assert.equal(h.flow.getSnapshot().uncertain, true); assert.equal(h.flow.getSnapshot().notice, null); assert.equal(h.applied.length, 0); assert.equal(h.journal.size, 1);
  h.readFail(false); await h.flow.reconcile(); assert.equal(h.flow.getSnapshot().listingId, listingId);
});
test('known validation rejection clears pending marker and safely permits an explicit corrected save', async () => {
  const h = harness(); await h.ready(); h.rpcError({ code: '22023', message: 'raw sensitive server detail' }); await h.flow.save(form());
  assert.equal(h.journal.size, 0); assert.equal(h.flow.getSnapshot().uncertain, false); assert.doesNotMatch(h.flow.getSnapshot().error ?? '', /sensitive/);
  h.rpcError(null); assert.equal(await h.flow.save(form()), 'saved');
});
test('journal storage failure prevents issuing a remote save', async () => {
  const h = harness(); h.diskFail(); await assert.rejects(h.service.save(context, form())); assert.equal(h.calls(), 0);
});
test('account switch, property switch and disposal reject stale late save results', async () => {
  for (const change of ['account', 'property', 'dispose']) {
    const h = harness(); await h.ready(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
    const pending = h.flow.save(form()); while (!h.calls()) await new Promise<void>(r => setImmediate(r));
    if (change === 'account') h.user('another'); else if (change === 'property') h.flow.setProperty(null); else h.flow.dispose();
    release(); await pending; assert.equal(h.applied.length, 0); assert.equal(h.flow.getSnapshot().listingId, null);
  }
});
test('no publication writes, direct View queries or teammate integrations are introduced', () => {
  const service = readFileSync('src/features/property-listing/services/listingDraftService.ts', 'utf8');
  assert.match(service, /rpc\('save_listing_draft', payload\)/); assert.doesNotMatch(service, /\.from\('listings'\)\s*\.(?:insert|update|delete)\(|'active'|'published'/);
  for (const p of ['CreateListingView.tsx', 'ListingPreviewView.tsx', 'PropertyListingFlowView.tsx']) assert.doesNotMatch(readFileSync(`src/features/property-listing/views/${p}`, 'utf8'), /getSupabaseClient|\.rpc\(|\.from\(/);
  for (const p of ['services/listingDraftService.ts', 'services/listingDraftDependencies.ts', 'viewModels/listingDraftWorkflow.ts', 'models/PersistedListingDraft.ts']) assert.doesNotMatch(readFileSync(`src/features/property-listing/${p}`, 'utf8'), /MapTiler|geocodeAddress|expo-location|panorama|has_360|XGBoost|Overpass|word.cloud/);
});

test('draft diagnostics expose safe stages and SQLSTATE without user-entered or backend data',()=>{
 const error={code:'23514',message:'private title and address',details:'private coordinates'};
 const event=draftSaveDiagnostic('rpc',error,true,true);assert.equal(event.code,'23514');assert.equal(event.outcome,'confirmed_failed');assert.equal(event.operation,'save_listing_draft');assert.doesNotMatch(JSON.stringify(event),/private/);
 assert.equal(draftSaveDiagnostic('reload',error,true,false).outcome,'uncertain');assert.equal(draftSaveDiagnostic('preflight',error,false,false).outcome,'not_sent');assert.equal(draftSaveDiagnostic('rpc',{code:'secret value'},true,false).code,'unknown');
});

test('existing drafts use exact-target update payload and never the create path',async()=>{const h=harness();h.setSaved(row());await h.ready();assert.equal(await h.flow.save({...form(),title:'Exact edit'}),'saved');const payload=h.payload()as any;assert.equal(payload.p_listing_id,listingId);assert.equal(payload.p_expected_edit_version,row().edit_version);assert.equal('p_property_id'in payload,false);assert.equal(h.saved()?.id,listingId);assert.equal(h.saved()?.property_id,propertyId);});
test('version conflicts preserve fields and block repeated RPC until explicit reload',async()=>{const h=harness();h.setSaved(row());await h.ready();h.rpcError({code:'40001',message:'private conflict'});const edited={...form(),title:'Keep local edit'};assert.equal(await h.flow.save(edited),'blocked');assert.equal(h.flow.getSnapshot().conflict,true);assert.equal(h.flow.getSnapshot().uncertain,false);assert.equal(h.journal.size,0);assert.equal(edited.title,'Keep local edit');await h.flow.save(edited);assert.equal(h.calls(),1);h.rpcError(null);await h.flow.reconcile();assert.equal(h.flow.getSnapshot().conflict,false);assert.equal(await h.flow.save(edited),'saved');assert.equal(h.calls(),2);});
test('missing migrated version fails closed instead of creating a replacement draft',async()=>{const h=harness();h.setSaved({...row(),edit_version:undefined as never});await h.ready();await h.flow.save(form());assert.equal(h.calls(),0);assert.match(h.flow.getSnapshot().error??'',/not available right now/);});
test('missing update RPC is a known deployment failure, never fallback or uncertainty',async()=>{const h=harness();h.setSaved(row());await h.ready();h.rpcError({code:'PGRST202',message:'private schema'});await h.flow.save(form());assert.equal(h.calls(),1);assert.equal(h.journal.size,0);assert.equal(h.flow.getSnapshot().uncertain,false);assert.match(h.flow.getSnapshot().error??'',/not available right now/);});
test('unknown update is journaled to exact ID and reconciliation never calls create or update',async()=>{const h=harness();h.setSaved(row());await h.ready();h.loseResponse(true);await h.flow.save(form());assert.equal(h.flow.getSnapshot().uncertain,true);assert.match([...h.journal.values()][0]??'',new RegExp(listingId));const count=h.calls();await h.flow.reconcile();assert.equal(h.calls(),count);assert.equal(h.flow.getSnapshot().listingId,listingId);assert.equal(h.journal.size,0);assert.ok(h.filters.some(f=>f.id===listingId));});
test('publication after edit load rejects before update without inserting another draft',async()=>{const h=harness();h.setSaved(row());await h.ready();h.setSaved({...row(),status:'active',published_at:'2026-11-01T00:00:00Z'});await h.flow.save(form());assert.equal(h.calls(),0);assert.equal(h.flow.getSnapshot().conflict,true);await h.flow.reconcile();assert.equal(h.flow.getSnapshot().lastConfirmed?.status,'active');assert.equal(await h.flow.save(form()),'blocked');assert.equal(h.calls(),0);});
test('an unresolved update for a different draft cannot hydrate the selected listing',async()=>{const h=harness();const other='20000000-0000-4000-8000-000000000099';h.journal.set(`rentlease:listing-draft-save:${owner}:${propertyId}`,JSON.stringify({mode:'update',listingId:other}));h.flow.setProperty(propertyId);await h.flow.load(false,listingId);await h.flow.reconcile();assert.equal(h.flow.getSnapshot().uncertain,true);assert.equal(h.flow.getSnapshot().lastConfirmed,null);assert.equal(h.journal.size,1);assert.equal(h.calls(),0);});

test('successful update followed by an unreadable reload reconciles a later publication without another mutation',async()=>{const h=harness();h.setSaved(row());await h.ready();let release!:()=>void;h.delay(new Promise<void>(r=>{release=r;}));const pending=h.flow.save(form());while(!h.calls())await new Promise<void>(r=>setImmediate(r));h.readFail(true);release();await pending;assert.equal(h.calls(),1);assert.equal(h.flow.getSnapshot().uncertain,true);h.readFail(false);h.setSaved({...row(),status:'active',completeness_score:1,published_at:'2026-11-01T00:00:00Z'});await h.flow.reconcile();assert.equal(h.calls(),1);assert.equal(h.flow.getSnapshot().lastConfirmed?.status,'active');assert.equal(h.journal.size,0);assert.equal(await h.flow.save(form()),'blocked');});
test('update target cannot cross the service property/listing scope',async()=>{const h=harness();h.setSaved(row());await assert.rejects(()=>h.service.save(context,form(),{listingId:'20000000-0000-4000-8000-000000000099',editVersion:row().edit_version!}));assert.equal(h.calls(),0);assert.equal(h.journal.size,0);});


test('exact-target availability date changes and clearing survive authoritative reopening',async()=>{
 const h=harness();h.setSaved(row());await h.ready();assert.equal(await h.flow.save({...form(),availableDate:'2027-02-28'}),'saved');assert.equal(h.flow.getSnapshot().lastConfirmed?.available_from,'2027-02-28');
 const reopened=createListingDraftWorkflow(h.service,()=>{});reopened.setProperty(propertyId);await reopened.load(false,listingId);assert.equal(reopened.getSnapshot().lastConfirmed?.available_from,'2027-02-28');assert.equal(reopened.getSnapshot().listingId,listingId);
 assert.equal(await reopened.save({...form(),availableDate:''}),'saved');const next=createListingDraftWorkflow(h.service,()=>{});next.setProperty(propertyId);await next.load(false,listingId);assert.equal(next.getSnapshot().lastConfirmed?.available_from,null);assert.equal(next.getSnapshot().listingId,listingId);assert.ok(next.getSnapshot().lastConfirmed?.edit_version);
});
