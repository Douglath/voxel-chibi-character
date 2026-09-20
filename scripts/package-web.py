from pathlib import Path
import hashlib, json, shutil, subprocess, sys, tempfile, zipfile

root = Path(__file__).resolve().parents[1]
plugin = root / 'web/voxel-character-web'
skill = plugin / 'skills/voxel-character-web'
dist = root / 'web/dist'
if not shutil.which('node'):
    raise SystemExit('Node.js is required to rebuild and validate both portable model outputs before packaging.')

# Rebuild both variants with only bundled dependencies before publishing any dist files.
with tempfile.TemporaryDirectory(prefix='voxel-web-package-') as temporary:
    staging = Path(temporary)
    products = []
    for example, stem, title in [(None, 'character', '银灰狼耳少女 · 母版'), ('technical-kit', 'technical-kit', '配件组合范例 · technical-kit')]:
        project = staging / stem
        command = [sys.executable, str(skill/'scripts/create_project.py'), str(project)]
        if example:
            command += ['--accessory-example', example]
        subprocess.run(command, check=True, capture_output=True, text=True)
        for script in ['export.mjs', 'rig-export.mjs']:
            subprocess.run(['node', str(project/'assets/baseline'/script)], check=True, capture_output=True, text=True)
        preview = staging / f'{stem}-preview.html'
        result = subprocess.run([sys.executable, str(skill/'scripts/build_html.py'), '--assets', str(project/'assets'), '--output', str(preview), '--title', title], check=True, capture_output=True, text=True)
        print(result.stdout.strip())
        products += [(preview, f'{stem}-preview.html'), (project/'assets/baseline/silver-wolf-rigged.glb', f'{stem}-rigged.glb')]
    # The source skill's included preview always corresponds to its bare style baseline.
    shutil.copy2(staging/'character-preview.html', skill/'assets/preview.html')
    dist.mkdir(exist_ok=True)
    for source, name in products:
        shutil.copy2(source, dist/name)
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
