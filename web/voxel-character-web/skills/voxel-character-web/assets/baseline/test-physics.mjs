import fs from 'node:fs';
import {GLTFLoader} from '../three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from '../three/build/three.module.js';
import {HairPhysics} from './hair-physics.mjs';
const b=fs.readFileSync(new URL('silver-wolf-rigged.glb',import.meta.url));
const results=[];
for(const fps of [30,60,144]){
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const hair=new HairPhysics(gltf.scene);let maxAngle=0;
 for(let i=0;i<fps*16;i++){const t=i/fps;hair.head.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),t<8?.32*Math.sin(t*1.5):0);if(i===fps*3)hair.kick();hair.update(1/fps);for(const c of hair.chains)for(const bone of c.bones)maxAngle=Math.max(maxAngle,bone.quaternion.angleTo(new THREE.Quaternion()));}
 const settled=Math.max(...hair.chains.flatMap(c=>c.bones.map(b=>b.quaternion.angleTo(new THREE.Quaternion()))));
 hair.enabled=false;hair.update(1/fps);const disabledIdentity=hair.chains.every(c=>c.bones.every(b=>b.quaternion.angleTo(new THREE.Quaternion())<1e-7));
 const result={fps,...hair.metrics,maxAngleRadians:maxAngle,settledAngleRadians:settled,disabledIdentity};
 result.pass=hair.metrics.finite&&hair.metrics.maxLag>.01&&hair.metrics.maxLag<.8&&hair.metrics.maxLengthError<.005&&hair.metrics.minProxyClearance>=-1e-5&&settled<.01&&disabledIdentity;
 results.push(result);
}
// Deliberately start a simulated tip inside the torso; check that the collision constraint resolves it.
const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const forced=new HairPhysics(gltf.scene);forced.chains[0].p[1].set(.01,1.6,-.05);forced.update(1/60);
const collisionRecovered=forced.clearance(forced.chains[0].p[1]).d>=-1e-5;
const report={results,collisionRecovered,pass:results.every(r=>r.pass)&&collisionRecovered,scope:'30/60/144 FPS turn, impulse, settle, off/reset; endpoint collision only'};
fs.writeFileSync(new URL('physics-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
