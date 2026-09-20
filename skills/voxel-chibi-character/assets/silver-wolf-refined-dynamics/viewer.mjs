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
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);frame(host.clientWidth/host.clientHeight);}new ResizeObserver(resize).observe(host);
function view(name){camera.position.copy(center).add(new THREE.Vector3(...directions[name]));camera.lookAt(center);controls.target.copy(center);controls.update();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{controls.autoRotate=false;document.getElementById('rotate').textContent='自动旋转';view(b.dataset.view);});document.getElementById('rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;document.getElementById('rotate').textContent=controls.autoRotate?'停止旋转':'自动旋转';};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
try{
 const gltf=await new GLTFLoader().loadAsync('./silver-wolf.glb');scene.add(gltf.scene);const box=new THREE.Box3().setFromObject(gltf.scene);box.getCenter(center);height=box.getSize(new THREE.Vector3()).y*1.2;
 let triangles=0,meshCount=0,finite=true;gltf.scene.traverse(o=>{if(o.isMesh){meshCount++;triangles+=o.geometry.index.count/3;finite&&=Array.from(o.geometry.attributes.position.array).every(Number.isFinite);}});
 const images={};renderer.setPixelRatio(1);renderer.setSize(720,800,false);frame(720/800);
 for(const name of ['front','side','back','three']){view(name);renderer.render(scene,camera);images[name]=renderer.domElement.toDataURL('image/png');}
 const report={loadedFrom:'silver-wolf.glb',threeRevision:THREE.REVISION,triangles,meshCount,animations:gltf.animations.length,finite,bounds:{min:box.min.toArray(),max:box.max.toArray()},webglError:renderer.getContext().getError(),errors};report.pass=triangles>0&&triangles<5000&&finite&&Math.abs(box.min.y)<1e-5&&report.webglError===0;
 const response=await fetch('/evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,report})});if(!response.ok)throw Error('Could not save verification');
 document.getElementById('status').textContent=`${triangles.toLocaleString()} 个三角面 · 静态模型 · 拖动旋转，滚轮缩放`;
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));resize();view('three');
}catch(e){document.getElementById('status').textContent=String(e);console.error(e);}
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
