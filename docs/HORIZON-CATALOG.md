# Horizon offline catalog

`src/horizonCatalog.ts` exposes `horizonBrands`, `horizonMetadata`,
`getHorizonModels(brandId, query = '')`, `getHorizonSkus(brandId, modelId)`,
`getHorizonParts(brandId, modelId, sku, query = '')`, and
`getHorizonCoverage(brandId, modelId, sku)`. IDs are exact, case-sensitive source
identifiers. Search is case-insensitive and matches all whitespace-separated terms.
The returned parts satisfy the existing `Part` type without importing catalog
runtime data. No UI or native API dependency is introduced.

## Build

After the collector has stopped and the parent confirms the full export is ready:

```sh
python scripts/build-horizon-catalog.py
```

The exporter defaults to `/workspace/horizon-partfinder/exports/horizon.sqlite`.
The builder reads it in read-only mode, checks integrity and foreign keys, and
atomically replaces `src/data/horizon-catalog.json`. It never fetches source data.
An explicit completed sample can be used during development:

```sh
python scripts/build-horizon-catalog.py --database /tmp/horizon-export-sample/horizon.sqlite
node --test tests/horizon-catalog.test.mjs
npm run typecheck
EXPO_NO_TELEMETRY=1 npm run lint
```

`--models`, `--database`, and `--output` override paths. Model metadata defaults to
`/workspace/horizon-partfinder/models.json`; the database model rows take
precedence for models present in that export. All metadata models remain visible,
even if no captures exist. The bundled full catalog contains 1,140 models across
14 brands, 1,376 SKU/model lookups, 20,357 products, 160,708 exact associations, and 3,963
captures. All 1,140 models have complete SKU coverage. The exporter reported
complete with zero issues, and the independent coverage audit passed all 1,376
lookups. Nothing here publishes the application.

## Storage and evidence

Schema version 2 stores products once as `[id, name, brand]`, captures once as
`[relativePath, sha256, capturedAt]`, and snapshots once as
`[captureIndex, amountMinorOrNull, currencyOrNull]`. A SKU stores associations as
`[productIndex, relationshipIndex, snapshotIndexes]`; the `relationships` table
stores source relationship labels once. Models contain their own
SKU indexes and coverage. Raw JSON, HTML, images, and complete `Part` objects are
not bundled. The full JSON is 8,084,304 bytes
uncompressed (1,344,221 bytes with gzip for reference). Normalized tables avoid
copying product fields and relationship labels per association. The latest export
capture is `2026-10-28T03:21:53.544548+00:00`.

Parts are materialized only for the requested exact brand/model/SKU tuple.
Model-ID fallback pseudo-SKUs are returned with `is_fallback: true`; their
associations are never spread to other SKUs. Source model labels and association
relationship text are preserved. These are Horizon listings, including tools and
accessories, with no independent fitment assertion. `fitments` carries that
explicit relationship and its capture evidence, rather than asserting verified
compatibility.

Every association includes its source capture hashes, paths/JSON locators, and
observed dates. The public source URL is the Horizon selected-SKU product page;
the precise captured record is identified by the local path and JSON locator.
Product links use the exact product ID. Dates are exporter capture filesystem
mtimes, **not server retrieval timestamps**. `horizonMetadata.observedAt` is the
latest capture time across the export, including metadata, not a freshness promise
for every product.

Only a captured, nonnegative, exact-cent USD sales value becomes `observedPrice`;
list prices, ranges, missing prices, and unsupported currency conversions are not
substituted. The latest snapshot within the selected association supplies the
price and primary provenance. Older evidence is retained in fitment sources.
Prices are dated observations, not live offers. Images and manufacturer part
numbers are null because this module does not independently establish image
access or manufacturer part numbers. Product IDs are never relabeled as MPNs.
No vendor offers or matches to unrelated original catalog records are invented.

## Coverage

`{status, expectedCount, observedCount}` retains the exporter SKU status
(`complete` or `error`) and expected count; observed count is the actual unique
association count. A complete count mismatch is downgraded to `error` by the
builder. A captured complete zero-result query has `expectedCount: 0`,
`observedCount: 0`, and `status: 'complete'`. This says the query returned zero,
not that the vehicle needs no parts.

Model-level status is `complete` when every SKU has complete coverage,
`incomplete` when any SKU has other coverage, and `missing_summary` when no SKUs
exist. This is derived after SKU count validation.

Missing coverage uses `expectedCount: null`, never zero. Models without SKUs
return `missing_summary`; known SKUs without coverage are
`missing_coverage`. Unknown selections return `unknown_model` or `unknown_sku`.
Empty results must be interpreted alongside coverage. Metadata counts include
uncaptured models; SKU/product/association counts reflect only exported records.

The tests exercise exact SKU isolation, evidence/price mapping, source labels,
fallback complete-zero queries, incomplete and missing coverage, and a real
SQLite fixture through the Python builder and TypeScript API.
