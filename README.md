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
- Search by name, brand, catalog ID or exact vehicle ID, with title-derived category filters. Results display in batches of 24.
- Part details show the source relation, capture date, source product link, fitment warning, and retailer search actions.
- **Prices and stock are unknown.** No live offers, sample prices or invented availability are displayed.
- Fitment is **retailer-listed, pending diagram verification**. The informal “EXB V2” alias has not been independently established for ARA8708T1. Other model versions do not inherit this association.
- Catalog IDs are source identifiers and can differ from manufacturer part numbers. Always check the exact product and model before ordering.
- Unsourced M2C, Perfect Pass and RPM upgrade samples have been removed; Upgrades shows an explicit empty state until evidence-backed records are added.
- Session bookmarks remain available. They do not persist across app restarts.

The app imports an offline data snapshot from `src/data/kraton.js`, generated from the captured official lookup in `database/discovery/kraton-ARA8708T1-parts.json`. This snapshot is not a live backend or a verified compatibility database. No new service or credential is required. Regenerate it with:

```sh
node scripts/build-mobile-catalog.mjs
npm test
```

The generator validates pagination and expected source/model relation and deliberately excludes price/stock claims. Tests compare every bundled ID, title, brand, source hash and capture time to the source snapshot. `database/` also contains the separate SQLite reviewed-data schema/importer and the broader vehicle research; those reviewed SQLite tables have not been populated or exposed as an API.

For future live offers, add a server-side integration using authorized retailer feeds/APIs. Keep keys on the server, validate product identity and condition, and record currency, shipping, source, and fetched-at time. Label stale or failed responses explicitly. No live feeds or independently verified fitment data are currently connected.

## Validation scope

Catalog behavior tests and TypeScript validation run in the cloud. Metro exports verify both native JavaScript bundles; this does not replace physical-device testing, native compilation, accessibility review or store signing.

Cloud-specific Metro startup (avoids the unavailable home directory and optional remote metadata):

```sh
mkdir -p /workspace/.expo-state /tmp/pit-cache
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 __UNSAFE_EXPO_HOME_DIRECTORY=/workspace/.expo-state XDG_CACHE_HOME=/tmp/pit-cache npm_config_cache=/tmp/npm-cache npx expo start --localhost --port 8082
```

The Expo-specific home override is implemented by this SDK 58 CLI and should be revisited on upgrades. Cloud startup instructions are also saved in the environment configuration draft.
