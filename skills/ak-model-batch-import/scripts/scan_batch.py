"""Read-only batch inventory. Does not extract archives, execute models or publish."""
import argparse, base64, hashlib, json, struct, zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath

class Payloads(HTMLParser):
    def __init__(self):
        super().__init__(); self.key=None; self.data={}
    def handle_starttag(self, tag, attrs):
        key=dict(attrs).get('id')
        if tag=='script' and key in ('library-data','model-data'):
            self.key=key; self.data[key]=''
    def handle_data(self, data):
        if self.key:self.data[self.key]+=data
    def handle_endtag(self, tag):
        if tag=='script':self.key=None

def digest(data):return hashlib.sha256(data).hexdigest()
def glb_info(data):
    if len(data)<20 or data[:4]!=b'glTF':raise ValueError('invalid GLB header')
    version,length,size,kind=struct.unpack_from('<IIII',data,4)
    if version!=2 or length!=len(data) or kind!=0x4e4f534a or 20+size>len(data):raise ValueError('invalid GLB lengths/version')
    obj=json.loads(data[20:20+size]);return {'glb_sha256':digest(data),'meshes':len(obj.get('meshes',[])),'skins':len(obj.get('skins',[])),'animations':[a.get('name','') for a in obj.get('animations',[])]}

def inspect(path, limit):
    item={'source':str(path),'bytes':path.stat().st_size,'status':'discovered'}
    if item['bytes']>limit:
        item.update(status='deferred',reason='File exceeds inspection size limit');return item
    data=path.read_bytes();item['source_sha256']=digest(data)
    try:
        if path.suffix.lower()=='.zip':
            with zipfile.ZipFile(path) as z:
                members=z.infolist();item['archive_members']=len(members)
                unsafe=[i.filename for i in members if PurePosixPath(i.filename.replace(chr(92),'/')).is_absolute() or '..' in PurePosixPath(i.filename.replace(chr(92),'/')).parts or ':' in i.filename]
                item['unsafe_members']=unsafe
                item['candidates']=[{'name':i.filename,'bytes':i.file_size} for i in members if Path(i.filename).suffix.lower() in ('.html','.glb','.mjs','.json') and 'node_modules/' not in i.filename.replace(chr(92),'/')]
                if unsafe:item.update(status='blocked',reason='Unsafe archive paths; not extracted')
        elif path.suffix.lower()=='.glb':item['models']=[glb_info(data)]
        else:
            p=Payloads();p.feed(data.decode('utf-8-sig'))
            if 'library-data' in p.data:
                records=json.loads(p.data['library-data']).get('models',[])
            elif 'model-data' in p.data:
                d=json.loads(p.data['model-data']);records=[{'glb':d.get('rigged') or d.get('static')}]
            else:records=[]
            item['models']=[]
            for index,m in enumerate(records):
                raw=base64.b64decode((m.get('glb') or '').split(',')[-1],validate=True)
                item['models'].append({'record_index':index,'name':m.get('name'), 'physics':m.get('physics'),**glb_info(raw)})
            if not records:item.update(status='needs_inspection',reason='No recognized embedded payload; may use external files')
    except (ValueError,KeyError,TypeError,zipfile.BadZipFile,UnicodeError) as e:item.update(status='invalid',reason=str(e))
    return item

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('source',type=Path);ap.add_argument('--output',type=Path,required=True);ap.add_argument('--max-mb',type=int,default=300);args=ap.parse_args()
    source=args.source.resolve()
    if not source.exists():ap.error('source does not exist')
    if args.output.exists():ap.error('output exists; choose a new inventory path')
    paths=[source] if source.is_file() else sorted(p for p in source.rglob('*') if p.is_file() and not p.is_symlink() and p.suffix.lower() in ('.zip','.html','.htm','.glb') and 'node_modules' not in p.parts and p.resolve().is_relative_to(source))
    items=[inspect(p,args.max_mb*1024*1024) for p in paths];groups={}
    for item in items:
        for m in item.get('models',[]):groups.setdefault(m['glb_sha256'],[]).append({'source':item['source'],'record_index':m.get('record_index',0)})
    result={'source_root':str(source),'items':items,'duplicate_glb_groups':{k:v for k,v in groups.items() if len(v)>1},'note':'Read-only inventory, not identity matching, visual approval or import completion.'}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'files':len(items),'duplicate_groups':len(result['duplicate_glb_groups']),'output':str(args.output)}))
if __name__=='__main__':main()
