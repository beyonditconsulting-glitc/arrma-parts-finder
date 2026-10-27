# Official diagram verification and catalog expansion

## Result

**No fitment has been promoted to diagram-verified.** The two official document downloads below returned HTTP 403 Forbidden. No PDF bytes were retained, so there is no document checksum, page inspection, or diagram-content claim for either model.

| Exact model | Official product | Document identified by the product page | Retrieval outcome |
| --- | --- | --- | --- |
| ARA8708T1 | [KRATON 6S EXB RTR](https://www.horizonhobby.com/product/ARA8708T1.html) | [ARA8708T1 exploded view](https://production-na01-horizonhobby.demandware.net/on/demandware.static/-/Sites-horizon-master/default/dwffc2e7cc/Manuals/ARA8708T1_EXPLODED_VIEW_MULTI.PDF) | HTTP 403; not retrieved or reviewed |
| ARA7704V3 | [MOJAVE 6S EXB RTR](https://www.horizonhobby.com/product/ARA7704V3.html) | [ARA7704V3 tech pack](https://production-na01-horizonhobby.demandware.net/on/demandware.static/-/Sites-horizon-master/default/dw0df764fa/Manuals/ARA7704V3_TECH_PACK.pdf) | HTTP 403; not retrieved or reviewed |

The required document hostname is `production-na01-horizonhobby.demandware.net`. It was already declared in the configuration draft; actual requests still failed. A saved requirement is not proof that the running instance permits access. Do not disable TLS checks, route around the session proxy, or substitute another host to evade the denial. Apply the supported access configuration, or supply the original official PDFs securely, then retry the affected retrieval.

`database/discovery/diagram-verification.json` retains exact product source URLs and hashes, document URLs, recorded outcomes and an explicit zero verified-fitment count.

## Expansion accomplished independently

The accessible official Horizon replacement-parts relation for **MOJAVE 6S EXB ARA7704V3** returned **206 catalog entries**. All 206 entries were captured across two pages and passed pagination/cardinality checks:

- **142** exact catalog IDs also occur in the current 210-entry Kraton catalog.
- **64** catalog IDs are outside the current Kraton catalog.
- The query explicitly retained `parentProduct=ARA7704V3`, `relationType=Standardparts`, and the actual `c_discontinued=false` refinement.
- This is a retailer-listed association, not an independently reviewed diagram fitment. It does not establish all historical parts or cross-version compatibility.
- IDs are retailer catalog identifiers, which may differ from manufacturer part numbers. Do not use an `ARAC…` catalog ID as a manufacturer number without checking the corresponding product's manufacturer-number evidence.

Artifacts:

- `database/discovery/diagram-mojave-discovery.json`: 206 source records with source URL/hash/time/locator and checked page coverage.
- `database/discovery/diagram-mojave-captures.json`: exact capture plan.
- `database/discovery/diagram-expansion-summary.json`: exact shared/new catalog-ID sets and explicit unverified status.
- Raw public responses are retained locally under ignored `database/evidence/diagrams/mojave-source-parts-*.html`; they are not PDF evidence and are not pushed to Git.

The app's generated catalog has **not** been altered by this research task. The parent task can integrate these discovery records without labeling them diagram-verified after obtaining source identities, images and manufacturer numbers for the new entries.

## Review tooling

`pdftotext` is installed. Once an authentic official PDF has been retrieved and its source provenance recorded, use:

```sh
node scripts/diagram-source-scan.mjs \
  /path/to/official-diagram.pdf \
  ARA8708T1 \
  /path/to/manufacturer-part-numbers.json \
  /path/to/review-candidates.json
```

The part-number input is an array of exact manufacturer numbers, for example `["ARA320754"]`. The scanner checks the `%PDF-` signature, records the actual document SHA-256, preserves physical page numbers, and performs exact token matching. It deliberately returns **pending visual review**, never verified compatibility. A part-number occurrence can be an optional accessory, a cross-reference, or another assembly.

Before approving any fitment:

1. Inspect the document's exact model identity and edition/revision. An informal “EXB V2” name is not automatically equivalent to ARA8708T1, and a V6 document does not prove an older model's fitment.
2. Render and inspect the relevant PDF page and assembly callout. Text-only occurrences are candidate evidence.
3. Record exact manufacturer part number, exact model ID, document source URL, checksum, page number, assembly/callout locator, review status and notes. Keep standard replacement and optional-upgrade evidence distinct.
4. Preserve other source associations as unverified rather than overwriting them with a broad family-level claim.

Tests cover exact model/generation isolation, part-number token boundaries, preserved page locations, and the prohibition on automatic verification.

## Follow-up denial diagnosis

A root follow-up connected through the proxy (HTTP CONNECT 200), then the official Kraton PDF host returned an upstream HTTP 403 with Cloudflare response headers. This is not evidence that another duplicate network permission will fix it. No challenge or access control was bypassed. Obtain a publisher-supported accessible document link or an original official PDF supplied by the user, then verify the exact model header and page callouts. No document-verified claim has been added.
