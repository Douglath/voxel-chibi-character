"""Package two independent stages from canonical skills, without web forks."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
dest = root / 'dist'
dest.mkdir(exist_ok=True)
reports = []
for name in ('chibi-character-sheet', 'voxel-chibi-character'):
    source = root / 'skills' / name
    archive = dest / (name + '.zip')
    files = sorted(p for p in source.rglob('*') if p.is_file()
                   and not any(x in p.relative_to(source).parts for x in ('__pycache__', 'node_modules')))
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            # Fixed metadata keeps identical sources byte-for-byte reproducible.
            info = zipfile.ZipInfo(name + '/' + p.relative_to(source).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, p.read_bytes(), compresslevel=9)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert name + '/SKILL.md' in z.namelist()
        for p in files:
            assert z.read(name + '/' + p.relative_to(source).as_posix()) == p.read_bytes()
    reports.append({'file': archive.name, 'files': len(files), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size})
report = {'packages': reports}
(dest / 'checksums.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
