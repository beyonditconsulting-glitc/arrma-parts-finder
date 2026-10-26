import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Completeness applies only to the supplied query/filter sweep, not all ARRMA history.
export function validateSweep(sweep) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const total = sweep?.reported_total;
  const pages = Array.isArray(sweep?.pages) ? sweep.pages : [];
  const records = Array.isArray(sweep?.records) ? sweep.records : [];
  if (!Number.isSafeInteger(total) || total < 0) fail('Invalid reported_total');
  if (!Array.isArray(sweep?.pages) || !pages.length) fail('At least one evidence page is required');
  if (!Array.isArray(sweep?.records)) fail('records must be an array');
  const seen = new Set();
  let nextOffset = 0;
  for (const [index, page] of pages.entries()) {
    const label = `Page ${index}`;
    if (!page || typeof page !== 'object') { fail(`${label} is invalid`); continue; }
    if (!Number.isSafeInteger(page.offset) || page.offset !== nextOffset) fail(`${label} has a noncontiguous offset`);
    if (!Number.isSafeInteger(page.limit) || page.limit < 1) fail(`${label} has an invalid limit`);
    if (page.total !== total) fail(`${label} has an unstable total`);
    try {
      const url = new URL(page.source_url);
      if (url.protocol !== 'https:' || url.username || url.password) throw Error();
    } catch { fail(`${label} requires an HTTPS source without credentials`); }
    if (typeof page.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(page.sha256)) fail(`${label} has an invalid SHA-256`);
    const date = page.retrieved_at;
    const time = typeof date === 'string' ? Date.parse(date) : NaN;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(date) ||
        !Number.isFinite(time) || time > Date.now() || new Date(time).toISOString().slice(0, 10) !== date.slice(0, 10)) fail(`${label} has an invalid retrieval date`);
    const ids = Array.isArray(page.record_ids) ? page.record_ids : [];
    if (!Array.isArray(page.record_ids)) fail(`${label} record_ids must be an array`);
    if (ids.length !== Math.min(page.limit, Math.max(0, total - page.offset))) fail(`${label} has an incomplete record count`);
    if (total > 0 && page.offset >= total) fail(`${label} lies beyond reported results`);
    if (total === 0 && index > 0) fail('Empty sweep has redundant pages');
    for (const id of ids) {
      if (typeof id !== 'string' || !id.trim()) fail(`${label} has an invalid record ID`);
      if (seen.has(id)) fail(`${label} repeats record ID ${id}`);
      seen.add(id);
    }
    nextOffset = page.offset + page.limit;
  }
  const recordIds = new Set();
  for (const record of records) {
    const id = record?.id;
    if (typeof id !== 'string' || !id.trim()) fail('records contains an invalid ID');
    if (recordIds.has(id)) fail(`records repeats ID ${id}`);
    recordIds.add(id);
  }
  if (seen.size !== total || records.length !== total) fail('Fetched cardinality does not match reported_total');
  if (seen.size !== recordIds.size || [...seen].some(id => !recordIds.has(id))) fail('Page IDs do not match supplied records');
  return { complete: errors.length === 0, reported_total: total ?? null, fetched_count: records.length, errors };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw Error('Usage: node scripts/validate-discovery.mjs sweep.json');
  const result = validateSweep(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.complete ? 0 : 1;
}
