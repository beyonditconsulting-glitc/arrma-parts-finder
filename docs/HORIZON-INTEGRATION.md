# Horizon Hobby cart integration findings

Research date: 2026-10-27. Scope: publicly documented support for an independent parts-finder app. No account login, customer session, credentials, basket creation, checkout, or outbound support message was used.

## Result

**Customer product links and the customer cart page are confirmed. Automatic third-party cart transfer and a supported multi-item cart permalink are not confirmed.** Do not enable a “sent to Horizon cart” success state on the strength of these pages.

- The official customer cart at <https://www.horizonhobby.com/cart> returns the **Shopping Cart** page.
- Exact product links are available from the source product records already captured in this repository, such as <https://www.horizonhobby.com/product/ARA320754.html>. Catalog identifiers are not sufficient evidence for basket variant IDs, sessions, stock, price guarantees, or tax/shipping totals.
- The official affiliate program at <https://www.horizonhobby.com/affiliate/> describes applications, commission through links, and purchases completed on HorizonHobby.com. The inspected page does **not** document cart creation, a product-data feed entitlement, an external basket API, a multi-item cart URL, or automatic cart transfer. Affiliate acceptance must not be represented as any of those capabilities without confirmation.
- The website’s use of a commerce platform or its own internal cart UI is not evidence that its browser endpoints, client configuration, or customer session can be reused by this app.
- No Horizon integration credential binding was configured when checked. No private storefront configuration or session token was extracted or reused.

This is an **unconfirmed supported-integration result**, not a claim that Horizon cannot provide one under a partner agreement.

## Official route and precise outside prerequisite

Horizon’s official contact route is <https://www.horizonhobby.com/contact/>. The page provides chat/email support and a callback form. It describes chat/email as the quickest channels and asks callers to submit the form with callback details. No contact was submitted by the agent.

The user or an authorized business representative can ask Horizon to route an integration inquiry to its ecommerce/partnership team. Request written confirmation of:

1. Whether an independent mobile comparison app may use an official product, image, price and availability feed/API, including refresh, caching, attribution and permitted-use rules.
2. Whether there is a **supported** multi-item cart link or basket/session API for outside applications. Ask for the exact documentation and supported domain, not a guessed storefront endpoint.
3. How the app obtains verified product/variant IDs and maximum quantities, and whether discontinued or replacement products need separate mapping.
4. Whether a guest cart can be prepared and transferred to the user’s browser, or whether customer authorization is required. Request the supported session/redirect mechanism and origin/app registration requirements.
5. Whether access requires affiliate/dealer/partner approval, issued credentials, approved redirect URIs, or a server-to-server integration; request a test environment and test products.
6. How price, currency, taxes, shipping, stock changes and failed/partial cart additions must be handled before handoff. Do not imply a successful transfer when only some items were accepted.

If Horizon authorizes a Salesforce Shopper API approach, it should supply the applicable organization/site selectors, approved client registration and scopes, guest/customer authentication method, basket operations, and handoff mechanism. These are **requested implementation inputs**, not confirmed existing Horizon access. Keep any issued secrets in secure server configuration; never paste values into chat or ship them in the Expo bundle.

## Current safe app behavior

- Keep Horizon selections and quantities in the app’s explicitly labeled local shopping list.
- Show source-page prices as dated observations, not live quotes or a checkout total.
- Until a supported integration is confirmed and tested, keep automatic transfer unavailable.
- An explicit final manual-shopping action may open the known product URL or customer cart page, but it must say the app’s items and quantities **have not been transferred**. Opening `/cart` does not add items.
- Never construct speculative URLs such as a guessed `/cart/add`, append catalog IDs as presumed variant IDs, or reuse a visitor cookie/client token as authorization for third-party cart operations.

## Product and image reuse

The inspected [official terms](https://www.horizonhobby.com/terms-and-conditions-page/) grant copying for placing an order or promoting products ordered by authorized retailers and state that other reproduction/distribution/republication requires prior written permission. This is a concrete reason to include feed/image-display permission in the partnership request. No permission or authorized-retailer status has been established by this research. Product identity, data accessibility, and display permission should be tracked separately.

## Source evidence

Public response files are retained locally under `/tmp/horizon-*-supported.html`; only this summary and hashes are saved to the repository. The site is dynamic, so later retrieval may differ.

| Official page | Observation | Captured response SHA-256 |
| --- | --- | --- |
| [Contact](https://www.horizonhobby.com/contact/) | HTTP 200, page read | `45da7f0497e73d8f2da6bee8c2bc95c0cb51672eaf6006967542e0d07134b109` |
| [Affiliate program](https://www.horizonhobby.com/affiliate/) | HTTP 200, page read | `02c2f60fb35ca0dda042ea518166942f852f2c381805f47267cf3a4099a133f1` |
| [Customer cart](https://www.horizonhobby.com/cart) | HTTP 200, page read | `8bb64d92f8574acf30b90462b02904f08961df38a246f5546c9b76b998643813` |
| [Terms](https://www.horizonhobby.com/terms-and-conditions-page/) | HTTP 200, page read | `e1024c186156102ab2e941e35a6912ad3ef75c5c1adee04048403f8c2deb45c3` |

The official Salesforce documentation URLs below returned HTTP 403 from this cloud environment:

- <https://developer.salesforce.com/docs/commerce/commerce-api/guide/authorization.html>
- <https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas.html>

`developer.salesforce.com` would need supported network access to continue that documentation review. Their contents were not treated as successfully verified evidence. Even reading those platform docs would not itself grant Horizon-specific integration access.

## Completion status

Completed: official customer cart/product navigation, affiliate scope, contact route, source terms, configured-access check, and an explicit implementation prerequisite list.

Outstanding: Horizon confirmation, any required agreement/app registration/credentials, documented cart/session handoff, validated vendor product/variant mapping, and end-to-end test additions. No remote cart integration is complete yet.
