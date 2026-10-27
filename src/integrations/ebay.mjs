/** Server-only eBay Browse adapter. Never import from Expo/mobile code. */
import { Buffer } from "node:buffer";

const SCOPE = "https://api.ebay.com/oauth/api_scope";
const ORIGINS = {
  production: "https://api.ebay.com",
  sandbox: "https://api.sandbox.ebay.com",
};
const MARKETS = {
  EBAY_US: ["US", "ebay.com"],
  EBAY_GB: ["GB", "ebay.co.uk"],
  EBAY_DE: ["DE", "ebay.de"],
  EBAY_CA: ["CA", "ebay.ca"],
  EBAY_AU: ["AU", "ebay.com.au"],
  EBAY_FR: ["FR", "ebay.fr"],
  EBAY_IT: ["IT", "ebay.it"],
  EBAY_ES: ["ES", "ebay.es"],
};

export class EbayError extends Error {
  constructor(code, { status = null, retryAfterSeconds = null } = {}) {
    // Deliberately omit upstream bodies, tokens, credentials and request headers.
    super(`eBay ${code}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "EbayError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export function readEbayConfig(env = process.env) {
  const environment = env.EBAY_ENVIRONMENT || "sandbox";
  const marketplaceId = env.EBAY_MARKETPLACE_ID || "EBAY_US";
  if (!ORIGINS[environment] || !MARKETS[marketplaceId])
    throw new EbayError("INVALID_CONFIGURATION");
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET)
    throw new EbayError("CREDENTIALS_NOT_CONFIGURED");
  return {
    environment,
    marketplaceId,
    clientId: env.EBAY_CLIENT_ID,
    clientSecret: env.EBAY_CLIENT_SECRET,
  };
}
function validatePart(part) {
  if (
    !part ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(part.partNumber || "") ||
    !/^[\p{L}\p{N} .&+'-]{1,80}$/u.test(part.brand || "") ||
    !part.brand.trim()
  )
    throw new EbayError("INVALID_PART");
}
function amount(value) {
  if (
    !value ||
    typeof value.value !== "string" ||
    !/^\d{1,15}(?:\.\d{1,6})?$/.test(value.value) ||
    !/^[A-Z]{3}$/.test(value.currency || "")
  )
    return null;
  return { value: value.value, currency: value.currency };
}
function identity(item, part) {
  const norm = (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : "";
  // Titles/keyword hits never establish identity. No fuzzy matching or alias substitution.
  if (!norm(item.brand) || !norm(item.mpn)) return "unverified";
  return norm(item.brand) === norm(part.brand) &&
    norm(item.mpn) === norm(part.partNumber)
    ? "seller_reported_brand_mpn_match"
    : "mismatch";
}
function listingUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !Object.values(MARKETS).some(
        ([, host]) => url.hostname === host || url.hostname === `www.${host}`,
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
/** Maps an actual API observation. Does not establish physical fitment or seller accuracy. */
export function normalizeEbayQuote(
  item,
  part,
  {
    environment,
    marketplaceId,
    observedAt,
    shippingContext = "not_provided",
    responseKind = "search_summary",
  },
) {
  validatePart(part);
  if (
    !ORIGINS[environment] ||
    !MARKETS[marketplaceId] ||
    !Number.isFinite(Date.parse(observedAt)) ||
    !item?.itemId ||
    (item.estimatedAvailabilities != null &&
      !Array.isArray(item.estimatedAvailabilities)) ||
    (item.shippingOptions != null && !Array.isArray(item.shippingOptions))
  )
    throw new EbayError("INVALID_RESPONSE");
  const statuses = (item.estimatedAvailabilities || []).map(
    (a) => a.estimatedAvailabilityStatus,
  );
  const ended =
    Number.isFinite(Date.parse(item.itemEndDate)) &&
    Date.parse(item.itemEndDate) <= Date.parse(observedAt);
  const availability = ended
    ? "ended"
    : statuses.includes("OUT_OF_STOCK")
      ? "out_of_stock"
      : statuses.includes("IN_STOCK")
        ? "in_stock"
        : statuses.includes("LIMITED_STOCK")
          ? "limited_stock"
          : "unknown";
  const feedback = item.seller?.feedbackPercentage;
  return {
    retailer: "eBay",
    source: "ebay_browse_api",
    environment,
    dataStatus:
      environment === "sandbox" ? "sandbox_test_data" : "api_observation",
    observedAt,
    marketplaceId,
    listingMarketplaceId: item.listingMarketplaceId || null,
    requestedPart: { brand: part.brand, partNumber: part.partNumber },
    itemId: item.itemId,
    title: typeof item.title === "string" ? item.title : null,
    productIdentity: identity(item, part),
    responseKind,
    sellerReportedBrand: typeof item.brand === "string" ? item.brand : null,
    sellerReportedMpn: typeof item.mpn === "string" ? item.mpn : null,
    price: amount(item.price),
    condition: item.condition || "Unknown",
    conditionId: item.conditionId || null,
    buyingOptions: Array.isArray(item.buyingOptions) ? item.buyingOptions : [],
    itemWebUrl: listingUrl(item.itemWebUrl),
    availability,
    itemEndDate: item.itemEndDate || null,
    shippingContext,
    shippingOptions: (item.shippingOptions || []).map((option) => ({
      cost: amount(option.shippingCost),
      costType: option.shippingCostType || null,
      service: option.shippingServiceCode || null,
      minEstimatedDeliveryDate: option.minEstimatedDeliveryDate || null,
      maxEstimatedDeliveryDate: option.maxEstimatedDeliveryDate || null,
    })),
    seller: {
      username: item.seller?.username || null,
      feedbackScore: Number.isInteger(item.seller?.feedbackScore)
        ? item.seller.feedbackScore
        : null,
      feedbackPercentage:
        typeof feedback === "string" &&
        /^\d+(?:\.\d+)?$/.test(feedback) &&
        Number(feedback) <= 100
          ? feedback
          : null,
      accountType: item.seller?.sellerAccountType || null,
    },
    taxIncluded: null, // Price tax treatment varies with marketplace and buyer context.
    fitmentVerified: false,
  };
}
export function isEbayQuoteFresh(quote, now = Date.now(), maxAgeMs = 300_000) {
  const time = Date.parse(quote?.observedAt);
  return (
    quote?.dataStatus === "api_observation" &&
    Number.isFinite(time) &&
    Number.isFinite(maxAgeMs) &&
    maxAgeMs > 0 &&
    now >= time &&
    now - time < maxAgeMs &&
    (!quote.itemEndDate || Date.parse(quote.itemEndDate) > now)
  );
}

export function createEbayClient(
  config,
  { fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 15_000 } = {},
) {
  if (!process.versions?.node) throw new EbayError("SERVER_RUNTIME_REQUIRED");
  const { environment, marketplaceId, clientId, clientSecret } = config;
  if (
    !ORIGINS[environment] ||
    !MARKETS[marketplaceId] ||
    !clientId ||
    !clientSecret ||
    typeof fetchImpl !== "function"
  )
    throw new EbayError("INVALID_CONFIGURATION");
  const origin = ORIGINS[environment];
  let token = null;
  let expiresAt = 0;
  let pendingToken = null;
  async function request(url, options, stage) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new EbayError(`${stage}_NETWORK_ERROR`);
    }
    if (!response.ok) {
      const rawRetry = response.headers?.get?.("retry-after");
      const retryAfterSeconds =
        rawRetry && /^\d{1,6}$/.test(rawRetry) ? Number(rawRetry) : null;
      throw new EbayError(
        response.status === 429 ? "RATE_LIMITED" : `${stage}_REJECTED`,
        { status: response.status, retryAfterSeconds },
      );
    }
    try {
      return await response.json();
    } catch {
      throw new EbayError(`${stage}_INVALID_RESPONSE`);
    }
  }
  async function getToken() {
    if (token && now() < expiresAt) return token;
    if (!pendingToken)
      pendingToken = (async () => {
        const body = await request(
          `${origin}/identity/v1/oauth2/token`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              scope: SCOPE,
            }).toString(),
          },
          "TOKEN",
        );
        if (
          typeof body.access_token !== "string" ||
          !body.access_token ||
          !Number.isFinite(body.expires_in) ||
          body.expires_in <= 0
        )
          throw new EbayError("TOKEN_INVALID_RESPONSE");
        token = body.access_token;
        expiresAt = now() + Math.max(0, body.expires_in - 60) * 1000;
        return token;
      })().finally(() => {
        pendingToken = null;
      });
    return pendingToken;
  }
  function contextHeaders(destination) {
    if (!destination) return {};
    if (
      !/^[A-Z]{2}$/.test(destination.country || "") ||
      !/^[A-Za-z0-9 -]{1,12}$/.test(destination.postalCode || "")
    )
      throw new EbayError("INVALID_DESTINATION");
    return {
      "X-EBAY-C-ENDUSERCTX": `contextualLocation=${encodeURIComponent(`country=${destination.country},zip=${destination.postalCode}`)}`,
    };
  }
  async function browse(path, destination) {
    const context = contextHeaders(destination);
    const accessToken = await getToken();
    try {
      return await request(
        `${origin}/buy/browse/v1/${path}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
            ...context,
          },
        },
        "BROWSE",
      );
    } catch (error) {
      // Clear expired auth for the next caller, without hiding or repeatedly retrying failures.
      if (error.status === 401) {
        token = null;
        expiresAt = 0;
      }
      throw error;
    }
  }
  return {
    async searchPart(part, { limit = 10, offset = 0, destination, gtin } = {}) {
      validatePart(part);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 200 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset >= 10000 ||
        offset % limit !== 0
      )
        throw new EbayError("INVALID_PAGINATION");
      if (gtin !== undefined && !/^(?:\d{8}|\d{12,14})$/.test(gtin))
        throw new EbayError("INVALID_GTIN");
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        filter: "buyingOptions:{FIXED_PRICE}",
      });
      if (gtin) params.set("gtin", gtin);
      else params.set("q", `${part.brand.trim()} ${part.partNumber}`);
      const data = await browse(`item_summary/search?${params}`, destination);
      if (
        !Number.isInteger(data.total) ||
        data.total < 0 ||
        (data.itemSummaries !== undefined && !Array.isArray(data.itemSummaries))
      )
        throw new EbayError("BROWSE_INVALID_RESPONSE");
      const observedAt = new Date(now()).toISOString();
      return {
        total: data.total,
        limit,
        offset,
        observedAt,
        environment,
        marketplaceId,
        quotes: (data.itemSummaries || []).map((item) =>
          normalizeEbayQuote(item, part, {
            environment,
            marketplaceId,
            observedAt,
            shippingContext: destination ? "provided" : "not_provided",
          }),
        ),
      };
    },
    async getItemQuote(itemId, part, { destination } = {}) {
      validatePart(part);
      if (typeof itemId !== "string" || !/^[A-Za-z0-9|_-]{1,200}$/.test(itemId))
        throw new EbayError("INVALID_ITEM_ID");
      const item = await browse(
        `item/${encodeURIComponent(itemId)}`,
        destination,
      );
      if (item.itemId !== itemId) throw new EbayError("ITEM_ID_MISMATCH");
      return normalizeEbayQuote(item, part, {
        environment,
        marketplaceId,
        observedAt: new Date(now()).toISOString(),
        shippingContext: destination ? "provided" : "not_provided",
        responseKind: "item_detail",
      });
    },
  };
}
