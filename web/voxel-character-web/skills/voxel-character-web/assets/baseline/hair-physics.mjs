import {TailDynamics} from './tail-dynamics.mjs';
import * as THREE from '../three/build/three.module.js';
const down=new THREE.Vector3(0,-1,0);
export class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=['L','R'].map(s=>({bones:[rig.getObjectByName('hair_'+s+'_1'),rig.getObjectByName('hair_'+s+'_2')],stiffness:s==='L'?62:68,damping:s==='L'?11:12,maxAngle:.24,category:'rear hair'}));
  this.tail=new TailDynamics(rig);
  for(const s of ['L','R'])this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:130,damping:19,maxAngle:.08,length:.72,cloth:true,collision:false});
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side+'_1'),rig.getObjectByName('side_hair_'+side+'_2')],stiffness:165,damping:22,maxAngle:.075,length:.40,collision:false,category:'face-side hair'});
   this.chains.push({bones:[rig.getObjectByName('outer_hair_'+side)],stiffness:95,damping:15,maxAngle:.12,length:.75,collision:false,category:'outer hair'});
   this.chains.push({bones:[rig.getObjectByName('ear_'+side)],axis:new THREE.Vector3(0,1,0),stiffness:290,damping:30,maxAngle:.025,length:.50,collision:false,category:'rigid ears'});
   this.chains.push({bones:[rig.getObjectByName('sleeve_soft_'+side)],stiffness:125,damping:19,maxAngle:.075,length:.25,cloth:true,collision:false,category:'sleeve lower edge'});
   this.chains.push({bones:[rig.getObjectByName('coat_back_'+side)],stiffness:155,damping:21,maxAngle:.06,length:.72,cloth:true,collision:false,category:'rear coat'});
  }
  this.chains.push({bones:[rig.getObjectByName('chest_ribbon_1'),rig.getObjectByName('chest_ribbon_2')],stiffness:105,damping:17,maxAngle:.14,length:.34,collision:false,planar:true,category:'chest ribbon'});
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Rear hair endpoint torso collisions; bounded tail and coat springs, not full mesh collision'};this.reset();
 }
 reset(tailSettled=true){this.tail.reset(tailSettled);for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){this.tail.kick();for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.tail.update(dt);this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
  while(this.acc>=h){this.acc-=h;this.rig.updateMatrixWorld(true);
   for(const c of this.chains){const target=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.p[0].copy(target[0]);
    for(let i=1;i<c.p.length;i++){const before=c.p[i].clone();c.v[i].addScaledVector(target[i].clone().sub(c.p[i]),(c.stiffness??(48/this.strength))*h).multiplyScalar(Math.exp(-(c.damping??(8/Math.sqrt(this.strength)))*h));c.p[i].addScaledVector(c.v[i],h);
     for(let k=0;k<12;k++){const direction=c.p[i].clone().sub(c.p[i-1]).normalize();const restDir=target[i].clone().sub(target[i-1]).normalize();
      if(c.maxAngle){const turn=new THREE.Quaternion().setFromUnitVectors(restDir,direction),angle=turn.angleTo(new THREE.Quaternion());if(angle>c.maxAngle)turn.slerp(new THREE.Quaternion(),1-c.maxAngle/angle);direction.copy(restDir).applyQuaternion(turn);}
      c.p[i].copy(c.p[i-1]).addScaledVector(direction,c.lengths[i-1]);const hit=this.clearance(c.p[i]);if(c.collision!==false&&hit.d<0){const outward=c.p[i].clone().sub(hit.q);if(outward.lengthSq()<1e-10)outward.set(0,0,-1);c.p[i].copy(hit.q).addScaledVector(outward.normalize(),this.capsule.radius);}}
     c.v[i].copy(c.p[i]).sub(before).divideScalar(h);
     this.metrics.maxLag=Math.max(this.metrics.maxLag,c.p[i].distanceTo(target[i]));this.metrics.maxLengthError=Math.max(this.metrics.maxLengthError,Math.abs(c.p[i].distanceTo(c.p[i-1])-c.lengths[i-1]));if(c.collision!==false)this.metrics.minProxyClearance=Math.min(this.metrics.minProxyClearance,this.clearance(c.p[i]).d);this.metrics.finite&&=c.p[i].toArray().every(Number.isFinite);
    }
   }this.metrics.steps++;
  }
  for(const c of this.chains)for(let i=0;i<c.bones.length;i++){const b=c.bones[i],previousRotation=b.quaternion.clone();if(c.cloth&&!this.clothEnabled){b.quaternion.identity();continue;}b.parent.updateWorldMatrix(true,false);const inverse=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),dir=c.p[i+1].clone().sub(c.p[i]).normalize().applyQuaternion(inverse);const restAxis=i<c.bones.length-1?c.bones[i+1].position.clone().normalize():(c.axis??down);b.quaternion.setFromUnitVectors(restAxis,dir);if(c.maxAngle){const angle=b.quaternion.angleTo(new THREE.Quaternion());if(angle>c.maxAngle)b.quaternion.slerp(new THREE.Quaternion(),1-c.maxAngle/angle);}if(c.planar){b.rotation.set(0,0,THREE.MathUtils.clamp(Math.atan2(dir.x,-dir.y),-c.maxAngle,c.maxAngle));}if(c.chestAccessory){b.rotation.x=Math.min(0,b.rotation.x);b.rotation.y=0;}const desired=b.quaternion.clone();b.quaternion.copy(previousRotation).rotateTowards(desired,4*dt);b.updateWorldMatrix(false,true);}
 }
}
