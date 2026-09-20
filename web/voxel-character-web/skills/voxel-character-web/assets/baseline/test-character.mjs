import fs from 'node:fs';
import * as T from '../three/build/three.module.js';
import {GLTFLoader} from '../three/examples/jsm/loaders/GLTFLoader.js';
import {HairPhysics} from './hair-physics.mjs';
import {palette} from './model.mjs';
const bytes=fs.readFileSync(new URL('silver-wolf-rigged.glb',import.meta.url));
const {scene:rig,animations}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const hp=new HairPhysics(rig),mixer=new T.AnimationMixer(rig);mixer.clipAction(animations.find(c=>c.name==='Idle')).play();
const max=hp.chains.map(()=>0);let finite=true;
for(let i=0;i<960;i++){const t=i/60;mixer.update(1/60);rig.rotation.y=t<6?.6*Math.sin(t*2):0;rig.position.y=t<6?.04*Math.sin(t*10):0;if(i===60)hp.kick();hp.update(1/60);hp.chains.forEach((c,k)=>{max[k]=Math.max(max[k],...c.bones.map(b=>b.quaternion.angleTo(new T.Quaternion())));finite&&=c.bones.every(b=>b.quaternion.toArray().every(Number.isFinite));});}
const settle=hp.chains.map(c=>Math.max(...c.bones.map(b=>b.quaternion.angleTo(new T.Quaternion()))));
// Stop animation before strict rest settling measurement.
mixer.stopAllAction();rig.rotation.set(0,0,0);for(let i=0;i<600;i++)hp.update(1/60);
const rest=hp.chains.map(c=>Math.max(...c.bones.map(b=>b.quaternion.angleTo(new T.Quaternion()))));
hp.enabled=false;hp.update(1/60);const off=hp.chains.every(c=>c.bones.every(b=>b.quaternion.angleTo(new T.Quaternion())<1e-7));hp.enabled=true;hp.update(1);const reset=hp.chains.every(c=>c.bones.every(b=>b.quaternion.angleTo(new T.Quaternion())<1e-7));
const face=rig.getObjectByName('Face').geometry.attributes.color,expected=new T.Color(palette.eyeHighlight);let highlights=0;for(let i=0;i<face.count;i++)if(Math.abs(face.getX(i)-expected.r)<1e-6&&Math.abs(face.getY(i)-expected.g)<1e-6&&Math.abs(face.getZ(i)-expected.b)<1e-6)highlights++;
const report={chains:hp.chains.map((c,i)=>({bones:c.bones.map(b=>b.name),maxAngle:max[i],settledAngle:rest[i],pass:max[i]>.001&&max[i]<.5&&rest[i]<.01})),finite,off,reset,whiteHighlightVertices:highlights,pass:finite&&off&&reset&&highlights>0&&max.every(v=>v>.001&&v<.5)&&rest.every(v=>v<.01),scope:'Actual GLB, 15 refined spring chains (tail tested separately in test-tail.mjs) under body turn/bounce/impulse, settling, disable and long-pause reset; exported white eye highlights'};
fs.writeFileSync(new URL('character-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);if(!report.pass)process.exitCode=1;
