#!/usr/bin/env python3
"""Independent saved-response coverage audit. Full mode requires collection-summary.json.

Run: python audit-coverage.py [--partial]
Writes coverage-audit.json. Partial mode audits only completed model summaries and
always marks the report incomplete, even when all inspected records pass.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

BASE = Path(__file__).resolve().parent


def validate_source(data, search, sid, mid, sku_ids, sku_count):
    """Bind saved results to the query; allow only captured canonical fallback headers."""
    expected_keywords = '"' + sid + 'PartFinderPart"'
    if search.get('searchKeywords') != expected_keywords:
        raise ValueError(f'Search lookup mismatch: expected {expected_keywords!r}, got {search.get("searchKeywords")!r}')
    product = data.get('product')
    if not isinstance(product, dict) or not isinstance(product.get('id'), str):
        raise ValueError('Missing/invalid source product header')
    header_id = product['id']
    canonical = header_id != sid
    if canonical and not (sid == mid and sku_count <= 1 and header_id in sku_ids):
        raise ValueError(f'Source product header mismatch: requested {sid!r}, got {header_id!r}')
    return canonical


def audit(partial=False):
    errors, missing, zero, queries, fingerprints = [], [], [], [], {}
    canonical_headers = []
    brand_stats = defaultdict(Counter)

    def issue(message, **context):
        errors.append({'error': message, **context})

    def load(path):
        data = path.read_bytes()
        fingerprints[str(path.relative_to(BASE))] = hashlib.sha256(data).hexdigest()
        return json.loads(data)

    def require(condition, message):
        if not condition:
            raise ValueError(message)

    models = load(BASE / 'models.json')
    require(isinstance(models, list), 'models.json must be an array')
    known = {}
    for model in models:
        key = (model['brand_id'], model['model_id'])
        require(key not in known, 'Duplicate model key: ' + repr(key))
        known[key] = model
        brand_stats[model['brand_id']]['expected_models'] += 1

    root_path = BASE / 'collection-summary.json'
    collection = None
    if root_path.exists():
        collection = load(root_path)
    elif not partial:
        raise ValueError('Full audit requires collection-summary.json; use --partial while collection runs')

    root_models = {}
    if collection is not None:
        require(isinstance(collection, dict) and isinstance(collection.get('models'), list)
                and isinstance(collection.get('errors'), list), 'Invalid collection-summary.json schema')
        for row in collection['models']:
            key = (row['brand_id'], row['model_id'])
            if key in root_models:
                issue('Duplicate model in collection summary', brand_id=key[0], model_id=key[1])
            root_models[key] = row
            if key not in known:
                issue('Unknown model in collection summary', brand_id=key[0], model_id=key[1])
        if collection['errors']:
            issue('Collection reports failed models', failures=collection['errors'])
        if not partial:
            for key in known.keys() - root_models.keys():
                issue('Model absent from collection summary', brand_id=key[0], model_id=key[1])

    discovered = set()
    for path in (BASE / 'raw/details').glob('*/*/summary.json'):
        key = (path.parent.parent.name, path.parent.name)
        discovered.add(key)
        if key not in known:
            issue('Unexpected raw model summary', path=str(path.relative_to(BASE)))

    checked = 0
    for (bid, mid), model in known.items():
        directory = BASE / 'raw/details' / bid / mid
        path = directory / 'summary.json'
        context = {'brand_id': bid, 'model_id': mid}
        if not path.exists():
            missing.append(context)
            brand_stats[bid]['missing_summaries'] += 1
            if not partial:
                issue('Missing model summary', **context)
            continue
        checked += 1
        brand_stats[bid]['audited_models'] += 1
        before = len(errors)
        try:
            summary = load(path)
            require(summary['brand_id'] == bid and summary['model_id'] == mid, 'Summary identity mismatch')
            if collection is not None:
                require((bid, mid) in root_models, 'Completed raw summary absent from collection summary')
                require(root_models[(bid, mid)] == summary, 'Collection and per-model summaries differ')
            sku_data = load(directory / 'skus.json')
            require(isinstance(sku_data, dict) and isinstance(sku_data.get('SKUs'), list), 'Invalid raw SKU schema')
            skus = sku_data['SKUs']
            require(summary['skus'] == skus, 'Summary SKUs differ from raw SKUs')
            sku_ids = [sku['sku'] for sku in skus]
            require(all(isinstance(s, str) and s for s in sku_ids), 'Invalid SKU IDs')
            require(len(sku_ids) == len(set(sku_ids)), 'Duplicate raw SKU IDs')
            expected = set(sku_ids)
            if len(skus) <= 1:
                expected.add(mid)
            actual = [q['sku'] for q in summary['queries']]
            require(len(actual) == len(set(actual)), 'Duplicate query SKU')
            require(set(actual) == expected,
                    f'Query coverage mismatch: missing={sorted(expected-set(actual))}, extra={sorted(set(actual)-expected)}')
            referenced = set()
            for query in summary['queries']:
                sid = query['sku']
                qcontext = {**context, 'sku': sid}
                try:
                    require(type(query['expected_count']) is int and query['expected_count'] >= 0, 'Invalid expected_count')
                    require(type(query['unique_count']) is int and query['unique_count'] >= 0, 'Invalid unique_count')
                    require(isinstance(query['pages'], list) and query['pages'], 'Query has no saved pages')
                    counts, page_offsets, ids = [], [], []
                    next_offset = 0
                    for index, filename in enumerate(query['pages']):
                        require(isinstance(filename, str), 'Non-string page path')
                        page = BASE / filename
                        require(not Path(filename).is_absolute() and page.resolve().is_relative_to(directory.resolve()), 'Page path outside model directory')
                        match = re.fullmatch(re.escape(sid) + r'-parts-(\d+)\.json', page.name)
                        require(match is not None, 'Page filename does not match SKU and offset')
                        offset = int(match.group(1))
                        require(offset == next_offset, f'Noncontiguous/out-of-order page offset {offset}; expected {next_offset}')
                        require(filename not in referenced, 'Repeated saved page reference')
                        referenced.add(filename)
                        data = load(page)
                        search = data['partsSearch']['productSearch']
                        canonical = validate_source(data, search, sid, mid, sku_ids, len(skus))
                        if canonical:
                            canonical_headers.append({**qcontext, 'page': filename, 'header_id': data['product']['id']})
                        count = search['count']
                        hits = search['productIds']
                        require(type(count) is int and count >= 0 and isinstance(hits, list), 'Invalid count/hits schema')
                        require(count == query['expected_count'], 'Raw total count differs from summary or changes across pages')
                        hit_ids = [hit['productID'] for hit in hits]
                        require(all(isinstance(h, str) and h for h in hit_ids), 'Invalid raw hit ID')
                        require(count == 0 or bool(hits), 'Empty page for nonzero total')
                        size = search.get('pageSize')
                        if size is not None:
                            require(type(size) is int and size > 0 and len(hits) <= size, 'Invalid page size/hit length')
                        paging = search.get('pagingmodel', {})
                        for field, value in [('start', offset), ('count', count)]:
                            if field in paging:
                                require(paging[field] == value, 'Raw pagingmodel ' + field + ' mismatch')
                        if hits and 'end' in paging:
                            require(paging['end'] == offset + len(hits) - 1, 'Raw pagingmodel end mismatch')
                        page_offsets.append(offset)
                        counts.append(count)
                        ids.extend(hit_ids)
                        next_offset += len(hits)
                        require(next_offset <= count, 'Raw hits exceed reported total')
                        if index < len(query['pages']) - 1:
                            require(next_offset < count, 'Extra page after reported total reached')
                    duplicates = {pid: n for pid, n in Counter(ids).items() if n > 1}
                    require(not duplicates, 'Duplicate raw hit IDs within/across pages: ' + repr(duplicates))
                    require(len(set(ids)) == query['expected_count'] == query['unique_count'], 'Raw unique/expected/summary count mismatch')
                    record = {**qcontext, 'query_type': 'model_fallback' if len(skus) <= 1 and sid == mid and sid not in sku_ids else 'actual_sku',
                              'expected_count': query['expected_count'], 'raw_unique_count': len(set(ids)),
                              'page_count': len(counts), 'offsets': page_offsets}
                    queries.append(record)
                    brand_stats[bid]['verified_queries'] += 1
                    brand_stats[bid]['raw_hit_associations'] += len(ids)
                    if not ids:
                        zero.append(record)
                        brand_stats[bid]['zero_result_queries'] += 1
                except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
                    issue(str(exc), **qcontext)
            saved = {str(f.relative_to(BASE)) for f in directory.glob('*-parts-*.json')}
            if saved - referenced:
                issue('Unreferenced saved parts pages', pages=sorted(saved - referenced), **context)
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
            issue(str(exc), **context)
        if len(errors) > before:
            brand_stats[bid]['failed_models'] += 1
        else:
            brand_stats[bid]['verified_models'] += 1

    complete = not partial and not errors and not missing and len(root_models) == len(known)
    return {'audited_at_utc': datetime.now(timezone.utc).isoformat(), 'mode': 'partial' if partial else 'full',
            'status': 'fail' if errors else ('incomplete' if partial else 'pass'), 'complete': complete,
            'scope': 'Independent model/SKU/fallback/page/hit coverage against saved raw responses; no live requests.',
            'summary': {'expected_models': len(known), 'audited_models': checked, 'missing_models': len(missing),
                        'verified_queries': len(queries), 'zero_result_queries': len(zero), 'error_count': len(errors)},
            'brand_counts': {bid: {'brand': next(m['brand'] for m in models if m['brand_id'] == bid), **dict(stats)}
                             for bid, stats in sorted(brand_stats.items())},
            'missing_models': missing, 'zero_result_queries': zero, 'queries': queries,
            'errors': errors, 'accepted_canonical_headers': canonical_headers, 'input_sha256': fingerprints,
            'limitations': ['Partial runs always remain incomplete and examine only models with saved summaries.',
                            'Collection files may change during partial runs; full audit should run after collection finishes.',
                            'Counts verify source response coverage, not silent source-side omissions.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--partial', action='store_true', help='Audit completed model summaries only; always marks report incomplete')
    args = parser.parse_args()
    # Refuse an early full run without writing or replacing a report.
    if not args.partial and not (BASE / 'collection-summary.json').exists():
        parser.error('collection-summary.json does not exist; wait for collection or use --partial')
    try:
        report = audit(args.partial)
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        report = {'audited_at_utc': datetime.now(timezone.utc).isoformat(), 'mode': 'partial' if args.partial else 'full',
                  'status': 'fail', 'complete': False, 'errors': [{'error': str(exc)}]}
    target = BASE / 'coverage-audit.json'
    target.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({k: report[k] for k in ('mode', 'status', 'complete')} | report.get('summary', {}), indent=2))
    return 1 if report['status'] == 'fail' else 0


if __name__ == '__main__':
    sys.exit(main())
