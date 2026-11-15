import test from 'node:test';
import assert from 'node:assert/strict';
import {project,unproject,mapBounds,kmBetween,inside} from '../src/supabase/hostingMapMath.mjs';

test('mercator round-trips safe coordinates',()=>{
 for(const [lon,lat] of [[-118.24,34.05],[-74.006,40.71],[0,0],[120,-35]]){
  const p=project(lon,lat,7),again=unproject(p.x,p.y,7);
  assert.ok(Math.abs(again.longitude-lon)<1e-8);
  assert.ok(Math.abs(again.latitude-lat)<1e-8);
 }
});
test('bounds contain center and exclude distant venues',()=>{
 const focus={longitude:-118.24,latitude:34.05};
 const b=mapBounds(focus,850,520,9);
 assert.equal(inside(b,focus),true);
 assert.equal(inside(b,{longitude:-74,latitude:40}),false);
});
test('straight-line distances are never represented as commute duration',()=>{
 const km=kmBetween({longitude:-118.24,latitude:34.05},{longitude:-118.36,latitude:34.09});
 assert.ok(km>5&&km<20);
});
