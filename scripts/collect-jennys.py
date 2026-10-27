import os,json,subprocess,datetime,hashlib,concurrent.futures,time
DIR='/tmp/jennys-storefront-evidence';os.makedirs(DIR,exist_ok=True)
def fetch(n):
 path=f'{DIR}/products-page{n}.json';meta_path=path+'.meta.json';url=f'https://jennysrc.com/products.json?limit=250&page={n}'
 if os.path.isfile(path) and os.path.isfile(meta_path):
  meta=json.load(open(meta_path));raw=open(path,'rb').read()
  if hashlib.sha256(raw).hexdigest()==meta['sha256']:return meta,json.loads(raw)['products']
 cp=subprocess.run(['curl','-fsSL','--max-time','40',url,'-o',path],capture_output=True,text=True)
 if cp.returncode:raise RuntimeError(f'Page{n} curl{cp.returncode}: {cp.stderr[-500:]}')
 raw=open(path,'rb').read();products=json.loads(raw)['products'];meta={'page':n,'source_url':url,'source_file':path,'sha256':hashlib.sha256(raw).hexdigest(),'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),'product_count':len(products),'product_ids':[p['id'] for p in products]};json.dump(meta,open(meta_path,'w'),indent=2);return meta,products
pages=[];products={};errors=[];end=None
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for base in range(1,81,2):
  for n,future in zip([base,base+1],[pool.submit(fetch,base),pool.submit(fetch,base+1)]):
   try:
    meta,rows=future.result();pages.append(meta)
    for p in rows:products[p['id']]=p
    print(n,len(rows),'unique',len(products),flush=True)
    if not rows:end=n if end is None else min(end,n)
   except Exception as e:errors.append({'page':n,'error':str(e)});print('FAIL',n,str(e),flush=True)
  json.dump({'pages':pages,'errors':errors,'empty_page':end,'unique_count':len(products),'complete':end is not None and not errors,'products':list(products.values())},open('/tmp/jennys-storefront.json','w'))
  if end is not None or errors:break
