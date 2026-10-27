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

- 210 Horizon Hobby source-listed replacement entries for **Kraton 6S EXB (ARA8708T1)** replace the original six sample records.
- Search by name, brand, catalog ID or exact vehicle ID, with title-derived category filters. Results default to an always-visible spreadsheet-style list of the first five matches. Tap a row for details, or use the results-view dropdown for the full vertical card list, paged in batches of 24.
- Part details show a sourced Horizon product photo above the title, using contain sizing, loading feedback and an unavailable-image fallback. Photos load from the source CDN and require connectivity.
- Part details show source evidence and **also listed for** models, separating standard replacements from optional upgrades. The 210 exact part-page captures contain 5,564 associations across 336 distinct model IDs, including other brands; coverage is not exhaustive.
- Search supports both catalog IDs and manufacturer numbers from source specifications. Different model revisions and color SKUs remain separate.
- Three vendor panels keep comparison and add-to-app-cart actions inside the app. Each vendor has a separate SQLite-backed device cart with quantity editing and removal. Native persistence needs device validation.
- Retailer cart transfer is **not connected**. Checkout is explicitly unavailable; final manual-shopping actions warn that items/quantities will not transfer before leaving the app. No source or vendor links launch a browser during normal part comparison.
- Horizon prices are explicitly dated **observed snapshots**, not live quotes. Jenny’s RC and eBay prices are unavailable until connected. Stock remains unverified; no sample prices or invented availability are displayed.
- Fitment is **retailer-listed, pending diagram verification**. The informal “EXB V2” alias has not been independently established for ARA8708T1. Other model versions do not inherit this association.
- Catalog IDs are source identifiers and can differ from manufacturer part numbers. Always check the exact product and model before ordering.
- Unsourced M2C, Perfect Pass and RPM upgrade samples have been removed; Upgrades shows an explicit empty state until evidence-backed records are added.
- Session bookmarks remain available. They do not persist across app restarts.

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

The in-app carts store selected catalog items and quantities on the device. They do **not** represent a remote basket, inventory reservation or completed retailer transfer. Only the explicit final manual-shopping action opens a browser, with a confirmation explaining the limitations. Prices from source pages are captured observations, not a live three-vendor comparison.

Automatic vendor baskets and live comparisons still require supported integrations, verified vendor product/variant or listing IDs, and any required retailer credentials/permissions. No retailer credentials are configured. Do not construct guessed cart endpoints or assume that a catalog/MPN is a vendor variant ID. eBay listing condition and seller identity, Jenny’s exact product variants, and Horizon’s cart session must be handled independently. Seller IDs, currency, shipping, taxes, freshness, quantities, and supported stock need validation before enabling transfer. Store credentials only on a server, never in this mobile bundle.

The cloud access draft now includes `developer.ebay.com`, `jennysrc.com`, `shopify.dev` and `docs.expo.dev`; documentation/storefront requests were blocked when checked. Review/save that draft to apply access and publish to retain the cloud configuration. This does not create retailer accounts or authorize API use.

After pulling this change, run `npm ci` because `expo-sqlite` was added with Expo’s SDK-compatible installer. If local tunnel-package changes prevent Git pull, preserve those changes before merging; do not reset them blindly.
