/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyDraftProperty,type DraftProperty} from '../src/features/property-listing/models/DraftProperty';
import {identityCorrectionIssues,identityCorrectionSnapshot,identityChangesRequireLocation,identityDataRepairRequired,type IdentityCorrectionKind} from '../src/features/property-listing/models/PropertyIdentityCorrection';
const current=():DraftProperty=>({...emptyDraftProperty(),propertyType:'apartment',city:'imus',barangay:'Fixture',addressLine1:'Fixture street',floorNumber:'2',totalFloors:'5',exactLatitude:14.4,exactLongitude:120.9,publicLatitude:14.401,publicLongitude:120.901});
test('identity corrections exclude routine data and preserve nullable unit/address fields',()=>{const d=current();d.addressLine2='';d.floorNumber='';const snapshot=identityCorrectionSnapshot(d);assert.equal(snapshot.floor_number,null);assert.equal(snapshot.address_line_2,null);assert.ok(!('total_floors'in snapshot));assert.ok(!('bedrooms'in snapshot));assert.ok(!('landlord_id'in snapshot));});
for(const kind of ['relocation','split','merge','different_unit'] as IdentityCorrectionKind[])test(`${kind} requires a new physical property rather than reusing approval`,()=>{assert.match(identityCorrectionIssues(current(),current(),kind,true,false)[0]?.message??'',/new physical property/i);});
test('same-asset attestation and existing floor/location validation are mandatory',()=>{assert.match(identityCorrectionIssues(current(),current(),'same_property_correction',false,false)[0]?.message??'',/same physical/);const d=current();d.floorNumber='6';assert.ok(identityCorrectionIssues(current(),d,'same_property_correction',true,false).some(i=>i.field==='floorNumber'));d.floorNumber='2';d.addressLine1='Corrected fixture address';assert.equal(identityChangesRequireLocation(current(),d),true);assert.ok(identityCorrectionIssues(current(),d,'same_property_correction',true,false).some(i=>i.field==='location'));assert.equal(identityCorrectionIssues(current(),d,'same_property_correction',true,true).length,0);});
test('type/floor correction alone can retain canonical location without pretending an address edit is confirmed',()=>{const d=current();d.propertyType='condominium';assert.equal(identityChangesRequireLocation(current(),d),false);assert.equal(identityCorrectionIssues(current(),d,'same_property_correction',true,false).length,0);d.city='tagaytay';assert.equal(identityChangesRequireLocation(current(),d),true);});


test('missing private identity requires repair regardless of historical approval',()=>{
 assert.equal(identityDataRepairRequired(null),true);
});
test('incomplete identity requires repair without inferring coordinates',()=>{
 const d=current();d.exactLatitude=null;
 assert.equal(identityDataRepairRequired(d),true);
 assert.equal(d.exactLatitude,null);
});
test('complete identity passes the data check without granting verification',()=>{
 const d=current();assert.equal(identityDataRepairRequired(d),false);
 d.addressLine1='';assert.equal(identityDataRepairRequired(d),true);
});
