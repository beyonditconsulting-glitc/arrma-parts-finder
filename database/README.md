# Real catalog ingestion

Status: schema and reviewed-data importer implemented. Official catalog discovery is now saved under `discovery/`: 112 distinct vehicle catalog IDs, 207 represented variant SKUs, and 210 retailer-listed ARA8708T1 parts entries. These are staging records, not independently verified version/fitment records. No reviewed data has been imported into SQLite. The app now bundles the 210 sourced ARA8708T1 entries as an offline catalog, labeled retailer-listed fitment pending diagram verification, with prices and stock unknown. No actual fitment or pricing has been verified yet.

This SQLite database is maintained with Node 24 tooling. The reviewed SQLite tables are not exposed to the Expo app; the mobile app uses a separate generated discovery snapshot. Do not bundle the Node SQLite importer in the mobile app.

## Source requirements

Use official manufacturer part listings and exact-model exploded diagrams to establish identity and fitment. Capture source URL, publisher, retrieval time (UTC ISO 8601), SHA-256 of the retained source bytes, and a page/section locator for each claim. Retain original documents outside Git when necessary for provenance. A source URL or an import succeeding does not prove a claim; a person must review the association against the document. Do not infer compatibility across generations, wheelbases or voltage variants.

A brand/part-number pair identifies a product. Vehicle fitments link to exact model numbers and revisions. Upgrade products use the same identity and evidence requirements. Manufacturer-verified fitments must be distinguishable from candidate associations.

Retailer prices belong in independent historical offer observations. Unknown price/shipping uses null, never zero. Store integer minor units and currency; record condition, availability, source and observation time. An old observation is never implicitly live. A later API service must apply a freshness policy and source validation before the app labels anything verified live.

## Import

Prepare reviewed JSON with `schema_version: 1`, `dataset_type: "reviewed"`, and arrays `sources`, `vehicles`, `parts`, `fitments`, `offers`. Exact field names are in `schema.sql` and the importer. Omitted arrays are empty. All row fields are required; shipping and price may be null, notes may be empty. No sample rows are included in real datasets.

```sh
node scripts/import-catalog.mjs /path/to/reviewed-catalog.json /path/to/catalog.sqlite
```

The importer creates the schema, validates fields and timestamps, and inserts in a single transaction. Duplicate IDs or brand/part-number pairs are rejected rather than silently overwritten. Foreign keys require existing evidence and exact vehicle references. Any failure rolls back the entire batch. Schema version 1 is intended for initial import; subsequent updates require explicit reviewed migrations or new observation IDs.

Tests use fictional records and an in-memory database only. Run `npm test`.

## Outstanding

1. Permit manufacturer source domains in cloud environment settings, save to apply, then retry source access.
2. Select the initial vehicle and revision, retrieve original documentation and review the parts list.
3. Import reviewed records, verify counts against the source, and inspect representative fitments.
4. Connect a read-only catalog export or API to the app, keeping live offers separate from samples.
5. Add authorized retailer feeds/APIs with freshness handling. No feeds or API credentials have been configured.

## Discovery artifacts

- `discovery/VEHICLES.md`: readable vehicle/model index.
- `discovery/vehicle-inventory.json`: deduplicated catalog IDs with variant relationships and per-query evidence.
- `discovery/active-vehicles.json` and `historical-vehicles.json`: complete captures of their respective current official search result sets. Neither proves all historical ARRMA models are included.
- `discovery/KRATON-PARTS.md` and `kraton-ARA8708T1-parts.json`: retailer-listed replacement associations; not fitment approval.
- `discovery/*-captures.json`: source URL, retrieval time and local retained-response location. Raw public HTML is kept locally in ignored `database/evidence/`, not pushed to Git. Source hashes in each sweep bind the facts to the captured response. Refetching dynamic pages may produce different bytes and should create new observations.

Rebuild a sweep from its retained local evidence:

```sh
node scripts/extract-horizon-sweep.mjs database/discovery/active-vehicles-captures.json database/discovery/active-vehicles.json
node scripts/validate-discovery.mjs database/discovery/active-vehicles.json
node scripts/build-vehicle-inventory.mjs
```

Use `prefnN`/`prefvN` for official search refinements and `start`/`sz` for pagination. URL `offset`, `limit` and `refine` were silently ignored. Inspect selected query refinements in hydration data instead of assuming request parameters applied. Pagination validation catches missing results, duplicate IDs and changed totals. Version aliases, historical coverage, and compatibility still require review.

The per-model pass fetched all 112 indexed product pages without errors and extracted 257 unique document links. `discovery/DOCUMENTS.md` is the readable index; `vehicle-documents.json` contains exact SKU/MPN evidence, product-page hashes, literal revision mentions with context, attachment URLs and parts-relation links. Revision mentions remain unassigned because they can describe a component such as an ESC rather than the vehicle generation.

Refresh the per-model index with cached evidence (no network):

```sh
python3 scripts/collect-vehicle-documents.py
```

Use `--fetch` only to retrieve missing pages. The collector uses the existing HTTPS proxy and TLS verification, at most two concurrent requests and 30-second timeouts. It records failures instead of claiming complete coverage. Raw responses in `database/evidence/product-pages/` are local and ignored by Git. PDF links are inventoried; their content remains unreviewed. Access to `production-na01-horizonhobby.demandware.net` was added to the environment configuration draft because document requests were blocked.
