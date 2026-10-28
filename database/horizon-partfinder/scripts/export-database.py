#!/usr/bin/env python3
"""Offline Horizon export. Never fetches or modifies source captures."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
from datetime import datetime, timezone


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def utc(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()


SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE captures(path TEXT PRIMARY KEY, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, captured_at TEXT NOT NULL, timestamp_basis TEXT NOT NULL);
CREATE TABLE models(brand_id TEXT, model_id TEXT, brand TEXT, name TEXT, discontinued INTEGER, source_path TEXT REFERENCES captures(path), source_json TEXT, PRIMARY KEY(brand_id,model_id));
CREATE TABLE skus(brand_id TEXT, model_id TEXT, sku TEXT, color TEXT, is_fallback INTEGER, source_path TEXT REFERENCES captures(path), source_json TEXT, PRIMARY KEY(brand_id,model_id,sku), FOREIGN KEY(brand_id,model_id) REFERENCES models);
CREATE TABLE products(product_id TEXT PRIMARY KEY, name TEXT, brand TEXT, product_type TEXT, source_path TEXT REFERENCES captures(path), source_json TEXT);
CREATE TABLE associations(brand_id TEXT, model_id TEXT, sku TEXT, product_id TEXT REFERENCES products, relationship TEXT NOT NULL, PRIMARY KEY(brand_id,model_id,sku,product_id), FOREIGN KEY(brand_id,model_id,sku) REFERENCES skus);
CREATE TABLE product_snapshots(product_id TEXT REFERENCES products, source_path TEXT REFERENCES captures(path), captured_at TEXT, price_json TEXT, source_json TEXT, PRIMARY KEY(product_id,source_path));
CREATE TABLE association_captures(brand_id TEXT, model_id TEXT, sku TEXT, product_id TEXT, source_path TEXT REFERENCES captures(path), PRIMARY KEY(brand_id,model_id,sku,product_id,source_path), FOREIGN KEY(brand_id,model_id,sku,product_id) REFERENCES associations);
CREATE TABLE sku_snapshots(brand_id TEXT, model_id TEXT, sku TEXT, source_path TEXT REFERENCES captures(path), captured_at TEXT, price_json TEXT, source_json TEXT, PRIMARY KEY(brand_id,model_id,sku,source_path), FOREIGN KEY(brand_id,model_id,sku) REFERENCES skus);
CREATE TABLE coverage(brand_id TEXT, model_id TEXT, sku TEXT, expected_count INTEGER, observed_hits INTEGER, unique_count INTEGER, duplicate_hits INTEGER, pages INTEGER, status TEXT, issues_json TEXT, FOREIGN KEY(brand_id,model_id) REFERENCES models);
'''


def export(root, out, sample=None):
    out.mkdir(parents=True, exist_ok=True)
    issues = []
    captured = {}
    db = sqlite3.connect(out / 'horizon.sqlite')
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)

    def capture(path):
        path = path.resolve()
        rel = path.relative_to(root).as_posix()
        if rel not in captured:
            before = path.stat()
            data = path.read_bytes()
            after = path.stat()
            if (before.st_mtime_ns, before.st_size) != (after.st_mtime_ns, after.st_size):
                raise ValueError('Source changed during read: ' + rel)
            captured[rel] = (hashlib.sha256(data).hexdigest(), after.st_mtime_ns, after.st_size)
            db.execute('INSERT INTO captures VALUES(?,?,?,?,?)',
                       (rel, captured[rel][0], len(data), utc(after.st_mtime), 'filesystem_mtime_not_server_retrieval_time'))
        return rel

    def read(path):
        rel = capture(path)
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != captured[rel][0]:
            raise ValueError('Source changed during read: ' + rel)
        return json.loads(data)

    models = read(root / 'models.json')
    manifest = read(root / 'manifest.json')
    capture(root / 'models.csv')
    collection = read(root / 'collection-summary.json') if (root / 'collection-summary.json').exists() else None
    if not sample and collection:
        issues.extend({'kind': 'collector_error', **e} for e in collection.get('errors', []))
    selected = models
    if sample:
        selected = [m for m in models if (root / 'raw/details' / m['brand_id'] / m['model_id'] / 'summary.json').exists()][:sample]
        if not selected:
            raise ValueError('No completed model available for sample')
    for m in selected:
        b, mid = m['brand_id'], m['model_id']
        db.execute('INSERT INTO models VALUES(?,?,?,?,?,?,?)', (b, mid, m['brand'], m['name'], m.get('discontinued'), 'models.json', dump(m)))
        directory = root / 'raw/details' / b / mid
        summary_path = directory / 'summary.json'
        if not summary_path.exists():
            db.execute('INSERT INTO coverage VALUES(?,?,?,?,?,?,?,?,?,?)', (b, mid, None, None, 0, 0, 0, 0, 'missing_summary', dump(['missing_summary'])))
            issues.append({'brand_id': b, 'model_id': mid, 'kind': 'missing_summary'})
            continue
        try:
            summary = read(summary_path)
            if (summary['brand_id'], summary['model_id']) != (b, mid):
                raise ValueError('summary model identity mismatch')
            sku_path = directory / 'skus.json'
            sku_data = read(sku_path)['SKUs']
            if summary['skus'] != sku_data:
                raise ValueError('summary/skus mismatch')
            variants = sku_data or [{'sku': mid, 'fallback_model_id': True}]
            ids = [v['sku'] for v in variants]
            if len(set(ids)) != len(ids):
                raise ValueError('duplicate SKU definitions')
            queries = summary['queries']
            query_ids = [q['sku'] for q in queries]
            if mid in query_ids and mid not in ids:
                variants = variants + [{'sku': mid, 'fallback_model_id': True}]
                ids.append(mid)
            for v in variants:
                db.execute('INSERT INTO skus VALUES(?,?,?,?,?,?,?)', (b, mid, v['sku'], v.get('color'), int(bool(v.get('fallback_model_id'))), capture(sku_path), dump(v)))
            if sorted(ids) != sorted(query_ids):
                raise ValueError('missing/duplicate/unknown SKU queries')
        except (OSError, ValueError, KeyError, TypeError) as e:
            issues.append({'brand_id': b, 'model_id': mid, 'kind': 'invalid_summary', 'error': str(e)})
            db.execute('INSERT INTO coverage VALUES(?,?,?,?,?,?,?,?,?,?)', (b, mid, None, None, 0, 0, 0, 0, 'invalid_summary', dump([str(e)])))
            continue
        for q in queries:
            sid = q['sku']
            seen, problems, hit_count, offsets = set(), [], 0, []
            pages = q.get('pages', [])
            if not pages or len(set(pages)) != len(pages):
                problems.append('missing_or_duplicate_pages')
            for page in pages:
                try:
                    path = (root / page).resolve()
                    if path.parent != directory.resolve() or not path.name.startswith(sid + '-parts-'):
                        raise ValueError('page outside expected SKU directory')
                    offset = int(path.stem.rsplit('-parts-', 1)[1])
                    data = read(path)
                    search = data['partsSearch']['productSearch']
                    hits = search['productIds']
                    if search['count'] != q['expected_count']:
                        problems.append('page_expected_count_mismatch:' + page)
                    if offset != hit_count:
                        problems.append('page_offset_gap_or_overlap:' + page)
                    page_size = search.get('pageSize')
                    if isinstance(page_size, int) and page_size > 0:
                        expected_hits = min(page_size, max(0, q['expected_count'] - offset))
                        if len(hits) != expected_hits:
                            problems.append('page_hit_count_mismatch:' + page)
                    paging = search.get('pagingmodel', {})
                    if 'start' in paging and paging['start'] != offset:
                        problems.append('paging_start_mismatch:' + page)
                    offsets.append(offset)
                    rel = capture(path)
                    date = db.execute('SELECT captured_at FROM captures WHERE path=?', (rel,)).fetchone()[0]
                    product = data.get('product')
                    if product:
                        # A model-ID query may return a canonical variant header.
                        # Only the captured SKU list establishes an allowed alias;
                        # keep snapshots and associations keyed by the query SKU.
                        fallback_header = sid == mid and product.get('id') in {
                            variant['sku'] for variant in sku_data
                        }
                        if product.get('id') != sid and not fallback_header:
                            problems.append('model_product_id_mismatch:' + page)
                        db.execute('INSERT OR IGNORE INTO sku_snapshots VALUES(?,?,?,?,?,?,?)', (b, mid, sid, rel, date, dump(product.get('price')), dump(product)))
                    for hit in hits:
                        pid, detail = hit['productID'], hit['productSearchHit']
                        if not pid or not isinstance(detail, dict):
                            raise ValueError('invalid product hit')
                        if detail.get('id') != pid:
                            problems.append('hit_id_mismatch:' + str(pid))
                        hit_count += 1
                        seen.add(pid)
                        db.execute('INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?)', (pid, detail.get('productName'), detail.get('brand'), detail.get('productType'), rel, dump(detail)))
                        db.execute('INSERT OR IGNORE INTO product_snapshots VALUES(?,?,?,?,?)', (pid, rel, date, dump(detail.get('price')), dump(detail)))
                        db.execute('INSERT OR IGNORE INTO associations VALUES(?,?,?,?,?)', (b, mid, sid, pid, 'Horizon-listed; not verified fitment'))
                        db.execute('INSERT OR IGNORE INTO association_captures VALUES(?,?,?,?,?)', (b, mid, sid, pid, rel))
                except (OSError, ValueError, KeyError, TypeError) as e:
                    problems.append(page + ': ' + str(e))
            if len(seen) != q.get('expected_count') or len(seen) != q.get('unique_count'):
                problems.append('query_count_mismatch')
            if hit_count != len(seen):
                problems.append('duplicate_product_hits')
            db.execute('INSERT INTO coverage VALUES(?,?,?,?,?,?,?,?,?,?)', (b, mid, sid, q.get('expected_count'), hit_count, len(seen), hit_count-len(seen), len(pages), 'error' if problems else 'complete', dump(problems)))
            if problems:
                issues.append({'brand_id': b, 'model_id': mid, 'sku': sid, 'kind': 'query_validation', 'issues': problems})
    # Detect replacement of any input while exporting, including summaries.
    for rel, (digest, mtime, size) in captured.items():
        path = root / rel
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('Source changed during export: ' + rel)
    fk = [tuple(r) for r in db.execute('PRAGMA foreign_key_check')]
    integrity = db.execute('PRAGMA integrity_check').fetchone()[0]
    if fk or integrity != 'ok':
        raise ValueError('Database integrity failure: ' + repr((fk, integrity)))
    db.commit()
    counts = {t: db.execute('SELECT count(*) FROM ' + t).fetchone()[0] for t in ('models', 'skus', 'products', 'associations', 'captures', 'coverage', 'product_snapshots', 'sku_snapshots')}
    for table in ('associations', 'skus', 'products'):
        cursor = db.execute('SELECT * FROM ' + table + ' ORDER BY ' + {'associations':'brand_id,model_id,sku,product_id','skus':'brand_id,model_id,sku','products':'product_id'}[table])
        names = [c[0] for c in cursor.description]
        with (out / (table + '.json')).open('w') as js, (out / (table + '.csv')).open('w', newline='') as cs:
            writer = csv.writer(cs); writer.writerow(names)
            js.write('[\n'); first = True
            for row in cursor:
                writer.writerow(tuple(row))
                if not first: js.write(',\n')
                js.write(dump(dict(row))); first = False
            js.write('\n]\n')
    audit = {'generated_at': utc(datetime.now(timezone.utc).timestamp()), 'status': 'sample' if sample else ('incomplete' if issues else 'complete'), 'sample_models': sample, 'scope_brand_counts': manifest['brand_counts'], 'scope_model_count': len(models), 'counts': counts, 'issues': issues, 'foreign_key_errors': fk, 'integrity_check': integrity, 'duplicate_associations': 0, 'association_semantics': 'Horizon-listed, not verified fitment; tools and accessories included; productSearch.productIds only', 'prices': 'Dated raw-capture snapshots in product_snapshots and sku_snapshots; dates are filesystem mtimes, not server timestamps', 'source_manifest': manifest}
    db.close()
    (out / 'export-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    return audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path)
    parser.add_argument('--collector-complete', action='store_true', help='Confirm collector has stopped; requires collection-summary.json')
    parser.add_argument('--sample', type=int, metavar='MODELS', help='Small completed-model test only (1–3); separate output required')
    args = parser.parse_args()
    root = args.root.resolve()
    out = (args.output or root / 'exports').resolve()
    if args.sample is not None:
        if not 1 <= args.sample <= 3 or not args.output or out == root / 'exports':
            parser.error('Sample must be 1–3 models with a separate --output')
    elif not args.collector_complete or not (root / 'collection-summary.json').exists():
        parser.error('Wait for collector completion, then pass --collector-complete (collection-summary.json required)')
    if out == root or out == root / 'raw' or root / 'raw' in out.parents:
        parser.error('Output must not overwrite source data')
    out.mkdir(parents=True, exist_ok=True)
    # Build privately; failed builds leave the previous exports intact.
    with tempfile.TemporaryDirectory(prefix='.horizon-export-', dir=out.parent) as temp:
        stage = Path(temp)
        audit = export(root, stage, args.sample)
        for path in stage.iterdir():
            path.replace(out / path.name)
    if not args.sample:
        (root / 'export-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(json.dumps({'status': audit['status'], 'counts': audit['counts'], 'output': str(out)}))
    return 2 if audit['issues'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
