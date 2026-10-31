import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {env} from '../src/config/env';
import {getMapTilerStyleUrl} from '../src/shared/services/maps/mapTiler/mapTilerConfig';
test('MapTiler default is streets-v4, key/style remain encoded and config never logs them',()=>{const previous=env.mapTilerApiKey;env.mapTilerApiKey='fixture key&not=a-real-key';try{const url=new URL(getMapTilerStyleUrl());assert.equal(url.pathname,'/maps/streets-v4/style.json');assert.equal(url.searchParams.get('key'),env.mapTilerApiKey);assert.match(getMapTilerStyleUrl('custom/style'),/custom%2Fstyle/);assert.doesNotMatch(readFileSync('src/shared/services/maps/mapTiler/mapTilerConfig.ts','utf8'),/console\./);assert.match(readFileSync('src/features/property-listing/views/PropertyLocationMapView.tsx','utf8'),/mapStyle=\{styleUrl\}/);}finally{env.mapTilerApiKey=previous;}});
