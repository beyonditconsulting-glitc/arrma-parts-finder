import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUpgradeInventory, searchUpgradeProducts, upgradeVendors } from '../src/upgradeInventory.ts';
const fixture = () => ({ schemaVersion: 1, vendors: upgradeVendors.map((v) => ({ ...v, products: [] , status: 'not_captured' })) });
const product = () => ({ id: 'test-only', title: 'Test-only chassis brace', sku: 'TEST-123', variant: 'Black', configurationNote: '', productUrl: 'https://m2cracing.net/test-only', capturedAt: '2026-10-27T00:00:00Z', sourceSha256: 'a'.repeat(64), price: { amount: '12.50', currency: 'USD' }, availability: 'unknown' });
test('all three requested vendors are present without fabricated inventory', () => {
 assert.deepEqual(upgradeVendors.map((v) => v.name), ['M2C Racing', 'Perfect Pass', 'Basher Bodies']);
 for (const v of upgradeVendors) if (v.status === 'not_captured') assert.equal(v.products.length, 0);
});
test('search preserves distinct variants and requires all terms', () => {
 const v = { ...upgradeVendors[0], products: [product(), { ...product(), id: 'other-test', variant: 'Red' }] };
 assert.equal(searchUpgradeProducts(v, 'TEST-123 black').length, 1);
 assert.equal(searchUpgradeProducts(v, '').length, 2);
 assert.equal(searchUpgradeProducts(v, 'unrelated').length, 0);
});
test('invalid source, prices, dates, duplicates and unavailable capture labels fail closed', () => {
 for (const change of [ { price: { amount: '-1', currency: 'USD' } }, { price: undefined }, { capturedAt: 'unknown' }, { sourceSha256: '' }, { productUrl: 'http://m2cracing.net/test' }, { productUrl: 'https://user:password@m2cracing.net/test' }, { availability: 'live' } ]) {
  const f = fixture(); f.vendors[0].status = 'partial'; f.vendors[0].products = [{ ...product(), ...change }]; assert.throws(() => parseUpgradeInventory(f));
 }
 const f = fixture(); f.vendors[0].products = [product()]; assert.throws(() => parseUpgradeInventory(f));
 f.vendors[0].status = 'partial'; assert.equal(parseUpgradeInventory(f)[0].products.length, 1);
 f.vendors[0].products.push(product()); assert.throws(() => parseUpgradeInventory(f));
 assert.throws(() => parseUpgradeInventory({ ...fixture(), vendors: [] }));
});

test('importer rejects missing evidence without replacing the app snapshot', async () => {
 const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
 const { tmpdir } = await import('node:os');
 const { join } = await import('node:path');
 const { spawnSync } = await import('node:child_process');
 const dir = mkdtempSync(join(tmpdir(), 'upgrade-import-'));
 const target = new URL('../src/data/upgrade-inventory.json', import.meta.url);
 const before = readFileSync(target, 'utf8');
 try {
  const f = fixture(); f.vendors[0].status = 'partial'; f.vendors[0].products = [product()];
  const input = join(dir, 'input.json'); writeFileSync(input, JSON.stringify(f));
  const result = spawnSync(process.execPath, ['scripts/import-upgrade-inventory.mjs', input, dir], { encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Missing retained source bytes/);
  assert.equal(readFileSync(target, 'utf8'), before);
 } finally { rmSync(dir, { recursive: true, force: true }); }
});
