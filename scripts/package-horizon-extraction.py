#!/usr/bin/env python3
"""Package audited Horizon exports and source evidence for repository publication."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import tarfile


def compressed(source, target):
    with source.open('rb') as src, target.open('wb') as dst:
        with gzip.GzipFile(filename='', fileobj=dst, mode='wb', mtime=0, compresslevel=6) as gz:
            shutil.copyfileobj(src, gz)


def archive(root, paths, target):
    with target.open('wb') as dst:
        with gzip.GzipFile(filename='', fileobj=dst, mode='wb', mtime=0, compresslevel=6) as gz:
            with tarfile.open(fileobj=gz, mode='w|') as tar:
                for path in sorted(paths):
                    tar.add(path, arcname=path.relative_to(root).as_posix(), recursive=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/workspace/horizon-partfinder'))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'database/horizon-partfinder')
    args = parser.parse_args()
    root, out = args.root.resolve(), args.output.resolve()
    audit = json.loads((root/'exports/export-audit.json').read_text())
    coverage = json.loads((root/'coverage-audit.json').read_text())
    if audit['status'] != 'complete' or audit['issues'] or coverage.get('status') != 'pass':
        raise ValueError('Refusing to package incomplete or failed extraction')
    out.mkdir(parents=True, exist_ok=True)
    for name in ('models.json', 'models.csv', 'manifest.json', 'collection-summary.json', 'model-audit.json', 'coverage-audit.json', 'export-audit.json'):
        shutil.copyfile(root/name, out/name)
    shutil.copyfile(root/'README.md', out/'README.md')
    scripts = out/'scripts';scripts.mkdir(exist_ok=True)
    for path in (root/'scripts').glob('*.py'):
        shutil.copyfile(path, scripts/path.name)
    for name in ('audit-models.py', 'audit-coverage.py'):
        shutil.copyfile(root/name, out/name)
    (out/'requirements.txt').write_text('requests==2.34.2\n')
    for name in ('horizon.sqlite', 'associations.json', 'associations.csv', 'products.json', 'products.csv', 'skus.json', 'skus.csv'):
        compressed(root/'exports'/name, out/(name+'.gz'))
    sources=out/'sources';sources.mkdir(exist_ok=True)
    archive(root, [p for p in (root/'raw').glob('*') if p.is_file()], sources/'models.tar.gz')
    for brand in sorted((root/'raw/details').iterdir()):
        if brand.is_dir():
            archive(root, [p for p in brand.rglob('*') if p.is_file() and p.suffix != '.tmp'], sources/(brand.name+'.tar.gz'))
    files=sorted(p for p in out.rglob('*') if p.is_file() and p.name!='SHA256SUMS')
    for path in files:
        if path.stat().st_size >= 95_000_000:
            raise ValueError('Artifact too large for Git publication: '+str(path))
    (out/'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(out).as_posix()+'\n' for p in files))
    print(json.dumps({'files':len(files),'bytes':sum(p.stat().st_size for p in files),'counts':audit['counts']}))


if __name__=='__main__':
    main()
