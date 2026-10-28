import data from './data/horizon-catalog.json';
import type { Part } from './catalog.ts';

type Association = [number, number, number[]];
type Sku = { sku: string; color: string | null; is_fallback: boolean; status: string; expectedCount: number | null; associations: Association[] };
type Model = { brand_id: string; model_id: string; name: string; discontinued: boolean; status: string; skus: Sku[] };
const models = data.models as Model[];
const modelIndex = new Map(models.map(m => [JSON.stringify([m.brand_id, m.model_id]), m]));
const modelFor = (brandId: string, modelId: string) => modelIndex.get(JSON.stringify([brandId, modelId]));
const skuFor = (brandId: string, modelId: string, sku: string) => modelFor(brandId, modelId)?.skus.find(s => s.sku === sku);
const matches = (text: string, query: string) => query.toLowerCase().trim().split(/\s+/).every(t => text.toLowerCase().includes(t));
const productUrl = (id: string) => `https://www.horizonhobby.com/product/${encodeURIComponent(id)}.html`;
export const horizonBrands = data.brands;
export const horizonMetadata = data.metadata;
export function getHorizonModels(brandId: string, query = '') {
  return models.filter(m => m.brand_id === brandId && matches(`${m.model_id} ${m.name}`, query))
    .map(({ brand_id, model_id, name, discontinued }) => ({ brand_id, model_id, name, discontinued }));
}
export function getHorizonSkus(brandId: string, modelId: string) {
  return (modelFor(brandId, modelId)?.skus ?? []).map(({ sku, color, is_fallback }) => ({ sku, color, is_fallback }));
}
export function getHorizonCoverage(brandId: string, modelId: string, sku: string) {
  const selected = skuFor(brandId, modelId, sku);
  return { status: selected?.status ?? (modelFor(brandId, modelId)?.skus.length ? 'unknown_sku' : modelFor(brandId, modelId)?.status ?? 'unknown_model'), expectedCount: selected?.expectedCount ?? null, observedCount: selected?.associations.length ?? 0 };
}
export function getHorizonParts(brandId: string, modelId: string, sku: string, query = ''): Part[] {
  const model = modelFor(brandId, modelId);
  const selected = skuFor(brandId, modelId, sku);
  if (!model || !selected) return [];
  return selected.associations.flatMap(([productIndex, relationshipIndex, snapshotIndexes]) => {
    const relationship = data.relationships[relationshipIndex];
    const [id, name, brand] = data.products[productIndex] as string[];
    if (!matches(`${id} ${name} ${brand} ${model.name} ${sku}`, query)) return [];
    const sources = snapshotIndexes.map(index => {
      const [captureIndex, amountMinor, currency] = data.snapshots[index];
      const [path, sha256, observedAt] = data.captures[captureIndex as number];
      return { url: productUrl(sku), sha256, observedAt, locator: `${path}#/partsSearch/productSearch/productIds/productID=${id}`, amountMinor, currency };
    });
    const latest = [...sources].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    return [{ id, name, brand, image: null, manufacturerPartNumber: null,
      category: 'Other', icon: '🔧', description: relationship,
      vehicles: [model.name], fitmentStatus: relationship,
      associationCoverage: selected.status,
      pricingStatus: latest.amountMinor === null ? 'No captured sales price' : 'Captured price; not a live offer',
      observedPrice: latest.amountMinor === null ? null : { amountMinor: latest.amountMinor as number, currency: latest.currency as string, observedAt: latest.observedAt, sourceUrl: latest.url },
      fitments: [{ vehicleId: sku, name: model.name, brand: horizonBrands.find(b => b.id === brandId)?.name ?? brandId, relationship, sources: sources.map(({ url, sha256, observedAt, locator }) => ({ url, sha256, observedAt, locator })) }],
      provenance: { publisher: 'Horizon Hobby', vehicleId: sku, sourceUrl: latest.url, sourceLocator: latest.locator, sourceSha256: latest.sha256, observedAt: latest.observedAt, productUrl: productUrl(id) },
    }];
  });
}
