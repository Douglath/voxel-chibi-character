import {validateStandardPhysics} from './standard-physics.mjs';
import {attachPhysics,updatePhysics,kickPhysics,supportsPhysics} from './character-physics.mjs';
import {captureArmFrames,applyArmSwing} from './arm-motion.mjs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {attachExpressions,names as expressionNames} from './expressions.mjs';
import {createHongKongScene} from './hong-kong-scene.mjs';
import {Crowd} from './crowd.mjs';
import {BlueHourFX} from './blue-hour-fx.mjs';
import {GLTFExporter} from './vendor/exporters/GLTFExporter.js';

const expressionProfiles=__EXPRESSION_PROFILES__;
const $=id=>document.getElementById(id),shell='<!doctype html>\n'+document.documentElement.outerHTML;
const initial=JSON.parse($('library-data').textContent),entries=[],logs=[],hashes=new Set();
const settings={scene:'studio',physics:true,random:true,paused:false,speed:1,grid:true,labels:false,...initial.settings};
let mode='playground',selected=null,serial=0,loading=false,worldRadius=28,customScene=null,environment=null,toastTimer,dragDepth=0,citySet=null,renderCalls=0;
const crowd=new Crowd({extent:28,halfWidth:10.55,cross:true});
let simulationClock=0;
let cameraMemory=null,lastFrame=performance.now(),perfTime=0,perfFrames=0,totalTime=0,labelsTime=0;
const host=$('viewport'),renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#e7eddf');renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.append(renderer.domElement);
const blueHourFX=new BlueHourFX(renderer);
const scene=new T.Scene(),stage=new T.Group(),actors=new T.Group(),solo=new T.Group();scene.add(stage,actors,solo);solo.visible=false;
const camera=new T.PerspectiveCamera(37,1,.05,500);camera.position.set(15,17,25);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=2;controls.maxDistance=180;controls.maxPolarAngle=Math.PI-.05;controls.target.set(0,1,0);
const ambient=new T.HemisphereLight(0xffffec,0x889b80,2.5);scene.add(ambient);const key=new T.DirectionalLight(0xfff5df,2.4);key.position.set(-9,18,12);scene.add(key);const fill=new T.DirectionalLight(0xd7e9ff,.9);fill.position.set(8,7,-10);scene.add(fill);
key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-44;key.shadow.camera.right=44;key.shadow.camera.top=44;key.shadow.camera.bottom=-44;key.shadow.camera.near=.5;key.shadow.camera.far=150;key.shadow.bias=-.0003;key.shadow.normalBias=.055;
const grid=new T.GridHelper(20,20,0xb6c4a5,0xd2ddc0);grid.position.y=.005;grid.material.transparent=true;grid.material.opacity=.15;scene.add(grid);
const soloFloor=new T.Mesh(new T.CircleGeometry(5,64),new T.MeshStandardMaterial({color:0xe3ead8,roughness:1}));soloFloor.rotation.x=-Math.PI/2;soloFloor.position.y=-.015;solo.add(soloFloor);
const raycaster=new T.Raycaster(),pointer=new T.Vector2();
const v=new T.Vector3(),q=new T.Quaternion(),axisX=new T.Vector3(1,0,0),axisZ=new T.Vector3(0,0,1);
const swatches=['#789580','#b69c7b','#8f92a3','#bb927f','#829e9a','#a2a573','#a68d9d'];

function toast(message,duration=5200){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,duration);}
function log(message){logs.push(message);$('logList').textContent=logs.join('\n');}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function toBase64(buffer){const bytes=new Uint8Array(buffer);let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}
function fromBase64(s){if(typeof s!=='string'||s.length>140000000)throw Error('内嵌 GLB 数据无效或超过 100 MB');return Uint8Array.from(atob(s.replace(/^data:[^,]*,/,'')),c=>c.charCodeAt(0)).buffer;}
async function digest(data){const bytes=typeof data==='string'?new TextEncoder().encode(data):data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function decodeModule(uri){if(typeof uri!=='string'||!uri.startsWith('data:text/javascript;base64,'))return '';return new TextDecoder().decode(new Uint8Array(fromBase64(uri)));}
function canonical(source){return source.split('export function setupExpressionUI')[0].replace(/^\s*import[^\n]*\n/,'').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'').replace(/\s+/g,'');}
function validateGlb(buffer){
 const d=new DataView(buffer);if(buffer.byteLength<20||d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength)throw Error('不是完整的 GLB 2.0 文件');
 if(d.getUint32(16,true)!==0x4e4f534a||20+d.getUint32(12,true)>buffer.byteLength)throw Error('GLB JSON 数据损坏');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,d.getUint32(12,true))));
 for(const resource of [...json.buffers??[],...json.images??[]])if(resource.uri&&!resource.uri.startsWith('data:'))throw Error('GLB 引用外部资源，请先将资源嵌入模型');
 if((json.extensionsRequired??[]).some(x=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(x)))throw Error('暂不支持 Draco / Meshopt / KTX2 压缩模型');return json;
}
async function parseFile(file){
 if(/\.glb$/i.test(file.name)){const buffer=await file.arrayBuffer();validateGlb(buffer);return [{name:file.name.replace(/\.glb$/i,''),source:file.name,glb:toBase64(buffer),palette:{},expression:null}];}
 const text=await file.text(),doc=new DOMParser().parseFromString(text,'text/html');
 const saved=doc.querySelector('script#library-data[type="application/json"]');
 if(saved){const data=JSON.parse(saved.textContent);if(data.version!==1||!Array.isArray(data.models))throw Error('模型集合版本不支持');return data.models;}
 const dataNode=doc.querySelector('script#model-data[type="application/json"]');if(!dataNode)throw Error('没有找到内嵌 GLB（非角色页面）');
 const data=JSON.parse(dataNode.textContent),glb=data.rigged||data.static;if(!glb)throw Error('没有 rigged 或 static 模型数据');
 let imports={};for(const s of doc.querySelectorAll('script[type="importmap"]'))Object.assign(imports,JSON.parse(s.textContent).imports??{});
 const module=ending=>decodeModule(Object.entries(imports).find(([k])=>k.endsWith('/'+ending))?.[1]);
 const model=module('model.mjs'),expression=module('expressions.mjs'),palette={};
 const paletteText=model.match(/(?:export\s+)?const\s+palette\s*=\s*\{([^}]+)\}/)?.[1]??'';
 for(const match of paletteText.matchAll(/["']?([A-Za-z]\w*)["']?\s*:\s*["'](#[a-fA-F0-9]{6})["']/g))palette[match[1]]=match[2];
 const signature=expression?await digest(canonical(expression)):null;
 const physicsSignature=module('hair-physics.mjs')?await digest(module('hair-physics.mjs')):null;
 const profile=signature&&Object.hasOwn(expressionProfiles,signature)?expressionProfiles[signature]:null;
 let name=(doc.querySelector('h1')?.textContent||doc.title||file.name).trim().replace(/\s+/g,' ').replace(/\s*[·/|]\s*(?:体素小人|体素角色|角色动态测试|Voxel).*$/i,'').slice(0,100);
 return [{name:name||file.name,source:file.name,glb,palette,physics:supportsPhysics(physicsSignature)?physicsSignature:null,expression:profile,expressionNote:profile===null?(expression?'未识别表情版本，保留原始脸部':'源文件未携带兼容表情系统'):'v5 表情与自然眨眼'}];
}

function disposeTree(root){const geos=new Set(),mats=new Set(),textures=new Set(),skeletons=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){mats.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});geos.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());skeletons.forEach(x=>x.dispose());}
const normalizeBone=name=>name.toLowerCase().replace(/[._\-\s]/g,'');
function bone(e,name){return e.bones.get(normalizeBone(name));}
function safeProfile(p){if(p===null||p===undefined)return null;const out={};for(const [k,min,max] of [['symbolX',-20,20],['symbolY',20,60],['symbolZ',.3,3],['blushZ',.3,2],['tearsZ',.3,2],['droolZ',.3,2]])if(Number.isFinite(p[k])&&p[k]>=min&&p[k]<=max)out[k]=p[k];return out;}
async function addRecord(raw){
 const buffer=fromBase64(raw.glb);validateGlb(buffer);
 const palette={};for(const [k,value]of Object.entries(raw.palette??{}))if(/^[A-Za-z]\w*$/.test(k)&&/^#[0-9a-f]{6}$/i.test(value))palette[k]=value;
 const standardPhysics=validateStandardPhysics(raw.standardPhysics);
 const expression=safeProfile(raw.expression),hash=await digest(new Uint8Array(buffer)),identity=hash+':'+JSON.stringify(palette)+':'+JSON.stringify(expression)+':'+JSON.stringify(standardPhysics);
 if(hashes.has(identity))return null;
 const gltf=await new GLTFLoader().parseAsync(buffer,''),rig=gltf.scene;rig.updateMatrixWorld(true);
 const sourceBox=new T.Box3().setFromObject(rig),sourceSize=sourceBox.getSize(new T.Vector3());
 if(sourceBox.isEmpty()||!sourceSize.toArray().every(Number.isFinite)||sourceSize.y<=0){disposeTree(rig);throw Error('模型没有可显示的有限几何');}
 const bones=new Map(),rest=[];let triangles=0,meshCount=0;
 rig.traverse(o=>{rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);if(o.isBone)bones.set(normalizeBone(o.name),o);if(o.isMesh){meshCount++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;}});
 const record={name:String(raw.name||raw.source||'未命名角色').slice(0,100),source:String(raw.source||'模型集合').slice(0,200),glb:raw.glb,palette,expression,standardPhysics,physics:supportsPhysics(raw.physics)?raw.physics:null,physicsEnabled:raw.physicsEnabled!==false,expressionNote:String(raw.expressionNote||'').slice(0,160)};
 let expr=null;
 if(expression&&rig.getObjectByName('Face')&&rig.getObjectByName('head')){
  try{expr=attachExpressions(rig,palette,expression);expr.set('Normal');}catch(error){record.expression=null;record.expressionNote='表情挂接不兼容：'+error.message;log(record.name+'：'+record.expressionNote);}
 }
 // Expression geometry is attached in its original bind frame before placement/scaling.
 const slot=new T.Group(),offset=new T.Group();slot.add(offset);offset.add(rig);actors.add(slot);
 const scale=4/sourceSize.y;offset.scale.setScalar(scale);offset.position.set(-sourceBox.getCenter(v).x*scale,-sourceBox.min.y*scale,-sourceBox.getCenter(v).z*scale);
 const shadow=new T.Mesh(new T.CircleGeometry(Math.max(.45,Math.min(1.4,sourceSize.x*scale*.36)),24),new T.MeshBasicMaterial({color:0x63795d,transparent:true,opacity:.12,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.016;slot.add(shadow);
 const e={id:++serial,record,identity,hash,rig,slot,offset,scale,shadow,expr,bones,rest,triangles,meshCount,clips:gltf.animations,mixer:new T.AnimationMixer(rig),state:'idle',actionTime:0,actionUntil:0,home:new T.Vector3(),goal:new T.Vector3(),display:raw.display!==false,random:true,rare:raw.rare!==false,blink:raw.blink!==false,exprWait:7+Math.random()*10,exprUntil:0,hasRun:['thigh.L','thigh.R','shin.L','shin.R','upper_arm.L','upper_arm.R','forearm.L','forearm.R'].every(n=>bones.has(normalizeBone(n))),color:swatches[serial%swatches.length],height:4,width:sourceSize.x*scale,depth:sourceSize.z*scale};
 e.armFrames=captureArmFrames(rig,n=>bone(e,n));
 try{attachPhysics(e);}catch(error){log(e.record.name+' 物理加载失败：'+error.message);e.physics=null;}
 const label=document.createElement('div');label.className='actor-label';label.textContent=record.name;$('labels').append(label);e.label=label;
 e.skeleton=new T.SkeletonHelper(rig);e.skeleton.visible=false;scene.add(e.skeleton);slot.userData.actor=e;rig.traverse(o=>{if(o.isMesh)o.userData.actor=e;});
 entries.push(e);hashes.add(identity);e.expr?.setBlinkEnabled(e.blink);setAction(e,'idle');e.nextDecision=2+Math.random()*9;
 if(Array.isArray(raw.position)&&raw.position.length===3&&raw.position.every(Number.isFinite)){slot.position.fromArray(raw.position);e.savedPosition=true;}
 if(Number.isFinite(raw.yaw))slot.rotation.y=raw.yaw;
 return e;
}
function resetPose(e){e.mixer.stopAllAction();for(const [o,p,r,s]of e.rest){o.position.copy(p);o.quaternion.copy(r);o.scale.copy(s);}e.rig.updateMatrixWorld(true);}
function playClip(e,name){resetPose(e);const clip=e.clips.find(c=>c.name===name);if(clip)e.mixer.clipAction(clip).reset().play();return !!clip;}
function setAction(e,action){
 if(['run','walk'].includes(action)&&!e.hasRun)action='idle';
 e.physicsReset=true;
 e.state=action;e.actionTime=0;e.gaitTime=0;e.rig.position.y=e.rest[0][1].y;
 if(action==='bind'){resetPose(e);}else if(action.startsWith('clip:')){playClip(e,action.slice(5));}else{playClip(e,e.clips.find(c=>/idle/i.test(c.name))?.name??'');}
 if(action==='drop'||action==='jump'){e.dropHeight=Number($('dropHeight').value)||6;frameSingle(e,'three',e.dropHeight*e.scale);}
 if(mode==='single'&&selected===e)syncInspectorState();
}
function motionPose(e,t,kind){
 const phase=t*(kind==='walk'?6.5:10),amp=kind==='walk'?.23:.46;
 for(const [side,sign]of [['L',1],['R',-1]]){
  const thigh=bone(e,'thigh.'+side),shin=bone(e,'shin.'+side),arm=bone(e,'upper_arm.'+side),forearm=bone(e,'forearm.'+side);
  if(thigh)thigh.rotation.x=sign*amp*Math.sin(phase);
  if(shin)shin.rotation.x=Math.max(0,sign*Math.sin(phase))*(kind==='walk'?.32:.62);

 }
 applyArmSwing(e.rig,e.armFrames,phase,kind);
 e.rig.position.y=e.rest[0][1].y+(kind==='walk'?.025:.055)*(1-Math.cos(phase*2));
}
function setExpression(e,name,manual=false){if(!e.expr)return;e.expr.set(name);e.exprUntil=manual?Infinity:1.6+Math.random()*1.3;if(name==='Normal')e.exprUntil=0;if(mode==='single'&&selected===e)syncInspectorState();}
function updateActor(e,dt){
 e.actionTime+=dt;e.mixer.update(dt);
 if(e.state==='run'||e.state==='walk'){e.gaitTime+=dt*(e.state==='walk'?(e.walkRate??1):1);motionPose(e,e.gaitTime,e.state);}
 if(e.state==='wave'){
  const arm=bone(e,'upper_arm.R'),fore=bone(e,'forearm.R');if(arm)arm.rotation.set(0,0,-.7+Math.sin(e.actionTime*7)*.16);if(fore)fore.rotation.y=1.5+Math.sin(e.actionTime*7)*.35;
 }
 if(e.state==='drop'||e.state==='jump'){
  const t=Math.max(0,e.actionTime-.45),h=e.dropHeight,velocity=e.state==='jump'?3:0;
  e.rig.position.y=e.rest[0][1].y+Math.max(0,h+velocity*t-9*t*t);
  if(t>(velocity+Math.sqrt(velocity*velocity+36*h))/18+1.5){setAction(e,'idle');if(mode==='single')frameSingle(e,'three');}
 }
 updatePhysics(e,dt,settings.physics);
 if(e.expr){
  if(e.rare&&e.exprUntil!==Infinity){e.exprWait-=dt;if(e.exprWait<=0){e.exprWait=7+Math.random()*11;if(Math.random()<.1&&e.expr.state.expression==='Normal'){const list=['Happy','Confused','Hungry','Scared'];setExpression(e,list[Math.floor(Math.random()*list.length)]);}}}
  if(e.exprUntil>0&&e.exprUntil!==Infinity){e.exprUntil-=dt;if(e.exprUntil<=0)e.expr.set('Normal');}
  e.expr.update(dt);
 }
}

function updateCrowd(dt){
 const active=new Set(entries.filter(e=>e.display&&e.hasRun).map(e=>e.id));crowd.update(dt,active);
 for(const e of entries){const a=crowd.agents.get(e.id);if(!a||!active.has(e.id))continue;e.slot.position.set(a.x,0,a.z);const speed=Math.hypot(a.vx,a.vz),walking=a.phase==='walk'&&speed>.15,action=walking?'walk':a.phase==='wave'?'wave':'idle';
  if(e.state!==action)setAction(e,action);e.walkRate=Math.max(.4,Math.min(1.35,speed/1.55));
  if(speed>.12){const target=Math.atan2(a.vx,a.vz),diff=Math.atan2(Math.sin(target-e.slot.rotation.y),Math.cos(target-e.slot.rotation.y));e.slot.rotation.y+=T.MathUtils.clamp(diff,-dt*3.2,dt*3.2);}
 }
}

function mat(color){return new T.MeshStandardMaterial({color,roughness:1});}
function box(parent,x,y,z,w,h,d,color){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);parent.add(m);return m;}
function tree(parent,x,z,size=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(size);box(g,0,.9,0,.22,1.8,.22,0x9c8967);box(g,0,2,0,1.55,1.25,1.45,0x8da676);box(g,-.45,1.7,.16,.9,.65,.95,0xa8bd87);box(g,.14,2.7,-.12,.95,.4,.92,0xbed29a);parent.add(g);}
function bench(parent,x,z,rotation=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;box(g,0,.65,0,2,.16,.65,0xb5a887);box(g,0,1.12,-.27,2,.72,.12,0xc9bda0);for(const sx of [-.75,.75])box(g,sx,.3,0,.12,.6,.45,0x778574);parent.add(g);}
function rebuildStage(){
 while(stage.children.length){const c=stage.children[0];stage.remove(c);if(c!==environment&&c!==citySet?.root)disposeTree(c);}if(environment)environment.removeFromParent();
 const blueHour=settings.scene==='hongkong',night=settings.scene==='night',studio=settings.scene==='studio';
 const city=blueHour&&mode!=='single';
 document.body.dataset.scene=settings.scene;
 $('singleSceneSelect').value=settings.scene;$('singleSceneSelect').querySelector('[value=custom]').hidden=!customScene;
 soloFloor.material.color.set(blueHour?0x263b50:night?0x4b6058:studio?0xe0e5da:0xd7e1c7);
 document.body.classList.toggle('blue-hour',blueHour||night);renderer.toneMapping=city?T.ACESFilmicToneMapping:T.NoToneMapping;renderer.toneMappingExposure=1.28;renderer.shadowMap.enabled=city;
 scene.fog=null;ambient.color.set(city?0xb5c5e3:0xffffec);ambient.groundColor.set(city?0x616079:0x889b80);ambient.intensity=city?1.08:2.5;
 key.color.set(city?0xaec9ff:0xfff5df);key.position.set(city?-28:-9,city?44:18,city?18:12);fill.color.set(city?0x899eca:0xd7e9ff);
 if(city){
  scene.background=new T.Color(0x18263c);scene.fog=new T.FogExp2(0x18263c,.0023);key.intensity=1.65;fill.intensity=.55;
  if(!citySet||Math.abs(citySet.extent-worldRadius)>.1){if(citySet)disposeTree(citySet.root);citySet=createHongKongScene(worldRadius);}stage.add(citySet.root);grid.visible=false;
  $('sceneSelect').value='hongkong';$('sceneLabel').textContent='HONG KONG / BLUE HOUR';return;
 }
 scene.background=new T.Color(blueHour?0x18263c:night?0x343f4a:studio?0xe9ece6:0xe6eddc);
 key.intensity=night?1.5:2.4;fill.intensity=night?1.1:.9;
 const ground=new T.Mesh(new T.PlaneGeometry(worldRadius*2+10,worldRadius*2+10),mat(night?0x4b6058:studio?0xe0e5da:0xd7e1c7));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;stage.add(ground);
 if(settings.scene==='custom'&&environment){environment.scale.setScalar((worldRadius*2+6)/environment.userData.baseSpan);stage.add(environment);}else if(!studio){
  const r=worldRadius+2;for(const [x,z,s]of [[-r,-r,1.5],[r,-r,1.25],[-r,r,.95],[r,r,1.5],[-r,-r*.25,1.2],[r,-r*.3,1.15]])tree(stage,x,z,s);
  bench(stage,-r+2,-r+.6);bench(stage,r-2,-r+.6);
  for(let i=0;i<16;i++){const x=-r+i*(2*r/15),z=-r-1;box(stage,x,.15,z,.72,.3,.7,i%2?0xb3c093:0xa4b485);if(i%3===0)box(stage,x,.42,z,.16,.16,.16,0xe3bc88);}
  for(let i=0;i<9;i++)box(stage,(i-4)*1.25,-.005,r+.2,.98,.035,1.35,night?0x738078:0xe7e9d8);
 }
 const gridSize=mode==='single'?14:worldRadius*2+6,gridShape=new T.GridHelper(gridSize,Math.ceil(gridSize),0xa9b99d,0xc6d1b7);grid.geometry.dispose();grid.geometry=gridShape.geometry;gridShape.material.dispose();
 grid.visible=settings.grid&&(mode==='single'||settings.scene!=='custom');grid.material.color.set(blueHour?0x49647b:night?0x779185:studio?0xb8c3ba:0xbdc9aa);
 $('sceneSelect').value=settings.scene;$('sceneLabel').textContent=mode==='single'?`CHARACTER STUDIO / ${{hongkong:'BLUE HOUR',night:'TWILIGHT',studio:'OBSERVATION',garden:'GARDEN',custom:'YOUR SCENE'}[settings.scene]}`:settings.scene==='garden'?'THE GARDEN / 01':settings.scene==='night'?'TWILIGHT / 02':settings.scene==='studio'?'OBSERVATION / 03':'YOUR SCENE / 04';
}
function arrange(preserve=false){
 if(settings.scene==='hongkong'){
  worldRadius=Math.max(28,Math.sqrt(entries.length)*4.7);rebuildStage();crowd.configure({extent:worldRadius,halfWidth:10.55,cross:true});
  const items=entries.map(e=>({id:e.id,x:e.slot.position.x,z:e.slot.position.z,r:T.MathUtils.clamp(e.width*.22,.72,1.15)}));
  const agents=crowd.distribute(items,preserve);for(const a of agents){const e=entries.find(x=>x.id===a.id);e.slot.position.set(a.x,0,a.z);e.home.copy(e.slot.position);if(!preserve)e.slot.rotation.y=Math.random()*Math.PI*2;setAction(e,'idle');}return;
 }
 const n=entries.length,cols=Math.max(1,Math.ceil(Math.sqrt(n))),rows=Math.ceil(n/cols),spacing=Math.max(5.6,...entries.map(e=>Math.max(e.width,e.depth)+2.4));
 entries.forEach((e,i)=>{e.home.set((i%cols-(cols-1)/2)*spacing,0,(Math.floor(i/cols)-(rows-1)/2)*spacing);if(!preserve||!e.savedPosition)e.slot.position.copy(e.home);else e.home.copy(e.slot.position);e.slot.rotation.y=preserve?e.slot.rotation.y:0;e.goal.copy(e.home);e.turnTarget=e.slot.rotation.y;setAction(e,'idle');});
 worldRadius=Math.max(7,Math.max(cols,rows)*spacing/2+1);if(preserve)worldRadius=Math.max(worldRadius,...entries.map(e=>Math.max(Math.abs(e.slot.position.x),Math.abs(e.slot.position.z))+4));rebuildStage();
 crowd.configure({extent:worldRadius,halfWidth:worldRadius,cross:false});crowd.clear();for(const e of entries)crowd.add(e.id,e.slot.position.x,e.slot.position.z,T.MathUtils.clamp(e.width*.22,.72,1.15));
}
function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(host);
function frameBox(bounds,direction=new T.Vector3(1,1.05,1.5)){
 const size=bounds.getSize(v),center=bounds.getCenter(new T.Vector3()),radius=Math.max(2,size.length()/2),fov=camera.fov*Math.PI/180;
 const distance=radius/Math.sin(Math.min(fov,2*Math.atan(Math.tan(fov/2)*camera.aspect))/2)*1.04;controls.target.copy(center);camera.position.copy(center).addScaledVector(direction.normalize(),distance);camera.near=.03;camera.far=Math.max(300,distance*8);camera.updateProjectionMatrix();controls.update();
}
function frameAll(){resize();if(settings.scene==='hongkong'){
 const outer=citySet?.outer??35,direction=new T.Vector3(.7,1.07,1.4).normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right).normalize(),center=new T.Vector3(0,4,0),tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*camera.aspect;let distance=0;
 for(const x of [-outer,outer])for(const y of [-1,22])for(const z of [-outer,outer]){const p=new T.Vector3(x,y,z).sub(center);distance=Math.max(distance,p.dot(direction)+Math.max(Math.abs(p.dot(right))/tanH,Math.abs(p.dot(up))/tanV));}
 controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance*1.035);controls.update();return;
 }const bounds=new T.Box3();for(const e of entries)if(e.display)bounds.union(new T.Box3().setFromCenterAndSize(e.slot.position.clone().add(new T.Vector3(0,2,0)),new T.Vector3(e.width+1,4.5,e.depth+1)));if(bounds.isEmpty())bounds.set(new T.Vector3(-7,0,-7),new T.Vector3(7,5,7));frameBox(bounds);}
function frameSingle(e,view='three',extra=0){resize();const dirs={front:[0,.12,1],side:[1,.12,0],back:[0,.12,-1],three:[.8,.5,1.5],top:[0,1,.001]};frameBox(new T.Box3(new T.Vector3(-Math.max(1,e.width/2),0,-Math.max(.6,e.depth/2)),new T.Vector3(Math.max(1,e.width/2),4.4+extra,Math.max(.6,e.depth/2))),new T.Vector3(...dirs[view]));}
function cameraSnapshot(){return {position:camera.position.toArray(),target:controls.target.toArray()};}
function restoreCamera(s){if(!s)return;camera.position.fromArray(s.position);controls.target.fromArray(s.target);controls.update();}

function leaveSingle(){if(!selected||mode!=='single')return;const e=selected;actors.add(e.slot);e.slot.position.copy(e.savedWorld.position);e.slot.quaternion.copy(e.savedWorld.rotation);e.skeleton.visible=false;setAction(e,'idle');e.expr?.set('Normal');e.exprUntil=0;}
function setMode(next,e=null){
 if(next==='single'&&!e)return;
 if(mode==='playground'&&next!=='playground')cameraMemory=cameraSnapshot();
 leaveSingle();mode=next;
 $('surface').classList.toggle('single-mode',mode==='single');$('surface').classList.toggle('table-mode',mode==='table');$('inspector').hidden=mode!=='single';$('tablePanel').hidden=mode!=='table';$('back').hidden=mode==='playground';
 actors.visible=mode!=='single';solo.visible=mode==='single';stage.visible=mode!=='single';
 for(const x of entries){x.slot.visible=x.display;x.label.hidden=mode!=='playground';}
 if(mode==='single'){
  selected=e;e.savedWorld={position:e.slot.position.clone(),rotation:e.slot.quaternion.clone()};solo.add(e.slot);e.slot.position.set(0,0,0);e.slot.rotation.set(0,0,0);e.slot.visible=true;setAction(e,'idle');buildInspector(e);
  $('viewTitle').textContent='单角色测试';$('viewDescription').textContent='统一的视角、姿态、运动与像素表情。';requestAnimationFrame(()=>frameSingle(e));
 }else{
  $('viewTitle').textContent=mode==='table'?'小伙伴名册':settings.scene==='hongkong'?'海角街，入夜之前。':'今天，也一起玩吧。';$('viewDescription').textContent=mode==='table'?'快速找到角色，进入同一套测试界面。':'沿着街灯，自由穿行在同一个小世界。';
  if(mode==='playground'){requestAnimationFrame(()=>{resize();cameraMemory?restoreCamera(cameraMemory):frameAll();});}else renderTable();
 }
 for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('active',b.dataset.mode===mode);rebuildStage();refreshUI();
}
function refreshUI(){
 $('count').textContent=entries.length;$('empty').hidden=entries.length>0||mode!=='playground';$('sceneBadge').textContent=entries.length?`${entries.filter(e=>e.display).length} 位在场 / ${entries.length} 位小伙伴`:'无人入场 · 等待导入';
 $('pauseAll').textContent=settings.paused?'▶ 继续':'Ⅱ 暂停';$('randomAll').classList.toggle('active',settings.random);$('saveLibrary').disabled=loading||entries.length===0;$('importButton').disabled=loading;
 $('globalPhysics').textContent='物理动态：'+(settings.physics?'开':'关');$('globalPhysics').classList.toggle('active',settings.physics);$('globalPhysics').setAttribute('aria-pressed',String(settings.physics));
 $('speed').value=String(settings.speed);$('toggleNames').classList.toggle('active',settings.labels);$('arrange').textContent=settings.scene==='hongkong'&&mode!=='single'?'重新散开':'整齐站好';renderRoster();if(mode==='table')renderTable();
}
function filtered(){const term=$('search').value.trim().toLowerCase();return entries.filter(e=>(e.record.name+' '+e.record.source).toLowerCase().includes(term));}
function renderRoster(){
 const root=$('roster');root.replaceChildren();for(const e of filtered()){
  const row=document.createElement('div');row.className='person'+(e===selected?' selected':'');
  const avatar=document.createElement('span');avatar.className='avatar';avatar.style.setProperty('--swatch',e.color);avatar.textContent=e.record.name.slice(0,1);
  const open=document.createElement('button');open.className='open';const name=document.createElement('span');name.className='name';name.textContent=e.record.name;const small=document.createElement('small');small.textContent=e.expr?'自然眨眼 · 八表情':'原始脸部 · 自带动画';open.append(name,small);open.onclick=()=>setMode('single',e);
  const visible=document.createElement('input');visible.type='checkbox';visible.checked=e.display;visible.setAttribute('aria-label','显示 '+e.record.name);visible.onchange=()=>{e.display=visible.checked;e.slot.visible=mode==='single'?selected===e:e.display;refreshUI();};row.append(avatar,open,visible);root.append(row);
 }if(!root.children.length){const empty=document.createElement('div');empty.className='roster-empty';empty.textContent=entries.length?'没有匹配的角色':'这里等待第一位小伙伴';root.append(empty);}
}
function renderTable(){
 const body=$('tableBody');body.replaceChildren();for(const e of filtered()){
  const row=document.createElement('tr'),visible=document.createElement('input');visible.type='checkbox';visible.checked=e.display;visible.setAttribute('aria-label','显示 '+e.record.name);visible.onchange=()=>{e.display=visible.checked;e.slot.visible=e.display;refreshUI();};
  const c1=document.createElement('td');c1.append(visible);const c2=document.createElement('td'),open=document.createElement('button'),file=document.createElement('small');open.textContent=e.record.name;open.className='ghost';open.onclick=()=>setMode('single',e);file.textContent=e.record.source;c2.append(open,file);
  const c3=document.createElement('td');c3.textContent=e.triangles.toLocaleString();const c4=document.createElement('td');c4.textContent=e.bones.size;const c5=document.createElement('td');c5.textContent=e.expr?'八表情 / 眨眼':'原始脸部';
  const c6=document.createElement('td'),preview=document.createElement('button'),remove=document.createElement('button');preview.textContent='测试';preview.onclick=()=>setMode('single',e);remove.textContent='移除';remove.className='ghost';remove.onclick=()=>removeEntry(e);c6.append(preview,remove);row.append(c1,c2,c3,c4,c5,c6);body.append(row);
 }
}
function removeEntry(e){if(selected===e&&mode==='single')setMode('playground');if(selected===e)selected=null;entries.splice(entries.indexOf(e),1);crowd.remove(e.id);hashes.delete(e.identity);e.mixer.stopAllAction();e.mixer.uncacheRoot(e.rig);e.slot.removeFromParent();e.skeleton.removeFromParent();e.label.remove();disposeTree(e.slot);if(e.physics?.hair.helpers)disposeTree(e.physics.hair.helpers);e.skeleton.geometry.dispose();e.skeleton.material.dispose();refreshUI();}
function buildInspector(e){
 $('physicsToggle').checked=e.physicsEnabled!==false;$('physicsToggle').disabled=!e.physics;$('physicsKick').disabled=!e.physics;$('physicsStatus').textContent=e.physics?(e.physicsKind==='standard'?'标准动态参数随角色保存，可跨页面导入':'已加载该角色原始物理模块'):'无可用动态参数';
 $('singleName').value=e.record.name;$('singleStats').textContent=`${e.triangles.toLocaleString()} 三角面 · ${e.bones.size} 骨骼 · ${e.clips.length} 个自带动画`;
 $('clip').replaceChildren(new Option('选择模型自带动画…',''));for(const clip of e.clips)$('clip').add(new Option(clip.name,clip.name));
 $('expressionButtons').replaceChildren();for(const [key,name]of Object.entries(expressionNames)){const b=document.createElement('button');b.textContent=name;b.dataset.expression=key;b.disabled=!e.expr;b.onclick=()=>setExpression(e,key,true);$('expressionButtons').append(b);}
 $('autoBlink').checked=e.blink;$('autoBlink').disabled=!e.expr;$('blinkOnce').disabled=!e.expr;$('rareExpression').disabled=!e.expr;$('randomExpression').disabled=!e.expr;$('showBones').checked=false;$('showGrid').checked=settings.grid;
 $('capabilityNote').textContent=e.expr?'沿用源文件的 v5 眼型、虹膜色和符号位置，不新增嘴巴。':(e.record.expressionNote||'没有已识别的表情模板，保留原始脸部。');
 document.querySelector('[data-action="run"]').disabled=!e.hasRun;document.querySelector('[data-action="wave"]').disabled=!bone(e,'upper_arm.R');syncInspectorState();
}
function syncInspectorState(){if(!selected||mode!=='single')return;const e=selected;for(const b of document.querySelectorAll('[data-action]'))b.classList.toggle('active',b.dataset.action===e.state);for(const b of document.querySelectorAll('[data-expression]'))b.classList.toggle('active',b.dataset.expression===e.expr?.state.expression);$('rareExpression').textContent='偶发表情：'+(e.rare?'开':'关');$('rareExpression').classList.toggle('active',e.rare);}

async function importFiles(files){
 if(loading){toast('正在导入，请稍候。');return;}
 if(mode==='single')setMode('playground');loading=true;refreshUI();$('loading').hidden=false;let imported=0,duplicates=0,failures=0;
 for(const [index,file]of [...files].entries()){
  $('loading').textContent=`正在读取 ${index+1} / ${files.length} · ${file.name}`;await new Promise(resolve=>requestAnimationFrame(resolve));
  try{const records=await parseFile(file);for(const r of records){try{const e=await addRecord(r);if(e){imported++;log('已导入 '+e.record.name+' ← '+file.name);}else duplicates++;}catch(error){failures++;log('未导入 '+(r.name||file.name)+'：'+error.message);}}}catch(error){failures++;log('未导入 '+file.name+'：'+error.message);}
 }
 loading=false;$('loading').hidden=true;arrange();refreshUI();if(mode!=='table')setMode('playground');cameraMemory=null;frameAll();toast(`已加入 ${imported} 个模型${duplicates?' · 跳过 '+duplicates+' 个重复项':''}${failures?' · '+failures+' 个文件无法导入（查看导入记录）':''}`,7000);$('files').value='';
}
function serializedModels(){return entries.map(e=>({...e.record,position:(mode==='single'&&selected===e?e.savedWorld.position:e.slot.position).toArray(),yaw:mode==='single'&&selected===e?new T.Euler().setFromQuaternion(e.savedWorld.rotation).y:e.slot.rotation.y,display:e.display,rare:e.rare,blink:e.blink}));}
function exportHtml(){
 const payload={version:1,models:serializedModels(),settings:{...settings},camera:mode==='single'?cameraMemory:cameraSnapshot(),customScene};
 const data=JSON.stringify(payload).replace(/</g,'\\u003c');
 return shell.replace(/(<script id="library-data" type="application\/json">)[\s\S]*?(<\/script>)/,(match,a,b)=>a+data+b);
}
async function loadScene(buffer,name){
 validateGlb(buffer);const gltf=await new GLTFLoader().parseAsync(buffer,'');gltf.scene.updateMatrixWorld(true);const b=new T.Box3().setFromObject(gltf.scene),size=b.getSize(new T.Vector3());
 if(b.isEmpty()||size.length()<=0||!size.toArray().every(Number.isFinite)){disposeTree(gltf.scene);throw Error('场景没有有效几何');}
 if(environment){environment.removeFromParent();disposeTree(environment);}environment=new T.Group();environment.add(gltf.scene);
 const center=b.getCenter(new T.Vector3());gltf.scene.position.sub(new T.Vector3(center.x,b.min.y,center.z));environment.userData.baseSpan=Math.max(size.x,size.z,.01);
 customScene={name,glb:toBase64(buffer)};settings.scene='custom';$('sceneSelect').querySelector('[value="custom"]').hidden=false;rebuildStage();
}

$('importButton').onclick=$('emptyImport').onclick=()=>$('files').click();$('files').onchange=e=>importFiles(e.target.files);
$('saveLibrary').onclick=()=>{try{download(new Blob([exportHtml()],{type:'text/html;charset=utf-8'}),'我的模型游乐场.html');toast('已保存完整模型集合。重新打开下载的 HTML 即可恢复。');}catch(error){toast('保存失败：'+error.message);}};
function changeScene(value){const single=mode==='single'?selected:null;if(single)setMode('playground');settings.scene=value;arrange();cameraMemory=null;frameAll();if(single)setMode('single',single);else refreshUI();}
$('sceneSelect').onchange=$('singleSceneSelect').onchange=e=>changeScene(e.target.value);$('addScene').onclick=()=>$('sceneFile').click();$('sceneFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await loadScene(await file.arrayBuffer(),file.name);arrange(true);toast('场景已加入，将随模型集合一起保存。');}catch(error){toast('场景导入失败：'+error.message);}e.target.value='';};
$('back').onclick=()=>setMode('playground');$('tableToggle').onclick=()=>setMode(mode==='table'?'playground':'table');document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('search').oninput=()=>{renderRoster();if(mode==='table')renderTable();};$('showLog').onclick=()=>$('logDetails').hidden=!$('logDetails').hidden;$('closeLog').onclick=()=>$('logDetails').hidden=true;
$('pauseAll').onclick=()=>{settings.paused=!settings.paused;refreshUI();};$('speed').onchange=e=>settings.speed=Number(e.target.value);
$('randomAll').onclick=()=>{settings.random=!settings.random;if(!settings.random)for(const e of entries)setAction(e,'idle');else for(const a of crowd.agents.values())a.pause=Math.random()*.6;refreshUI();};
$('arrange').onclick=()=>{if(mode==='single'){setAction(selected,'idle');selected.slot.rotation.set(0,0,0);frameSingle(selected);}else{settings.random=settings.scene==='hongkong';arrange();frameAll();}refreshUI();};$('fit').onclick=()=>mode==='single'?frameSingle(selected):frameAll();
$('streetView').onclick=()=>{if(mode!=='playground')setMode('playground');camera.position.set(5,27,43);controls.target.set(0,2.5,-4);controls.update();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>selected&&frameSingle(selected,b.dataset.view));
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(!selected)return;settings.paused=false;if(b.dataset.action==='reset'){setAction(selected,'idle');frameSingle(selected);}else setAction(selected,b.dataset.action);refreshUI();});
$('clip').onchange=e=>{if(selected&&e.target.value){settings.paused=false;setAction(selected,'clip:'+e.target.value);refreshUI();}};
$('singleName').onchange=e=>{if(!selected)return;selected.record.name=e.target.value.trim().slice(0,100)||selected.record.name;e.target.value=selected.record.name;selected.label.textContent=selected.record.name;refreshUI();};
$('autoBlink').onchange=e=>{if(selected){selected.blink=e.target.checked;selected.expr?.setBlinkEnabled(selected.blink);}};
$('globalPhysics').onclick=()=>{settings.physics=!settings.physics;for(const e of entries){e.physicsReset=true;updatePhysics(e,0,settings.physics);}refreshUI();};
$('physicsToggle').onchange=ev=>{if(selected){selected.physicsEnabled=ev.target.checked;selected.record.physicsEnabled=ev.target.checked;selected.physicsReset=true;updatePhysics(selected,0,settings.physics);}};
$('physicsKick').onclick=()=>{if(selected?.physics){selected.physicsEnabled=true;selected.record.physicsEnabled=true;settings.physics=true;$('physicsToggle').checked=true;settings.paused=false;kickPhysics(selected);refreshUI();}};
$('blinkOnce').onclick=()=>{if(selected?.expr){setExpression(selected,'Normal',true);selected.expr.blink();}};
$('randomExpression').onclick=()=>{if(!selected?.expr)return;const choices=Object.keys(expressionNames).filter(name=>name!=='Normal'&&name!==selected.expr.state.expression);settings.paused=false;setExpression(selected,choices[Math.floor(Math.random()*choices.length)]);refreshUI();};
$('rareExpression').onclick=()=>{if(!selected)return;selected.rare=!selected.rare;setExpression(selected,'Normal');syncInspectorState();};
$('showBones').onchange=e=>{if(selected)selected.skeleton.visible=e.target.checked;};$('showGrid').onchange=e=>{settings.grid=e.target.checked;grid.visible=settings.grid;};$('toggleNames').onclick=()=>{settings.labels=!settings.labels;$('toggleNames').classList.toggle('active',settings.labels);};
$('downloadModel').onclick=()=>{if(selected)download(new Blob([fromBase64(selected.record.glb)],{type:'model/gltf-binary'}),selected.record.name.replace(/[<>:"/\\|?*]/g,'_')+'.glb');};
let pointerDown=null;renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY,button:e.button,time:performance.now()};});renderer.domElement.addEventListener('pointerup',e=>{
 if(!pointerDown||pointerDown.button!==0||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5||performance.now()-pointerDown.time>650||mode!=='playground')return;
 const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects([...entries.filter(x=>x.display).map(x=>x.rig),stage],true)[0];if(hit?.object.userData.actor)setMode('single',hit.object.userData.actor);
});
window.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();dragDepth++;$('dropCover').hidden=false;}});window.addEventListener('dragover',e=>{e.preventDefault();});window.addEventListener('dragleave',e=>{e.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('dropCover').hidden=true;});window.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('dropCover').hidden=true;importFiles(e.dataTransfer.files);});
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();});window.addEventListener('error',e=>log('运行错误：'+e.message));window.addEventListener('unhandledrejection',e=>{log('运行错误：'+String(e.reason));toast('遇到问题，请查看导入记录。');});
function draw(now){
 requestAnimationFrame(draw);if(document.hidden){lastFrame=now;return;}const elapsed=(now-lastFrame)/1000,raw=Math.min(elapsed,.05);lastFrame=now;const dt=raw*settings.speed;totalTime+=dt;
 if(elapsed>.2){simulationClock=0;for(const e of entries)e.physicsReset=true;}
 if(mode!=='table'&&!settings.paused){simulationClock+=dt;while(simulationClock>=1/120){simulationClock-=1/120;if(mode==='playground'&&settings.random)updateCrowd(1/120);for(const e of entries){if(mode==='single'?e!==selected:!e.display)continue;updateActor(e,1/120);}}}else simulationClock=0;
 controls.update();if(mode!=='table'){if(settings.scene==='hongkong'&&mode==='playground')renderCalls=blueHourFX.render(scene,camera);else{renderer.render(scene,camera);renderCalls=renderer.info.render.calls;}}
 labelsTime+=raw;if(labelsTime>.1){labelsTime=0;for(const e of entries){e.label.hidden=mode!=='playground'||!e.display||!settings.labels;if(e.label.hidden)continue;v.copy(e.slot.position).add(new T.Vector3(0,4.35,0)).project(camera);e.label.hidden=v.z>1||v.z< -1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1;e.label.style.left=(v.x*.5+.5)*host.clientWidth+'px';e.label.style.top=(-v.y*.5+.5)*host.clientHeight+'px';}if(mode==='single')syncInspectorState();}
 perfFrames++;perfTime+=elapsed;if(perfTime>.8){const fps=perfFrames/perfTime,shown=mode==='single'?[selected]:entries.filter(e=>e.display),active=shown.filter(e=>e.physics&&e.physicsEnabled&&settings.physics).length;$('perf').textContent=`${Math.round(fps)} FPS · ${(1000/fps).toFixed(1)} ms/帧 · ${shown.length} 人 · 物理 ${active}/${shown.length}${settings.paused?' · 已暂停':''}`;$('perf').title=`${renderCalls} 绘制调用；受屏幕刷新率与当前设备限制，比较时保持场景和视角相同`; perfFrames=0;perfTime=0;}
}
resize();rebuildStage();frameAll();refreshUI();requestAnimationFrame(draw);
if(initial.models?.length){loading=true;$('loading').hidden=false;for(const [index,r]of initial.models.entries()){try{$('loading').textContent=`恢复模型集合 ${index+1} / ${initial.models.length}`;await addRecord(r);}catch(error){log('恢复失败：'+(r.name||'模型')+' '+error.message);}}loading=false;$('loading').hidden=true;arrange(true);if(initial.customScene){try{const savedScene=settings.scene;await loadScene(fromBase64(initial.customScene.glb),initial.customScene.name);settings.scene=savedScene;rebuildStage();}catch(error){log('场景恢复失败：'+error.message);settings.scene='garden';rebuildStage();}}refreshUI();initial.camera?restoreCamera(initial.camera):frameAll();}
if(initial.openSingle&&entries.length===1)setMode('single',entries[0]);
// Read-only diagnostics plus the same UI actions are exposed for artifact verification.
async function exportCityGLB(){
 if(!citySet)citySet=createHongKongScene(Math.max(28,worldRadius));const copy=citySet.root.clone(true);copy.traverse(o=>{if(o.userData.webEffect)o.visible=false;});copy.updateMatrixWorld(true);return new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:true,maxTextureSize:1024});
}
window.playground={get entries(){return entries;},get mode(){return mode;},get selected(){return selected;},get city(){return citySet;},crowd,settings,logs,importFiles,exportHtml,exportCityGLB,setMode,setAction,setExpression,updateActor,updatePhysics,kickPhysics,frameAll,renderer,camera,controls,scene,ready:true};
