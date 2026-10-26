import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { importCatalog } from '../scripts/import-catalog.mjs';
// Fictional fixtures for constraint testing, never shipped as catalog data.
function fixture() {
 return {schema_version:1,dataset_type:'reviewed', sources:[{id:'fixture-source',url:'https://example.com/test-only',publisher:'Test fixture',retrieved_at:'2026-01-01T00:00:00Z',sha256:'a'.repeat(64)}],vehicles:[{id:'test-vehicle',manufacturer:'Test',model_number:'TEST-V1',name:'Test vehicle',revision:'V1',source_id:'fixture-source',source_locator:'page 1'}],parts:[{id:'test-part',brand:'Test',part_number:'TEST-P1',name:'Test arm',category:'Suspension',kind:'replacement',source_id:'fixture-source',source_locator:'page 2'}],fitments:[{part_id:'test-part',vehicle_id:'test-vehicle',status:'verified',source_id:'fixture-source',source_locator:'page 2',notes:''}],offers:[]};
}
test('imports exact model fitment with source provenance and no invented price',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  const counts=importCatalog(db,fixture());
  assert.equal(counts.parts,1);
  assert.equal(counts.offers,0);
  const row=db.prepare('SELECT v.model_number, s.url FROM fitments f JOIN vehicles v ON f.vehicle_id=v.id JOIN sources s ON f.source_id=s.id').get();
  assert.equal(row.model_number,'TEST-V1'); assert.equal(row.url,'https://example.com/test-only');
 } finally {db.close();}
});
test('missing provenance or vehicle reference rolls back the whole batch',()=>{
 for(const mutate of [d=>d.parts[0].source_id='missing', d=>d.fitments[0].vehicle_id='missing', d=>d.parts[0].source_locator='']) {
  const db=new DatabaseSync(':memory:'); const data=fixture(); mutate(data);
  try {assert.throws(()=>importCatalog(db,data)); assert.equal(db.prepare('SELECT count(*) AS n FROM sources').get().n,0);} finally {db.close();}
 }
});
test('rejects demo import and duplicate product identities without damaging existing data',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  assert.throws(()=>importCatalog(db,{...fixture(),dataset_type:'sample'}));
  importCatalog(db,fixture());
  assert.throws(()=>importCatalog(db,fixture()));
  assert.equal(db.prepare('SELECT count(*) AS n FROM parts').get().n,1);
 }finally{db.close();}
});
test('rejects impossible prices and future live observations atomically',()=>{
 for(const patch of [{price_minor:-1},{observed_at:'2099-01-01T00:00:00Z'},{price_minor:19.99}]){
 const db=new DatabaseSync(':memory:'); const data=fixture();
 data.offers=[{id:'test-offer',part_id:'test-part',retailer:'Test',listing_url:'https://example.com/test-only',price_minor:1999,currency:'USD',shipping_minor:null,condition:'unknown',availability:'unknown',observed_at:'2026-01-01T00:00:00Z',source_id:'fixture-source',source_locator:'product page',...patch}];
 try{assert.throws(()=>importCatalog(db,data));assert.equal(db.prepare('SELECT count(*) AS n FROM parts').get().n,0);}finally{db.close();}
 }
});
