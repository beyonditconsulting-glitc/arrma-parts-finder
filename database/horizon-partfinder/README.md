# Horizon Hobby part finder extraction

The source model catalog contains 1,140 records across all 14 configured brands:
ARRMA (111), Axial (99), Blade (78), DLE Engines (14), E-flite (289),
Hangar 9 (71), HobbyZone (44), Losi (112), OS Engines (110), Pro Boat (42),
Saito Engines (28), Spektrum (101), Team Losi Racing (24), Top Flite (17).
`models.csv`, `models.json`, and `manifest.json` retain the original model
catalog and retrieval provenance. Raw API responses remain in `raw/`.

Collection is in progress. No full normalized database or full association
exports have been generated yet. `export-audit.json` records this deferred
state; sample verification is not evidence of complete coverage.

## Offline export

Python 3 and its standard library are sufficient. Wait until the collector has
exited and written `collection-summary.json`, then run:

```sh
python /workspace/horizon-partfinder/scripts/export-database.py --collector-complete
```

The flag confirms that collection has stopped; the script also requires the
completion file. A completion file can contain collection errors, so its existence
does not establish complete coverage. Do not run against an active collector or
reuse a stale completion file. The exporter reads local files only and never
modifies raw captures or contacts Horizon. Input hashes are checked again before
publishing the generated files. Export generation occurs in a temporary directory;
a failed build preserves previous exports. Final file replacements are individual,
not an atomic transaction across the entire export directory.

Default output is `exports/`: `horizon.sqlite`, `associations.json/.csv`,
`skus.json/.csv`, `products.json/.csv`, and `export-audit.json`. The full audit is
also copied to the workspace root. JSON arrays and CSV rows represent the same
columns; embedded source objects are JSON strings. CSV uses standard quoting.
Exit code 0 means validation passed, 2 means incomplete/error coverage (or invalid
CLI usage). Fatal unreadable catalog/schema errors stop generation with an error.
Always read the audit before using an export.

For a small test while collection is running:

```sh
python /workspace/horizon-partfinder/scripts/export-database.py --sample 1 --output /tmp/horizon-export-sample
```

Samples are limited to 1–3 models with completed summaries and require a separate
output directory. They do not update the root audit or constitute a full export.

## Database and interpretation

- `models`: all source models, including those with missing or failed collection.
- `skus`: variants keyed by brand/model/SKU, including the collector's model-ID
  fallback when queried, with an explicit `is_fallback` flag; actual source SKUs,
  original color and source JSON are retained. A queried model ID absent from the
  actual SKU list becomes a fallback pseudo-SKU, including the website's <=1 SKU
  dropdown behavior.
- `products`: distinct listed product IDs and the first observed descriptive hit.
- `associations`: unique brand/model/SKU/product rows. These are **Horizon-listed
  associations, not verified fitment**. Accessories and tools are included.
- `captures`: relative source paths, SHA-256 digests, sizes, and timestamps for
  inputs consumed, including source catalog/manifest and available collection summary.
- `coverage`: one row per SKU query, or a missing/invalid-summary row per model;
  expected, observed, unique and duplicate counts, page counts, status and issues.
- `association_captures`: every contributing page for each unique association.
- `product_snapshots` and `sku_snapshots`: per-page product details and price JSON
  for listed products and the response's model product respectively.

Only `partsSearch.productSearch.productIds` creates associations.
`partsSearch.combinedIds` is not merged into results: it can contain separate
category/recommendation content. Raw captures preserve that content for inspection.
The collector intentionally requests `preferences.discontinued=true|false`, including
both active and discontinued products. Category counts in `partsSearch.productCount`
can include tools and accessories; these results are not all replacement parts.
No inference of verified compatibility or classification as replacement parts is made.

Prices retain sales/list values, currency and formatting in snapshot JSON. Snapshot
dates are UTC filesystem modification times of raw files, explicitly labeled as
such in `captures`; the collector does not record a server retrieval timestamp per
page. They are historical observations, not current prices. `products` is a
canonical first-observation view; use snapshot tables for prices and changes.

Validation compares each page's advertised total and expected page length, page
offsets, summary unique counts, actual unique hits, and duplicate hits. Missing
pages, malformed responses, changed source files, query/SKU inconsistencies,
collector errors and absent model summaries cannot become complete coverage.
Primary keys enforce association uniqueness; SQLite foreign-key and integrity
checks run before export. Valid observations from incomplete queries are retained
and their coverage is marked as erroneous. A zero-result query can be complete
only when its captured page and summary consistently report zero.

This is the public part finder extraction, not Horizon's internal database or a
claim that every real-world model, part, or compatibility relationship is covered.

## Completed extraction

All 1,140 source models across 14 brands were collected successfully, covering 1,376 exact SKU/model lookups, 20,357 distinct listed products, and 160,708 source-listed associations. Both the independent coverage audit and exporter validation pass with no missing models, failed queries, duplicate associations or foreign-key errors. The SKU table includes explicit model-ID lookup fallbacks; these are not additional physical variants.

## Published package

The repository package compresses SQLite and CSV/JSON exports with gzip. Source archives under `sources/` preserve the relative `raw/` paths needed for hash verification. Extract each archive into this directory before rerunning audits or exports. `SHA256SUMS` covers every packaged file except itself. The mobile app bundles the compact generated catalog rather than these source archives.

```sh
gzip -dk horizon.sqlite.gz
for horizon_archive in sources/*.tar.gz; do tar -xzf "$horizon_archive"; done
python audit-models.py
python audit-coverage.py
python scripts/export-database.py --collector-complete
```

Collection scripts use the website public guest login and require `pip install -r requirements.txt`; guest tokens remain in memory and are not included in the package. `scripts/collect-models.py` refreshes model discovery; `scripts/collect-details.py` resumes details from saved successful responses. Recollection is a new dated snapshot; preserve the original captures separately first.
