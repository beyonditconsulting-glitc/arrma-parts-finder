# Pit Finder

Native iPhone and Android app built with React Native, Expo SDK 58 and TypeScript.

## Development

Use Node 24 (tested with 24.19.0) and npm 11. From this checkout:

```sh
npm ci
EXPO_NO_TELEMETRY=1 npm start
```

Open with a compatible Expo Go version or use a development build. A cloud localhost Metro server cannot be reached directly from a physical phone without supported forwarding. For local development use the normal LAN connection. Android emulator: `npm run android`. iOS simulator: `npm run ios` on macOS with Xcode. Native binaries require Android SDK or macOS/Xcode, or a separately configured Expo EAS build account. No signed binaries are included.

```sh
npm test
npm run typecheck
npm run lint
EXPO_NO_TELEMETRY=1 npx expo export --platform ios --platform android
```

## Features and data boundaries

- **Explore → All Horizon models** adds searchable brand, model and exact SKU/model lookup selection for all 1,140 models across 14 configured brands, including discontinued models. Each lookup retains its own parts/accessory associations, coverage counts, capture evidence and dated prices. The existing detail, saving and vendor-cart controls work with these entries. See [Horizon catalog](docs/HORIZON-CATALOG.md) and the [database package](database/horizon-partfinder/README.md).
- 210 Horizon Hobby source-listed replacement entries for **Kraton 6S EXB (ARA8708T1)** replace the original six sample records.
- Search by name, brand, catalog ID or exact vehicle ID, with title-derived category filters. Results default to an always-visible spreadsheet-style list of the first five matches. Tap a row for details, or use the results-view dropdown for the full vertical card list, paged in batches of 24.
- Full cards and details use bundled Jenny’s product photos for the 5 exact supported parts. Image bytes are included with the app and their source/asset hashes are recorded, avoiding retailer CDN requests during normal use. The denied Horizon fallback is disabled; unmatched parts explicitly show that no exact Jenny photo is available. In Expo Go, the app assets still need to load from the running Metro server at least once.
- Part details show source evidence and **also listed for** models, separating standard replacements from optional upgrades. The 210 exact part-page captures contain 5,564 associations across 336 distinct model IDs, including other brands; coverage is not exhaustive.
- Search supports both catalog IDs and manufacturer numbers from source specifications. Different model revisions and color SKUs remain separate.
- Three vendor panels keep comparison and add-to-app-cart actions inside the app. Each vendor has a separate SQLite-backed device cart with quantity editing and removal. Native persistence needs device validation.
- **Jenny’s preloaded-cart handoff is enabled for entirely matched carts.** It batches exact captured Shopify variants and quantities and fails the whole link if any selection is unresolved/unavailable. A fresh anonymous two-item test confirmed both IDs and quantities; no order was submitted. eBay/Horizon transfer remains unavailable. No vendor links launch a browser during normal part comparison; the final handoff requires confirmation.
- Horizon and the 5 matched Jenny’s parts display explicitly dated **observed snapshots**, not live quotes. Jenny’s coverage is 5/210 parts across 25 listings; all remaining matches stay unresolved. Take-off packaging/condition differences are visible. eBay prices are not connected; no sample prices or invented availability are displayed.
- Fitment is **retailer-listed, pending diagram verification**. The informal “EXB V2” alias has not been independently established for ARA8708T1. Other model versions do not inherit this association.
- Catalog IDs are source identifiers and can differ from manufacturer part numbers. Always check the exact product and model before ordering.
- The separate Upgrades tab is removed. M2C Racing, Perfect Pass and RPM upgrade vendor options now appear under each part’s Compare vendors section, explicitly marked unmatched until sourced fitment, prices and listings are available. No invented offer is added to a cart.
- Session bookmarks remain available. They do not persist across app restarts.
- **🎬 Maintenance** includes 32 unique official Horizon ARRMA support videos from 34 source entries. Search by topic, model wording or tool, then play inside the app with source-provided tool lists. No media is rehosted. Provider availability/embedding controls apply; video playback needs on-device validation.
- Shared-vehicle lists paginate five rows at a time after grouping Standard, Optional and Other/mixed evidence, so optional listings cannot hide earlier standard matches.

The app imports an offline data snapshot from `src/data/kraton.js`, generated from the captured official lookup in `database/discovery/kraton-ARA8708T1-parts.json`. This snapshot is not a live backend or a verified compatibility database. No new service or credential is required. Regenerate it with:

```sh
node scripts/collect-part-associations.mjs
node scripts/build-mobile-catalog.mjs
npm test
```

The generator validates pagination, expected source/model relation, and complete part-page capture. It merges explicit vehicle associations by exact model ID, preserves optional/standard distinctions, and keeps captured Horizon prices separate from live offers. Missing parent associations never imply exclusive fitment. Tests compare every bundled ID, title, brand, source hash and capture time to the source snapshot. `database/` also contains the separate SQLite reviewed-data schema/importer and the broader vehicle research; those reviewed SQLite tables have not been populated or exposed as an API.

For future live offers, add a server-side integration using authorized retailer feeds/APIs. Keep keys on the server, validate product identity and condition, and record currency, shipping, source, and fetched-at time. Label stale or failed responses explicitly. No live feeds or independently verified fitment data are currently connected.

## Validation scope

Catalog behavior tests and TypeScript validation run in the cloud. Metro exports verify both native JavaScript bundles; this does not replace physical-device testing, native compilation, accessibility review or store signing.

Cloud-specific Metro startup (avoids the unavailable home directory and optional remote metadata):

```sh
mkdir -p /workspace/.expo-state /tmp/pit-cache
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 __UNSAFE_EXPO_HOME_DIRECTORY=/workspace/.expo-state XDG_CACHE_HOME=/tmp/pit-cache npm_config_cache=/tmp/npm-cache npx expo start --localhost --port 8082
```

The Expo-specific home override is implemented by this SDK 58 CLI and should be revisited on upgrades. Cloud startup instructions are also saved in the environment configuration draft.

## Retailer integration status

The local carts store selections and quantities on the device. The final supported Jenny’s action opens a documented Shopify cart permalink; it is not an order, stock reservation or price guarantee. A second live QA check established that the link replaces the existing merchant cart rather than merging it, so the final confirmation explicitly discloses that effect. It is enabled only when every selected line has an exact observed-available match. Partial carts never silently omit unmatched items. See [Jenny’s integration](docs/JENNYS.md) and [the live handoff receipt](database/discovery/jennys-cart-verification.json).

The public Jenny’s sweep captured 4,725 products, but strict identity/content checks accepted only 5 current catalog parts across 25 listings. Multi-part lots are deliberately excluded from individual-part prices/photos. The default choice is deterministic and observed-available, not a cheapest-price claim. Root verified one two-item cart in a fresh isolated guest session and visually checked a matched product image. Device UI/persistence and embedded video playback remain phone checks.

The eBay server-only Browse adapter and tests exist, but no account, keys, production approval, deployed backend or authenticated request has been established. It must never be imported into the mobile app. The owner must [join eBay Developers](https://developer.ebay.com/join), create keys, obtain required production access and configure raw credentials in a trusted backend secret manager. Proxy placeholders cannot be combined as raw Basic OAuth credentials. See [eBay setup](docs/EBAY.md).

Horizon’s customer cart page is confirmed; a supported third-party multi-item transfer method is not. Do not guess endpoints or reuse private storefront client/session credentials. See [Horizon findings](docs/HORIZON-INTEGRATION.md).

The compatibility work captured a complete 206-entry MOJAVE ARA7704V3 retailer parts relation: 142 shared IDs and 64 additional IDs. This is staged research, not an expanded reviewed mobile catalog. Official diagram PDFs still return an upstream HTTP 403; zero fitments have been marked diagram-verified. See [diagram status](docs/DIAGRAM-VERIFICATION.md).

## Maintenance source and playback

The source is [Horizon Hobby ARRMA Support](https://www.horizonhobby.com/hh-support-arrma/). `src/data/maintenance.js` preserves source titles, reused-title aliases, descriptions, required items, locators, source hash and capture time. The extraction deduplicates 34 entries into 32 video IDs. Rebuild using the retained local response:

```sh
node scripts/extract-maintenance.mjs database/evidence/maintenance.html
```

Videos use a privacy-enhanced YouTube iframe inside `react-native-webview`, with the actual app bundle identifier as the WebView base origin, inline/fullscreen controls, manual play, an error/retry state and no external navigation by default. The film icon appears in main navigation and part details link to the library. The app does not download or rehost videos, guarantee embedding availability or claim tutorial applicability to every part. Player readiness, network errors and provider errors remain distinct from catalog tests.

The environment draft preserves existing domains and adds the necessary source/document/player hosts for review. Saving it is not publication or proof that a publisher permits a request. Review/save and publish in environment settings when preserving the cloud setup. Some upstream hosts still deny document access even when proxy connection succeeds.

After pulling, run `npm ci`; the new player uses the Expo-compatible `react-native-webview`. Preserve local tunnel-package edits before merging if Git reports a conflict; do not reset them blindly.

## Bundled product photos

The Horizon image CDN returned HTTP 403 for both captured dynamic and original image URLs. The app no longer retries those URLs. `assets/products/` holds the five exact Jenny product images; `database/discovery/bundled-product-photos.json` records the original source URLs, source hashes, asset hashes, byte counts and capture times. `src/productPhotoAssets.ts` uses static React Native asset imports guarded by exact source URL, so future metadata cannot silently reuse a stale asset mapping.

Rebuild after supported photo mappings change:

```sh
node scripts/bundle-product-photos.mjs
```

Verified unchanged cached bytes are reused without downloading. Use `--refresh` for an intentional source refresh. Downloads retain normal proxy/TLS verification, reject unsupported/non-image responses and replace files only after successful retrieval. No photo is assigned to an unresolved part merely to fill the UI.
