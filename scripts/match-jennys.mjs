import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function descriptionText(html) {
  return String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
export function partNumberTokens(value) {
  return [...new Set(String(value).toUpperCase().match(/\b(?:ARA\d{4,}|AR\d{5,}|SPM[A-Z0-9]{3,})\b/g) ?? [])];
}
export function evaluateJennyProduct(product, aliases) {
  const body = descriptionText(product.body_html);
  const section = body.split(/TERMS OF SALE|GENERAL TERMS|SHIPPING TERMS/i)[0].replace(/^PRODUCT DESCRIPTION\s*/i, '').trim();
  const tokens = partNumberTokens(section);
  const candidateIds = [...new Set(tokens.flatMap(n => aliases.get(n) ?? []))];
  if (!candidateIds.length) return { status: 'irrelevant' };
  if (tokens.length !== 1 || candidateIds.length !== 1) return { status: 'rejected', reason: 'multiple_or_ambiguous_part_numbers', candidateIds, tokens };
  const suspect = `${product.title} ${section}`;
  const colorPattern = /\b(?:black|white|red|orange|green|pink|blue|purple|silver|gold|clear|grey|gray)\b/g;
  const titleColors = [...new Set(String(product.title).toLowerCase().match(colorPattern) ?? [])];
  const descriptionColors = [...new Set(section.toLowerCase().match(colorPattern) ?? [])];
  if (titleColors.length && descriptionColors.length && titleColors.some(c=>!descriptionColors.includes(c))) return { status:'rejected', reason:'conflicting_color_or_finish_description', candidateIds, tokens };
  if (/\bonly\b|\bnot factory sealed\b|\b(bundle|assorted|assortment|mixed|partial|lot)\b|\bwithout\b|\bno (?:gear|shaft|case|bearing|screw)/i.test(suspect)) return { status: 'rejected', reason: 'partial_bundle_or_condition_ambiguity', candidateIds, tokens };
  // A single explicit number must identify the supplied item; names and vehicle titles are never evidence alone.
  if (!new RegExp(`^${tokens[0]}(?:\\s|\\s*[-–—:,])`, 'i').test(section)) return { status: 'rejected', reason: 'part_number_not_primary_description_identifier', candidateIds, tokens };
  const variants = product.variants ?? [];
  const candidateVariants = variants.filter(v => {
    const skuNumbers = partNumberTokens(v.sku);
    return skuNumbers.includes(tokens[0]) || (variants.length === 1 && !skuNumbers.some(n => aliases.has(n) && n !== tokens[0]));
  });
  if (candidateVariants.length !== 1) return { status: 'rejected', reason: 'ambiguous_product_variant', candidateIds, tokens };
  const variant = candidateVariants[0];
  if (!Number.isSafeInteger(variant.id) || variant.id <= 0) return { status: 'rejected', reason: 'invalid_variant_id', candidateIds, tokens };
  const images = (product.images ?? []).filter(image => image.product_id === product.id && Array.isArray(image.variant_ids) && (image.variant_ids.length === 0 || image.variant_ids.includes(variant.id)) && /^https:\/\/cdn\.shopify\.com\//.test(image.src ?? ''));
  images.sort((a,b) => Number(b.variant_ids.includes(variant.id)) - Number(a.variant_ids.includes(variant.id)) || a.position - b.position);
  const image = images[0];
  return { status:'matched', catalogPartId:candidateIds[0], explicitPartNumber:tokens[0], description:section, variant, image: image ? {url:image.src,alt:product.title,shopifyImageId:String(image.id),shopifyProductId:String(product.id),variantIds:image.variant_ids.map(String)} : null };
}

export function buildJennyMatches(catalog, associations, storefront) {
 const manufacturer = new Map(associations.records.map(r=>[r.id,r.manufacturerPartNumber]));
 const aliases = new Map();
 for(const part of catalog.records) for(const key of new Set([part.id,manufacturer.get(part.id)].filter(Boolean).map(x=>x.toUpperCase()))) aliases.set(key,[...(aliases.get(key)??[]),part.id]);
 const pages = new Map();
 for(const page of storefront.pages) page.product_ids.forEach((id,index)=>pages.set(id,{...page,index}));
 const matches=[],rejections=[];
 for(const product of storefront.products){
  const evaluation=evaluateJennyProduct(product,aliases);
  if(evaluation.status==='rejected'){rejections.push({shopifyProductId:String(product.id),productTitle:product.title,productUrl:`https://jennysrc.com/products/${product.handle}`,reason:evaluation.reason,candidateIds:evaluation.candidateIds,numberTokens:evaluation.tokens});continue;}
  if(evaluation.status!=='matched')continue;
  const page=pages.get(product.id);if(!page)throw Error('Missing page provenance');
  const {variant,image}=evaluation;
  const rawPrice=variant.price;
  if(!/^\d+\.\d\d$/.test(rawPrice))throw Error('Unexpected Shopify price representation');
  matches.push({catalogPartId:evaluation.catalogPartId,manufacturerPartNumber:manufacturer.get(evaluation.catalogPartId)??evaluation.explicitPartNumber,matchedNumber:evaluation.explicitPartNumber,matchStatus:'retailer_reported_exact_number',shopifyProductId:String(product.id),productTitle:product.title,productUrl:`https://jennysrc.com/products/${product.handle}`,variantId:String(variant.id),variantSku:variant.sku,variantTitle:variant.title,image,observedPrice:{status:'observed_snapshot',amountMinor:Number(rawPrice.replace('.','')),currency:'USD',rawAmount:rawPrice,shippingMinor:null,taxMinor:null},available:variant.available===true,sourceUrl:page.source_url,sourceSha256:page.sha256,observedAt:page.retrieved_at,sourceLocator:`products[${page.index}].body_html; products[${page.index}].variants[id=${variant.id}]; products[${page.index}].images`,identityEvidence:evaluation.description,conditionNote:'Jenny’s states parts are removed from new models, may show assembly marks and use its own packaging. Exact number is retailer-reported, not a guarantee of identical contents or manufacturer warranty.'});
 }
 matches.sort((a,b)=>a.catalogPartId.localeCompare(b.catalogPartId)||Number(b.available)-Number(a.available)||a.productTitle.localeCompare(b.productTitle)||a.variantId.localeCompare(b.variantId));
 const matched=new Set(matches.map(m=>m.catalogPartId));
 return {schemaVersion:1,datasetType:'observed',scope:'Conservative exact-number matching from Jenny’s RC public Shopify storefront. No inferred vehicle compatibility, live-price guarantee, or remote-cart session.',summary:{baselineParts:catalog.records.length,storefrontProducts:storefront.unique_count,storefrontPaginationComplete:storefront.complete,pages:storefront.pages.length,matchedParts:matched.size,matchedListings:matches.length,matchedListingsWithImages:matches.filter(m=>m.image).length,unresolvedParts:catalog.records.length-matched.size,rejectedCandidates:rejections.length},matches,unresolved:catalog.records.filter(p=>!matched.has(p.id)).map(p=>({catalogPartId:p.id,manufacturerPartNumber:manufacturer.get(p.id)??null,name:p.name})),rejectedCandidates:rejections,sources:storefront.pages.map(({product_ids,...page})=>page)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [storePath='/tmp/jennys-storefront.json',out='database/discovery/jennys-matches.json']=process.argv.slice(2);
 const data=buildJennyMatches(JSON.parse(readFileSync('database/discovery/kraton-ARA8708T1-parts.json')),JSON.parse(readFileSync('database/discovery/part-associations.json')),JSON.parse(readFileSync(storePath)));
 writeFileSync(out,JSON.stringify(data,null,2)+'\n');console.log(data.summary);
}
