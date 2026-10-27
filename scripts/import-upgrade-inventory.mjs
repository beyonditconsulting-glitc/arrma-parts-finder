// Import normalized public catalog captures only after retaining the source bytes.
import { readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseUpgradeInventory } from '../src/upgradeInventory.ts';
const [inputPath, evidenceDir] = process.argv.slice(2);
if (!inputPath || !evidenceDir) throw new Error('Usage: node scripts/import-upgrade-inventory.mjs snapshot.json evidence-directory');
const input = JSON.parse(readFileSync(inputPath, 'utf8'));
const vendors = parseUpgradeInventory(input);
const evidenceHashes = new Set(readdirSync(evidenceDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => createHash('sha256').update(readFileSync(join(evidenceDir, entry.name))).digest('hex')));
for (const vendor of vendors) for (const product of vendor.products) {
  if (!evidenceHashes.has(product.sourceSha256)) throw new Error(`Missing retained source bytes for ${vendor.id}/${product.id}`);
}
const target = resolve(import.meta.dirname, '../src/data/upgrade-inventory.json');
const temporary = `${target}.tmp`;
writeFileSync(temporary, `${JSON.stringify(input, null, 2)}\n`);
renameSync(temporary, target);
console.log(vendors.map((vendor) => `${vendor.name}: ${vendor.products.length} captured listings (${vendor.status})`).join('\n'));
