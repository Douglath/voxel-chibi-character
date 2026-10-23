// Compare loaded GLBs by semantic mesh name; no geometry or approvals are modified.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {GLTFLoader} from '../assets/dependencies/three/examples/jsm/loaders/GLTFLoader.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function snapshot(scene,animations=[]) {
 scene.updateMatrixWorld(true);
 const parts={};
 scene.traverse(m=>{
  if(!m.isMesh)return;
  if(!m.name)throw Error('Unnamed mesh: assign a stable semantic name before comparing');
  const geometry=m.geometry;
  const attr=a=>({itemSize:a.itemSize,normalized:a.normalized,values:Array.from({length:a.count*a.itemSize},(_,i)=>a.isInterleavedBufferAttribute?a.data.array[Math.floor(i/a.itemSize)*a.data.stride+a.offset+i%a.itemSize]:a.array[i])});
  const attributes=Object.fromEntries(Object.entries(geometry.attributes).sort().map(([k,a])=>[k,attr(a)]));
  const materials=(Array.isArray(m.material)?m.material:[m.material]).map(a=>({type:a.type,color:a.color?.toArray(),opacity:a.opacity,transparent:a.transparent,alphaTest:a.alphaTest,side:a.side,metalness:a.metalness,roughness:a.roughness,emissive:a.emissive?.toArray(),vertexColors:a.vertexColors}));
  if((Array.isArray(m.material)?m.material:[m.material]).some(a=>Object.values(a).some(v=>v?.isTexture)))throw Error('Textured material: use a texture-aware comparison; this helper is for vertex-colour models');
  if(Object.keys(geometry.morphAttributes).length)throw Error('Morph targets require a morph-aware comparison');
  const record={geometry:hash({attributes,index:geometry.index?attr(geometry.index):null,groups:geometry.groups}),transform:hash({matrix:m.matrixWorld.toArray(),visible:m.visible}),material:hash(materials),binding:hash(m.isSkinnedMesh?{bind:m.bindMatrix.toArray(),inverse:m.bindMatrixInverse.toArray(),bones:m.skeleton.bones.map((b,i)=>({name:b.name,parent:b.parent?.name,local:b.matrix.toArray(),inverse:m.skeleton.boneInverses[i].toArray()}))}:null)};
  (parts[m.name]??=[]).push(record);
 });
 // Retain duplicate-name meshes as a multiset rather than silently losing one.
 for(const values of Object.values(parts))values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return {parts,animations:hash(animations.map(c=>{const {uuid,...data}=c.toJSON();return data;}))};
}
export async function loadSnapshot(file) {
 const b=fs.readFileSync(file),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 return snapshot(g.scene,g.animations);
}
export function compare(before,after,allow=[]) {
 const changed=[],unchanged=[];
 for(const name of [...new Set([...Object.keys(before.parts),...Object.keys(after.parts)])].sort()) {
  if(hash(before.parts[name]??null)===hash(after.parts[name]??null))unchanged.push(name);
  else changed.push({name,kind:!before.parts[name]?'added':!after.parts[name]?'removed':'modified'});
 }
 const unexpected=changed.filter(c=>!allow.includes(c.name));
 const animationChanged=before.animations!==after.animations;
 return {pass:!unexpected.length&&!animationChanged,changed,unchanged,unexpected,animationChanged,scope:'Whole named meshes, material parameters, node transforms, skin binding and baked clips. Not visual/collision/physics validation; allowed meshes still need region-level review.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [before,after,...names]=process.argv.slice(2);
 if(!before||!after)throw Error('Usage: node compare_model_parts.mjs <before.glb> <after.glb> [allowed-mesh-name ...]');
 const report=compare(await loadSnapshot(before),await loadSnapshot(after),names);
 console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
}
