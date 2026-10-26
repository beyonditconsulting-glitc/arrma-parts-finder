import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateSweep } from './validate-discovery.mjs';

// Parse only the public product-search hydration payload, never page instructions.
export function extractPage(html, sourceUrl, retrievedAt) {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'www.horizonhobby.com') throw Error('Expected official Horizon HTTPS source');
  const match = html.match(/<script id="mobify-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw Error('Search hydration data missing');
  const state = JSON.parse(match[1]).__PRELOADED_STATE__?.__STATE_MANAGEMENT_LIBRARY?.store?.productStore;
  const entries = Object.entries(state?.searchResultsByKey ?? {});
  if (entries.length !== 1) throw Error('Expected exactly one search result set');
  const [key, result] = entries[0];
  const query = JSON.parse(key);
  if (!Array.isArray(result.hits) || !Number.isSafeInteger(result.total)) throw Error('Incomplete search response');
  const records = result.hits.map(hit => ({
    id: hit.productId, name: hit.productName,
    product_url: `https://www.horizonhobby.com/product/${encodeURIComponent(hit.productId)}.html`,
    hit_type: hit.hitType,
    brand: hit.c_brand ?? null,
    variant_skus: [...new Set((hit.representedProducts ?? []).map(v=>v.id))],
    declared_discontinued: hit.c_tileData?.discontinued ?? null,
    successor: hit.c_tileData?.replacedByItem ?? null,
    evidence_status: 'discovered',
    revision: null,
    source_locator: `mobify-data productStore.searchResultsByKey[${key}].hits[productId=${hit.productId}]`,
  }));
  return {page: {
    source_url: sourceUrl, retrieved_at: retrievedAt,
    sha256: createHash('sha256').update(html).digest('hex'),
    offset: query.offset, limit: query.limit, total: result.total,
    record_ids: records.map(r=>r.id), query,
  }, records};
}
export function assembleSweep(captures) {
  const pages = captures.map(c=>c.page).sort((a,b)=>a.offset-b.offset);
  const sweep = {reported_total:pages[0]?.total, pages, records:captures.flatMap(c=>c.records)};
  const validation = validateSweep(sweep);
  if (!validation.complete) throw Error(`Incomplete sweep: ${validation.errors.join('; ')}`);
  return {...sweep, validation, scope:'Only these official search queries; not all ARRMA history. Variant SKUs are not generations.'};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [planFile, output] = process.argv.slice(2);
  if (!planFile || !output) throw Error('Usage: node scripts/extract-horizon-sweep.mjs captures.json output.json');
  const plan = JSON.parse(readFileSync(planFile,'utf8'));
  const sweep = assembleSweep(plan.map(p=>extractPage(readFileSync(p.file,'utf8'),p.url,p.retrieved_at)));
  writeFileSync(output, JSON.stringify(sweep,null,2)+'\n');
  console.log(sweep.validation);
}
