import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installAccessorySupport} from './accessory-scaffold.mjs';
const [target,id,label,port='4192',mode,...extra]=process.argv.slice(2),template='silver-wolf',preview=mode==='--preview';
if(!target||!id||!label||!/^[a-z][a-z0-9-]*$/.test(id)||!/^\d+$/.test(port)||+port<1024||+port>65535||(mode!==undefined&&!preview)||extra.length)throw Error('Usage: scaffold.mjs <new-project> <slug> <display-name> [port 1024..65535] [--preview]');
const out=path.resolve(target);if(fs.existsSync(out))throw Error('Target already exists; choose a new directory');
const src=fileURLToPath(new URL('../assets/silver-wolf-refined-dynamics/',import.meta.url));
fs.mkdirSync(path.join(out,'character'),{recursive:true});
const cap=s=>s[0].toUpperCase()+s.slice(1),escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.mjs')||f.endsWith('.html'))){
 let t=fs.readFileSync(path.join(src,f),'utf8');
 // Preserve the Silver Wolf style parameters; rename output routes and asset filenames.
 t=t.replaceAll('create'+cap(template),'createCharacter').replaceAll(template+'-rigged.glb',id+'-rigged.glb').replaceAll(template+'-editable.three.json',id+'-editable.three.json').replaceAll(template+'.glb',id+'.glb');
 if(f==='server.mjs'){t=t.replaceAll('4207',port);if(preview)t=t.replace("Location:'/character/rig.html'","Location:'/character/index.html'");}
 if(f.endsWith('.html'))t=t.replaceAll('银灰狼耳少女',escape(label)).replace(/<small>.*?<\/small>/,preview?'<small>静态外形预览 · 未验收</small>':'<small>体素角色 · T-pose · 基础动画</small>');
 if(f==='model.mjs')t=t.replace(/reference:"[^"]*"/,'reference:'+JSON.stringify('New character '+id+'; reference review required')).replaceAll('SilverWolf_Voxel_Static',id+'_Voxel_Static');
 fs.writeFileSync(path.join(out,'character',f),t);
}
fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({name:id+'-voxel',private:true,type:'module',scripts:{build:preview?'node character/export.mjs':'node character/export.mjs && node character/rig-export.mjs', 'test:expressions':'node character/test-expressions.mjs',start:'node character/server.mjs'},dependencies:{three:'0.180.0'}},null,2));
installAccessorySupport(out);
// A single source template works locally or in a downloaded Drive skill folder.
// Bundle only the Three.js modules used by this workflow; no network install needed.
fs.cpSync(fileURLToPath(new URL('../assets/dependencies/three/',import.meta.url)),path.join(out,'node_modules/three'),{recursive:true});
fs.mkdirSync(path.join(out,'scripts'),{recursive:true});
fs.copyFileSync(fileURLToPath(new URL('./build_html.py',import.meta.url)),path.join(out,'scripts/build_html.py'));
fs.writeFileSync(path.join(out,'character-spec.json'),JSON.stringify({id,label,styleBaseline:'silver-wolf-refined-dynamics',template,reference:null,identityFeatures:[],delivery:{mode:preview?'preview':'final',status:preview?'appearance-preview':'pending'},expressions:{template:'v5-eight-neutral-blink',default:'Normal',autoBlink:!preview,...(preview?{status:'Deferred for this appearance preview; adapt expressions and enable blinking when continuing final delivery.'}:{}),paletteSource:'character/model.mjs palette.iris',runtime:'character/expressions.mjs',bakedInGlb:false},accessories:{version:1,palette:{},anchors:{},bones:[],dynamics:[],parts:[]},sleeveDesign:'review-reference',dynamics:{requiredByDefault:!preview,optOut:'Only explicit user request for static/no animation',selected:[],omitted:[],targetCategories:[2,3],targetAddedBones:[4,8],requiredDelivery:preview?[]:['Basic animation','Character-appropriate secondary motion','Working runtime preview','Motion and settling validation'],status:preview?'Deferred only for this appearance preview, not a permanent static preference. Restore the normal requested dynamics and validation when continuing final delivery.':'Full 43-bone reference copied; choose appropriate parts and adapt bindings/runtime/tests. Empty selection is unfinished, not permission to omit secondary motion.'},limitations:['Template copied; character geometry not yet customized',...(preview?['Appearance preview only; rigging, expressions, dynamics and final acceptance are deferred.']:[]),'Runtime secondary motion is not baked into GLB']},null,2));
console.log(JSON.stringify({project:out,preview:'http://localhost:'+port+'/character/'+(preview?'index.html':'rig.html'),next:preview?'Customize model geometry, npm run build for the static GLB, npm start and inspect front/side/back model views. This is an unaccepted appearance preview; continuing final delivery requires restoring the normal build and adapting rigging, expressions, dynamics and validation.':'Customize geometry and bindings, npm run build, npm start; optional: python scripts/build_html.py --project . --output character.html'}));
