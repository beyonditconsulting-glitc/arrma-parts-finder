import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateJennyProduct } from '../scripts/match-jennys.mjs';
import { buildJennyCart, getJennyMatch, getJennyMatches, jennyMatches, jennyCoverage } from '../src/integrations/jennys.ts';
const aliases=new Map([['ARA320754',['ARA320754']],['AR480002',['ARAC9652']]]);
function product(patch={}) {return {id:123,title:'Rear brace',body_html:'<b>PRODUCT DESCRIPTION</b><p>ARA320754 - Aluminum rear brace</p><p>TERMS OF SALE</p>',variants:[{id:456,title:'Default Title',sku:'Brace (ARA320754)',price:'18.99',available:true}],images:[{id:789,product_id:123,variant_ids:[],position:1,src:'https://cdn.shopify.com/s/files/test/brace.jpg'}],...patch};}
test('matches explicit primary part number and supplier-linked image, never title substring',()=>{
 const match=evaluateJennyProduct(product(),aliases);assert.equal(match.status,'matched');assert.equal(match.catalogPartId,'ARA320754');assert.equal(match.image.shopifyProductId,'123');
 assert.equal(evaluateJennyProduct(product({title:'ARA320754 brace',body_html:'PRODUCT DESCRIPTION ARA3207540 - A different brace TERMS OF SALE'}),aliases).status,'irrelevant');
 assert.equal(evaluateJennyProduct(product({title:'ARA320754 brace',body_html:'PRODUCT DESCRIPTION A universal brace TERMS OF SALE'}),aliases).status,'irrelevant');
});
test('rejects bundles, partial contents, color conflict and ambiguous variants',()=>{
 assert.equal(evaluateJennyProduct(product({body_html:'PRODUCT DESCRIPTION ARA320754 brace AR480002 wing TERMS OF SALE'}),aliases).status,'rejected');
 assert.equal(evaluateJennyProduct(product({title:'Brace case only'}),aliases).reason,'partial_bundle_or_condition_ambiguity');
 assert.equal(evaluateJennyProduct(product({title:'Wing Orange',body_html:'PRODUCT DESCRIPTION AR480002 - Rear Wing Black TERMS OF SALE'}),aliases).reason,'conflicting_color_or_finish_description');
 assert.equal(evaluateJennyProduct(product({variants:[{id:456,sku:''},{id:457,sku:''}]}),aliases).reason,'ambiguous_product_variant');
});
test('photo mapping rejects another product or another variant image',()=>{
 assert.equal(evaluateJennyProduct(product({images:[{id:789,product_id:124,variant_ids:[],position:1,src:'https://cdn.shopify.com/other.jpg'}]}),aliases).image,null);
 assert.equal(evaluateJennyProduct(product({images:[{id:789,product_id:123,variant_ids:[457],position:1,src:'https://cdn.shopify.com/other.jpg'}]}),aliases).image,null);
});
test('batches actual captured variants and quantities in one Shopify cart permalink',()=>{
 const a=getJennyMatch('ARA310991'),b=getJennyMatch('SPMXSE2150');assert.ok(a?.available&&b?.available);
 const cart=buildJennyCart([{partId:a.catalogPartId,quantity:2},{partId:b.catalogPartId,quantity:3}]);
 assert.equal(cart.ready,true);assert.deepEqual(cart.unmatched,[]);assert.equal(cart.url,`https://jennysrc.com/cart/${a.variantId}:2,${b.variantId}:3?storefront=true`);
 assert.equal(new URL(cart.url).searchParams.get('storefront'),'true');
});
test('unmatched, wrong-vendor, unavailable, invalid quantities and malformed variant fail the entire transfer',()=>{
 const match=getJennyMatch('ARA310991');
 for(const lines of [[],[{partId:'missing',quantity:1}],[{partId:match.catalogPartId,quantity:0}],[{partId:match.catalogPartId,quantity:1.5}],[{partId:match.catalogPartId,quantity:100}],[{partId:match.catalogPartId,quantity:1,vendor:'eBay'}]]){
  const cart=buildJennyCart(lines);assert.equal(cart.ready,false);assert.equal(cart.url,null);assert.ok(cart.unmatched.length);
 }
 assert.equal(buildJennyCart([{partId:match.catalogPartId,quantity:1}],[{...match,available:false}]).url,null);
 assert.equal(buildJennyCart([{partId:match.catalogPartId,quantity:1}],[{...match,variantId:'123?evil=1'}]).url,null);
 const mixed=buildJennyCart([{partId:match.catalogPartId,quantity:1},{partId:'missing',quantity:1}]);assert.equal(mixed.url,null);assert.equal(mixed.lines.length,1);
});
test('duplicate selected parts and aggregate alias quantities cannot silently overwrite lines',()=>{
 const match=getJennyMatch('ARA310991');
 assert.equal(buildJennyCart([{partId:match.catalogPartId,quantity:1},{partId:match.catalogPartId,quantity:1}]).ready,false);
 const alias={...match,catalogPartId:'test-alias'};
 const joined=buildJennyCart([{partId:match.catalogPartId,quantity:2},{partId:'test-alias',quantity:3}],[match,alias]);assert.equal(joined.url,`https://jennysrc.com/cart/${match.variantId}:5?storefront=true`);
 assert.equal(buildJennyCart([{partId:match.catalogPartId,quantity:99},{partId:'test-alias',quantity:1}],[match,alias]).url,null);
});
test('captured coverage remains explicit and all photos retain exact Shopify product linkage',()=>{
 assert.equal(jennyCoverage.baselineParts,210);assert.equal(jennyCoverage.matchedParts,new Set(jennyMatches.map(m=>m.catalogPartId)).size);
 assert.equal(jennyCoverage.matchedParts+jennyCoverage.unresolvedParts,210);
 const baseline=JSON.parse(readFileSync(new URL('../database/discovery/part-associations.json',import.meta.url))).records;
 for(const m of jennyMatches){
  const p=baseline.find(p=>p.id===m.catalogPartId);assert.ok(p);assert.ok([p.id,p.manufacturerPartNumber].includes(m.matchedNumber));
  assert.equal(m.image?.shopifyProductId,m.shopifyProductId);assert.equal(new URL(m.image.url).hostname,'cdn.shopify.com');
  assert.match(m.variantId,/^\d+$/);assert.match(m.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(m.observedPrice.status,'observed_snapshot');
  assert.ok(getJennyMatches(m.catalogPartId).includes(m));
 }
});
