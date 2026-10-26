"""Inventory official product evidence; fetch at most two public pages concurrently.

Usage: python3 scripts/collect-vehicle-documents.py [--fetch]
Without --fetch, only retained local evidence is read. PDFs are linked, not fetched.
"""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
DISCOVERY = ROOT / 'database/discovery'
EVIDENCE = ROOT / 'database/evidence/product-pages'
EVIDENCE.mkdir(parents=True, exist_ok=True)
INVENTORY = json.loads((DISCOVERY / 'vehicle-inventory.json').read_text())


def collect(record):
    identity = record['id']
    url = record['product_url']
    if not re.fullmatch(r'[A-Za-z0-9_-]+', identity):
        raise ValueError('Unsafe catalog identity')
    path = EVIDENCE / f'{identity}.html'
    try:
        if not path.exists():
            if '--fetch' not in sys.argv:
                raise ValueError('Local response missing; rerun with --fetch to retrieve official page')
            with urllib.request.urlopen(url, timeout=30) as response:
                content = response.read()
            path.write_bytes(content)
        content = path.read_bytes()
        text = content.decode('utf-8')
        match = re.search(r'<script id="mobify-data"[^>]*>(.*?)</script>', text, re.S)
        if not match:
            raise ValueError('Official product state missing')
        state = json.loads(match.group(1))['__PRELOADED_STATE__']['__STATE_MANAGEMENT_LIBRARY']['store']
        products = state['productStore']['productsById']
        product = products.get(identity)
        if not product:
            raise ValueError('Exact requested identity missing from source')
        attachments = []
        for group, item in (product.get('pdpTabs', {}).get('hasAttachments') or {}).items():
            for file in item.get('files', []):
                attachments.append({'group': group, **{key: file.get(key) for key in ['url', 'label', 'name']}})
        identities = []
        for raw in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', text, re.S):
            data = json.loads(raw)
            if isinstance(data, dict) and data.get('@type') == 'Product':
                identities.append({key: data.get(key) for key in ['sku', 'mpn', 'name', '@id']})
        mentions = []
        for field in ['name', 'secondaryName', 'shortDescription', 'longDescription', 'descriptionOverview']:
            value = str(product.get(field) or '')
            for occurrence in re.finditer(r'\b(?:[Vv]\d+|[Vv]ersion\s+\d+)\b', value):
                mentions.append({'field': field, 'literal': occurrence.group(), 'context': value[max(0, occurrence.start()-90):occurrence.end()+100]})
        timestamp = datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        return {'id': identity, 'source_url': url, 'source_file': str(path.relative_to(ROOT)),
                'sha256': hashlib.sha256(content).hexdigest(), 'retrieved_at': timestamp,
                'source_locator': f'mobify-data productStore.productsById[{identity}]',
                'name': product.get('name'), 'hydration_product_id': product.get('id'),
                'jsonld_identities': identities, 'master_id': product.get('masterId'),
                'selected_variant_id': product.get('defaultSelectedVariantId'),
                'declared_discontinued': product.get('discontinued'),
                'revision': None, 'revision_mentions': mentions,
                'revision_note': 'Unassigned evidence; mentions can describe components, not the vehicle generation.',
                'attachments': attachments,
                'parts_links': [item for item in product.get('quickLinks', []) if item.get('code') in ['Standardparts', 'OptionalParts']],
                'exploded_view_route': product.get('pdpTabs', {}).get('explodedView')}
    except Exception as error:
        return {'id': identity, 'source_url': url, 'error': str(error)}


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(collect, INVENTORY['records']))
    failures = [row for row in results if 'error' in row]
    records = [row for row in results if 'error' not in row]
    documents = {file['url'] for row in records for file in row['attachments'] if file.get('url')}
    output = {'scope': 'Per-product evidence for the indexed discovery inventory only; no claim of all historical models or reviewed fitment.',
              'requested_count': len(results), 'parsed_count': len(records), 'unique_document_urls': len(documents),
              'document_status': 'Links extracted; documents not yet retrieved or reviewed.',
              'records': records, 'failures': failures}
    (DISCOVERY / 'vehicle-documents.json').write_text(json.dumps(output, indent=2)+'\n')
    print(json.dumps({key: output[key] for key in ['requested_count', 'parsed_count', 'unique_document_urls']}))
    if failures:
        print(json.dumps(failures, indent=2))
        sys.exit(1)
