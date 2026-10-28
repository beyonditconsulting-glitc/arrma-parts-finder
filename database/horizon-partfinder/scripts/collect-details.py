import requests,secrets,hashlib,base64,json,urllib.parse,pathlib
base='https://www.horizonhobby.com/mobify/proxy/api'
s=requests.Session()
v=secrets.token_urlsafe(48)
c=base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).decode().rstrip('=')
p={'redirect_uri':'https://www.horizonhobby.com/callback','client_id':'3ef13a0f-f96a-45f0-bdb2-f7bd7f1d67ee','code_challenge':c,'response_type':'code','hint':'guest'}
u=base+'/shopper/auth/v1/organizations/f_ecom_bfbr_prd/oauth2/authorize'
r=s.get(u,params=p,allow_redirects=False,timeout=30)
print('Guest authorization:',r.status_code)
loc=r.headers.get('Location','')
q=urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
if 'code' not in q:
 print(r.text[:500]);raise SystemExit(1)
d={'grant_type':'authorization_code_pkce','code':q['code'][0],'code_verifier':v,'client_id':p['client_id'],'channel_id':'horizon-us','redirect_uri':p['redirect_uri']}
if 'usid' in q:d['usid']=q['usid'][0]
r=s.post(base+'/shopper/auth/v1/organizations/f_ecom_bfbr_prd/oauth2/token',data=d,timeout=30)
print('Guest token:',r.status_code)
r.raise_for_status()
s.headers['Authorization']='Bearer '+r.json()['access_token']

import concurrent.futures,time,threading
out=pathlib.Path(__file__).resolve().parents[1]
raw=out/'raw'/'details';raw.mkdir(exist_ok=True)
models=json.loads((out/'models.json').read_text())
headers=dict(s.headers)
def fetch(method,endpoint,params,body,path):
 if path.exists():return json.loads(path.read_text())
 for attempt in range(4):
  try:
   r=requests.request(method,base+'/custom/part-finder/v1/organizations/f_ecom_bfbr_prd/'+endpoint,params=params,json=body,headers=headers,timeout=90)
   if r.status_code in (429,500,502,503,504):time.sleep(2**attempt);continue
   r.raise_for_status();data=r.json()
   if 'title' in data and 'detail' in data:raise ValueError(data['title'])
   temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,separators=(',',':')));temp.replace(path)
   return data
  except Exception:
   if attempt==3:raise
   time.sleep(2**attempt)
 raise RuntimeError('request retry exhausted')
def collect(m):
 mid=m['model_id'];d=raw/m['brand_id']/mid;d.mkdir(parents=True,exist_ok=True)
 skus=fetch('GET','get-skus',{'siteId':'horizon-us','c_filter':mid},None,d/'skus.json')['SKUs']
 # Standard products may have no variation list; the model ID is the website fallback.
 variants=list(skus)
 if len(skus)<=1 and mid not in {v['sku'] for v in variants}:variants.append({'sku':mid,'fallback_model_id':True})
 result={'brand_id':m['brand_id'],'model_id':mid,'skus':skus,'queries':[]}
 for sku in variants:
  sid=sku['sku'];start=0;seen=set();total=None;pages=[]
  while True:
   body={'partFinderBrands':m['brand_id'],'partFinderProducts':mid,'partFinderSKU':sid,'sz':200,'start':start,'preferences':{'discontinued':'true|false'}}
   path=d/(sid+'-parts-'+str(start)+'.json')
   data=fetch('POST','get-parts',{'siteId':'horizon-us','locale':'en-US'},body,path)
   ps=data['partsSearch'];search=ps['productSearch'];hits=search.get('productIds',[]);total=search['count']
   ids={h['productID'] for h in hits};new=ids-seen;seen.update(ids);pages.append(str(path.relative_to(out)))
   if start+len(hits)>=total:break
   if not new or not hits:raise ValueError('Pagination stalled '+sid)
   start+=len(hits)
  if len(seen)!=total:raise ValueError('Unique hit count mismatch '+sid)
  result['queries'].append({'sku':sid,'expected_count':total,'unique_count':len(seen),'pages':pages})
 (d/'summary.json').write_text(json.dumps(result,indent=2))
 return result
results=[];errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 futures={pool.submit(collect,m):m for m in models}
 for f in concurrent.futures.as_completed(futures):
  m=futures[f]
  try:results.append(f.result())
  except Exception as e:errors.append({'model_id':m['model_id'],'brand_id':m['brand_id'],'error':str(e)})
  if (len(results)+len(errors))%20==0:print('Progress',len(results),'completed',len(errors),'failed; latest',m['brand_id'],m['model_id'],flush=True)
(out/'collection-summary.json').write_text(json.dumps({'models':results,'errors':errors},indent=2))
print('DONE',len(results),'errors',len(errors),flush=True)
