import * as T from 'three';
export function validateStandardPhysics(raw){
 if(raw==null)return null;
 if(raw.version!==1||!Array.isArray(raw.bones)||raw.bones.length>128)throw Error('标准动态参数版本或骨骼数量无效');
 const names=new Set();return {version:1,bones:raw.bones.map(d=>{
  if(typeof d.name!=='string'||!d.name||d.name.length>120||names.has(d.name))throw Error('标准动态骨骼名无效或重复');names.add(d.name);
  for(const [k,min,max]of [['stiffness',10,400],['damping',2,60],['maxAngle',.005,.6]])if(!Number.isFinite(d[k])||d[k]<min||d[k]>max)throw Error('标准动态参数越界：'+k);
  const out={name:d.name,stiffness:d.stiffness,damping:d.damping,maxAngle:d.maxAngle};
  if(d.axis){if(!Array.isArray(d.axis)||d.axis.length!==3||!d.axis.every(Number.isFinite)||Math.hypot(...d.axis)<.001)throw Error('标准动态轴无效');out.axis=new T.Vector3(...d.axis).normalize().toArray();}return out;
 })};
}
// Versioned data-only secondary motion. Bounded angular springs, not mesh collision.
export class StandardPhysics{
 constructor(rig,config){this.rig=rig;this.enabled=true;this.metrics={steps:0,finite:true,maxAngle:0};
  this.states=config.bones.map(d=>{const bone=rig.getObjectByName(d.name)||rig.getObjectByName(d.name.replace(/[\[\].:/]/g,''));if(!bone?.isBone)throw Error('标准动态找不到骨骼：'+d.name);return {...d,bone,rest:bone.quaternion.clone(),angle:new T.Vector3(),velocity:new T.Vector3(),position:new T.Vector3(),rotation:new T.Quaternion()};});this.reset();}
 reset(){for(const s of this.states){s.bone.quaternion.copy(s.rest);s.angle.set(0,0,0);s.velocity.set(0,0,0);}this.rig.updateMatrixWorld(true);for(const s of this.states){s.bone.parent.getWorldPosition(s.position);s.bone.parent.getWorldQuaternion(s.rotation);}}
 kick(){for(const s of this.states){const v=new T.Vector3(.55,.18,.25);if(s.axis){const a=new T.Vector3(...s.axis);v.copy(a.multiplyScalar(v.dot(a)));}s.velocity.add(v);}}
 update(dt){if(!this.enabled||dt<=0)return;if(dt>.2){this.reset();return;}this.rig.updateMatrixWorld(true);
  for(const s of this.states){const parent=s.bone.parent,p=parent.getWorldPosition(new T.Vector3()),q=parent.getWorldQuaternion(new T.Quaternion());const v=p.clone().sub(s.position).divideScalar(dt).applyQuaternion(q.clone().invert()).clampLength(0,12);const dq=s.rotation.clone().invert().multiply(q),angular=new T.Euler().setFromQuaternion(dq);const target=new T.Vector3(-v.z*.035,-angular.y/dt*.018,v.x*.035).clampLength(0,s.maxAngle);
   if(s.axis){const a=new T.Vector3(...s.axis);target.copy(a.multiplyScalar(target.dot(a)));}
   s.velocity.addScaledVector(target.sub(s.angle),s.stiffness*dt).multiplyScalar(Math.exp(-s.damping*dt));s.angle.addScaledVector(s.velocity,dt).clampLength(0,s.maxAngle);
   s.bone.quaternion.copy(s.rest).multiply(new T.Quaternion().setFromEuler(new T.Euler(s.angle.x,s.angle.y,s.angle.z)));s.position.copy(p);s.rotation.copy(q);s.bone.updateWorldMatrix(false,true);this.metrics.maxAngle=Math.max(this.metrics.maxAngle,s.angle.length());this.metrics.finite&&=s.bone.quaternion.toArray().every(Number.isFinite);
  }this.metrics.steps++;
 }
}
