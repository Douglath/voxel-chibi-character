import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {technicalKit,wristKit} from '../skills/voxel-chibi-character/assets/accessory-examples/technical-kit.mjs';
import {AccessoryDynamics} from '../skills/voxel-chibi-character/assets/accessory-kit/accessory-dynamics.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const work=path.join(root,'.smoke','accessories',String(Date.now()));
const run=(file,args=[])=>execFileSync(process.execPath,[file,...args],{encoding:'utf8',stdio:'pipe'});
const scaffold=path.join(root,'skills/voxel-chibi-character/scripts/scaffold.mjs');
const load=async file=>{const b=fs.readFileSync(file);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const bone=(rig,name)=>rig.getObjectByName(name)||rig.getObjectByName(name.replaceAll('.',''));
const vertices=mesh=>{mesh.updateWorldMatrix(true,false);mesh.skeleton.update();return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));};
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(work,{recursive:true});
const results=[];
for(const [name,spec,port] of [['technical-kit',technicalKit(),4237],['wrist-kit',wristKit(),4238]]) {
  const project=path.join(work,name);
  run(scaffold,[project,name,name==='technical-kit'?'配件组合测试':'腕部设备测试',String(port)]);
  // The unified scaffold supplies its own offline dependencies.
  assert(fs.existsSync(path.join(project,'node_modules/three/build/three.module.js')));
  const specFile=path.join(project,'character-spec.json');
  const characterSpec=JSON.parse(fs.readFileSync(specFile));
  characterSpec.accessories=spec;
  characterSpec.limitations.push('Synthetic accessory construction test on unchanged baseline, not a generated new character.');
  fs.writeFileSync(specFile,JSON.stringify(characterSpec,null,2));
  run(path.join(project,'character/export.mjs'));
  run(path.join(project,'character/rig-export.mjs'));
  const file=path.join(project,`character/${name}-rigged.glb`);
  const {scene:rig,animations}=await load(file);
  const baseline=await load(path.join(root,'skills/voxel-chibi-character/assets/silver-wolf-refined-dynamics/silver-wolf-rigged.glb'));
  // Original hair, clothing and body geometry, palette, normals and skin weights are unchanged.
  let preservedMeshes=0;
  baseline.scene.traverse(m=>{if(!m.isMesh)return;const other=rig.getObjectByName(m.name);assert(other,`Missing baseline mesh ${m.name}`);for(const attribute of ['position','normal','color','skinIndex','skinWeight'])assert.deepEqual(Array.from(other.geometry.attributes[attribute].array),Array.from(m.geometry.attributes[attribute].array),`Changed baseline ${m.name}/${attribute}`);assert.deepEqual(Array.from(other.geometry.index.array),Array.from(m.geometry.index.array));preservedMeshes++;});
  const meshes=spec.parts.map(p=>{const m=rig.getObjectByName(`Acc_${p.id}`);assert(m?.isSkinnedMesh,`Missing exported skinned accessory ${p.id}`);assert(m.userData.accessory,`Missing exported part metadata ${p.id}`);assert(m.geometry.index.count>0);return m;});
  const skeleton=meshes[0].skeleton;
  assert.equal(skeleton.bones.length,43+spec.bones.length);
  for(const m of meshes){for(const a of Object.values(m.geometry.attributes))assert(Array.from(a.array).every(Number.isFinite));const w=m.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);}
  const fpsResults=[];
  for(const fps of [30,60,144]) {
    const {scene:testRig}=await load(file);
    const dynamics=new AccessoryDynamics(testRig);
    const rigidParts=spec.parts.filter(p=>p.shapeMode==='rigid');
    const rigidFixtures=rigidParts.map(p=>{const m=testRig.getObjectByName(`Acc_${p.id}`),b=bone(testRig,p.binding.bone);assert(b);testRig.updateMatrixWorld(true);const inv=b.matrixWorld.clone().invert();return {m,b,rest:vertices(m).map(v=>v.applyMatrix4(inv))};});
    let rigidityError=0,response=0,endpointError=0;
    const pathMesh=testRig.getObjectByName('Acc_sling');
    let endpoints=[];
    if(pathMesh){testRig.updateMatrixWorld(true);const t=pathMesh.geometry.attributes._path_t;assert(t,'Path coordinate was lost in GLB');for(const [value,bn] of [[0,'chest'],[1,'hips']]){const b=bone(testRig,bn),inv=b.matrixWorld.clone().invert();vertices(pathMesh).forEach((v,i)=>{if(Math.abs(t.getX(i)-value)<1e-6)endpoints.push({i,b,rest:v.clone().applyMatrix4(inv)});});}assert(endpoints.length>=8);}
    for(let frame=0;frame<fps*5;frame++) {
      const t=frame/fps,active=t<2;
      testRig.rotation.y=active?.35*Math.sin(t*3):0;
      testRig.position.x=active?.10*Math.sin(t*4):0;
      bone(testRig,'chest').rotation.x=active?.07*Math.sin(t*2):0;
      bone(testRig,'thigh.L').rotation.x=active?.20*Math.sin(t*3):0;
      bone(testRig,'forearm.L').rotation.y=active?.35*Math.sin(t*2):0;
      if(frame===fps)dynamics.kick();
      dynamics.update(1/fps);testRig.updateMatrixWorld(true);
      for(const d of spec.dynamics){const b=bone(testRig,d.bone);const a=b.quaternion.angleTo(new T.Quaternion());response=Math.max(response,a);assert(Number.isFinite(a));assert(a<=d.maxAngle+1e-5,'Exceeded configured angular limit');}
      // Full vertex measurements at representative frames, not just bone tips.
      if(frame%Math.max(1,Math.floor(fps/12))===0){
        for(const f of rigidFixtures){const inv=f.b.matrixWorld.clone().invert();vertices(f.m).forEach((v,i)=>rigidityError=Math.max(rigidityError,v.applyMatrix4(inv).distanceTo(f.rest[i])));}
        if(pathMesh){const p=vertices(pathMesh);for(const e of endpoints)endpointError=Math.max(endpointError,p[e.i].clone().applyMatrix4(e.b.matrixWorld.clone().invert()).distanceTo(e.rest));}
      }
    }
    assert(rigidityError<2e-6,`Rigid accessory deformed: ${rigidityError}`);
    assert(endpointError<2e-6,`Two-end strap detached: ${endpointError}`);
    const settled=Math.max(0,...spec.dynamics.map(d=>bone(testRig,d.bone).quaternion.angleTo(new T.Quaternion())));
    if(spec.dynamics.length){assert(response>.001,'No actual accessory response');assert(settled<.01,'Accessory failed to settle');}
    dynamics.enabled=false;dynamics.update(1/fps);dynamics.reset();
    for(const d of spec.dynamics)assert(bone(testRig,d.bone).quaternion.angleTo(new T.Quaternion())<1e-6);
    dynamics.enabled=true;dynamics.kick();dynamics.update(1/fps);dynamics.update(3);
    for(const d of spec.dynamics)assert(bone(testRig,d.bone).quaternion.angleTo(new T.Quaternion())<1e-6,'Long pause did not reset');
    testRig.position.set(100,0,0);dynamics.update(1/fps);
    for(const d of spec.dynamics)assert(Number.isFinite(bone(testRig,d.bone).quaternion.x));
    fpsResults.push({fps,rigidityError,endpointError,response,settled,pass:true});
  }
  // Reproduce the production running demo's yaw and vertical bob, with no kick.
  const {scene:runRig}=await load(file),runDynamics=new AccessoryDynamics(runRig);
  let runResponse=0;
  for(let frame=0;frame<360;frame++){const t=frame/120;runRig.rotation.y=.20*Math.sin(t*5);runRig.position.y=.055*(1-Math.cos(t*20));runDynamics.update(1/120);for(const d of spec.dynamics)runResponse=Math.max(runResponse,bone(runRig,d.bone).quaternion.angleTo(new T.Quaternion()));}
  if(spec.dynamics.length)assert(runResponse>.001,'Off-center accessories did not respond to actual running motion');
  const stats=JSON.parse(fs.readFileSync(path.join(project,'character/stats.json')));
  let actualTriangles=0;rig.traverse(m=>{if(m.isMesh)actualTriangles+=m.geometry.index.count/3;});
  assert.equal(stats.triangles,actualTriangles,'Stats must include actual accessory geometry');
  results.push({name,project,preview:`http://localhost:${port}/character/rig.html`,glb:file,sha256:hash(file),parts:spec.parts.length,bones:skeleton.bones.length,triangles:stats.triangles,preservedMeshes,clips:animations.map(a=>a.name),fpsResults,runResponse,pass:true});
}
const invalidProject=path.join(work,'invalid-anchor');
run(scaffold,[invalidProject,'invalid-anchor','无效挂点拒绝测试','4239']);
const invalidSpecFile=path.join(invalidProject,'character-spec.json'),invalid=JSON.parse(fs.readFileSync(invalidSpecFile));
invalid.accessories=technicalKit();invalid.accessories.anchors.badge_seam.bone='missing_anchor_bone';
fs.writeFileSync(invalidSpecFile,JSON.stringify(invalid));run(path.join(invalidProject,'character/export.mjs'));
assert.throws(()=>run(path.join(invalidProject,'character/rig-export.mjs')),error=>String(error.stderr).includes('missing_anchor_bone'),'Unknown anchor bone must fail actual rig export');
const report={pass:true,createdAt:new Date().toISOString(),results,invalidAnchorRejected:true,browser:'unverified',scope:'Actual exported GLBs; unchanged baseline meshes and colors; accessory presence, metadata and normalized skin; full rigid vertices and two-end path attachment under torso/thigh/forearm movement; bounded secondary response and settling at 30/60/144 FPS; production run yaw/bob without kick. Browser appearance, seam contact and collision require separate review; no full cloth or self collision.'};
fs.writeFileSync(path.join(root,'accessory-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
