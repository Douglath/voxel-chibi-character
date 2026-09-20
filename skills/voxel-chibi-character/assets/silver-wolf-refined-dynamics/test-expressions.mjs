import {palette} from './model.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {attachExpressions,names,irisPalette,blinkTemplates,templates} from './expressions.mjs';
const bytes=fs.readFileSync(new URL('silver-wolf-rigged.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const rig=gltf.scene,face=rig.getObjectByName('Face'),original=face.geometry;
const hasColor=hex=>{const target=new THREE.Color(hex),a=original.attributes.color;return Array.from({length:a.count},(_,i)=>i).some(i=>Math.abs(a.getX(i)-target.r)<1e-6&&Math.abs(a.getY(i)-target.g)<1e-6&&Math.abs(a.getZ(i)-target.b)<1e-6);};
for(const hex of [...Object.values(irisPalette(palette.iris)),palette.eyeWhite,palette.eyeHighlight])assert(hasColor(hex),'Actual GLB missing character eye color '+hex);
const digest=g=>crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).update(Buffer.from(g.attributes.color.array.buffer)).digest('hex');
const before=new Map();let triangles=0,vertices=0,meshes=0;const materials=new Set();rig.traverse(o=>{if(o.isMesh){before.set(o.uuid,{o,hash:digest(o.geometry)});triangles+=o.geometry.index.count/3;vertices+=o.geometry.attributes.position.count;meshes++;materials.add(o.material);}});
const api=attachExpressions(rig,palette),states={};assert.deepEqual(irisPalette('#788c86'),{U:'#6b807a',I:'#788c86',L:'#82968f'});
for(const name of Object.keys(names)){
 api.set(name);states[name]={...api.stats(),layers:api.state.layers};
 for(const m of api.group.children){assert(materials.has(m.material));assert([...m.geometry.attributes.position.array].every(Number.isFinite));}
 const eye=api.group.getObjectByName('ExpressionEyes'),positions=[...eye.geometry.attributes.position.array];
 api.setColor('#ae608b');assert.deepEqual([...api.group.getObjectByName('ExpressionEyes').geometry.attributes.position.array],positions);api.setColor(palette.iris);
 for(const key of Object.keys(api.layers)){api.toggle(key,true);assert(api.layers[key].visible);api.toggle(key,false);assert(!api.layers[key].visible);}
}
api.set('Normal');assert.equal(face.geometry,original);
api.set('Happy');const expectedSkin=new THREE.Color(palette.skin),skinColors=face.geometry.attributes.color;
for(let i=0;i<skinColors.count;i++){assert(Math.abs(skinColors.getX(i)-expectedSkin.r)<1e-6);assert(Math.abs(skinColors.getY(i)-expectedSkin.g)<1e-6);assert(Math.abs(skinColors.getZ(i)-expectedSkin.b)<1e-6);}api.set('Normal');
assert.notDeepEqual(blinkTemplates.shut.rows,templates.Closed.rows);
const blinkResults=[];
for(const fps of [30,60,144]){
 api.set('Normal');const cached=api.group.children.map(m=>m.geometry.uuid),seen=new Set();
 api.blink();for(let i=0;i<Math.ceil(.4*fps);i++){seen.add(api.state.blinkFrame);api.update(1/fps);}
 assert(seen.has('half')&&seen.has('shut')&&seen.has('open'));
 assert.equal(face.geometry,original);assert.deepEqual(api.group.children.map(m=>m.geometry.uuid),cached,'Blink must not allocate geometry');
 api.previewBlink(true);api.update(1);assert.equal(api.state.blinkFrame,'shut');api.previewBlink(false);
 api.setColor('#ae608b');api.blink();for(let i=0;i<fps;i++)api.update(1/fps);assert.equal(api.state.iris,'#ae608b');assert.equal(api.state.blinkFrame,'open');api.setColor(palette.iris);
 api.set('Normal');for(let i=0;i<Math.ceil(3.25*fps);i++)api.update(1/fps);assert.notEqual(api.state.blinkFrame,'open','Normal should blink automatically');
 api.set('Happy');api.update(10);assert.equal(api.state.blinkFrame,'open');
 api.set('Normal');api.setBlinkEnabled(false);api.update(10);assert.equal(api.state.blinkFrame,'open');api.setBlinkEnabled(true);
 blinkResults.push({fps,pass:true,frames:[...seen],geometryAllocationsDuringBlink:0});
}
api.set('Normal');api.previewBlink(true);states.BlinkShut=api.stats();api.previewBlink(false);
for(const key of ['anger','sweat','spark']){const g=api.layers[key].geometry;g.computeBoundingBox();assert(g.boundingBox.max.x-g.boundingBox.min.x> .85*4*.085);const outline=new THREE.Color('#18212c');assert([...Array(g.attributes.color.count).keys()].some(i=>Math.abs(g.attributes.color.getX(i)-outline.r)<1e-6),'Outline color missing');}
for(const {o,hash}of before.values())assert.equal(digest(o.geometry),hash,'Original geometry/color modified: '+o.name);
const head=rig.getObjectByName('head');api.set('Angry');rig.updateMatrixWorld(true);const symbol=api.layers.anger,beforeWorld=symbol.getWorldPosition(new THREE.Vector3());head.rotation.y=.5;rig.updateMatrixWorld(true);assert.equal(symbol.parent.parent,head);const point=new THREE.Vector3().fromBufferAttribute(symbol.geometry.attributes.position,0).applyMatrix4(symbol.matrixWorld);assert([...point].every(Number.isFinite));assert(point.z!==symbol.geometry.attributes.position.getZ(0));head.rotation.y=0;
const report={pass:true,blinkResults,sourceSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),baseline:{triangles,vertices,meshes,materials:materials.size,bones:rig.getObjectByName('Face').skeleton.bones.length},states,checks:['Eight templates load on actual packaged GLB','v5 base generates exact approved iris colors','Iris recolor preserves pixel geometry','All optional layers independently toggle','All layers share original vertex-color material','Normal restores original Face geometry exactly','All original geometry and colors unchanged','Emblems inherit head transform'],limits:['Runtime expression geometry is not embedded in the unchanged baseline GLB','No other character head topology or engine tested','No full self-collision or performance stress benchmark']};
fs.writeFileSync(new URL('expression-verification.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
