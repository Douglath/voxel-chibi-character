"""Package the canonical skill folder, without a second web skill or plugin."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'skills/voxel-chibi-character'
dest = root / 'dist'
dest.mkdir(exist_ok=True)
archive = dest / 'voxel-chibi-character.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(source.rglob('*')):
        if p.is_file() and not any(x in p.parts for x in ('__pycache__', 'node_modules')):
            z.write(p, 'voxel-chibi-character/' + p.relative_to(source).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'voxel-chibi-character/SKILL.md' in z.namelist()
    count = len(z.namelist())
report = {'file': archive.name, 'files': count, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size}
(dest / 'checksums.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
