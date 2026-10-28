#!/usr/bin/env python3
"""Audit saved model extraction; writes only model-audit.json. Optional public JS is read in memory."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.request import urlopen

BASE = Path(__file__).resolve().parent

def audit(public_js=False):
    errors, warnings, hashes = [], [], {}
    def read(path):
        data = (BASE / path).read_bytes()
        hashes[path] = hashlib.sha256(data).hexdigest()
        return data.decode('utf-8')
    def load(path):
        try:
            return json.loads(read(path))
        except (OSError, ValueError) as exc:
            errors.append({'file': path, 'error': str(exc)})
            return None
    html = read('raw/partfinder.html')
    configs = re.findall(r'"partFinderBrands"\s*:\s*(\[[^\]]*\])', html)
    configured = json.loads(configs[0]) if configs else []
    if not configs or any(json.loads(c) != configured for c in configs):
        errors.append({'error': 'Missing or inconsistent partFinderBrands configuration'})
    brands = {}
    for entry in configured:
        name, bid = entry.split('|', 1)
        if bid in brands:
            errors.append({'error': 'Duplicate configured brand', 'brand_id': bid})
        brands[bid] = name
    if len(brands) != 14:
        errors.append({'error': 'Expected 14 configured brands', 'actual': len(brands)})
    models = load('models.json')
    manifest = load('manifest.json')
    if not isinstance(models, list):
        errors.append({'error': 'models.json must be an array'})
        models = []
    def schema(rows, fields, location):
        valid = []
        for index, row in enumerate(rows):
            if not isinstance(row, dict) or set(row) != set(fields):
                errors.append({'file': location, 'index': index, 'error': 'Unexpected schema', 'row': row})
                continue
            invalid = [k for k, typ in fields.items() if type(row[k]) is not typ or
                       (typ is str and (not row[k].strip() or row[k] != row[k].strip()))]
            if invalid:
                errors.append({'file': location, 'index': index, 'error': 'Invalid field type/empty/outer whitespace', 'fields': invalid})
                continue
            valid.append(row)
        return valid
    valid_models = schema(models, {'brand': str, 'brand_id': str, 'model_id': str,
                                   'name': str, 'discontinued': bool}, 'models.json')
    def signature(row):
        return tuple(row[k] for k in ('brand', 'brand_id', 'model_id', 'name', 'discontinued'))
    expected, per_brand, pagination = [], [], []
    pagination_re = re.compile(r'^(?:.*(?:pagination|hasmore|hasnext|nextpage|nextcursor|pagetoken|pagesize|pagecount|totalpages|totalcount|totalresults).*|page|offset|limit|start|count|total|next|previous|cursor|links|_links)$', re.I)
    def scan(value, path, filename):
        if isinstance(value, dict):
            for key, child in value.items():
                childpath = path + '.' + key
                if pagination_re.match(re.sub(r'[_-]', '', key)):
                    pagination.append({'file': filename, 'path': childpath, 'value': child})
                scan(child, childpath, filename)
        elif isinstance(value, list):
            for i, child in enumerate(value):
                scan(child, f'{path}[{i}]', filename)
    actual_raw_files = {f.stem for f in (BASE / 'raw').glob('brands-*.json')}
    for bid in sorted(actual_raw_files - set(brands)):
        errors.append({'error': 'Unconfigured raw brand file', 'brand_id': bid})
    for bid, name in brands.items():
        filename = f'raw/{bid}.json'
        raw = load(filename)
        if not isinstance(raw, dict) or not isinstance(raw.get('products'), list):
            errors.append({'file': filename, 'error': 'Expected object with products array'})
            continue
        scan(raw, '$', filename)
        rows = schema(raw['products'], {'ID': str, 'Name': str, 'discontinued': bool}, filename)
        ids = Counter(r['ID'] for r in rows)
        duplicates = {k: n for k, n in ids.items() if n > 1}
        if duplicates:
            errors.append({'file': filename, 'error': 'Duplicate raw model IDs', 'ids': duplicates})
        normalized = [{'brand': name, 'brand_id': bid, 'model_id': r['ID'],
                       'name': r['Name'], 'discontinued': r['discontinued']} for r in rows]
        expected.extend(normalized)
        extracted = [r for r in valid_models if r['brand_id'] == bid]
        missing = Counter(map(signature, normalized)) - Counter(map(signature, extracted))
        extra = Counter(map(signature, extracted)) - Counter(map(signature, normalized))
        if missing or extra:
            errors.append({'brand_id': bid, 'error': 'Raw/extracted field or multiplicity mismatch',
                           'missing': list(missing.elements()), 'extra': list(extra.elements())})
        per_brand.append({'brand': name, 'brand_id': bid, 'raw_count': len(raw['products']),
                          'extracted_count': len(extracted),
                          'active': sum(not r['discontinued'] for r in rows),
                          'discontinued': sum(r['discontinued'] for r in rows),
                          'raw_top_level_keys': sorted(raw), 'duplicate_ids': duplicates,
                          'exact_mapping_match': not missing and not extra,
                          'manifest_count_matches': bool(manifest and manifest.get('brand_counts', {}).get(name) == len(rows))})
    for row in valid_models:
        if brands.get(row['brand_id']) != row['brand']:
            errors.append({'error': 'Invalid brand mapping', 'row': row})
    counts = Counter((r['brand_id'], r['model_id']) for r in valid_models)
    duplicate_keys = [{'brand_id': k[0], 'model_id': k[1], 'count': n} for k, n in counts.items() if n > 1]
    if duplicate_keys:
        errors.append({'error': 'Duplicate extracted model keys', 'duplicates': duplicate_keys})
    global_ids, names = defaultdict(list), defaultdict(list)
    for row in valid_models:
        global_ids[row['model_id']].append(row['brand_id'])
        names[(row['brand_id'], row['name'])].append(row['model_id'])
    cross_brand = {k: sorted(set(v)) for k, v in global_ids.items() if len(set(v)) > 1}
    duplicate_names = [{'brand_id': bid, 'name': name, 'model_ids': ids}
                       for (bid, name), ids in names.items() if len(ids) > 1]
    actual_counts = dict(Counter(r['brand'] for r in valid_models))
    if not manifest or manifest.get('model_count') != len(models) or manifest.get('brand_counts') != actual_counts:
        errors.append({'error': 'Manifest counts differ from models.json'})
    if any(not r['manifest_count_matches'] for r in per_brand):
        errors.append({'error': 'Manifest counts differ from raw responses'})
    if pagination:
        warnings.append('Pagination-related keys detected; inspect pagination_indicators for whether further pages exist.')
    js = {'checked': False}
    if public_js:
        sources = re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', html)
        main = next((s for s in sources if s.endswith('/main.js')), None)
        if main:
            url = 'https://www.horizonhobby.com' + main if main.startswith('/') else main
            try:
                body = urlopen(url, timeout=30).read()
                text = body.decode('utf-8')
                methods = re.findall(r'partFinderGetProducts\([^)]*\)\{.*?(?=partFinderGetSkus\()', text)
                store = re.findall(r'.{0,250}partFinderGetProducts\(\{.{0,1000}', text)
                js = {'checked': True, 'url': url, 'sha256': hashlib.sha256(body).hexdigest(),
                      'product_method': methods, 'store_call_contexts': store,
                      'assessment': 'Inspect product_method: brand filter request and whole JSON response; no pagination loop/parameters in this method.' if methods else 'Method pattern not found; manual review needed.'}
            except Exception as exc:
                js = {'checked': False, 'url': url, 'error': str(exc)}
                warnings.append('Could not inspect public JS.')
    return {'audited_at_utc': datetime.now(timezone.utc).isoformat(), 'status': 'pass' if not errors else 'fail',
            'scope': 'Exact completeness versus saved responses for all brands in saved partFinderBrands configuration.',
            'limitations': ['Cannot prove absence of silent server-side truncation or models omitted by the source endpoint.',
                            'Model audit only; SKU variants and parts associations are outside scope.',
                            'Public JavaScript is fetched only with --public-js; raw JSON does not include HTTP headers.'],
            'configured_brands': brands, 'summary': {'configured_brand_count': len(brands),
                'raw_model_count': len(expected), 'extracted_model_count': len(models),
                'unique_model_ids': len(global_ids), 'active': sum(not r['discontinued'] for r in valid_models),
                'discontinued': sum(r['discontinued'] for r in valid_models), 'error_count': len(errors),
                'pagination_indicator_count': len(pagination), 'duplicate_model_key_count': len(duplicate_keys),
                'cross_brand_id_count': len(cross_brand), 'duplicate_name_group_count': len(duplicate_names)},
            'per_brand': per_brand, 'errors': errors, 'warnings': warnings,
            'cross_brand_ids': cross_brand, 'duplicate_names': duplicate_names,
            'pagination_indicators': pagination, 'public_js': js, 'input_sha256': hashes}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-js', action='store_true', help='Inspect referenced public main.js in memory')
    args = parser.parse_args()
    report = audit(args.public_js)
    (BASE / 'model-audit.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': report['status'], **report['summary']}, indent=2))
    sys.exit(0 if report['status'] == 'pass' else 1)
