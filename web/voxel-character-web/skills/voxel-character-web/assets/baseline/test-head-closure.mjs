import fs from 'node:fs';
import * as THREE from '../three/build/three.module.js';
import {GLTFLoader} from '../three/examples/jsm/loaders/GLTFLoader.js';
const b=fs.readFileSync(new URL('silver-wolf-rigged.glb',import.meta.url));
const {scene:rig}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
rig.updateMatrixWorld(true);const head=rig.getObjectByName('head'),mesh=rig.getObjectByName('Head'),inverse=head.matrixWorld.clone().invert();
const misses=[];let samples=0;
for(const [pitch,yaw]of [[0,0],[0,45],[0,-45],[25,35],[-25,-35]]){
 head.rotation.set(pitch*Math.PI/180,yaw*Math.PI/180,0);rig.updateMatrixWorld(true);mesh.skeleton.update();
 const transform=head.matrixWorld.clone().multiply(inverse);
 for(let x=-4;x<=4;x++)for(let z=-3;z<=3;z++){
  const target=new THREE.Vector3(x*.085,28*.085,z*.085).applyMatrix4(transform);
  const origin=new THREE.Vector3(x*.085,28*.085-.05,z*.085).applyMatrix4(transform);
  const hits=new THREE.Raycaster(origin,target.clone().sub(origin).normalize(),0,.08).intersectObject(mesh,false);samples++;
  if(!hits[0]||hits[0].point.distanceTo(target)>1e-5)misses.push({pitch,yaw,x,z});
 }
}
const report={samples,missingCount:misses.length,missing:misses.slice(0,12),pass:!misses.length,scope:'Exported skinned Head underside, 63 neck/collar footprint positions across 5 head poses'};
fs.writeFileSync(new URL('head-closure-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
