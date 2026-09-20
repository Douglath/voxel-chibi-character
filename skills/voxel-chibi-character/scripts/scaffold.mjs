import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installAccessorySupport} from './accessory-scaffold.mjs';
const [target,id,label,port='4192']=process.argv.slice(2),template='silver-wolf';
if(!target||!id||!label||!/^[a-z][a-z0-9-]*$/.test(id)||!/^\d+$/.test(port)||+port<1024||+port>65535)throw Error('Usage: scaffold.mjs <new-project> <slug> <display-name> [port 1024..65535]');
const out=path.resolve(target);if(fs.existsSync(out))throw Error('Target already exists; choose a new directory');
const src=fileURLToPath(new URL('../assets/silver-wolf-refined-dynamics/',import.meta.url));
fs.mkdirSync(path.join(out,'character'),{recursive:true});
const cap=s=>s[0].toUpperCase()+s.slice(1),escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.mjs')||f.endsWith('.html'))){
 let t=fs.readFileSync(path.join(src,f),'utf8');
 // Preserve the Silver Wolf style parameters; rename output routes and asset filenames.
 t=t.replaceAll('create'+cap(template),'createCharacter').replaceAll(template+'-rigged.glb',id+'-rigged.glb').replaceAll(template+'-editable.three.json',id+'-editable.three.json').replaceAll(template+'.glb',id+'.glb');
 if(f==='server.mjs')t=t.replaceAll('4207',port);
 if(f.endsWith('.html'))t=t.replaceAll('银灰狼耳少女',escape(label)).replace(/<small>.*?<\/small>/,'<small>体素角色 · T-pose · 基础动画</small>');
 if(f==='model.mjs')t=t.replace(/reference:"[^"]*"/,'reference:'+JSON.stringify('New character '+id+'; reference review required')).replaceAll('SilverWolf_Voxel_Static',id+'_Voxel_Static');
 fs.writeFileSync(path.join(out,'character',f),t);
}
fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({name:id+'-voxel',private:true,type:'module',scripts:{build:'node character/export.mjs && node character/rig-export.mjs', 'test:expressions':'node character/test-expressions.mjs',start:'node character/server.mjs'},dependencies:{three:'0.180.0'}},null,2));
installAccessorySupport(out);
fs.writeFileSync(path.join(out,'character-spec.json'),JSON.stringify({id,label,styleBaseline:'silver-wolf-refined-dynamics',template,reference:null,identityFeatures:[],expressions:{template:'v5-eight-neutral-blink',default:'Normal',autoBlink:true,paletteSource:'character/model.mjs palette.iris',runtime:'character/expressions.mjs',bakedInGlb:false},accessories:{version:1,palette:{},anchors:{},bones:[],dynamics:[],parts:[]},sleeveDesign:'review-reference',dynamics:{requiredByDefault:true,optOut:'Only explicit user request for static/no animation',selected:[],omitted:[],targetCategories:[2,3],targetAddedBones:[4,8],requiredDelivery:['Basic animation','Character-appropriate secondary motion','Working runtime preview','Motion and settling validation'],status:'Full 43-bone reference copied; choose appropriate parts and adapt bindings/runtime/tests. Empty selection is unfinished, not permission to omit secondary motion.'},limitations:['Template copied; character geometry not yet customized','Runtime secondary motion is not baked into GLB']},null,2));
console.log(JSON.stringify({project:out,preview:'http://localhost:'+port+'/character/rig.html',next:'Customize geometry and bindings, npm install, npm run build, npm start'}));
