# eBay pricing access and backend adapter

## Current status

**No developer account, app keyset, production approval or working eBay access has been established.** The cloud currently has no eBay credential bindings or exported eBay variable names. Official documentation is accessible. The server-only adapter and deterministic fixture tests are implemented; no authenticated eBay call has been made, and it is not connected to the mobile app or a deployed backend.

The account owner must register and accept eBay's agreements personally. Do not send credentials in chat or put them in Git, an Expo `EXPO_PUBLIC_*` variable, an app config, a QR code, or the mobile bundle.

## Account-owner steps

1. [Join the eBay Developers Program](https://developer.ebay.com/join), using your real account/contact information and accepting applicable terms. An eBay member account is also required by the published Buy API requirements.
2. Open [Application Keys](https://developer.ebay.com/my/keys). Create a **Sandbox** keyset for testing. The OAuth client ID is the App ID; the client secret is the Cert ID. Sandbox data is test data, not live marketplace pricing.
3. For real pricing, create the corresponding **Production** keyset and complete the production Buy API access process applicable to the app. The published [Buy API requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html#Production) require approval and additional licensing; a developer account or successful token grant alone does not establish production Browse authorization. The documented process includes an [eBay Partner Network account](https://partnernetwork.ebay.com/), the [Buy API application](https://partnernetwork.ebay.com/page/developer-questionnaire), review of the use case/mocks/data flow, and [Developer Support](https://developer.ebay.com/my/support/tickets) review/contracts. Production approval is not guaranteed. Follow current instructions in your eBay account and confirm requirements with support.
4. Store the matching environment's keys in a trusted backend's secret manager and inject them into its process as `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. Choose `EBAY_ENVIRONMENT=sandbox` or `production`; the adapter defaults to sandbox. `EBAY_MARKETPLACE_ID` defaults to `EBAY_US`.
5. Test config and then an authenticated read-only search on that backend. A token grant can succeed while Browse returns 403 for missing API access. Report status/code, never credentials or full upstream authentication responses.

A proxy-only secret placeholder is not a raw credential that this adapter can combine into a Basic OAuth header. The OAuth client needs the actual matching client ID/secret securely available in the trusted server process, or a separately implemented trusted token provider. Do not copy or attempt to extract proxy-held credentials.

## What is implemented

`src/integrations/ebay.mjs` is **Node-only**, using the standard runtime and no new dependencies. It must never be imported by Expo screens or mobile state. A deployed backend is still needed to authenticate/rate-limit app requests and invoke this helper. It is not a public proxy endpoint.

- Application OAuth `client_credentials` grant, scope `https://api.ebay.com/oauth/api_scope`, fixed production/sandbox origins, cached token with expiry margin, and coalesced concurrent token requests. Tokens stay private in a closure.
- No user consent/login flow is required for Browse search. Buyer checkout and vendor-cart operations are separate APIs and are **not** implemented.
- Read-only `searchPart({brand,partNumber}, options)` uses Browse `item_summary/search`, fixed-price buying options, explicit marketplace, optional buyer destination context and validated pagination. Optional GTIN search is exclusive of keyword `q`.
- Search results remain **unverified candidates**: matching words or a number in a listing title is not proof of product identity or fitment.
- `getItemQuote(itemId, part, options)` retrieves item detail and compares the structured seller-reported **brand plus MPN** to the requested identity. Exact normalized equality is labeled `seller_reported_brand_mpn_match`, not manufacturer-verified authenticity/fitment. A mismatch is retained as a mismatch; the caller must exclude it from exact-part comparisons. No alias/fuzzy substitution is performed.
- Quotes retain observation time, environment, price and currency as decimal strings, condition, seller feedback, item URL, buying options, and each shipping option. Missing shipping and stock remain unknown, not free/in stock. Shipping depends on destination and quantity; taxes and combined seller shipping are not calculated.
- Search summaries normally lack availability and structured MPN. Item detail may contain estimated availability; ended listings override that estimate. Unknown future availability states remain unknown.
- Sandbox results are always `sandbox_test_data`; production results are `api_observation`. `isEbayQuoteFresh` checks observation age with a five-minute default and rejects sandbox/ended/future-dated observations. Freshness alone does not establish identity, fitment, checkout availability or permission to display a "verified live" badge.
- Safe status-only upstream errors, bounded request timeouts, HTTPS/TLS verification, fixed-origin requests and redirect rejection. No automatic retries hide 401/403/429 failures. A 401 invalidates the cached token for the next call. `Retry-After` seconds are exposed for an outer queue to respect.

## Backend usage and checks

Node 24 supports `--use-env-proxy` for the inherited proxy settings in this cloud. Preserve inherited proxy/CA configuration; do not disable TLS verification or print auth headers. Credentials must be supplied securely **before** running the commands; do not paste secrets into the command line/history.

```sh
node --use-env-proxy scripts/ebay-check.mjs --check-config
node --use-env-proxy scripts/ebay-check.mjs ARA330654 ARRMA
node --test tests/ebay.test.mjs
```

`--check-config` validates only names/presence, environment and supported marketplace; it does not prove access. The search command prints only normalized public listing observations, not tokens. Its results require manual assessment against the actual requested part and listing condition. The script does not retrieve item details automatically or spend quota on every candidate.

Supported marketplace settings in this first adapter: US, GB, DE, CA, AU, FR, IT and ES. Expand only with documented marketplace/URL handling. Destination is `{country: 'US', postalCode: '90210'}` supplied per request, not stored by the client; do not log users' locations unnecessarily.

## Rates and production work

The official [Buy API limits](https://developer.ebay.com/develop/api/buy/api_call_limits) currently list **5,000 calls/day for Browse methods except `getItems`**, with a separate 5,000/day `getItems` limit. Actual app grants and limits must be checked in the account/Developer Analytics API. Token issuance has its own limits; reuse tokens. Search supports 1–200 results/page, offsets that are multiples of limit, and a 10,000-result ceiling.

Before connecting the app, add a server cache keyed by part identity, environment, marketplace and destination context; deduplicate requests; budget detail calls; enforce per-user/server rate limits; expose stale/error/offline states; and inspect actual granted limits. Never bulk-poll the entire parts database on each app launch. UI presentation must meet applicable eBay display/attribution and privacy requirements. EPN revenue tracking and affiliate URLs require separate configuration; the adapter currently uses the ordinary item URL and claims no affiliate attribution.

A real retailer cart or checkout is outside Browse and this adapter. Linking to a listing or maintaining an app shopping list is not equivalent to adding to eBay's cart.

## Official sources reviewed

Reviewed 2026-10-27. eBay's legacy documentation URLs now redirect into a new documentation site; prefer the linked official OpenAPI for exact parameters and fields.

- [Browse overview](https://developer.ebay.com/develop/api/buy/browse_api)
- [Browse OpenAPI JSON](https://developer.ebay.com/develop/api/spec/browse_api.json): `item_summary/search` scope, q/GTIN/aspect filters, marketplace/context headers, result limits; item detail brand/MPN; seller, shipping, condition and availability fields.
- [OAuth authorization guide](https://developer.ebay.com/develop/guides-v2/authorization#the-client-credentials-grant-flow): token endpoints, Basic client credentials, scope, expiry and token confidentiality.
- [Production Buy requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html)
- [Buy API call limits](https://developer.ebay.com/develop/api/buy/api_call_limits)

Authentication and production access remain **unverified external prerequisites**, not completed setup.
