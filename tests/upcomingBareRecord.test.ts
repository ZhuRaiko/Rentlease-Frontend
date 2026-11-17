// An upcoming move-in is the sparsest record the app shows: no end date, no schedule, no rent yet, no confirmation from the other person.
// Every screen model that reads it must give a calm answer, never throw. (The crash itself was a hook-order bug, see hooksStability.test.ts.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {detailsScreen} from '../src/features/tenancy/models/TenancyDetailsScreen';
import {parseRentLedger,rowLine} from '../src/features/tenancy/models/RentLedger';
import {careActionsFor,parseMaintenanceInbox,tenancyStateOf} from '../src/features/tenancy/models/Maintenance';
import {propertyMaintenance,countRows} from '../src/features/tenancy/models/MaintenanceInbox';

const L='00000000-0000-4000-8000-00000000000a',T='00000000-0000-4000-8000-00000000000b',P='00000000-0000-4000-8000-0000000000c1',LI='00000000-0000-4000-8000-0000000000d1',C='00000000-0000-4000-8000-0000000000e1',ID='00000000-0000-4000-8000-0000000000f2';
const NOW=Date.parse('2026-11-16T04:00:00Z');
const bare:any={id:ID,property_id:P,listing_id:LI,conversation_id:C,tenant_id:T,landlord_id:L,status:'pending_confirmation',start_date:'2026-11-25',expected_end_date:null,actual_end_date:null,agreed_monthly_rent:null,rent_due_day:null,tenant_confirmed_at:null,landlord_confirmed_at:null};
const ctx:any={title:'Garcia Apartment',listingStatus:'active',property:{id:P,type:'apartment',city:'tagaytay',barangay:'Bayan Luma',bedrooms:null,bathrooms:null,floorArea:null,furnishing:null,active:true},photos:[],notice:null};
const people={[L]:{id:L,nickname:'Nightcity',avatarUrl:null,avatarPath:null},[T]:{id:T,nickname:'Samuel',avatarUrl:null,avatarPath:null}} as any;

for(const actor of [L,T]){
  test(`details: an upcoming record with nothing optional renders for ${actor===L?'the landlord':'the tenant'}`,()=>{
    for(const withContext of [true,false]){
      const d=detailsScreen({actor,tenancy:bare,context:withContext?ctx:{...ctx,property:null,title:''},identities:people,care:null,lifecycle:null,reviews:null,reservation:null,conversationId:null,now:NOW});
      assert.equal(d.dates.end,null);assert.ok(!d.documents.some(x=>x.key==='rent'),'no rent ledger is offered before the stay');assert.equal(d.dates.progress,null);assert.deepEqual(d.rent?.rows??[],[]);assert.equal(d.maintenance,null);assert.equal(d.reviews,null);
    }
  });
}
test('rent ledger: an upcoming tenancy has no rows; the parser accepts the empty ledger and rejects one that names the wrong people',()=>{
  const ok={tenancyId:ID,tenantId:T,landlordId:L,status:'pending_confirmation',today:'2026-11-16',monthlyRent:10000,dueDay:1,rows:[],hasMore:false,awaiting:null};
  for(const actor of [L,T])assert.deepEqual(parseRentLedger(ok,actor,ID).rows,[]);
  assert.throws(()=>parseRentLedger(ok,'00000000-0000-4000-8000-0000000000aa',ID));
  assert.throws(()=>parseRentLedger({...ok,tenancyId:P},T,ID));
  assert.equal(typeof rowLine,'function');
});
test('maintenance: nothing can be reported or changed on an upcoming tenancy, and an empty inbox is a valid answer',()=>{
  assert.equal(tenancyStateOf('pending_confirmation'),'other');
  for(const role of ['tenant','landlord'] as const)for(const status of ['submitted','acknowledged','in_progress','resolved','reopened'] as const)
    assert.ok(Object.values(careActionsFor({role,tenancy:'other',status,confirmed:false})).every(v=>v===false),`${role} ${status}`);
  const empty=parseMaintenanceInbox({counts:{open:0,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:0},rows:[],hasMore:false});
  assert.deepEqual(empty.rows,[]);assert.deepEqual(propertyMaintenance(empty.rows,P),{open:0,urgent:[]});assert.equal(countRows([]).open,0);
});
