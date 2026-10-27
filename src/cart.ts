import { buildJennyCart } from "./integrations/jennys.ts";
export const vendors = ["Horizon Hobby", "Jenny’s RC", "eBay"] as const;
export type Vendor = (typeof vendors)[number];
export type CartLine = { vendor: Vendor; partId: string; quantity: number };
export function setCartQuantity(
  cart: CartLine[],
  vendor: Vendor,
  partId: string,
  quantity: number,
): CartLine[] {
  if (
    !vendors.includes(vendor) ||
    !partId ||
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    quantity > 99
  )
    throw Error("Invalid cart item or quantity");
  const rest = cart.filter(
    (line) => line.vendor !== vendor || line.partId !== partId,
  );
  return quantity === 0 ? rest : [...rest, { vendor, partId, quantity }];
}
export function addToCart(
  cart: CartLine[],
  vendor: Vendor,
  partId: string,
): CartLine[] {
  const quantity =
    cart.find((line) => line.vendor === vendor && line.partId === partId)
      ?.quantity ?? 0;
  return setCartQuantity(cart, vendor, partId, Math.min(quantity + 1, 99));
}
export function decodeCart(
  raw: string | null,
  validPartIds: ReadonlySet<string>,
): CartLine[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw Error("Invalid saved cart");
  let cart: CartLine[] = [];
  for (const row of parsed) {
    if (
      !row ||
      typeof row !== "object" ||
      !vendors.includes(row.vendor) ||
      !validPartIds.has(row.partId) ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > 99
    )
      throw Error("Invalid saved cart row");
    if (
      cart.some(
        (line) => line.vendor === row.vendor && line.partId === row.partId,
      )
    )
      throw Error("Duplicate saved cart item");
    cart = setCartQuantity(cart, row.vendor, row.partId, row.quantity);
  }
  return cart;
}
export function vendorCartCount(cart: CartLine[], vendor: Vendor) {
  return cart
    .filter((line) => line.vendor === vendor)
    .reduce((total, line) => total + line.quantity, 0);
}
export function checkoutCapability(
  vendor: Vendor,
  lines: readonly CartLine[] = [],
): {
  ready: boolean;
  reason: string;
  url: string | null;
  unmatched: { partId: string; reason: string }[];
} {
  if (vendor === "Jenny’s RC") {
    const result = buildJennyCart(
      lines.filter((line) => line.vendor === vendor),
    );
    return {
      ready: result.ready,
      url: result.url,
      reason: result.ready
        ? result.observationNote
        : "No cart will be sent until every selected item has an exact, observed-available Jenny’s variant and valid quantity.",
      unmatched: result.unmatched,
    };
  }
  return {
    ready: false,
    url: null,
    unmatched: [],
    reason: `${vendor} cart transfer is not connected. These items are saved in this app only.`,
  };
}
