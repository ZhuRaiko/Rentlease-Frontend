import {test} from 'node:test';import assert from 'node:assert/strict';
import {becameVisible} from '../src/shared/models/RentalReview';
test('reviews are read again only when a hidden screen turns visible',()=>{
  assert.equal(becameVisible(false,true),true);
  assert.equal(becameVisible(true,true),false,'staying visible does not reload');
  assert.equal(becameVisible(true,false),false,'hiding does not reload');
  assert.equal(becameVisible(false,false),false);
});
