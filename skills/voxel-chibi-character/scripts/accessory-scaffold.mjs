import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Extend generated projects without changing the approved baseline assets.
export function installAccessorySupport(project) {
  const character = path.join(project, 'character');
  const source = fileURLToPath(new URL('../assets/accessory-kit/', import.meta.url));
  const target = path.join(character, 'accessories');
  fs.mkdirSync(target, {recursive: true});
  for (const file of fs.readdirSync(source).filter(f => f.endsWith('.mjs') && !f.startsWith('test-'))) {
    fs.copyFileSync(path.join(source, file), path.join(target, file));
  }
  const patch = (file, edits) => {
    const dest = path.join(character, file);
    let text = fs.readFileSync(dest, 'utf8');
    for (const [before, after] of edits) {
      if (text.split(before).length !== 2) throw Error(`Accessory integration point changed: ${file}: ${before.slice(0, 70)}`);
      text = text.replace(before, after);
    }
    fs.writeFileSync(dest, text);
  };
  patch('export.mjs', [
    ["import fs from 'node:fs';", "import fs from 'node:fs';\nimport {applyAccessories} from './accessories/accessory-kit.mjs';\nimport {applyTonalColors} from './tonal-colors.mjs';"],
    ['const root=createCharacter(),json=', "const root=createCharacter();\nconst spec=JSON.parse(fs.readFileSync(new URL('../character-spec.json',import.meta.url),'utf8'));\napplyAccessories(root,spec.accessories);\napplyTonalColors(root);\nconst json="],
    ['const indices=add(new Uint32Array(g.index.array)', "if(g.attributes.pathT)attributes._PATH_T=add(g.attributes.pathT.array,'SCALAR',34962);const indices=add(new Uint32Array(g.index.array)"],
    ['json.nodes.push({name:m.name,mesh:json.meshes.length});', 'json.nodes.push({name:m.name,mesh:json.meshes.length,...(m.userData.accessory?{extras:m.userData}:{})});']
  ]);
  patch('rig-export.mjs', [
    ["import fs from 'node:fs';", "import fs from 'node:fs';\nimport {addAccessoryBones,accessoryWeights} from './accessories/accessory-kit.mjs';"],
    ['const id=name=>', 'addAccessoryBones(j.nodes[0].extras.accessoryRig,bone,bones);\nconst id=name=>'],
    ['const clamp=v=>', 'for(const anchor of Object.values(j.nodes[0].extras.accessories?.anchors??{}))id(anchor.bone);\nconst clamp=v=>'],
    ["if(name==='ChestRibbon'){", "if(node.extras?.accessory){const ta=p.attributes._PATH_T===undefined?null:j.accessors[p.attributes._PATH_T],tv=ta?j.bufferViews[ta.bufferView]:null;const t=ta?bin.readFloatLE((tv.byteOffset??0)+(ta.byteOffset??0)+k*4):0;w=accessoryWeights(node.extras.accessory.binding,t,id);}\n   else if(name==='ChestRibbon'){"]
  ]);
  patch('rig-viewer.mjs', [
    ["import {HairPhysics} from './hair-physics.mjs';", "import {HairPhysics} from './hair-physics.mjs';\nimport {AccessoryDynamics} from './accessories/accessory-dynamics.mjs';\nlet accessoryDynamics;"],
    ['hair=new HairPhysics(rig);scene.add(hair.helpers);', `hair=new HairPhysics(rig);scene.add(hair.helpers);
 accessoryDynamics=new AccessoryDynamics(rig);
 const baseHairUpdate=hair.update.bind(hair),baseHairReset=hair.reset.bind(hair),baseHairKick=hair.kick.bind(hair);
 hair.update=dt=>{baseHairUpdate(dt);accessoryDynamics.enabled=hair.enabled;accessoryDynamics.update(dt);};
 hair.reset=(...args)=>{baseHairReset(...args);accessoryDynamics.reset();};
 hair.kick=(...args)=>{baseHairKick(...args);accessoryDynamics.kick();};`],
    ['window.characterDebug=()=>({rig,hair,motion,drop,renderer,report,paused,loops});', 'window.characterDebug=()=>({rig,hair,accessoryDynamics,motion,drop,renderer,report,paused,loops});']
  ]);
  const viewer = path.join(character, 'rig-viewer.mjs');
  let text = fs.readFileSync(viewer, 'utf8');
  text = text.replaceAll('43 根骨骼', '${meshes[0].skeleton.bones.length} 根骨骼');
  text = text.replace('p.length-1,0)+3,webglError', 'p.length-1,0)+3+(accessoryDynamics?.states.length??0),webglError');
  // One legacy status is a single-quoted string; interpolate the measured count.
  text = text.replace("?'通过 · ${meshes[0].skeleton.bones.length} 根骨骼 · 待机 / 关节测试 · T-pose 绑定姿势'", '?`通过 · ${meshes[0].skeleton.bones.length} 根骨骼 · 待机 / 关节测试 · T-pose 绑定姿势`');
  fs.writeFileSync(viewer, text);
}
