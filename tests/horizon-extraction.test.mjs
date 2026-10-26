import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPage, assembleSweep } from '../scripts/extract-horizon-sweep.mjs';
const url = 'https://www.horizonhobby.com/search?q=test';
function html(total=1) {
 const key=JSON.stringify({limit:24,offset:0,refine:['c_discontinued=false']});
 return `<script id="mobify-data" type="application/json">${JSON.stringify({__PRELOADED_STATE__:{__STATE_MANAGEMENT_LIBRARY:{store:{productStore:{searchResultsByKey:{[key]:{total,hits:[{productId:'TEST',productName:'Test',hitType:'master',representedProducts:[{id:'TESTT1'},{id:'TESTT1'}]}]}}}}}}})}</script>`;
}
test('preserves variant identity without inferring a revision or price',()=>{
 const capture=extractPage(html(),url,'2026-01-01T00:00:00Z');
 const sweep=assembleSweep([capture]); assert.equal(sweep.validation.complete,true);
 assert.deepEqual(sweep.records[0].variant_skus,['TESTT1']);
 assert.equal(sweep.records[0].revision,null);
 assert.equal('price' in sweep.records[0],false);
});
test('fails closed for truncated responses, bad source, and incomplete pagination',()=>{
 assert.throws(()=>extractPage('<html/>',url,'2026-01-01T00:00:00Z'));
 assert.throws(()=>extractPage(html(),'https://example.com','2026-01-01T00:00:00Z'));
 assert.throws(()=>assembleSweep([extractPage(html(50),url,'2026-01-01T00:00:00Z')]));
});
