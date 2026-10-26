# Real catalog ingestion

Status: schema and importer implemented; no real records imported. The app continues to use its clearly labeled sample catalog. No actual fitment or pricing has been verified yet.

This SQLite database is maintained with Node 24 tooling. It is not yet connected to the Expo app. Do not bundle the Node SQLite importer in the mobile app.

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
