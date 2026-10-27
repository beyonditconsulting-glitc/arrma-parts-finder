import test from "node:test";
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import {
  createEbayClient,
  readEbayConfig,
  normalizeEbayQuote,
  isEbayQuoteFresh,
  EbayError,
} from "../src/integrations/ebay.mjs";

// Entirely fabricated deterministic fixtures; never imported into the app catalog.
const config = {
  environment: "sandbox",
  marketplaceId: "EBAY_US",
  clientId: "fixture-id",
  clientSecret: "fixture-secret",
};
const part = { brand: "ARRMA", partNumber: "ARA330654" };
const observedAt = "2026-01-01T00:00:00.000Z";
const summary = {
  itemId: "v1|123456789|0",
  title: "TEST ONLY ARRMA ARA330654 arm",
  itemWebUrl: "https://www.ebay.com/itm/123456789",
  price: { value: "19.99", currency: "USD" },
  condition: "Used",
  conditionId: "3000",
  buyingOptions: ["FIXED_PRICE"],
  seller: {
    username: "fixture-seller",
    feedbackPercentage: "99.5",
    feedbackScore: 123,
  },
};
const options = {
  environment: "production",
  marketplaceId: "EBAY_US",
  observedAt,
};
function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

test("configuration requires server credentials and selects sandbox by default", () => {
  assert.throws(() => readEbayConfig({}), /CREDENTIALS_NOT_CONFIGURED/);
  assert.equal(
    readEbayConfig({ EBAY_CLIENT_ID: "fixture", EBAY_CLIENT_SECRET: "fixture" })
      .environment,
    "sandbox",
  );
  assert.throws(
    () => readEbayConfig({ EBAY_ENVIRONMENT: "invalid" }),
    /INVALID_CONFIGURATION/,
  );
});
test("keyword listing is a candidate; missing shipping and stock stay unknown", () => {
  const q = normalizeEbayQuote(summary, part, options);
  assert.equal(q.productIdentity, "unverified");
  assert.equal(q.availability, "unknown");
  assert.deepEqual(q.shippingOptions, []);
  assert.deepEqual(q.price, { value: "19.99", currency: "USD" });
  assert.equal(q.condition, "Used");
  assert.equal(q.seller.feedbackPercentage, "99.5");
  assert.equal(q.fitmentVerified, false);
  assert.equal(q.taxIncluded, null);
});
test("detail identity requires both exact seller-reported brand and MPN, never title similarity", () => {
  assert.equal(
    normalizeEbayQuote(
      { ...summary, brand: "ARRMA", mpn: "ARA330654" },
      part,
      options,
    ).productIdentity,
    "seller_reported_brand_mpn_match",
  );
  assert.equal(
    normalizeEbayQuote(
      { ...summary, brand: "RPM", mpn: "ARA330654" },
      part,
      options,
    ).productIdentity,
    "mismatch",
  );
  assert.equal(
    normalizeEbayQuote(
      { ...summary, brand: "ARRMA", mpn: "ARA330654X" },
      part,
      options,
    ).productIdentity,
    "mismatch",
  );
  assert.equal(
    normalizeEbayQuote({ ...summary, brand: "ARRMA" }, part, options)
      .productIdentity,
    "unverified",
  );
});
test("ended listings, sandbox and stale observations cannot be fresh production observations", () => {
  const q = normalizeEbayQuote(
    {
      ...summary,
      itemEndDate: "2025-12-31T23:00:00Z",
      estimatedAvailabilities: [{ estimatedAvailabilityStatus: "IN_STOCK" }],
    },
    part,
    options,
  );
  assert.equal(q.availability, "ended");
  assert.equal(isEbayQuoteFresh(q, Date.parse(observedAt)), false);
  const live = normalizeEbayQuote(summary, part, options);
  assert.equal(isEbayQuoteFresh(live, Date.parse(observedAt) + 1000), true);
  assert.equal(isEbayQuoteFresh(live, Date.parse(observedAt) + 300000), false);
  assert.equal(isEbayQuoteFresh(live, Date.parse(observedAt) - 1), false);
  assert.equal(
    isEbayQuoteFresh(
      { ...live, dataStatus: "sandbox_test_data" },
      Date.parse(observedAt),
    ),
    false,
  );
});
test("shipping distinguishes explicit free from unavailable and rejects unsafe listing URLs", () => {
  const q = normalizeEbayQuote(
    {
      ...summary,
      itemWebUrl: "https://evil.example/itm/1",
      shippingOptions: [
        { shippingCost: { value: "0.00", currency: "USD" } },
        { shippingCostType: "CALCULATED" },
      ],
    },
    part,
    options,
  );
  assert.equal(q.itemWebUrl, null);
  assert.equal(q.shippingOptions[0].cost.value, "0.00");
  assert.equal(q.shippingOptions[1].cost, null);
  assert.equal(
    normalizeEbayQuote(
      { ...summary, price: { value: "-1", currency: "USD" } },
      part,
      options,
    ).price,
    null,
  );
});
test("OAuth is server-side cached, uses correct scope, and requests marketplace and destination headers", async () => {
  const calls = [];
  const client = createEbayClient(config, {
    now: () => Date.parse(observedAt),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return url.endsWith("/oauth2/token")
        ? response({ access_token: "fixture-access-token", expires_in: 7200 })
        : response({ total: 1, itemSummaries: [summary] });
    },
  });
  const first = await client.searchPart(part, {
    destination: { country: "US", postalCode: "90210" },
  });
  await client.searchPart(part);
  assert.equal(calls.length, 3);
  assert.equal(
    calls[0].url,
    "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
  );
  assert.equal(
    new URLSearchParams(calls[0].init.body).get("scope"),
    "https://api.ebay.com/oauth/api_scope",
  );
  assert.equal(
    calls[0].init.headers.Authorization,
    `Basic ${Buffer.from("fixture-id:fixture-secret").toString("base64")}`,
  );
  assert.equal(calls[1].init.headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_US");
  assert.equal(
    calls[1].init.headers["X-EBAY-C-ENDUSERCTX"],
    "contextualLocation=country%3DUS%2Czip%3D90210",
  );
  assert.equal(new URL(calls[1].url).searchParams.get("q"), "ARRMA ARA330654");
  assert.equal(calls[1].init.redirect, "error");
  assert.equal(first.quotes[0].dataStatus, "sandbox_test_data");
  assert.ok(!JSON.stringify(first).includes("fixture-access-token"));
});
test("concurrent searches share one token grant and expired tokens refresh", async () => {
  let tokenCalls = 0,
    time = Date.parse(observedAt);
  const client = createEbayClient(config, {
    now: () => time,
    fetchImpl: async (url) => {
      if (url.endsWith("/oauth2/token")) {
        tokenCalls++;
        return response({ access_token: "test", expires_in: 120 });
      }
      return response({ total: 0 });
    },
  });
  await Promise.all([client.searchPart(part), client.searchPart(part)]);
  assert.equal(tokenCalls, 1);
  time += 61000;
  await client.searchPart(part);
  assert.equal(tokenCalls, 2);
});
test("getItem uses fixed origin and checks exact item ID before normalizing", async () => {
  const client = createEbayClient(config, {
    now: () => Date.parse(observedAt),
    fetchImpl: async (url) =>
      url.endsWith("/oauth2/token")
        ? response({ access_token: "test", expires_in: 7200 })
        : response({ ...summary, brand: "ARRMA", mpn: "ARA330654" }),
  });
  const q = await client.getItemQuote(summary.itemId, part);
  assert.equal(q.responseKind, "item_detail");
  assert.equal(q.productIdentity, "seller_reported_brand_mpn_match");
  await assert.rejects(
    () => client.getItemQuote("https://evil.example", part),
    /INVALID_ITEM_ID/,
  );
  await assert.rejects(
    () => client.getItemQuote("v1|999|0", part),
    /ITEM_ID_MISMATCH/,
  );
});
test("rate-limit and auth failures are surfaced without leaking upstream secret-bearing bodies", async () => {
  const client = createEbayClient(config, {
    fetchImpl: async () =>
      response(
        { error_description: "fixture-secret fixture-access-token" },
        429,
        { "retry-after": "60" },
      ),
  });
  await assert.rejects(
    () => client.searchPart(part),
    (e) =>
      e instanceof EbayError &&
      e.code === "RATE_LIMITED" &&
      e.retryAfterSeconds === 60 &&
      !e.message.includes("fixture"),
  );
});
test("invalid inputs cannot spend API quota and GTIN search is not mixed with keyword query", async () => {
  let calls = 0;
  const urls = [];
  const client = createEbayClient(config, {
    fetchImpl: async (url) => {
      calls++;
      urls.push(url);
      return url.endsWith("/oauth2/token")
        ? response({ access_token: "test", expires_in: 7200 })
        : response({ total: 0 });
    },
  });
  await assert.rejects(
    () => client.searchPart({ ...part, partNumber: "*" }),
    /INVALID_PART/,
  );
  await assert.rejects(
    () => client.searchPart(part, { limit: 201 }),
    /INVALID_PAGINATION/,
  );
  await assert.rejects(
    () => client.searchPart(part, { limit: 10, offset: 3 }),
    /INVALID_PAGINATION/,
  );
  await assert.rejects(
    () =>
      client.searchPart(part, {
        destination: { country: "US", postalCode: "bad,header" },
      }),
    /INVALID_DESTINATION/,
  );
  assert.equal(calls, 0);
  await client.searchPart(part, { gtin: "0123456789012" });
  const url = new URL(urls[1]);
  assert.equal(url.searchParams.has("q"), false);
  assert.equal(url.searchParams.get("gtin"), "0123456789012");
});
