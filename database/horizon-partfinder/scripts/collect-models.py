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
import re,csv,datetime,shutil
out=pathlib.Path(__file__).resolve().parents[1];(out/'raw').mkdir(parents=True,exist_ok=True)
page=s.get('https://www.horizonhobby.com/partfinder',timeout=40);page.raise_for_status();html=page.text
(out/'raw'/'partfinder.html').write_text(html)
m=re.search(r'"partFinderBrands":(\[[^\]]+\])',html)
brands=json.loads(m.group(1));rows=[];counts={}
for b in brands:
 name,bid=b.split('|',1)
 r=s.get(base+'/custom/part-finder/v1/organizations/f_ecom_bfbr_prd/get-products',params={'siteId':'horizon-us','c_filter':bid},timeout=40)
 r.raise_for_status();data=r.json()
 (out/'raw'/f'{bid}.json').write_text(json.dumps(data,indent=2))
 products=data['products'];counts[name]=len(products)
 for prod in products:rows.append({'brand':name,'brand_id':bid,'model_id':prod['ID'],'name':prod['Name'],'discontinued':prod.get('discontinued')})
 print(name,len(products),flush=True)
(out/'models.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False))
with (out/'models.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['brand','brand_id','model_id','name','discontinued']);w.writeheader();w.writerows(rows)
meta={'source':'https://www.horizonhobby.com/partfinder','retrieved_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'model_count':len(rows),'brand_counts':counts,'scope':'All models returned by the get-products endpoint for every brand configured in the public part finder. SKU variants and model-to-part associations are not included.'}
(out/'manifest.json').write_text(json.dumps(meta,indent=2))

print('TOTAL',len(rows))
