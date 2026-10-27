import snapshot from "./data/upgrade-inventory.json" with { type: "json" };

export type UpgradeProduct = {
  id: string;
  title: string;
  sku: string;
  variant: string;
  configurationNote: string;
  productUrl: string;
  capturedAt: string;
  sourceSha256: string;
  price: { amount: string; currency: string } | null;
  availability: "available" | "unavailable" | "unknown";
};
export type UpgradeVendor = {
  id: string;
  name: string;
  status: "not_captured" | "partial" | "captured";
  products: UpgradeProduct[];
};
const vendorNames: Record<string, string> = {
  m2c: "M2C Racing",
  "perfect-pass": "Perfect Pass",
  "basher-bodies": "Basher Bodies",
};
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === "string" && !!v.trim();

// Reject incomplete imports rather than displaying made-up prices or source claims.
export function parseUpgradeInventory(input: unknown): UpgradeVendor[] {
  if (!isObject(input) || input.schemaVersion !== 1 || !Array.isArray(input.vendors))
    throw new Error("Invalid upgrade inventory format");
  const seenVendors = new Set<string>();
  const result = input.vendors.map((vendor): UpgradeVendor => {
    if (!isObject(vendor) || !nonempty(vendor.id) || vendorNames[vendor.id] !== vendor.name || seenVendors.has(vendor.id) || !["not_captured", "partial", "captured"].includes(String(vendor.status)) || !Array.isArray(vendor.products))
      throw new Error("Invalid upgrade vendor");
    seenVendors.add(vendor.id);
    if (vendor.status === "not_captured" && vendor.products.length)
      throw new Error("Uncaptured vendors cannot contain products");
    const seen = new Set<string>();
    for (const product of vendor.products) {
      if (!isObject(product) || !nonempty(product.id) || seen.has(product.id) || !nonempty(product.title) || typeof product.sku !== "string" || typeof product.variant !== "string" || typeof product.configurationNote !== "string" || !nonempty(product.productUrl) || !nonempty(product.capturedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(product.capturedAt) || !Number.isFinite(Date.parse(product.capturedAt)) || !/^[a-f0-9]{64}$/.test(String(product.sourceSha256)) || !["available", "unavailable", "unknown"].includes(String(product.availability)))
        throw new Error("Invalid upgrade product or source evidence");
      const url = new URL(product.productUrl);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("Invalid upgrade source URL");
      if (product.price !== null && (!isObject(product.price) || typeof product.price.amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(product.price.amount) || !/^[A-Z]{3}$/.test(String(product.price.currency))))
        throw new Error("Invalid captured price");
      seen.add(product.id);
    }
    return vendor as unknown as UpgradeVendor;
  });
  if (seenVendors.size !== Object.keys(vendorNames).length)
    throw new Error("All three upgrade vendors must be represented");
  return result;
}
export const upgradeVendors = parseUpgradeInventory(snapshot);
export function searchUpgradeProducts(vendor: UpgradeVendor, query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return vendor.products.filter((p) => {
    const text = `${p.title} ${p.sku} ${p.variant}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
