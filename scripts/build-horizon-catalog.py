#!/usr/bin/env python3
"""Build a normalized offline catalog from the validated exporter database."""
import argparse
import json
import sqlite3
from decimal import Decimal, InvalidOperation
from pathlib import Path


def build(database, models_path):
    db = sqlite3.connect(f'file:{database.resolve()}?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchone():
        raise ValueError('Invalid source database')
    models = json.loads(models_path.read_text())
    by_model = {(m['brand_id'], m['model_id']): m for m in models}
    for row in db.execute('SELECT * FROM models'):
        by_model[(row['brand_id'], row['model_id'])] = dict(row)
    captures = []
    capture_ids = {}
    for row in db.execute('SELECT * FROM captures ORDER BY path'):
        capture_ids[row['path']] = len(captures)
        captures.append([row['path'], row['sha256'], row['captured_at']])
    products = []
    product_ids = {}
    for row in db.execute('SELECT * FROM products ORDER BY product_id'):
        product_ids[row['product_id']] = len(products)
        products.append([row['product_id'], row['name'] or row['product_id'], row['brand'] or ''])
    snapshots = []
    snapshot_ids = {}
    for row in db.execute('SELECT * FROM product_snapshots ORDER BY product_id,source_path'):
        price = json.loads(row['price_json']) or {}
        sales = price.get('sales') or {}
        amount = None
        # A captured sales value only; do not convert ranges or list prices into offers.
        if sales.get('currency') == 'USD':
            try:
                value = Decimal(str(sales.get('decimalPrice', sales.get('value')))) * 100
                if value.is_finite() and value >= 0 and value == value.to_integral_value():
                    amount = int(value)
            except (InvalidOperation, ValueError, TypeError):
                pass
        snapshot_ids[(row['product_id'], row['source_path'])] = len(snapshots)
        snapshots.append([capture_ids[row['source_path']], amount, sales.get('currency') if amount is not None else None])
    sku_rows = {}
    for row in db.execute('SELECT * FROM skus ORDER BY brand_id,model_id,sku'):
        key = (row['brand_id'], row['model_id'], row['sku'])
        sku_rows[key] = {'sku': row['sku'], 'color': row['color'], 'is_fallback': bool(row['is_fallback']), 'status': 'missing_coverage', 'expectedCount': None, 'associations': []}
    for row in db.execute('SELECT * FROM coverage'):
        key = (row['brand_id'], row['model_id'], row['sku'])
        if key in sku_rows:
            sku_rows[key].update(status=row['status'], expectedCount=row['expected_count'])
    grouped = {}
    for row in db.execute('SELECT a.*, c.source_path FROM associations a JOIN association_captures c USING(brand_id,model_id,sku,product_id) ORDER BY a.brand_id,a.model_id,a.sku,a.product_id,c.source_path'):
        key = (row['brand_id'], row['model_id'], row['sku'], row['product_id'])
        grouped.setdefault(key, [row['relationship'], []])[1].append(snapshot_ids[(row['product_id'], row['source_path'])])
    if len(grouped) != db.execute('SELECT count(*) FROM associations').fetchone()[0]:
        raise ValueError('Association missing source capture; refusing silent omission')
    relationships = sorted({value[0] for value in grouped.values()})
    relationship_ids = {label: index for index, label in enumerate(relationships)}
    for key, (relationship, sources) in grouped.items():
        sku_rows[key[:3]]['associations'].append([product_ids[key[3]], relationship_ids[relationship], sources])
    for sku in sku_rows.values():
        if sku['status'] == 'complete' and sku['expectedCount'] != len(sku['associations']):
            sku['status'] = 'error'
    output_models = []
    for key, m in sorted(by_model.items()):
        output_models.append({'brand_id': key[0], 'model_id': key[1], 'name': m['name'], 'discontinued': bool(m['discontinued']), 'status': 'missing_summary', 'skus': []})
    model_lookup = {(m['brand_id'], m['model_id']): m for m in output_models}
    for key, sku in sku_rows.items():
        model_lookup[key[:2]]['skus'].append(sku)
    for model in output_models:
        if model['skus']:
            model['status'] = 'complete' if all(s['status'] == 'complete' for s in model['skus']) else 'incomplete'
    brands = sorted({m['brand_id']: m['brand'] for m in by_model.values()}.items())
    result = {'schemaVersion': 2, 'relationships': relationships, 'brands': [{'id': k, 'name': v} for k, v in brands], 'models': output_models, 'products': products, 'captures': captures, 'snapshots': snapshots}
    result['metadata'] = dict(modelCount=len(output_models), brandCount=len(brands), skuCount=len(sku_rows), productCount=len(products), associationCount=len(grouped), observedAt=max((c[2] for c in captures), default=None))
    db.close()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=Path('/workspace/horizon-partfinder/exports/horizon.sqlite'))
    parser.add_argument('--models', type=Path, default=Path('/workspace/horizon-partfinder/models.json'))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'src/data/horizon-catalog.json')
    args = parser.parse_args()
    result = build(args.database, args.models)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(args.output)
    print(json.dumps(result['metadata']))
