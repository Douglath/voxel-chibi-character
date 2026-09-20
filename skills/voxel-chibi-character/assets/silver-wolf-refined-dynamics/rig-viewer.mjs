import {setupExpressionUI} from './expressions.mjs';
import {palette} from './model.mjs';
import {setupDropDemo} from './drop-demo.mjs';
import {setupMotionDemo} from './motion-demo.mjs';
import {HairPhysics} from './hair-physics.mjs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('#111d2b');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const host=document.getElementById('view');host.appendChild(renderer.domElement);
const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,100);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.autoRotateSpeed=1.3;
scene.add(new THREE.HemisphereLight(0xffffff,0x6982a3,2));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-3,8,6);scene.add(sun);
const directions={front:[0,0,10],side:[10,0,0],back:[0,0,-10],three:[7,3,10]};let center=new THREE.Vector3(0,2,0),height=5;
function frame(aspect){const h=height*Math.max(1,0.85/aspect);camera.left=-h*aspect/2;camera.right=h*aspect/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();}
function resize(){renderer.setSize(host.clientWidth,host.clientHeight,false);frame(host.clientWidth/host.clientHeight);}new ResizeObserver(()=>requestAnimationFrame(resize)).observe(host);
function view(name){camera.position.copy(center).add(new THREE.Vector3(...directions[name]));camera.lookAt(center);controls.target.copy(center);controls.update();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{controls.autoRotate=false;document.getElementById('rotate').textContent='自动旋转';view(b.dataset.view);});document.getElementById('rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;document.getElementById('rotate').textContent=controls.autoRotate?'停止旋转':'自动旋转';};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
let expression,followCamera,drop,physicsClock=0,motion,hair,hairDemo=false,hairTime=0,hairSaved=false,mixer,action,rig,meshes=[],skeleton,paused=false,frames=0,loops=0,report,saved=false,previous=performance.now();
function sample(){rig.updateMatrixWorld(true);return meshes.flatMap(m=>{m.skeleton.update();return Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld).toArray());});}
function delta(a,b){return Math.max(...a.map((p,i)=>new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...b[i]))));}
async function save(){await fetch('/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report})});}
try{
 const gltf=await new GLTFLoader().loadAsync('./silver-wolf-rigged.glb');rig=gltf.scene;scene.add(rig);rig.traverse(o=>{if(o.isSkinnedMesh){meshes.push(o);o.frustumCulled=false;}});const box=new THREE.Box3().setFromObject(gltf.scene);box.getCenter(center);height=box.getSize(new THREE.Vector3()).y*1.2;
 let triangles=0,meshCount=0,finite=true;gltf.scene.traverse(o=>{if(o.isMesh){meshCount++;triangles+=o.geometry.index.count/3;finite&&=Array.from(o.geometry.attributes.position.array).every(Number.isFinite);}});
 const images={};renderer.setPixelRatio(1);renderer.setSize(720,800,false);frame(720/800);
 for(const name of ['front','side','back','three']){view(name);renderer.render(scene,camera);images[name]=renderer.domElement.toDataURL('image/png');}
 const bind=sample();
 const original=await new GLTFLoader().loadAsync('./silver-wolf.glb');original.scene.updateMatrixWorld(true);const rest=[];original.scene.traverse(o=>{if(o.isMesh)for(let i=0;i<o.geometry.attributes.position.count;i++)rest.push(new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrixWorld).toArray());});
 mixer=new THREE.AnimationMixer(rig);mixer.addEventListener('loop',()=>loops++);
 // Sleeve/arm containment must hold in animated poses, not merely in T-pose.
 const sleeveFixtures=['L','R'].map(side=>{
  const arm=meshes.find(m=>m.name==='Arm_'+side),sleeve=meshes.find(m=>m.name==='Sleeve_'+side),p=arm.geometry.attributes.position;
  const rootX=Math.min(...Array.from({length:p.count},(_,i)=>Math.abs(p.getX(i))));
  const indices=Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(Math.abs(p.getX(i))-rootX)<1e-5);
  const bone=arm.skeleton.bones[arm.geometry.attributes.skinIndex.getX(indices[0])],inverse=bone.matrixWorld.clone().invert(),box=new THREE.Box3();
  for(let i=0;i<sleeve.geometry.attributes.position.count;i++)box.expandByPoint(sleeve.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(sleeve.matrixWorld).applyMatrix4(inverse));
  return {side,arm,bone,indices,box};
 });
 let sleeveSamples=0,minSleeveClearance=Infinity;
 function checkSleeves(){sample();for(const f of sleeveFixtures){const inverse=f.bone.matrixWorld.clone().invert();for(const i of f.indices){const p=f.arm.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(f.arm.matrixWorld).applyMatrix4(inverse);minSleeveClearance=Math.min(minSleeveClearance,p.x-f.box.min.x,f.box.max.x-p.x,p.y-f.box.min.y,f.box.max.y-p.y,p.z-f.box.min.z,f.box.max.z-p.z);}}sleeveSamples++;}
 const checks=[];
 for(const clip of gltf.animations){mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().play();mixer.setTime(0);const base=sample();mixer.setTime(.5);const pose=sample();mixer.setTime(clip.duration);const end=sample();mixer.setTime(0);for(let i=0;i<Math.round(clip.duration*600);i++)mixer.update(1/60);const cycles=sample();action.paused=true;const before=sample();mixer.update(.3);const pauseError=delta(before,sample());action.paused=false;mixer.update(.5);checks.push({clip:clip.name,displacement:delta(base,pose),loopError:delta(base,end),tenCyclesError:delta(base,cycles),pauseError,resumeDelta:delta(before,sample()),finite:pose.flat().every(Number.isFinite)});}
 report={loadedFrom:'silver-wolf-rigged.glb',threeRevision:THREE.REVISION,triangles,meshCount,bones:meshes[0].skeleton.bones.length,animations:gltf.animations.map(a=>a.name),bindPoseError:delta(bind,rest),checks,webglError:renderer.getContext().getError(),errors};report.numericPass=report.bindPoseError<1e-5&&checks.every(c=>c.finite&&c.displacement>1e-4&&c.loopError<1e-5&&c.tenCyclesError<1e-5&&c.pauseError<1e-7&&c.resumeDelta>1e-4)&&report.webglError===0;
 for(const clip of gltf.animations){mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().play();for(let i=0;i<=48;i++){mixer.setTime(clip.duration*i/48);checkSleeves();}}
 mixer.stopAllAction();
 const restRotations=sleeveFixtures.map(f=>f.bone.quaternion.clone());
 for(const degrees of [-90,-60,-45,0,45,60,90]){sleeveFixtures.forEach((f,i)=>f.bone.quaternion.copy(restRotations[i]).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),degrees*Math.PI/180*(i===0?1:-1))));checkSleeves();}
 sleeveFixtures.forEach((f,i)=>f.bone.quaternion.copy(restRotations[i]));
 report.sleeveCoverage={samples:sleeveSamples,minClearance:minSleeveClearance,pass:minSleeveClearance>1e-4,scope:'Both upper-arm root caps inside sleeves: both clips + mirrored shoulder rotations -90..90 degrees; not full garment collision testing'};
 report.numericPass=report.numericPass&&report.sleeveCoverage.pass;
 mixer.stopAllAction();action=mixer.clipAction(gltf.animations.find(a=>a.name==='Rig_Test'));action.reset().play();mixer.setTime(.5);sample();view('three');renderer.render(scene,camera);images.three=renderer.domElement.toDataURL('image/png');mixer.setTime(0);loops=0;
 skeleton=new THREE.SkeletonHelper(rig);skeleton.visible=false;scene.add(skeleton);
 document.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>{mixer.stopAllAction();action=mixer.clipAction(gltf.animations.find(c=>c.name===b.dataset.clip));action.reset().play();paused=false;});
 document.getElementById('bind').onclick=()=>{mixer.stopAllAction();paused=true;};
 document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'播放':'暂停';};
 document.getElementById('bones').onclick=()=>{skeleton.visible=!skeleton.visible;document.getElementById('bones').textContent=skeleton.visible?'隐藏骨骼':'显示骨骼';};
 mixer.stopAllAction();action=mixer.clipAction(gltf.animations.find(c=>c.name==='Idle'));action.reset().play();mixer.setTime(0);for(const name of ['front','side','back','three']){view(name);renderer.render(scene,camera);images[name]=renderer.domElement.toDataURL('image/png');}
 const response=await fetch('/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,report})});if(!response.ok)throw Error('Could not save verification');
 document.getElementById('status').textContent=`${triangles.toLocaleString()} 个三角面 · 43 根骨骼 · 正在验证实时播放`;
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));resize();view('three');
 hair=new HairPhysics(rig);scene.add(hair.helpers);
 const clothButton=document.createElement('button');clothButton.textContent='关闭衣摆袖口动态';clothButton.id='clothToggle';document.getElementById('proxies').after(clothButton);clothButton.onclick=()=>{hair.clothEnabled=!hair.clothEnabled;clothButton.textContent=hair.clothEnabled?'关闭衣摆袖口动态':'开启衣摆袖口动态';};motion=setupMotionDemo(rig,hair,renderer.domElement,controls,()=>paused);
 const normalCenter=center.clone(),normalHeight=height;const ground=new THREE.GridHelper(6,6,0x7da1be,0x304859);ground.visible=false;scene.add(ground);
 followCamera=()=>{if(drop?.testing&&drop.follow){const wanted=normalCenter.clone().add(rig.position),shift=wanted.clone().sub(center);camera.position.add(shift);center.copy(wanted);controls.target.copy(center);}};
 drop=setupDropDemo(rig,hair,motion,{resume:()=>{paused=false;physicsClock=0;document.getElementById('pause').textContent='暂停';mixer.stopAllAction();action=mixer.clipAction(gltf.animations.find(c=>c.name==='Idle'));action.reset().play();},frame:(h,follow=false)=>{ground.visible=h>0;center.copy(normalCenter);if(h>0)center.y+=follow?rig.position.y:h*.5;height=h>0&&!follow?normalHeight+h*1.12:normalHeight;resize();view('three');}});

 document.getElementById('hairToggle').onclick=()=>{hair.enabled=!hair.enabled;hair.reset();document.getElementById('hairToggle').textContent=hair.enabled?'关闭全部附加动态':'开启全部附加动态';};
 document.getElementById('turnDemo').onclick=()=>{hairDemo=!hairDemo;document.getElementById('turnDemo').textContent=hairDemo?'停止转头演示':'开启转头演示';};
 document.getElementById('hairKick').onclick=()=>hair.kick();
 const tailButton=document.createElement('button');tailButton.id='tailDrop';tailButton.textContent='尾巴重置落下';document.getElementById('hairKick').after(tailButton);
 tailButton.onclick=()=>{paused=false;document.getElementById('pause').textContent='暂停';hair.enabled=true;document.getElementById('hairToggle').textContent='关闭全部附加动态';hair.tail.reset(false);};

 document.getElementById('proxies').onclick=()=>{hair.helpers.visible=!hair.helpers.visible;};
 const oldBind=document.getElementById('bind').onclick;document.getElementById('bind').onclick=()=>{oldBind();hair.reset(false);};
 mixer.stopAllAction();action=mixer.clipAction(gltf.animations.find(c=>c.name==='Idle'));action.reset().play();loops=0;
 mixer.setTime(0);hair.reset();for(const name of ['front','side','back','three']){view(name);renderer.render(scene,camera);images[name]=renderer.domElement.toDataURL('image/png');}await fetch('/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,report})});view('three');


expression=setupExpressionUI(rig,palette);
}catch(e){document.getElementById('status').textContent=String(e);console.error(e);}
renderer.setAnimationLoop(()=>{
 const now=performance.now(),raw=(now-previous)/1000;previous=now;
 if(raw>.2&&hair){hair.reset();physicsClock=0;}
 if(hair&&!paused){physicsClock+=Math.min(raw,.05)*(drop?.testing&&drop.slow?.25:1);while(physicsClock>=1/120){physicsClock-=1/120;const dt=1/120;mixer.update(dt);hairTime+=dt;frames++;
  if(hairDemo)rig.getObjectByName('head').quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),.55*Math.sin(hairTime*2));
  if(drop?.active)drop.update(dt);else motion?.update(dt);hair.update(dt);
 }
 drop?.renderStatus();document.getElementById('hairStatus').textContent='附加动态 '+(hair.enabled?'开启':'关闭')+' · 转头 '+(hairDemo?'演示中':'跟随原动画');
 if(hairTime>12&&!hairSaved){hairSaved=true;fetch('/hair-evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(hair.metrics)});}
 }
 if(expression&&!paused)expression.update(Math.min(raw,.05));
 followCamera?.();controls.update();renderer.render(scene,camera);
 if(report&&!saved&&loops>=3){saved=true;report.live={frames,loops,drawCalls:renderer.info.render.calls,activeParticles:hair.chains.reduce((n,c)=>n+c.p.length-1,0)+3,webglError:renderer.getContext().getError()};report.pass=report.numericPass&&report.live.webglError===0&&errors.length===0;save();document.getElementById('status').textContent=report.pass?'通过 · 43 根骨骼 · 待机 / 关节测试 · T-pose 绑定姿势':'检查未通过';}
});

window.characterDebug=()=>({rig,hair,motion,drop,renderer,report,paused,loops});
