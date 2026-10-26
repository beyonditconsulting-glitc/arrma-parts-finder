import { readFileSync, writeFileSync } from 'node:fs';
import { validateSweep } from './validate-discovery.mjs';
const root = new URL('../database/discovery/', import.meta.url);
const sweeps = ['active-vehicles','historical-vehicles'].map(name=>({name,data:JSON.parse(readFileSync(new URL(`${name}.json`,root),'utf8'))}));
const byId=new Map();
for(const {name,data} of sweeps) {
 const check=validateSweep(data); if(!check.complete)throw Error(`${name}: ${check.errors.join(';')}`);
 for(const record of data.records) {
  const existing=byId.get(record.id) ?? {...record,search_matches:[],source_evidence:[]};
  existing.variant_skus=[...new Set([...existing.variant_skus,...record.variant_skus])];
  existing.search_matches.push(name);
  const page=data.pages.find(p=>p.record_ids.includes(record.id));
  existing.source_evidence.push({query:name,source_url:page.source_url,sha256:page.sha256,retrieved_at:page.retrieved_at,locator:record.source_locator});
  existing.literal_sku_version_tokens=record.id.match(/V\d+/g) ?? [];
  existing.revision=null;
  existing.revision_note='Unknown until reviewed against exact product documentation. SKU tokens are preserved literally; color suffixes are not generations.';
  byId.set(record.id,existing);
 }
}
const records=[...byId.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
const variants=new Map();
for(const record of records)for(const id of record.variant_skus) {
 const v=variants.get(id) ?? {id,parent_catalog_ids:[]};v.parent_catalog_ids.push(record.id);variants.set(id,v);
}
const inventory={schema_version:1,dataset_type:'discovered',scope:'Current and discontinued vehicle search results in the Horizon US catalog. Not exhaustive ARRMA history; not a fitment dataset.',catalog_record_count:records.length,variant_sku_count:variants.size,overlapping_query_ids:records.filter(r=>r.search_matches.length>1).map(r=>r.id),records,variant_relationships:[...variants.values()].sort((a,b)=>a.id.localeCompare(b.id))};
writeFileSync(new URL('vehicle-inventory.json',root),JSON.stringify(inventory,null,2)+'\n');
const report=['# ARRMA vehicle discovery inventory','','This is a source-backed discovery list, not a claim that every historical ARRMA version is included. Exact revision and parts compatibility remain unreviewed.','','## Coverage','',...sweeps.map(s=>`- ${s.name}: ${s.data.reported_total} results; pagination and counts validated.`),`- ${records.length} distinct catalog IDs; ${variants.size} distinct represented variant SKUs; ${inventory.overlapping_query_ids.length} IDs occur in both searches.`,'- A variant SKU can identify a color or bundled option. It is not automatically a new generation.','- Missing/deleted older pages, regional models and pre-Horizon history need separate archival research.','- Discontinued-search membership is recorded as a search observation. Some master IDs occur in both searches; inspect product and variant status before assigning lifecycle.','','## Exact indexed models','','| Catalog ID | Official catalog name | Search membership | Variant SKUs |','| --- | --- | --- | --- |',...records.map(r=>`| [${r.id}](${r.product_url}) | ${r.name.replaceAll('|','/')} | ${r.search_matches.join(', ')} | ${r.variant_skus.join(', ')} |`),'','## Next review','','Use the per-product document inventory to review exact generation labels and aliases. Record an explicit citation before assigning a version or fitment. Successor links do not imply compatible parts. Prices and stock are deliberately omitted.',''];
writeFileSync(new URL('VEHICLES.md',root),report.join('\n'));
console.log({catalog_records:records.length,variant_skus:variants.size,overlaps:inventory.overlapping_query_ids.length});
