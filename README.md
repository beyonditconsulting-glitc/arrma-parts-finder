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

- Search by vehicle, name, number or brand; combine vehicle and category filters.
- Compare sample prices from Horizon Hobby, Jenny’s RC and eBay and open retailer searches.
- Explore illustrative M2C, Perfect Pass and RPM upgrades.
- Save parts for the current app session. Bookmarks do not survive restarting the app.
- Accessible labels, dismissible native comparison and vehicle-selection sheets, empty search state.

Every record in `src/catalog.ts` is **sample data**. Part numbers, model associations, prices and upgrade compatibility are not verified. Stock is unknown. Search links do not establish availability or exact product matches. Check manufacturer exploded diagrams, revision, dimensions and retailer details before ordering. No live retailer APIs or scraping are implemented, and no credentials are required for this demo.

For production live offers, add a server-side integration using authorized retailer feeds/APIs. Keep keys on the server. Validate product identity, currency, shipping, condition, source, fetched-at time and fitment evidence. Clearly mark stale or failed responses and never relabel sample fallback data as live. Verified offers should have source provenance and a verification timestamp. Retailer authorization and independently verified fitment data are outstanding production work.

## Validation scope

Catalog behavior tests and TypeScript validation run in the cloud. Metro exports verify both native JavaScript bundles; this does not replace physical-device testing, native compilation, accessibility review or store signing.

Cloud-specific Metro startup (avoids the unavailable home directory and optional remote metadata):

```sh
mkdir -p /workspace/.expo-state /tmp/pit-cache
EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 __UNSAFE_EXPO_HOME_DIRECTORY=/workspace/.expo-state XDG_CACHE_HOME=/tmp/pit-cache npm_config_cache=/tmp/npm-cache npx expo start --localhost --port 8082
```

The Expo-specific home override is implemented by this SDK 58 CLI and should be revisited on upgrades. Cloud startup instructions are also saved in the environment configuration draft.
