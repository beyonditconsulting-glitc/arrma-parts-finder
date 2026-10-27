"""Capture public Perfect Pass and Basher Bodies catalogs; M2C uses a separate Ecwid source.
No authenticated endpoints, cookies, sessions, or merchant credentials are used.
"""
import concurrent.futures, datetime, hashlib, html, json, os, re, subprocess
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'database/evidence/upgrade-inventory'
EVIDENCE.mkdir(parents=True, exist_ok=True)
receipts = []
def fetch(url, filename):
    path = EVIDENCE / filename
    meta_path = path.with_suffix(path.suffix + '.meta.json')
    if path.exists() and meta_path.exists():
        raw = path.read_bytes(); meta = json.loads(meta_path.read_text())
        if meta['url'] == url and hashlib.sha256(raw).hexdigest() == meta['sha256']:
            return raw, meta
    temporary = path.with_suffix(path.suffix + '.download')
    subprocess.run(['curl', '-fsSL', '--max-time', '45', '--retry', '1', url, '-o', str(temporary)], check=True, capture_output=True)
    raw = temporary.read_bytes(); temporary.replace(path)
    meta = {'url': url, 'file': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(raw).hexdigest(), 'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')}
    meta_path.write_text(json.dumps(meta, indent=2) + '\n')
    return raw, meta

def locs(raw):
    return [node.text for node in ET.fromstring(raw).findall('.//{*}loc')]

def row(pid, title, sku, variant, url, meta, price, currency, availability, note=''):
    return {'id': str(pid), 'title': title, 'sku': sku or '', 'variant': variant or '', 'productUrl': url, 'capturedAt': meta['capturedAt'], 'sourceSha256': meta['sha256'], 'price': {'amount': str(price), 'currency': currency} if price is not None else None, 'availability': availability, 'configurationNote': note}

def perfect_pass():
    homepage, homepage_meta = fetch('https://www.perfectpassrc.com/', 'perfect-pass-homepage.html')
    currency_match = re.search(r'Shopify.currency\s*=\s*(\{[^;]+\})', homepage.decode())
    if not currency_match: raise ValueError('Missing storefront currency')
    currency = json.loads(currency_match.group(1))['active']
    if not re.fullmatch('[A-Z]{3}', currency): raise ValueError('Invalid storefront currency')
    products = {}; pages = []; end = None
    for page in range(1, 101):
        raw, meta = fetch(f'https://www.perfectpassrc.com/products.json?limit=250&page={page}', f'perfect-pass-page{page}.json')
        items = json.loads(raw)['products']; pages.append({**meta, 'productCount': len(items)})
        for product in items:
            if product['id'] in products: raise ValueError('Repeated Shopify product across pages')
            products[product['id']] = (product, meta)
        if not items: end = page; break
    if end is None: raise ValueError('Perfect Pass pagination did not terminate')
    root, root_meta = fetch('https://www.perfectpassrc.com/sitemap.xml', 'perfect-pass-sitemap.xml')
    sitemap_urls = [u for u in locs(root) if '/sitemap_products_' in u]
    sitemap_products = set(); sitemap_receipts = []
    for i, url in enumerate(sitemap_urls):
        raw, meta = fetch(url, f'perfect-pass-products-sitemap{i}.xml'); sitemap_receipts.append(meta)
        sitemap_products.update(u for u in locs(raw) if '/products/' in u)
    urls = {f'https://www.perfectpassrc.com/products/{p[0]["handle"]}' for p in products.values()}
    if urls != sitemap_products: raise ValueError(f'Perfect Pass sitemap mismatch {len(urls)} vs {len(sitemap_products)}')
    output = []
    for product, meta in products.values():
        for v in product['variants']:
            if not isinstance(v.get('available'), bool): raise ValueError('Missing explicit Shopify availability')
            output.append(row(v['id'], product['title'], v.get('sku'), '' if v['title'] == 'Default Title' else v['title'], f'https://www.perfectpassrc.com/products/{product["handle"]}', meta, v.get('price'), currency, 'available' if v['available'] else 'unavailable'))
    return {'id': 'perfect-pass', 'name': 'Perfect Pass', 'status': 'captured', 'products': output}, {'vendor': 'perfect-pass', 'scope': 'Published public products.json catalog reconciled with product sitemap; not private inventory', 'productCount': len(products), 'variantCount': len(output), 'emptyPage': end, 'pages': pages, 'currencySource': homepage_meta, 'sitemaps': [root_meta, *sitemap_receipts], 'completeForScope': True}

class TextParser(HTMLParser):
    def __init__(self): super().__init__(); self.text = []
    def handle_data(self, data): self.text.append(data)
def plain(s):
    p = TextParser(); p.feed(s); return ' '.join(' '.join(p.text).split())
class BasherParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.products = []; self.meta = {}; self.variant_select = False; self.current_option = None; self.options = {}; self.customized = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('data-webshop-product'): self.products.append(json.loads(a['data-webshop-product']))
        if tag == 'meta' and a.get('itemprop') and a.get('content') and a['itemprop'] not in self.meta: self.meta[a['itemprop']] = a['content']
        if tag == 'select': self.variant_select = 'js-product-container__options' in a.get('class', '')
        if self.variant_select and tag == 'option': self.current_option = {'id': a.get('value'), 'priceHtml': a.get('data-price-html', ''), 'text': ''}
        if 'data-surcharge' in a: self.customized = True
    def handle_data(self, data):
        if self.current_option is not None: self.current_option['text'] += data
    def handle_endtag(self, tag):
        if tag == 'option' and self.current_option is not None:
            self.options[self.current_option['id']] = self.current_option; self.current_option = None
        if tag == 'select': self.variant_select = False

def basher_bodies():
    raw, sitemap_meta = fetch('https://www.basherbodies.com/sitemap.xml', 'basher-bodies-sitemap.xml')
    urls = sorted(set(u for u in locs(raw) if re.match(r'https://www\.basherbodies\.com/product/\d+/', u)))
    def capture(url):
        pid = re.search(r'/product/(\d+)/', url).group(1)
        raw, meta = fetch(url, f'basher-bodies-{pid}.html')
        p = BasherParser(); p.feed(raw.decode())
        matches = [v for v in p.products if str(v['id']) == pid]
        if len(matches) != 1: raise ValueError(f'Missing/duplicate product {pid}')
        product = matches[0]; output = []
        for variant in product['variants']:
            option = p.options.get(str(variant['id']))
            if option:
                match = re.search(r'class=["\']product-price__price["\'][^>]*>(.*?)</span>', option['priceHtml'], re.S)
                price_match = re.fullmatch(r'€\s*(\d+(?:\.\d{2})?)', plain(match.group(1))) if match else None
                price = price_match.group(1) if price_match else None
            else: price = p.meta.get('price') if len(product['variants']) == 1 else None
            if variant.get('limited') is False: stock = 'available'
            elif variant.get('limited') is True and isinstance(variant.get('stock'), (int, float)): stock = 'available' if variant['stock'] > 0 else 'unavailable'
            else: stock = 'unknown'
            currency = p.meta.get('priceCurrency')
            if price is not None and currency != 'EUR': raise ValueError(f'Unexpected currency for {pid}: {currency}')
            output.append(row(variant['id'], product['title'], variant.get('productNumber'), plain(option['text']) if option else '', url, meta, price, currency, stock, 'Base variant price. Optional customization, decals or other surcharges may cost extra.' if p.customized else ''))
        if not output: raise ValueError(f'No variants {pid}')
        return output, {**meta, 'productId': pid, 'variantCount': len(output)}
    output = []; pages = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for i, (rows, meta) in enumerate(pool.map(capture, urls)):
            output.extend(rows); pages.append(meta)
            if i % 20 == 0: print('Basher Bodies', i + 1, '/', len(urls), flush=True)
    return {'id': 'basher-bodies', 'name': 'Basher Bodies', 'status': 'captured', 'products': output}, {'vendor': 'basher-bodies', 'scope': 'All product URLs published in vendor sitemap; not private inventory or unpublished products', 'productCount': len(urls), 'variantCount': len(output), 'sitemap': sitemap_meta, 'pages': pages, 'completeForScope': True}

if __name__ == '__main__':
    existing = json.loads((ROOT / 'src/data/upgrade-inventory.json').read_text())
    vendors = {v['id']: v for v in existing['vendors']}
    summary = []
    for collector in [perfect_pass, basher_bodies]:
        vendor, receipt = collector(); vendors[vendor['id']] = vendor; summary.append(receipt)
        print(vendor['name'], receipt['productCount'], 'products /', receipt['variantCount'], 'variants', flush=True)
        Path('/tmp/normalized-upgrade-inventory.json').write_text(json.dumps({'schemaVersion': 1, 'vendors': list(vendors.values())}, indent=2) + '\n')
        (ROOT / 'database/discovery/upgrade-inventory-captures.json').write_text(json.dumps({'captures': summary}, indent=2) + '\n')
