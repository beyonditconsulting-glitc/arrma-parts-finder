import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSweep } from '../scripts/validate-discovery.mjs';
function fixture() {
  const page = { limit: 2, total: 3, source_url: 'https://example.com/catalog', sha256: 'a'.repeat(64), retrieved_at: '2026-01-01T00:00:00Z' };
  return { reported_total: 3, pages: [{ ...page, offset: 0, record_ids: ['a', 'b'] }, { ...page, offset: 2, record_ids: ['c'] }], records: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
}
test('a contiguous two-page sweep establishes query-scoped completeness', () => {
  assert.deepEqual(validateSweep(fixture()), { complete: true, reported_total: 3, fetched_count: 3, errors: [] });
});
test('caller status cannot make an interrupted sweep complete', () => {
  const data = fixture(); data.pages.pop(); data.records.pop(); data.status = 'complete';
  assert.equal(validateSweep(data).complete, false);
});
test('rejects unstable totals and noncontiguous pagination', () => {
  for (const mutate of [d => d.pages[1].total = 4, d => d.pages[1].offset = 3]) {
    const data = fixture(); mutate(data); assert.equal(validateSweep(data).complete, false);
  }
});
test('duplicate or substituted IDs cannot hide missing vehicles', () => {
  for (const mutate of [d => d.pages[1].record_ids = ['a'], d => d.records[2].id = 'b', d => d.records[2].id = 'different']) {
    const data = fixture(); mutate(data); assert.equal(validateSweep(data).complete, false);
  }
});
test('requires usable source evidence and rejects future retrieval dates', () => {
  for (const patch of [{ source_url: 'http://example.com' }, { source_url: 'https://user:pass@example.com' }, { sha256: 'invalid' }, { retrieved_at: '2099-01-01T00:00:00Z' }, { retrieved_at: '2026-02-30T00:00:00Z' }]) {
    const data = fixture(); Object.assign(data.pages[0], patch); assert.equal(validateSweep(data).complete, false);
  }
});
test('zero results need an actual evidence page and empty record set', () => {
  assert.equal(validateSweep({ reported_total: 0, pages: [], records: [] }).complete, false);
  const data = fixture(); data.reported_total = 0; data.pages = [{ ...data.pages[0], total: 0, record_ids: [] }]; data.records = [];
  assert.equal(validateSweep(data).complete, true);
});
