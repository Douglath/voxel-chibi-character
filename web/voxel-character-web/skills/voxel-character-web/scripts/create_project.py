"""Copy the portable editable model; examples are explicit opt-ins, not character defaults."""
from pathlib import Path
import argparse, json, shutil, subprocess

p = argparse.ArgumentParser()
p.add_argument('target', type=Path)
p.add_argument('--accessory-example', choices=['technical-kit', 'wrist-kit'])
a = p.parse_args()
src = Path(__file__).resolve().parents[1]
out = a.target.resolve()
if out.exists():
    raise SystemExit('Target exists; choose a new directory.')
if a.accessory_example and not shutil.which('node'):
    raise SystemExit('The optional construction example requires Node.js to evaluate its spec; no npm install is needed.')

accessories = {'version': 1, 'palette': {}, 'anchors': {}, 'bones': [], 'dynamics': [], 'parts': []}
if a.accessory_example:
    example = src / 'assets/accessory-examples/technical-kit.mjs'
    function_name = {'technical-kit': 'technicalKit', 'wrist-kit': 'wristKit'}[a.accessory_example]
    code = "import {pathToFileURL} from 'node:url'; const example=await import(pathToFileURL(process.argv[1])); console.log(JSON.stringify(example[process.argv[2]]()));"
    result = subprocess.run(['node', '--input-type=module', '--eval', code, str(example), function_name], check=True, text=True, capture_output=True)
    accessories = json.loads(result.stdout)

out.mkdir(parents=True)
shutil.copytree(src / 'assets', out / 'assets', ignore=shutil.ignore_patterns('preview.html', '__pycache__'))
shutil.copytree(src / 'scripts', out / 'scripts', ignore=shutil.ignore_patterns('__pycache__'))
(out / 'package.json').write_text(json.dumps({'private': True, 'type': 'module', 'scripts': {'build': 'node assets/baseline/export.mjs && node assets/baseline/rig-export.mjs'}}, indent=2) + '\n', encoding='utf-8')
(out / 'character-spec.json').write_text(json.dumps({'id': a.accessory_example or 'character', 'label': a.accessory_example or 'New character', 'styleBaseline': 'silver-wolf-refined-dynamics', 'reference': None, 'identityFeatures': [], 'accessories': accessories, 'example': a.accessory_example, 'limitations': ['Copied style baseline or optional construction example; not a reconstruction of a new reference', 'Runtime secondary motion is not baked into GLB']}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'project': str(out), 'example': a.accessory_example, 'accessoryParts': len(accessories['parts']), 'next': 'Customize geometry and character-spec.json, then build both GLBs and offline HTML. No npm install required.'}, ensure_ascii=False))
