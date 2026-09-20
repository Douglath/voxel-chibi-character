import * as T from '../three/build/three.module.js';
const rear=new T.Vector3(0,0,-1);
// Local angular springs with world gravity; root position is always owned by hips.
export class TailDynamics {
 constructor(rig){
  this.rig=rig;this.bones=[1,2,3].map(i=>rig.getObjectByName('tail_'+i));
  if(this.bones.some(b=>!b))throw Error('Tail requires three connected bones');
  this.lengths=[.255,.425,.425];this.angles=[0,0,0];this.vel=[0,0,0];this.yaw=[0,0,0];this.yawVel=[0,0,0];
  this.prev=new T.Vector3();this.prevVel=new T.Vector3();this.lastQ=new T.Quaternion();this.acc=0;this.contacts=0;this.reset(true);
 }
 reset(settled=true){this.angles.fill(0);this.vel.fill(0);this.yaw.fill(0);this.yawVel.fill(0);this.acc=0;this.apply();if(settled)for(let i=0;i<960;i++)this.step(1/120,0,0);this.apply();this.prev.copy(this.bones[0].getWorldPosition(new T.Vector3()));this.prevVel.set(0,0,0);this.lastQ.copy(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()));}
 kick(){this.yawVel[1]+=.9;this.vel[2]-=.9;}
 step(h,vertical,yawForce){
  const stiffness=[180,17,32],damping=[20,6,7],rest=[0,0,-.85],gravity=[22,36,13],limits=[[-.08,.30],[0,1.45],[-1.05,.25]];
  const parentGravity=new T.Vector3(0,-1,0).applyQuaternion(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()).invert());let total=0;
  for(let i=0;i<3;i++){
   total+=this.angles[i];const torque=gravity[i]*(-parentGravity.y*Math.cos(total)+parentGravity.z*Math.sin(total));
   this.vel[i]+=(torque-stiffness[i]*(this.angles[i]-rest[i])-damping[i]*this.vel[i]+vertical*[.1,.55,.8][i])*h;
   this.angles[i]+=this.vel[i]*h;const clipped=T.MathUtils.clamp(this.angles[i],...limits[i]);if(clipped!==this.angles[i])this.vel[i]=0;this.angles[i]=clipped;
   this.yawVel[i]+=(-[140,45,28][i]*this.yaw[i]-[18,9,7][i]*this.yawVel[i]+yawForce*[.1,.7,1][i])*h;
   this.yaw[i]+=this.yawVel[i]*h;const max=[.06,.2,.25][i];if(Math.abs(this.yaw[i])>max){this.yaw[i]=T.MathUtils.clamp(this.yaw[i],-max,max);this.yawVel[i]=0;}
  }
 }
 apply(){
  for(let i=0;i<3;i++){this.bones[i].rotation.set(-this.angles[i],this.yaw[i],0,'YXZ');this.bones[i].updateWorldMatrix(true,true);}
  this.points=this.bones.map(b=>b.getWorldPosition(new T.Vector3()));this.points.push(rear.clone().multiplyScalar(this.lengths[2]).applyMatrix4(this.bones[2].matrixWorld));
  // Sample free segments against pelvis / moving leg capsules. Never translate the root.
  // Corrections raise a colliding segment back towards the rearward bind direction.
  if(this.clearance()<0){for(let attempt=0;attempt<12&&this.clearance()<0;attempt++){
   this.angles[1]=Math.max(0,this.angles[1]-.08);this.vel[1]=Math.min(0,this.vel[1]);this.yaw[1]*=.8;this.yaw[2]*=.8;this.contacts++;
   for(let i=0;i<3;i++){this.bones[i].rotation.set(-this.angles[i],this.yaw[i],0,'YXZ');this.bones[i].updateWorldMatrix(true,true);}
   this.points=this.bones.map(b=>b.getWorldPosition(new T.Vector3()));this.points.push(rear.clone().multiplyScalar(this.lengths[2]).applyMatrix4(this.bones[2].matrixWorld));
  }}
 }
 clearance(){
  const parent=this.bones[0].parent;parent.updateWorldMatrix(true,false);const hips=parent.getWorldPosition(new T.Vector3());
  const capsules=[{a:hips,b:hips.clone().add(new T.Vector3(0,.12,0)),r:.23}];
  for(const side of ['L','R']){const nodes=['thigh','shin','foot'].map(n=>this.rig.getObjectByName(n+side)||this.rig.getObjectByName(n+'.'+side));for(let i=0;i<2;i++){nodes[i].updateWorldMatrix(true,false);nodes[i+1].updateWorldMatrix(true,false);capsules.push({a:nodes[i].getWorldPosition(new T.Vector3()),b:nodes[i+1].getWorldPosition(new T.Vector3()),r:.13});}}
  let minimum=Infinity;for(let segment=1;segment<3;segment++)for(const t of [.25,.5,.75,1]){const p=this.points[segment].clone().lerp(this.points[segment+1],t),radius=segment===1?.17:.12;
   for(const c of capsules){const ab=c.b.clone().sub(c.a),q=c.a.clone().addScaledVector(ab,T.MathUtils.clamp(p.clone().sub(c.a).dot(ab)/Math.max(ab.lengthSq(),1e-8),0,1));minimum=Math.min(minimum,p.distanceTo(q)-c.r-radius);}
  }return minimum;
 }
 update(dt){
  if(dt>.2){this.reset(true);return;}if(dt<=0)return;
  this.rig.updateMatrixWorld(true);const pos=this.bones[0].getWorldPosition(new T.Vector3()),q=this.bones[0].parent.getWorldQuaternion(new T.Quaternion());
  const velocity=pos.clone().sub(this.prev).divideScalar(dt),acceleration=velocity.clone().sub(this.prevVel).divideScalar(dt);
  if(pos.distanceTo(this.prev)>1){this.reset(true);return;}
  const dq=this.lastQ.clone().invert().multiply(q),yawRate=2*Math.atan2(dq.y,dq.w)/dt;
  this.prev.copy(pos);this.prevVel.copy(velocity);this.lastQ.copy(q);
  this.acc+=Math.min(dt,.05);while(this.acc>=1/120){this.acc-=1/120;this.step(1/120,T.MathUtils.clamp(acceleration.y,-15,15),T.MathUtils.clamp(yawRate*4,-12,12));}this.apply();
 }
}
