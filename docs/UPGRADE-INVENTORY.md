# Upgrade vendor inventory

Requested catalogs: M2C Racing, Perfect Pass, Basher Bodies (user also typed “Baser Bodies”).

## Current status

No products have been imported into the app for these three vendors. Initial proxy denials briefly cleared and the following public sources were inspected on 2026-10-27:

- M2C Racing: `https://m2cracing.net/` embeds Ecwid store **77005013**. Its site sitemap does not enumerate products. The full Ecwid catalog is still unresolved; `app.ecwid.com` and the store-specific default `store77005013.company.site` are saved as discovery destinations, not confirmed inventory APIs.
- Perfect Pass: `https://www.perfectpassrc.com/` is a Shopify storefront showing USD. `products.json?limit=250&page=1` contained **143 products / 304 variants**; page 2 was empty. The product sitemap contained 144 URL entries including the homepage. Exact URL reconciliation remains to be completed by the collector before importing.
- Basher Bodies: `https://www.basherbodies.com/sitemap.xml` published **170 product URLs**. A sample product page exposed explicit variants, per-variant stock, base prices in EUR and optional decal surcharges. These are not manufacturer-confirmed fitments.

The runtime then returned to an enforced package-manager-only network policy; subsequent catalog requests failed at HTTPS CONNECT with 403. Previously inspected responses in temporary storage were unavailable after that transition. Counts above are discovery observations, not a retained and verified complete capture. The saved network draft includes the vendor domains, www counterparts and Ecwid discovery destinations; it must be applied before collection can resume. No collected products, prices or stock have been manufactured from these summary counts.

The app now has expandable, searchable vendor catalogs under each part’s Compare vendors section. Empty catalogs are explicitly labeled not sourced, with no sample prices or compatibility claims. RPM remains listed as unsourced. Products are not displayed as replacements based on title or vehicle-family similarity. No cart integration is implied.

## Capture and import

After network access is enabled, first confirm official domains and inspect each vendor’s public catalog and pagination. The included `python scripts/collect-upgrade-inventory.py` collector supports the inspected Perfect Pass Shopify feed/sitemaps and Basher Bodies sitemap/product HTML. Its full-network run is pending. M2C still needs a verified public Ecwid catalog source and collector. Do not assume or probe authenticated merchant APIs. Retain raw response bytes under ignored `database/evidence/upgrade-inventory/`. Capture all published categories, pagination and variants, including sold-out listings, and record omissions. A public catalog is not private warehouse inventory. Record the observed product and variant totals, each requested URL, timestamp, response SHA-256, pagination termination and errors in `database/discovery/upgrade-inventory-captures.json`. Do not call coverage complete until those counts reconcile. Do not bypass access challenges.

Normalize into the schema in `src/upgradeInventory.ts` and `src/data/upgrade-inventory.json`. IDs must be stable per variant. Preserve vendor SKU, variant options, exact source product URL, capture timestamp and raw-source SHA-256. Unknown prices must be null; stock must be unknown unless explicitly supplied. A captured price requires a decimal amount and ISO currency. Keep every distinct variant; do not collapse unavailable variants or invent prices from marketing text. `partial` means coverage is incomplete; `captured` means a catalog snapshot, never a live feed. Compatibility requires a separate exact-version source review and is not imported by this schema.

Run:

```bash
python scripts/collect-upgrade-inventory.py
node scripts/import-upgrade-inventory.mjs /tmp/normalized-upgrade-inventory.json database/evidence/upgrade-inventory
npm run typecheck
npm run lint
npm test
```

The importer validates all three vendors and requires raw evidence bytes matching each product’s source hash before atomically replacing the bundled snapshot. It performs no network calls. Review source identity, variant mapping, capture coverage and evidence manually before importing; schema validation alone cannot establish those facts. The app bundles imported rows for local browsing, searches title/SKU/variant, shows 20 at a time, labels prices and availability as captured, and keeps users in the app. No external vendor navigation or cart transfer is added here.
