// Shared deterministic motion for both the viewer and actual-GLB tests.
export const DROP_GRAVITY=18;
export function dropPose(time,height=6,jump=false){
 const release=.55,v0=jump?3:0,flight=(v0+Math.sqrt(v0*v0+2*DROP_GRAVITY*height))/DROP_GRAVITY;
 const t=Math.max(0,time-release),air=t<flight;
 return {y:time<release?height:air?height+v0*t-.5*DROP_GRAVITY*t*t:0,
  velocity:time<release?0:air?v0-DROP_GRAVITY*t:0,
  phase:time<release?'准备':air?(v0-DROP_GRAVITY*t>0?'上升':'下落'):t-flight<4?'落地回弹':'完成',
  impactSpeed:Math.sqrt(v0*v0+2*DROP_GRAVITY*height),landed:time>=release+flight,done:time>=release+flight+4};
}
export class DropMotion{
 constructor(rig,hair){this.rig=rig;this.hair=hair;this.active=false;this.testing=false;this.time=0;this.state=dropPose(0);}
 start(height=6,jump=false){this.height=height;this.jump=jump;this.time=0;this.active=true;this.testing=true;this.rig.position.set(0,height,0);this.rig.rotation.set(0,0,0);this.rig.updateMatrixWorld(true);this.hair.reset();this.state=dropPose(0,height,jump);}
 update(dt){if(!this.active)return;this.time+=dt;this.state=dropPose(this.time,this.height,this.jump);this.rig.position.y=this.state.y;if(this.state.done)this.active=false;}
 stop(){this.active=false;this.testing=false;this.time=0;this.state=dropPose(0);this.rig.position.set(0,0,0);this.rig.rotation.set(0,0,0);this.hair.reset();}
}
export function setupDropDemo(rig,hair,motion,{resume,frame}){
 const drop=new DropMotion(rig,hair),nav=document.createElement('nav');
 nav.innerHTML='<label>掉落高度 <select id="dropHeight"><option value="3">低</option><option value="6" selected>中</option><option value="10">高</option></select></label><button id="dropStart">高处掉落</button><button id="jumpStart">跳下测试</button><button id="dropSlow">慢放：关</button><button id="dropFollow">近看跟随：关</button><button id="dropStop">结束掉落测试</button>';
 document.getElementById('hairStatus').before(nav);const status=document.createElement('p');status.id='dropStatus';status.style.cssText='text-align:center;color:#b4cce0;font-size:12px;margin:6px';status.textContent='真实向下加速，落地直接制动；用于观察附加动态，不是完整落地动作。';nav.after(status);
 drop.follow=false;drop.slow=false;const begin=jump=>{motion.stop();resume();hair.enabled=true;document.getElementById('hairToggle').textContent='关闭全部附加动态';const h=Number(document.getElementById('dropHeight').value);drop.start(h,jump);frame(h,drop.follow);};
 document.getElementById('dropStart').onclick=()=>begin(false);document.getElementById('jumpStart').onclick=()=>begin(true);
 document.getElementById('dropSlow').onclick=e=>{drop.slow=!drop.slow;e.target.textContent='慢放：'+(drop.slow?'¼ 速度':'关');};
 document.getElementById('dropFollow').onclick=e=>{drop.follow=!drop.follow;e.target.textContent='近看跟随：'+(drop.follow?'开':'关');if(drop.testing)frame(drop.height,drop.follow);};
 const stop=()=>{drop.stop();frame(0);status.textContent='测试已结束，已恢复待机。';};document.getElementById('dropStop').onclick=stop;
 for(const b of document.querySelectorAll('[data-clip],#bind,#runDemo,#motionReset'))b.addEventListener('click',()=>{if(drop.active||drop.state.done)stop();});
 drop.renderStatus=()=>{if(drop.time>0)status.textContent=`${drop.state.phase} · 高度 ${drop.state.y.toFixed(2)} · 竖直速度 ${drop.state.velocity.toFixed(2)} · ${drop.slow?'¼ 速度':'正常速度'}（模型单位）`;};
 return drop;
}
