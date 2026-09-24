"""Populate the fixed offline playground from a source preview HTML or static GLB."""
from pathlib import Path
from html.parser import HTMLParser
import argparse,base64,hashlib,json,re
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.items=[];self.attrs=None;self.body=''
 def handle_starttag(self,tag,attrs):
  if tag=='script':self.attrs=dict(attrs);self.body=''
 def handle_data(self,data):
  if self.attrs is not None:self.body+=data
 def handle_endtag(self,tag):
  if tag=='script' and self.attrs is not None:self.items.append((self.attrs,self.body));self.attrs=None

def build(output,title,source=None,glb=None):
 root=Path(__file__).resolve().parent.parent;assets=root/'assets/playground';template=(assets/'model-playground.html').read_text(encoding='utf-8');palette={};profile=None
 if source:
  parsed=Scripts();parsed.feed(Path(source).read_text(encoding='utf-8-sig'));data=next(json.loads(b) for a,b in parsed.items if a.get('id')=='model-data');encoded=data.get('rigged') or data['static'];imports={}
  for a,b in parsed.items:
   if a.get('type')=='importmap':imports.update(json.loads(b).get('imports',{}))
  def module(name):return next((base64.b64decode(v.split(',',1)[1]).decode() for k,v in imports.items() if k.endswith('/'+name) and v.startswith('data:text/javascript;base64,')),'')
  model=module('model.mjs');match=re.search(r'(?:export\s+)?const\s+palette\s*=\s*\{([^}]+)\}',model)
  if match:palette=dict(re.findall(r'''["']?([A-Za-z]\w*)["']?\s*:\s*["'](#[a-fA-F0-9]{6})["']''',match[1]))
  expr=module('expressions.mjs').split('export function setupExpressionUI')[0];expr=re.sub(r'^\s*import[^\n]*\n','',expr);expr=re.sub(r'/\*[\s\S]*?\*/|//[^\n]*','',expr);expr=re.sub(r'\s+','',expr);profile=json.loads((assets/'profiles.json').read_text()).get(hashlib.sha256(expr.encode()).hexdigest())
 else:encoded=base64.b64encode(Path(glb).read_bytes()).decode()
 physics=None
 if source and module('hair-physics.mjs'):
  hair=module('hair-physics.mjs');physics=hashlib.sha256(hair.encode()).hexdigest()
  # This packager handles the explicitly authored source preview; the browser importer never executes unknown HTML code.
  def clean(code):
   for dependency in re.findall(r"from ['\"]([^'\"]+)['\"]",code):
    if dependency.split('/')[-1] not in ['three.module.js','tail-dynamics.mjs','accessory-dynamics.mjs']:raise ValueError('Unsupported physics dependency: '+dependency)
   return re.sub(r'^\s*import[^;]+;','',code,flags=re.M).replace('export ','')
  tail=module('tail-dynamics.mjs');accessory=module('accessory-dynamics.mjs')
  tail_decl='const TailDynamics=(()=>{'+clean(tail)+';return TailDynamics;})();' if tail else ''
  accessory_decl='const AccessoryDynamics=(()=>{'+clean(accessory)+';return AccessoryDynamics;})();' if accessory else ''
  addition='\nphysicsTypes['+json.dumps(physics)+']=(()=>{'+accessory_decl+tail_decl+clean(hair)+';return {Hair:HairPhysics,accessory:false};})();\n'
  if accessory and 'extends AccessoryDynamics' not in hair:
   addition='\nphysicsTypes['+json.dumps(physics)+']=(()=>{'+accessory_decl+tail_decl+clean(hair)+';class Combined extends HairPhysics{constructor(rig){super(rig);this.extra=new AccessoryDynamics(rig);}update(dt){super.update(dt);this.extra.enabled=this.enabled;this.extra.update(dt);}reset(...args){super.reset(...args);this.extra?.reset();}kick(){super.kick?.();this.extra?.kick?.();}}return {Hair:Combined,accessory:false};})();\n'
  pat=r'(<script type="importmap">)(.*?)(</script>)';matched=re.search(pat,template,re.S);mapping=json.loads(matched[2]);key=next(k for k in mapping['imports'] if k.endswith('/physics-registry.mjs'));body=base64.b64decode(mapping['imports'][key].split(',',1)[1]).decode();mapping['imports'][key]='data:text/javascript;base64,'+base64.b64encode((body+addition).encode()).decode();template=re.sub(pat,lambda m:m[1]+json.dumps(mapping)+m[3],template,flags=re.S)
 record=dict(physics=physics,name=title,source=Path(source or glb).name,glb=encoded,palette=palette,expression=profile)
 payload=dict(version=1,models=[record],settings=dict(scene='studio',random=False),openSingle=True)
 output=Path(output);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(re.sub(r'(<script id="library-data" type="application/json">).*?(</script>)',lambda m:m[1]+json.dumps(payload,ensure_ascii=False).replace('<','\\u003c')+m[2],template,flags=re.S),encoding='utf-8')
 return str(output)
if __name__=='__main__':
 p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group(required=True);g.add_argument('--source-html',type=Path);g.add_argument('--glb',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--title',required=True);a=p.parse_args();print(build(a.output,a.title,a.source_html,a.glb))
