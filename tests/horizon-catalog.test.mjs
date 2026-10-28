import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { gunzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
function api(data, onLoad = () => {}) {
  const code = ts.transpileModule(readFileSync(new URL('src/horizonCatalog.ts', root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const index = { ...data, models: data.models.map(model => ({ ...model, skus: model.skus.map(sku => ({ ...sku, observedCount: sku.associations.length })) })) };
  const requireFixture = (path) => path.includes('horizon-model-loaders')
    ? { loadHorizonModel(brandId, modelId) { onLoad(brandId, modelId); return { ...data, model: data.models.find(model => model.brand_id === brandId && model.model_id === modelId) }; } }
    : index;
  new Function('require', 'module', 'exports', code)(requireFixture, module, module.exports);
  return module.exports;
}
const fixture = {
  brands: [{ id: 'b', name: 'Brand' }], metadata: {}, relationships: ['Horizon-listed; not verified fitment'],
  models: [{ brand_id: 'b', model_id: 'm', name: 'Source model label', discontinued: false, status: 'incomplete', skus: [
    { sku: 'red', color: 'Red', is_fallback: false, status: 'complete', expectedCount: 1, associations: [[0, 0, [0]]] },
    { sku: 'blue', color: 'Blue', is_fallback: false, status: 'error', expectedCount: 2, associations: [[1, 0, [1]]] },
    { sku: 'm', color: null, is_fallback: true, status: 'complete', expectedCount: 0, associations: [] },
  ] }, { brand_id: 'b', model_id: 'missing', name: 'Missing', discontinued: true, status: 'missing_summary', skus: [] }],
  products: [['RED-ID', 'Red only', 'Brand'], ['BLUE-ID', 'Blue only', 'Brand']],
  captures: [['red.json', 'red-hash', '2026-01-01T00:00:00Z'], ['blue.json', 'blue-hash', '2026-01-02T00:00:00Z']],
  snapshots: [[0, 1234, 'USD'], [1, null, null]],
};
test('isolates exact brand/model/SKU associations and retains captured evidence', () => {
  const h = api(fixture);
  const [red] = h.getHorizonParts('b', 'm', 'red');
  assert.equal(red.id, 'RED-ID');
  assert.equal(h.getHorizonParts('b', 'm', 'blue')[0].id, 'BLUE-ID');
  assert.deepEqual(h.getHorizonParts('other', 'm', 'red'), []);
  assert.deepEqual(h.getHorizonParts('b', 'other', 'red'), []);
  assert.deepEqual(h.getHorizonParts('b', 'm', 'red', 'blue'), []);
  assert.equal(red.manufacturerPartNumber, null);
  assert.equal(red.image, null);
  assert.equal(red.observedPrice.amountMinor, 1234);
  assert.equal(red.provenance.sourceSha256, 'red-hash');
  assert.equal(red.fitments[0].name, 'Source model label');
  assert.equal(red.fitments[0].relationship, 'Horizon-listed; not verified fitment');
  assert.equal(h.getHorizonParts('b', 'm', 'blue')[0].observedPrice, null);
});
test('distinguishes complete zero, incomplete, missing, and unknown coverage', () => {
  const h = api(fixture);
  assert.deepEqual(h.getHorizonCoverage('b', 'm', 'm'), { status: 'complete', expectedCount: 0, observedCount: 0 });
  assert.deepEqual(h.getHorizonCoverage('b', 'm', 'blue'), { status: 'error', expectedCount: 2, observedCount: 1 });
  assert.deepEqual(h.getHorizonCoverage('b', 'missing', 'missing'), { status: 'missing_summary', expectedCount: null, observedCount: 0 });
  assert.equal(h.getHorizonCoverage('b', 'm', 'unknown').status, 'unknown_sku');
  assert.equal(h.getHorizonSkus('b', 'm')[2].is_fallback, true);
  assert.equal(h.getHorizonModels('b', 'source model').length, 1);
});
test('builder normalizes exact associations, fallback zero results and missing models', () => {
  const directory = mkdtempSync(join(tmpdir(), 'horizon-catalog-test-'));
  try {
    const python = `
import importlib.util,json,sqlite3,sys
from pathlib import Path
sys.dont_write_bytecode=True
root=Path(sys.argv[1]); temp=Path(sys.argv[2])
spec=importlib.util.spec_from_file_location('builder',root/'scripts/build-horizon-catalog.py'); builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
# Keep this test self-contained: define only the export tables the builder consumes.
c=sqlite3.connect(temp/'fixture.sqlite')
c.executescript('''CREATE TABLE models(brand_id,model_id,brand,name,discontinued); CREATE TABLE captures(path,sha256,captured_at); CREATE TABLE products(product_id,name,brand); CREATE TABLE product_snapshots(product_id,source_path,price_json); CREATE TABLE skus(brand_id,model_id,sku,color,is_fallback); CREATE TABLE coverage(brand_id,model_id,sku,status,expected_count); CREATE TABLE associations(brand_id,model_id,sku,product_id,relationship); CREATE TABLE association_captures(brand_id,model_id,sku,product_id,source_path);''')
c.execute("INSERT INTO models VALUES('b','m','Brand','Source model',0)")
c.execute("INSERT INTO captures VALUES('page.json','hash','2026-01-01T00:00:00Z')")
c.execute("INSERT INTO products VALUES('P','Part','Brand')")
c.execute('INSERT INTO product_snapshots VALUES(?,?,?)',('P','page.json',json.dumps({'sales':{'decimalPrice':'12.34','currency':'USD'}})))
for sku,fallback,count in [('red',0,1),('m',1,0)]:
 c.execute('INSERT INTO skus VALUES(?,?,?,?,?)',('b','m',sku,None,fallback)); c.execute('INSERT INTO coverage VALUES(?,?,?,?,?)',('b','m',sku,'complete',count))
c.execute("INSERT INTO associations VALUES('b','m','red','P','Horizon-listed')")
c.execute("INSERT INTO association_captures VALUES('b','m','red','P','page.json')")
c.commit(); c.close()
(temp/'models.json').write_text(json.dumps([{'brand_id':'b','model_id':'missing','brand':'Brand','name':'Missing','discontinued':False}]))
complete=builder.build(temp/'fixture.sqlite',temp/'models.json')
assert next(m for m in complete['models'] if m['model_id']=='m')['status']=='complete'
assert next(m for m in complete['models'] if m['model_id']=='missing')['status']=='missing_summary'
c=sqlite3.connect(temp/'fixture.sqlite')
c.execute("UPDATE coverage SET status='error' WHERE sku='red'"); c.commit(); c.close()
incomplete=builder.build(temp/'fixture.sqlite',temp/'models.json')
assert next(m for m in incomplete['models'] if m['model_id']=='m')['status']=='incomplete'
# Even an erroneously complete exporter row must become incomplete on count mismatch.
c=sqlite3.connect(temp/'fixture.sqlite')
c.execute("UPDATE coverage SET status='complete',expected_count=2 WHERE sku='red'"); c.commit(); c.close()
mismatch=builder.build(temp/'fixture.sqlite',temp/'models.json')
assert next(m for m in mismatch['models'] if m['model_id']=='m')['status']=='incomplete'
print(json.dumps(complete))
`;
    const result = spawnSync('python', ['-c', python, root.pathname, directory], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const built = JSON.parse(result.stdout);
    assert.equal(built.products.length, 1);
    assert.equal(built.metadata.associationCount, 1);
    assert.deepEqual(built.relationships, ['Horizon-listed']);
    assert.equal(built.models.find(m => m.model_id === 'm').skus[1].associations[0][1], 0);
    assert.deepEqual(built.snapshots, [[0, 1234, 'USD']]);
    const h = api(built);
    assert.equal(h.getHorizonParts('b', 'm', 'red')[0].id, 'P');
    assert.equal(h.getHorizonParts('b', 'm', 'm').length, 0);
    assert.equal(h.getHorizonCoverage('b', 'm', 'm').expectedCount, 0);
    assert.equal(h.getHorizonCoverage('b', 'missing', 'missing').expectedCount, null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test('opening the catalog and selecting metadata never loads parts data', () => {
  const loads = [];
  const h = api(fixture, (...args) => loads.push(args));
  h.getHorizonModels('b');
  h.getHorizonSkus('b', 'm');
  h.getHorizonCoverage('b', 'm', 'red');
  assert.deepEqual(loads, []);
  assert.equal(h.getHorizonParts('b', 'm', 'red')[0].id, 'RED-ID');
  assert.deepEqual(loads, [['b', 'm']]);
});

test('bundled startup index is bounded and all model shards retain complete coverage', () => {
  const bytes = readFileSync(new URL('src/data/horizon-catalog.json', root));
  const index = JSON.parse(bytes);
  assert.ok(bytes.length < 600_000, `startup index grew to ${bytes.length} bytes`);
  assert.equal(index.schemaVersion, 3);
  assert.equal(index.products, undefined);
  assert.equal(index.snapshots, undefined);
  const source = JSON.parse(gunzipSync(readFileSync(new URL('database/horizon-partfinder/associations.json.gz', root))));
  const expected = new Set(source.map(row => JSON.stringify([row.brand_id, row.model_id, row.sku, row.product_id])));
  let associations = 0;
  const products = new Set();
  const loaderSource = readFileSync(new URL('src/data/horizon-model-loaders.ts', root), 'utf8');
  const compiled = ts.transpileModule(loaderSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  let loads = 0;
  const requireShard = path => {
    loads++;
    const bytes = readFileSync(new URL(`src/data/${path.replace('./', '')}`, root));
    assert.ok(bytes.length < 1_000_000, `oversized model shard: ${path}`);
    return JSON.parse(bytes);
  };
  new Function('require', 'module', 'exports', compiled)(requireShard, module, module.exports);
  assert.equal(loads, 0, 'loader registry eagerly loaded model files');
  for (const model of index.models) {
    assert.ok(model.skus.every(sku => sku.associations === undefined));
    const shard = module.exports.loadHorizonModel(model.brand_id, model.model_id);
    assert.equal(shard.model.model_id, model.model_id);
    assert.equal(shard.model.brand_id, model.brand_id);
    for (const sku of shard.model.skus) {
      assert.equal(sku.associations.length, sku.expectedCount);
      associations += sku.associations.length;
      for (const [p, rel, snapshots] of sku.associations) {
        assert.ok(shard.relationships[rel]);
        assert.ok(snapshots.length > 0);
        products.add(shard.products[p][0]);
        assert.ok(expected.delete(JSON.stringify([model.brand_id, model.model_id, sku.sku, shard.products[p][0]])), 'missing, duplicate or incorrect source association');
        for (const i of snapshots) assert.ok(shard.captures[shard.snapshots[i][0]][1]);
      }
    }
  }
  assert.equal(expected.size, 0);
  assert.equal(loads, index.metadata.modelCount);
  assert.equal(associations, index.metadata.associationCount);
  assert.equal(products.size, index.metadata.productCount);
});
