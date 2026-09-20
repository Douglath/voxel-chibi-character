import * as THREE from 'three';
export function setupMotionDemo(rig,hair,canvas,controls,isPaused){
 let running=false,dragModel=false,dragging=false,lastX=0,lastY=0,yaw=0,pitch=0,time=0;
 const nodes=new Map();rig.traverse(o=>{if(o.isBone)nodes.set(o.name,o);});
 const affected=['thigh.L','thigh.R','shin.L','shin.R','upper_arm.L','upper_arm.R','forearm.L','forearm.R'];
 // GLTFLoader sanitizes periods from node names for animation binding.
 for(const name of affected){const bone=nodes.get(name)||nodes.get(name.replaceAll('.',''));if(!bone)throw Error('Missing motion bone: '+name);nodes.set(name,bone);}
 const nav=document.createElement('nav');nav.innerHTML='<button id="runDemo">开启原地跑动</button><button id="dragMode">鼠标：旋转镜头</button><button id="motionReset">朝向归零</button>';
 document.getElementById('hairStatus').before(nav);
 const hint=document.createElement('p');hint.style.cssText='font-size:12px;text-align:center;color:#a9bed3;margin:4px 12px';hint.textContent='默认拖动环绕镜头，可查看头顶与足底；切换拖动角色后测试甩动。原地跑动不是完整步行动画。';nav.after(hint);
 controls.enableRotate=true;controls.minPolarAngle=.001;controls.maxPolarAngle=Math.PI-.001;canvas.style.touchAction='none';hair.strength=1.6;
 function stop(){running=false;for(const name of affected)nodes.get(name).quaternion.identity();rig.position.y=0;document.getElementById('runDemo').textContent='开启原地跑动';}
 document.getElementById('runDemo').onclick=()=>{if(running)stop();else{running=true;document.getElementById('runDemo').textContent='停止原地跑动';}};
 document.getElementById('dragMode').onclick=()=>{dragModel=!dragModel;controls.enableRotate=!dragModel;document.getElementById('dragMode').textContent=dragModel?'鼠标：拖动角色':'鼠标：旋转镜头';};
 document.getElementById('motionReset').onclick=()=>{yaw=0;pitch=0;rig.rotation.set(0,0,0);hair.reset();};
 canvas.addEventListener('pointerdown',e=>{if(!dragModel||e.button!==0||isPaused())return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!dragging||isPaused())return;yaw+=(e.clientX-lastX)*.015;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.004,-.25,.25);lastX=e.clientX;lastY=e.clientY;});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>dragging=false);
 for(const button of document.querySelectorAll('[data-clip],#bind'))button.addEventListener('click',stop);
 return {stop,update(dt){
  time+=dt;const wanted=yaw+(running?.20*Math.sin(time*5):0);
  rig.rotation.y+=THREE.MathUtils.clamp(wanted-rig.rotation.y,-4*dt,4*dt);rig.rotation.x+=THREE.MathUtils.clamp(pitch-rig.rotation.x,-dt,dt);
  if(running){const phase=time*10;rig.position.y=.055*(1-Math.cos(phase*2));for(const [side,sign]of [['L',1],['R',-1]]){
   nodes.get('thigh.'+side).rotation.x=sign*.45*Math.sin(phase);nodes.get('shin.'+side).rotation.x=.5*Math.max(0,sign*Math.sin(phase));
   nodes.get('upper_arm.'+side).rotation.set(-sign*.45*Math.sin(phase),0,-sign*.72);nodes.get('forearm.'+side).rotation.y=-sign*.55;
  }}
 }};
}
