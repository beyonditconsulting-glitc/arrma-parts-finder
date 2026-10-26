import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const columns = {
  sources: ['id', 'url', 'publisher', 'retrieved_at', 'sha256'],
  vehicles: ['id', 'manufacturer', 'model_number', 'name', 'revision', 'source_id', 'source_locator'],
  parts: ['id', 'brand', 'part_number', 'name', 'category', 'kind', 'source_id', 'source_locator'],
  fitments: ['part_id', 'vehicle_id', 'status', 'source_id', 'source_locator', 'notes'],
  offers: ['id', 'part_id', 'retailer', 'listing_url', 'price_minor', 'currency', 'shipping_minor', 'condition', 'availability', 'observed_at', 'source_id', 'source_locator'],
};
export function importCatalog(db, data) {
  if (data.schema_version !== 1 || data.dataset_type !== 'reviewed') throw Error('Expected a version 1 reviewed dataset, never demo data.');
  for (const key of Object.keys(data)) {
    if (!['schema_version','dataset_type', ...Object.keys(columns)].includes(key)) throw Error(`Unknown dataset field: ${key}`);
  }
  db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  db.exec('BEGIN');
  try {
    const counts = {};
    for (const [table, fields] of Object.entries(columns)) {
      const rows = data[table] ?? [];
      if (!Array.isArray(rows)) throw Error(`${table} must be an array`);
      const statement = db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`);
      for (const row of rows) {
        if (Object.keys(row).some(k=>!fields.includes(k))) throw Error(`Unknown ${table} field`);
        for (const field of fields) {
          const v = row[field];
          if (['price_minor','shipping_minor'].includes(field) && v === null) continue;
          if (v === undefined || v === null || (typeof v === 'string' && !v.trim() && field !== 'notes')) throw Error(`Missing ${table}.${field}`);
          if (['price_minor','shipping_minor'].includes(field) && !Number.isSafeInteger(v)) throw Error(`Expected integer ${field}`);
          if (['retrieved_at','observed_at'].includes(field) && (!/^\d{4}-\d\d-\d\dT.*Z$/.test(v) || !Number.isFinite(Date.parse(v)) || Date.parse(v)>Date.now())) throw Error(`Invalid timestamp ${field}`);
          if (field==='sha256' && !/^[a-f0-9]{64}$/.test(v)) throw Error('Invalid SHA-256');
          if (['url','listing_url'].includes(field)) {
            const url = new URL(v);
            if (url.protocol !== 'https:' || url.username || url.password) throw Error('Expected HTTPS URL without credentials');
          }
          if (field==='currency' && !/^[A-Z]{3}$/.test(v)) throw Error('Expected uppercase currency code');
        }
        statement.run(...fields.map(f=>row[f]));
      }
      counts[table] = rows.length;
    }
    db.exec('COMMIT');
    return counts;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error('Usage: node scripts/import-catalog.mjs reviewed.json output.sqlite');
  const data = JSON.parse(readFileSync(input,'utf8'));
  const db = new DatabaseSync(output);
  try { console.log(importCatalog(db, data)); } finally { db.close(); }
}
