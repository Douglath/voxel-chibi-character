from pathlib import Path
import hashlib, json, shutil, subprocess, sys, zipfile

root = Path(__file__).resolve().parents[1]
plugin = root / 'web/voxel-character-web'
skill = plugin / 'skills/voxel-character-web'
dist = root / 'web/dist'
dist.mkdir(exist_ok=True)
subprocess.run([sys.executable, str(skill/'scripts/build_html.py'), '--output', str(skill/'assets/preview.html')], check=True)
shutil.copy2(skill/'assets/preview.html', dist/'character-preview.html')
shutil.copy2(skill/'assets/baseline/silver-wolf-rigged.glb', dist/'character-rigged.glb')
shutil.copy2(plugin/'README.md', dist/'使用说明.md')
for source, name, prefix in [(plugin,'voxel-character-web-plugin.zip',''),(skill,'voxel-character-web-skill.zip','voxel-character-web/')]:
    with zipfile.ZipFile(dist/name,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(source.rglob('*')):
            if p.is_file():
                rel=p.relative_to(source)
                if '__pycache__' in rel.parts or 'node_modules' in rel.parts:continue
                z.write(p,prefix+rel.as_posix())
    with zipfile.ZipFile(dist/name) as z:
        assert z.testzip() is None
        assert all(not n.startswith('/') and '..' not in Path(n).parts for n in z.namelist())
manifest={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(dist.iterdir()) if p.is_file() and p.name!='checksums.json'}
(dist/'checksums.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))
