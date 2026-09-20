from pathlib import Path
import argparse, shutil
p=argparse.ArgumentParser();p.add_argument('target',type=Path);a=p.parse_args()
src=Path(__file__).resolve().parents[1];out=a.target.resolve()
if out.exists():raise SystemExit('Target exists; choose a new directory.')
out.mkdir(parents=True)
shutil.copytree(src/'assets',out/'assets',ignore=shutil.ignore_patterns('preview.html'))
shutil.copytree(src/'scripts',out/'scripts')
(out/'package.json').write_text('{"private":true,"type":"module"}\n')
print('Copied baseline only; customize geometry before presenting a new character:',out)
