import { getJennyMatch } from "./integrations/jennys.ts";
import type { Vendor } from "./cart";
export type ObservedPrice = {
  amountMinor: number;
  currency: string;
  observedAt: string;
  sourceUrl: string;
};
export function displayObservedPrice(price: ObservedPrice | null) {
  if (!price) return "Price unavailable";
  // A captured page is an observation, never a live quote or a checkout total.
  return `${new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency }).format(price.amountMinor / 100)} observed`;
}
export function vendorOffer(
  vendor: Vendor,
  price: ObservedPrice | null,
  partId?: string,
) {
  const jenny =
    vendor === "Jenny’s RC" && partId ? getJennyMatch(partId) : undefined;
  if (jenny) {
    const observed: ObservedPrice = {
      amountMinor: jenny.observedPrice.amountMinor,
      currency: jenny.observedPrice.currency,
      observedAt: jenny.observedAt,
      sourceUrl: jenny.productUrl,
    };
    return {
      status: "snapshot" as const,
      price: observed,
      label: displayObservedPrice(observed),
    };
  }
  return vendor === "Horizon Hobby" && price
    ? { status: "snapshot" as const, price, label: displayObservedPrice(price) }
    : {
        status: "not_connected" as const,
        price: null,
        label: "Price unavailable",
      };
}
