#!/usr/bin/env python3
"""Bounded offline regression tests; run with python -B scripts/test-export-database.py."""
import csv
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest


EXPORTER = Path(__file__).with_name('export-database.py')


class ExportRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='horizon-export-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.directory = self.root / 'raw/details/brands-test/MODEL'
        self.directory.mkdir(parents=True)
        self.model = dict(brand='Test', brand_id='brands-test', model_id='MODEL',
                          name='Fixture model', discontinued=False)
        self.write(self.root / 'models.json', [self.model])
        with (self.root / 'models.csv').open('w', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(self.model))
            writer.writeheader()
            writer.writerow(self.model)
        self.write(self.root / 'manifest.json', dict(
            source='https://example.invalid/partfinder', model_count=1,
            brand_counts={'Test': 1}, retrieved_at_utc='2026-01-01T00:00:00Z'))
        self.variants = [{'sku': 'SKU-A', 'color': 'RED'}]
        self.queries = []

    @staticmethod
    def write(path, value):
        path.write_text(json.dumps(value), encoding='utf-8')

    @staticmethod
    def hit(pid):
        return {'productID': pid, 'productSearchHit': {
            'id': pid, 'productName': 'Tool ' + pid, 'brand': 'Test',
            'productType': 'standard',
            'price': {'sales': {'value': 12.5, 'currency': 'USD'}, 'list': None}}}

    def page(self, sku, offset, ids, total, size=2, paging_start=None):
        path = self.directory / f'{sku}-parts-{offset}.json'
        self.write(path, {'partsSearch': {
            'productSearch': {'productIds': [self.hit(pid) for pid in ids],
                              'count': total, 'pageSize': size,
                              'pagingmodel': {'start': offset if paging_start is None else paging_start}},
            'combinedIds': [self.hit('RECOMMENDATION-ONLY')],
            'productCount': {'tools': 1, 'accessories': 1}},
            'product': {'id': sku, 'price': {'sales': {'value': 99, 'currency': 'USD'}}}})
        return path.relative_to(self.root).as_posix()

    def query(self, sku, pages, expected, unique=None):
        self.queries.append(dict(sku=sku, pages=pages, expected_count=expected,
                                 unique_count=expected if unique is None else unique))

    def run_export(self, expected_exit=0):
        summary = dict(brand_id='brands-test', model_id='MODEL',
                       skus=self.variants, queries=self.queries)
        self.write(self.directory / 'skus.json', {'SKUs': self.variants})
        self.write(self.directory / 'summary.json', summary)
        self.write(self.root / 'collection-summary.json', {'models': [summary], 'errors': []})
        result = subprocess.run(
            [sys.executable, '-B', str(EXPORTER), '--root', str(self.root), '--collector-complete'],
            capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, expected_exit, result.stdout + result.stderr)
        # Exercise the default path consumed by the integration agent.
        self.out = self.root / 'exports'
        self.assertTrue((self.out / 'horizon.sqlite').is_file())
        self.db = sqlite3.connect(self.out / 'horizon.sqlite')
        self.db.row_factory = sqlite3.Row
        self.addCleanup(self.db.close)
        self.assertEqual(list(self.db.execute('PRAGMA foreign_key_check')), [])
        self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        self.audit = json.loads((self.out / 'export-audit.json').read_text())
        self.assertEqual(self.audit['status'], 'complete' if expected_exit == 0 else 'incomplete')
        return self.db

    def problems(self):
        return [issue for row in self.db.execute('SELECT issues_json FROM coverage')
                for issue in json.loads(row[0])]

    def assert_problem(self, prefix):
        self.assertTrue(any(p.startswith(prefix) for p in self.problems()), self.problems())

    def test_valid_pagination_provenance_and_snapshots(self):
        pages = [self.page('SKU-A', 0, ['P1', 'P2'], 3),
                 self.page('SKU-A', 2, ['P3'], 3)]
        self.query('SKU-A', pages, 3)
        self.run_export()
        self.assertEqual(self.audit['counts']['associations'], 3)
        self.assertEqual(self.audit['counts']['product_snapshots'], 3)
        self.assertEqual(self.db.execute('SELECT count(*) FROM products WHERE product_id=?',
                                        ('RECOMMENDATION-ONLY',)).fetchone()[0], 0)
        for rel in pages:
            row = self.db.execute('SELECT * FROM captures WHERE path=?', (rel,)).fetchone()
            self.assertEqual(row['sha256'], hashlib.sha256((self.root / rel).read_bytes()).hexdigest())
            self.assertIn('filesystem_mtime', row['timestamp_basis'])
        snapshot = self.db.execute('SELECT * FROM product_snapshots LIMIT 1').fetchone()
        self.assertEqual(json.loads(snapshot['price_json'])['sales']['currency'], 'USD')
        self.assertTrue(snapshot['captured_at'])

    def test_missing_page_is_incomplete_and_retains_available_hits(self):
        first = self.page('SKU-A', 0, ['P1', 'P2'], 3)
        missing = (self.directory / 'SKU-A-parts-2.json').relative_to(self.root).as_posix()
        self.query('SKU-A', [first, missing], 3)
        self.run_export(2)
        self.assertEqual(self.audit['counts']['associations'], 2)
        self.assert_problem(missing + ':')
        self.assert_problem('query_count_mismatch')

    def test_empty_page_list_cannot_mean_zero_results(self):
        self.query('SKU-A', [], 0)
        self.run_export(2)
        self.assert_problem('missing_or_duplicate_pages')

    def test_page_total_mismatch(self):
        self.query('SKU-A', [self.page('SKU-A', 0, ['P1'], 2)], 1)
        self.run_export(2)
        self.assert_problem('page_expected_count_mismatch:')

    def test_short_page(self):
        self.query('SKU-A', [self.page('SKU-A', 0, ['P1'], 2)], 2)
        self.run_export(2)
        self.assert_problem('page_hit_count_mismatch:')
        self.assert_problem('query_count_mismatch')

    def test_offset_gap_and_paging_start_mismatch(self):
        pages = [self.page('SKU-A', 0, ['P1', 'P2'], 3),
                 self.page('SKU-A', 3, ['P3'], 3, paging_start=2)]
        self.query('SKU-A', pages, 3)
        self.run_export(2)
        self.assert_problem('page_offset_gap_or_overlap:')
        self.assert_problem('paging_start_mismatch:')

    def test_duplicate_hits_reported_without_duplicate_associations(self):
        self.query('SKU-A', [self.page('SKU-A', 0, ['P1', 'P1'], 2)], 2, unique=1)
        self.run_export(2)
        self.assert_problem('duplicate_product_hits')
        self.assertEqual(self.audit['counts']['associations'], 1)
        self.assertEqual(self.db.execute('SELECT duplicate_hits FROM coverage').fetchone()[0], 1)

    def test_empty_source_skus_model_fallback_zero_results(self):
        self.variants = []
        self.query('MODEL', [self.page('MODEL', 0, [], 0)], 0)
        self.run_export()
        row = self.db.execute('SELECT sku,is_fallback FROM skus').fetchone()
        self.assertEqual(tuple(row), ('MODEL', 1))
        self.assertEqual(self.audit['counts']['associations'], 0)
        self.assertEqual(self.db.execute('SELECT status FROM coverage').fetchone()[0], 'complete')

    def test_actual_sku_and_queried_model_fallback_are_preserved(self):
        for sku in ['SKU-A', 'MODEL']:
            self.query(sku, [self.page(sku, 0, [], 0)], 0)
        self.run_export()
        self.assertEqual(dict(self.db.execute('SELECT sku,is_fallback FROM skus')),
                         {'SKU-A': 0, 'MODEL': 1})

    def test_same_product_has_distinct_per_sku_associations_and_exports(self):
        self.variants.append({'sku': 'SKU-B', 'color': 'BLUE'})
        for sku in ['SKU-A', 'SKU-B']:
            self.query(sku, [self.page(sku, 0, ['SHARED'], 1)], 1)
        self.run_export()
        self.assertEqual(self.audit['counts']['products'], 1)
        self.assertEqual(self.audit['counts']['associations'], 2)
        self.assertEqual(self.audit['counts']['product_snapshots'], 2)
        rows = list(self.db.execute('SELECT sku,product_id,relationship FROM associations ORDER BY sku'))
        self.assertEqual([(r['sku'], r['product_id']) for r in rows],
                         [('SKU-A', 'SHARED'), ('SKU-B', 'SHARED')])
        self.assertTrue(all('not verified fitment' in r['relationship'] for r in rows))
        for table, count in [('associations', 2), ('skus', 2), ('products', 1)]:
            data = json.loads((self.out / (table + '.json')).read_text())
            with (self.out / (table + '.csv')).open(newline='') as stream:
                csv_rows = list(csv.DictReader(stream))
            self.assertEqual(len(data), count)
            self.assertEqual(csv_rows, [{k: '' if v is None else str(v) for k, v in row.items()}
                                        for row in data])

    def test_model_fallback_accepts_captured_variant_header_without_remapping(self):
        self.query('SKU-A', [self.page('SKU-A', 0, ['VARIANT-PART'], 1)], 1)
        page = self.page('MODEL', 0, ['FALLBACK-PART', 'TOOL'], 2)
        data = json.loads((self.root / page).read_text())
        data['product']['id'] = 'SKU-A'
        data['partsSearch']['productSearch']['searchKeywords'] = '"MODELPartFinderPart"'
        self.write(self.root / page, data)
        self.query('MODEL', [page], 2)
        self.run_export()
        snapshot = self.db.execute(
            'SELECT sku,source_json FROM sku_snapshots WHERE sku=?', ('MODEL',)).fetchone()
        self.assertEqual(snapshot['sku'], 'MODEL')
        self.assertEqual(json.loads(snapshot['source_json'])['id'], 'SKU-A')
        associations = [tuple(row) for row in self.db.execute(
            'SELECT sku,product_id FROM associations ORDER BY sku,product_id')]
        self.assertEqual(associations, [('MODEL', 'FALLBACK-PART'), ('MODEL', 'TOOL'),
                                       ('SKU-A', 'VARIANT-PART')])

    def test_model_fallback_rejects_unrelated_header(self):
        self.query('SKU-A', [self.page('SKU-A', 0, [], 0)], 0)
        page = self.page('MODEL', 0, [], 0)
        data = json.loads((self.root / page).read_text())
        data['product']['id'] = 'UNRELATED'
        self.write(self.root / page, data)
        self.query('MODEL', [page], 0)
        self.run_export(2)
        self.assert_problem('model_product_id_mismatch:')

    def test_explicit_sku_rejects_other_captured_variant_header(self):
        self.variants.append({'sku': 'SKU-B'})
        page = self.page('SKU-A', 0, [], 0)
        data = json.loads((self.root / page).read_text())
        data['product']['id'] = 'SKU-B'
        self.write(self.root / page, data)
        self.query('SKU-A', [page], 0)
        self.query('SKU-B', [self.page('SKU-B', 0, [], 0)], 0)
        self.run_export(2)
        self.assert_problem('model_product_id_mismatch:')

    def test_empty_sku_list_does_not_authorize_header_alias(self):
        self.variants = []
        page = self.page('MODEL', 0, [], 0)
        data = json.loads((self.root / page).read_text())
        data['product']['id'] = 'UNPROVEN-ALIAS'
        self.write(self.root / page, data)
        self.query('MODEL', [page], 0)
        self.run_export(2)
        self.assert_problem('model_product_id_mismatch:')


if __name__ == '__main__':
    unittest.main(verbosity=2)
