"""Bundle the actual GLBs, Three.js and production motion into one offline HTML."""
from pathlib import Path
import argparse, base64, html as html_tools, json, re, struct

parser = argparse.ArgumentParser()
parser.add_argument('--assets', type=Path, default=Path(__file__).resolve().parents[1] / 'assets')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--title', help='Display label for this actual model or construction example')
args = parser.parse_args()
assets = args.assets.resolve()
base = assets / 'baseline'
modules = {}
imports = re.compile(r'''(?m)^\s*(?:(?:import|export)\s+(?:[^;]*?\s+from\s*)?|import\s*)["']([^"']+)["']''')

def bundle(path, override=None):
    path = path.resolve()
    key = 'packed/' + path.relative_to(assets).as_posix()
    if key in modules:
        return key
    modules[key] = ''
    source = override if override is not None else path.read_text(encoding='utf-8')
    def replace(match):
        spec = match.group(1)
        if spec == 'three':
            target_path = assets / 'three/build/three.module.js'
        elif spec.startswith('three/addons/'):
            target_path = assets / 'three/examples/jsm' / spec.removeprefix('three/addons/')
        elif spec.startswith('.'):
            target_path = path.parent / spec
        else:
            raise ValueError(f'Unbundled module import in {path.name}: {spec}')
        target = bundle(target_path)
        return match.group(0).replace(spec, target)
    source = imports.sub(replace, source)
    modules[key] = 'data:text/javascript;base64,' + base64.b64encode(source.encode()).decode()
    return key

viewer = (base / 'rig-viewer.mjs').read_text(encoding='utf-8')
viewer = viewer.replace("new GLTFLoader().loadAsync('./silver-wolf-rigged.glb')", "readModel('rigged')")
viewer = viewer.replace("new GLTFLoader().loadAsync('./silver-wolf.glb')", "readModel('static')")
viewer = viewer.replace('fetch(', 'saveLocal(')
if '.loadAsync(' in viewer or 'fetch(' in viewer:
    raise ValueError('Viewer still contains an external model/network loading call')
viewer = viewer.replace("document.getElementById('status').textContent=String(e);", "document.getElementById('status').textContent='加载失败：'+String(e);")
prefix = '''
const embedded = JSON.parse(document.getElementById('model-data').textContent);
const evidence = {};
function buffer(key){return Uint8Array.from(atob(embedded[key]), c=>c.charCodeAt(0)).buffer;}
async function readModel(key){return new GLTFLoader().parseAsync(buffer(key),'');}
async function saveLocal(route,options){const data=JSON.parse(options.body);if(route==='/evidence')Object.assign(evidence,data);else evidence.physics=data;return {ok:true};}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.getElementById('downloadGlb').onclick=()=>download(buffer('rigged'),'character-rigged.glb','model/gltf-binary');
document.getElementById('downloadReport').onclick=()=>{const debug=window.characterDebug?.();download(JSON.stringify({report:debug?.report??evidence.report,physics:debug?.hair?.metrics??evidence.physics,accessories:debug?.accessoryDynamics?.metrics,scope:'Current browser evidence; no full mesh collision validation and no baked spring animation'},null,2),'browser-validation.json','application/json');};
window.addEventListener('unhandledrejection',e=>{document.getElementById('status').textContent='加载失败：'+String(e.reason);});
'''
entry = bundle(base / 'rig-viewer.mjs', prefix + viewer)
data, model_documents = {}, {}
for key, filename in [('rigged', 'silver-wolf-rigged.glb'), ('static', 'silver-wolf.glb')]:
    model_bytes = (base / filename).read_bytes()
    if model_bytes[:4] != b'glTF':
        raise ValueError(f'Expected actual GLB output: {filename}')
    document = json.loads(model_bytes[20:20 + struct.unpack_from('<I', model_bytes, 12)[0]])
    for resource in document.get('buffers', []) + document.get('images', []):
        if resource.get('uri') and not resource['uri'].startswith('data:'):
            raise ValueError(f'{filename} references an external resource; embed it in the GLB before offline packaging')
    data[key] = base64.b64encode(model_bytes).decode()
    model_documents[key] = document
model_json = model_documents['rigged']
model_stats = {
    'triangles': sum(model_json['accessors'][primitive['indices']]['count'] // 3 for mesh in model_json['meshes'] for primitive in mesh['primitives']),
    'vertices': sum(model_json['accessors'][primitive['attributes']['POSITION']]['count'] for mesh in model_json['meshes'] for primitive in mesh['primitives']),
    'bones': len(model_json.get('skins', [{}])[0].get('joints', [])),
    'accessoryParts': sum(bool(node.get('extras', {}).get('accessory')) for node in model_json['nodes']),
}
html = (base / 'rig.html').read_text(encoding='utf-8')
html = re.sub(r'<script type="importmap">.*?</script>', '', html, flags=re.S)
html = re.sub(r'<script type="module" src="./rig-viewer.mjs"></script>', '', html)
html = re.sub(r'<a href="./silver-wolf-rigged.glb" download>.*?</a>', '<div><button id="downloadGlb">下载 GLB</button> <button id="downloadReport">下载检查报告</button></div>', html)
html = html.replace('银灰长发 · 狼尾 · 黑色外套 · 精修动态','基准模型示例 · 可离线打开 · 拖动旋转、滚轮缩放')
if args.title:
    label = html_tools.escape(args.title)
    html = re.sub(r'<title>.*?</title>', '<title>' + label + '</title>', html)
    html = re.sub(r'<h1>.*?</h1>', '<h1>' + label + '</h1>', html)
    html = re.sub(r'<small>.*?</small>', '<small>可离线打开 · 拖动旋转、滚轮缩放</small>', html)
html = html.replace('</html>', '')
html += '<style>header{flex-wrap:wrap}#view{height:56vh;min-height:280px}nav{padding:6px 12px}button{touch-action:manipulation}#status{min-height:18px}body{padding-bottom:16px}</style>'
html += '<p style="text-align:center;color:#91adc9;font-size:12px">GLB 包含基础动画；头发、衣物与适用配件的附加动态在此网页中运行。</p>'
html += '<!-- Three.js 0.180.0 license\n' + (assets / 'three/LICENSE').read_text(encoding='utf-8') + '\n-->\n'
html += '<script id="model-data" type="application/json">' + json.dumps(data) + '</script>'
html += '<script type="importmap">' + json.dumps({'imports':modules}) + '</script>'
html += '<script type="module">import ' + json.dumps(entry) + ';</script></html>'
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html, encoding='utf-8')
print(json.dumps({'output':str(args.output),'bytes':args.output.stat().st_size,'embeddedModules':len(modules),'externalDependencies':0,**model_stats}))
