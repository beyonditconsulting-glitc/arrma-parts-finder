# Jenny’s RC exact-number matching and cart links

## Captured scope

`database/discovery/jennys-matches.json` contains conservative matches against the 210-part Kraton ARA8708T1 baseline, including manufacturer-number aliases already supported by Horizon evidence. The public Shopify storefront sweep captured 4,725 unique products over 19 nonempty pages; page 20 was empty. This establishes observed pagination coverage only, not historical completeness or unchanged inventory.

Current result: **5 catalog parts, 25 matched listings, 25 product-linked photos; 205 unresolved parts.** Counts are also machine-readable in the artifact. Most Jenny’s listings combine many part numbers. Those are not equivalent single-item offers and are excluded from exact-price comparisons and cart transfer. This is intentional; do not infer a match to fill gaps.

Matched catalog IDs: ARA310991, ARA320570, ARAC9652 (manufacturer AR480002), SPMXSE2150 and SPMXSM1700.

The matcher requires one explicit primary part number in the product-description section before terms of sale; it does not match a vehicle title or part-number substring. Multi-number assemblies, partial/case-only listings, mixed lots, ambiguous variants, and conflicting stated colors are rejected. This is retailer-reported identity, not independent manufacturer verification of contents. Source wording, product/variant IDs, URL, SHA-256, observation time and locator remain attached to every offer.

Manual review confirmed ARA320754 and ARA320756 appear in multi-component side-guard/battery-tray/mount lots, with actual lists of included parts. They are excluded rather than treating their full lot price/photo as an individual brace.

## Photos

Photos come from the exact matched Jenny’s Shopify product. An image must have the same Shopify product ID and either no variant restriction or the selected variant ID. Variant-specific images are preferred. Images from another product or variant are rejected. The returned URL is the original `https://cdn.shopify.com/...` asset, not a stock truck photo, proxy or fabricated image. Color-conflicting wing listings are excluded. Do not use an unmatched part’s generic retailer image as if it were its product photo.

`getJennyMatch(partId)` provides a deterministic observed-available listing first and otherwise the first captured listing; `getJennyMatches(partId)` exposes all accepted source listings. The chosen product title, condition note and source link should stay visible. This preference does not rank vendors or claim lowest price.

## Price and condition

Each price is an **observed snapshot**, never a live quote. USD is supported by the shop’s captured `/cart.js` currency response. Shipping and tax are unknown. Captured availability can change. Jenny’s states these are parts removed from new models, with its own packaging and possible assembly marks; compare contents and warranty terms rather than treating them as identical sealed retail items.

## Preloaded cart

`buildJennyCart([{partId, quantity}], matches?)` returns `{ready, url, unmatched, lines, observationNote}`. Only exact matched, observed-available variants are eligible. Empty carts, unresolved or unavailable parts, invalid quantities, duplicate selected catalog IDs, wrong vendors and malformed source/variant identity cause failure. **Any unmatched selected line prevents the entire URL; nothing is silently omitted.** Quantities must be safe integers 1–99. Multiple catalog aliases pointing to the same variant aggregate quantities, with a limit of 99. Very long links are rejected.

The supported link format is:

```
https://jennysrc.com/cart/VARIANT_ID:QUANTITY,VARIANT_ID:QUANTITY?storefront=true
```

This is Shopify’s documented stateless cart permalink. It opens the storefront cart instead of directly requesting payment. It is not an authenticated vendor-session integration, price reservation or order submission. The app must not claim transfer succeeded merely because the link was built or opened. The buyer reviews current contents, quantity, availability, shipping, tax and price on Jenny’s site. Existing browser-cart behavior is controlled by the storefront and should not be represented as a guaranteed merge. No actual buyer checkout was performed during implementation.

Official format: https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks

## Refresh and validation

```
python3 scripts/collect-jennys.py
node scripts/match-jennys.mjs /tmp/jennys-storefront.json database/discovery/jennys-matches.json
node --test tests/jennys.test.mjs
npm run lint
npm run typecheck
```

Collector uses at most two requests concurrently and SHA-256-checked cached pages to preserve original observation times. Raw source evidence lives under `/tmp/jennys-storefront-evidence/`; capture metadata is saved in `database/discovery/jennys-captures.json`. To refresh, use a separate empty evidence directory or deliberately archive and clear only the collector’s previous snapshots before rerunning. Never relabel cached observations as newly fetched. The collector stops on a failure and marks pagination incomplete. It caps at 80 pages; absence of an empty final page prevents a completeness claim.

Neither the storefront endpoint nor the matcher infers vehicle compatibility. The existing manufacturer-backed fitment system remains separate.

## Live guest-cart verification

Root tested the supported multi-item link in a fresh, isolated anonymous session. Jenny’s `/cart.js` returned both selected variant IDs at quantity one, with exactly two items total. No checkout or order was submitted. `database/discovery/jennys-cart-verification.json` records only normalized public IDs/counts and scope; no cookies, guest cart token or customer fields are saved to Git. This validates that particular handoff, not future stock, prices or arbitrary quantities.
