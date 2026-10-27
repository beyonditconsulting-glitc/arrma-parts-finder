import dataset from "../../database/discovery/jennys-matches.json" with { type: "json" };

export type JennyMatch = {
  catalogPartId: string;
  manufacturerPartNumber: string;
  matchedNumber: string;
  matchStatus: string;
  shopifyProductId: string;
  productTitle: string;
  productUrl: string;
  variantId: string;
  variantSku: string;
  variantTitle: string;
  image: { url: string; alt: string; shopifyImageId: string; shopifyProductId: string; variantIds: string[] } | null;
  observedPrice: {status: string; amountMinor: number; currency: string; rawAmount: string; shippingMinor: null; taxMinor: null};
  available: boolean;
  sourceUrl: string;
  sourceSha256: string;
  observedAt: string;
  sourceLocator: string;
  identityEvidence: string;
  conditionNote: string;
};
export const jennyMatches: readonly JennyMatch[] = dataset.matches;
export const jennyCoverage = dataset.summary;
export function getJennyMatches(catalogPartId: string): readonly JennyMatch[] {
  return jennyMatches.filter(match => match.catalogPartId === catalogPartId);
}
/** Deterministic observed-available listing preference; never a cheapest-price claim. */
export function getJennyMatch(catalogPartId: string): JennyMatch | undefined {
  const matches = getJennyMatches(catalogPartId);
  return matches.find(match => match.available) ?? matches[0];
}
export type JennyCartInput = { partId: string; quantity: number; vendor?: string };
export type JennyCartIssue = { partId: string; reason: string };
export type JennyCartResult = {
  ready: boolean;
  url: string | null;
  unmatched: JennyCartIssue[];
  lines: { partId: string; variantId: string; quantity: number }[];
  observationNote: string;
};
/** Shopify-supported stateless permalink. This creates no remote session and submits no order. */
export function buildJennyCart(
  selected: readonly JennyCartInput[],
  matches: readonly JennyMatch[] = jennyMatches,
): JennyCartResult {
  const unmatched: JennyCartIssue[] = [];
  const lines: JennyCartResult["lines"] = [];
  const quantities = new Map<string, number>();
  const selectedParts = new Set<string>();
  if (!selected.length) unmatched.push({partId:"",reason:"Cart is empty"});
  for (const line of selected) {
    if (line.vendor && !["Jenny’s RC", "Jenny's RC"].includes(line.vendor)) {
      unmatched.push({partId:line.partId,reason:"Item belongs to another retailer"}); continue;
    }
    if (!line.partId || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      unmatched.push({partId:line.partId,reason:"Quantity must be an integer from 1 to 99"}); continue;
    }
    if (selectedParts.has(line.partId)) {
      unmatched.push({partId:line.partId,reason:"Duplicate selected catalog part"});continue;
    }
    selectedParts.add(line.partId);
    const match = matches.find(m=>m.catalogPartId===line.partId && m.available);
    if (!match) { unmatched.push({partId:line.partId,reason:"No exact matched listing observed available; refresh or choose a retailer manually"}); continue; }
    let productUrl: URL;
    try { productUrl=new URL(match.productUrl); } catch { unmatched.push({partId:line.partId,reason:"Invalid product evidence URL"});continue; }
    if (match.matchStatus!=="retailer_reported_exact_number" || !/^\d{1,20}$/.test(match.variantId) || /^0+$/.test(match.variantId) || productUrl.protocol!=="https:" || productUrl.hostname!=="jennysrc.com" || !productUrl.pathname.startsWith("/products/") || productUrl.username || productUrl.password || !/^[a-f0-9]{64}$/.test(match.sourceSha256) || !Number.isFinite(Date.parse(match.observedAt))) {
      unmatched.push({partId:line.partId,reason:"Missing verified Shopify variant or source identity"});continue;
    }
    const quantity=(quantities.get(match.variantId)??0)+line.quantity;
    if(quantity>99) {unmatched.push({partId:line.partId,reason:"Combined quantity for one variant exceeds 99"});continue;}
    quantities.set(match.variantId,quantity);
    lines.push({partId:line.partId,variantId:match.variantId,quantity:line.quantity});
  }
  const ready=unmatched.length===0 && lines.length>0;
  const encoded=[...quantities.entries()].map(([variant,quantity])=>`${variant}:${quantity}`).join(",");
  const url=ready?`https://jennysrc.com/cart/${encoded}?storefront=true`:null;
  if(url && url.length>7500) return {ready:false,url:null,unmatched:[{partId:"",reason:"Cart is too large for a single supported browser link"}],lines,observationNote:"No items transferred. Split the cart."};
  return {ready,url,unmatched,lines,observationNote:"Opens a Shopify preloaded-cart link. Price, stock, tax, shipping and take-off contents must be confirmed by Jenny’s RC; no order or remote session has been created by this app."};
}
