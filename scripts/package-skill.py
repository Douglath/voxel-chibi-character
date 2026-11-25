"""Build reproducible, independent skill ZIPs from canonical sources."""
from pathlib import Path
import argparse, hashlib, json, zipfile
ROOT = Path(__file__).resolve().parents[1]
NAMES = ('voxel-chibi-character', 'character-sheet-to-voxel', 'ak-model-upload', 'ak-model-download', 'ak-model-batch-import', 'chibi-character-sheet')
DEFAULT = NAMES
EXCLUDED = {'__pycache__', 'node_modules', '.git', 'settings.local.json'}
def package(name, dest):
    source = ROOT / 'skills' / name
    archive = dest / (name + '.zip')
    files = sorted(p for p in source.rglob('*') if p.is_file() and not EXCLUDED.intersection(p.relative_to(source).parts))
    assert (source / 'SKILL.md') in files
    for required in ('LICENSE', 'NOTICE', 'LICENSING.md', 'CREDITS.md', 'THIRD_PARTY_NOTICES.md'):
        assert (source / required) in files, f'Missing package notice: {name}/{required}'
    assert (source / 'LICENSE').read_bytes() == (ROOT / 'LICENSE').read_bytes(), f'License drift: {name}'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            if p.is_symlink(): raise ValueError(f'Symlink is not a portable asset: {p}')
            info = zipfile.ZipInfo(name + '/' + p.relative_to(source).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, p.read_bytes(), compresslevel=9)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == len(files)
        for p in files: assert z.read(name + '/' + p.relative_to(source).as_posix()) == p.read_bytes()
    return {'file': archive.name, 'files': len(files), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size}
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('skills', nargs='*', help='Skill names; default: all six independently licensed skill packages')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    names = args.skills or DEFAULT
    unknown = set(names) - set(NAMES)
    if unknown: parser.error('Unknown skills: ' + ', '.join(sorted(unknown)))
    args.output.mkdir(parents=True, exist_ok=True)
    reports = [package(name, args.output) for name in dict.fromkeys(names)]
    index = args.output / 'checksums.json'
    old = json.loads(index.read_text(encoding='utf8')).get('packages', []) if index.exists() else []
    current = {r['file']: r for r in reports}
    for row in old:
        p = args.output / row['file']
        if p.name not in current and p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest() == row['sha256']: current[p.name] = row
    rows = sorted(current.values(), key=lambda r:r['file'])
    index.write_text(json.dumps({'packages': rows}, indent=2) + '\n', encoding='utf8', newline='\n')
    (args.output / 'SHA256SUMS').write_text(''.join(f"{r['sha256']}  {r['file']}\n" for r in rows), encoding='utf8', newline='\n')
    print(json.dumps({'built': reports}, ensure_ascii=False))
if __name__ == '__main__': main()
