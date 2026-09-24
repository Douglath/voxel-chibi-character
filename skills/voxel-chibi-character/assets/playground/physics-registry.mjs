import * as THREE from 'three';
const T=THREE;
const AccessoryDynamics=(()=>{

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sanitized = name => name.replace(/\s/g, '_').replace(/[\[\]\.:/]/g, '');
const resolve = (rig, name) => rig.getObjectByName(name) ?? rig.getObjectByName(sanitized(name));

/** Optional bounded angular springs; no mesh collision or two-end constraint solver. */
class AccessoryDynamics {
  constructor(rig) {
    this.rig = rig;
    this.root = null;
    rig.traverse(node => { if (!this.root && node.userData?.accessoryRig) this.root = node; });
    this.step = 1 / 120; this.accumulator = 0; this._enabled = true;
    this.metrics = { steps: 0, resets: 0, maxAngle: 0, finite: true, scope: 'Bounded single-axis angular springs; no mesh collision or endpoint constraints' };
    this.states = (this.root?.userData.accessoryRig.dynamics ?? []).map(definition => {
      const bone = resolve(rig, definition.bone);
      if (!bone?.isBone) throw new Error(`Accessory dynamics: bone not found: ${definition.bone}`);
      if (!bone.parent) throw new Error(`Accessory dynamics: bone has no parent: ${definition.bone}`);
      const axis = new THREE.Vector3(...definition.axis).normalize();
      if (axis.lengthSq() < 1e-8 || ![definition.stiffness, definition.damping, definition.maxAngle].every(n => Number.isFinite(n) && n > 0)) throw new Error(`Accessory dynamics: invalid spring ${definition.bone}`);
      return { ...definition, bone, axis, rest: bone.quaternion.clone(), angle: 0, velocity: 0, pivotPosition: new THREE.Vector3(), parentQuaternion: new THREE.Quaternion(), linearVelocity: new THREE.Vector3(), angularVelocity: 0, force: 0 };
    });
    this.lastPosition = new THREE.Vector3();
    this.reset();
  }

  get enabled() { return this._enabled; }
  set enabled(value) {
    const enabled = Boolean(value);
    if (enabled !== this._enabled) { this._enabled = enabled; this.reset(); }
  }

  reset() {
    this.accumulator = 0;
    for (const state of this.states) { state.angle = 0; state.velocity = 0; state.force = 0; state.angularVelocity = 0; state.linearVelocity.set(0, 0, 0); state.bone.quaternion.copy(state.rest); }
    this.rig.updateMatrixWorld(true);
    for (const state of this.states) {
      state.bone.getWorldPosition(state.pivotPosition);
      state.bone.parent.getWorldQuaternion(state.parentQuaternion);
    }
    this.rig.getWorldPosition(this.lastPosition);
    this.metrics.resets++;
  }

  kick(amount = 1) {
    if (!Number.isFinite(amount)) throw new Error('Accessory dynamics: kick must be finite');
    if (!this.enabled) return;
    for (const state of this.states) state.velocity = clamp(state.velocity + amount, -8, 8);
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Accessory dynamics: dt must be finite and nonnegative');
    if (!this.enabled || dt === 0 || !this.states.length) return;
    if (dt > .2) { this.reset(); return; }
    this.rig.updateMatrixWorld(true);
    const position = this.rig.getWorldPosition(new THREE.Vector3());
    if (position.distanceTo(this.lastPosition) > 1) { this.reset(); return; }
    this.lastPosition.copy(position);
    for (const state of this.states) {
      // Rotation moves an off-center attachment even when its parent's origin is fixed.
      // Sample that actual pivot; the spring's own rotation does not move its origin.
      const p = state.bone.getWorldPosition(new THREE.Vector3()), q = state.bone.parent.getWorldQuaternion(new THREE.Quaternion());
      if (p.distanceTo(state.pivotPosition) > 1 || q.angleTo(state.parentQuaternion) > Math.PI / 2) { this.reset(); return; }
      const velocity = p.clone().sub(state.pivotPosition).divideScalar(dt);
      const acceleration = velocity.clone().sub(state.linearVelocity).divideScalar(dt).applyQuaternion(q.clone().invert());
      const delta = state.parentQuaternion.clone().invert().multiply(q);
      if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
      const halfSine = Math.hypot(delta.x, delta.y, delta.z);
      const rotation = halfSine > 1e-8 ? new THREE.Vector3(delta.x, delta.y, delta.z).multiplyScalar(2 * Math.atan2(halfSine, delta.w) / halfSine) : new THREE.Vector3();
      const angularVelocity = rotation.dot(state.axis) / dt;
      const angularAcceleration = (angularVelocity - state.angularVelocity) / dt;
      const torque = new THREE.Vector3(0, -1, 0).cross(acceleration).dot(state.axis);
      state.force = clamp(-.06 * angularAcceleration - .05 * torque, -20, 20);
      state.pivotPosition.copy(p); state.parentQuaternion.copy(q); state.linearVelocity.copy(velocity); state.angularVelocity = angularVelocity;
    }
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= this.step) {
      this.accumulator -= this.step;
      for (const state of this.states) {
        // Semi-implicit spring integration at a fixed 120 Hz.
        state.velocity += (-state.stiffness * state.angle - state.damping * state.velocity + state.force) * this.step;
        state.angle += state.velocity * this.step;
        if (Math.abs(state.angle) > state.maxAngle) { state.angle = clamp(state.angle, -state.maxAngle, state.maxAngle); state.velocity = 0; }
        this.metrics.maxAngle = Math.max(this.metrics.maxAngle, Math.abs(state.angle));
        this.metrics.finite &&= Number.isFinite(state.angle) && Number.isFinite(state.velocity);
      }
      this.metrics.steps++;
    }
    for (const state of this.states) state.bone.quaternion.copy(state.rest).multiply(new THREE.Quaternion().setFromAxisAngle(state.axis, state.angle));
    this.rig.updateMatrixWorld(true);
  }
}
;return AccessoryDynamics;})();
const Physics0=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const [side,sign] of [['L',1],['R',-1]]){
   this.chains.push({bones:[rig.getObjectByName('hair_'+side+'_1'),rig.getObjectByName('hair_'+side+'_2')],stiffness:side==='L'?72:78,damping:side==='L'?14:15,maxAngle:.14,length:.44,axis:new THREE.Vector3(sign*.18,-1,.06).normalize(),category:'rear hair'});
   this.chains.push({bones:[rig.getObjectByName('ear_'+side)],axis:new THREE.Vector3(sign*.36,1,0).normalize(),stiffness:290,damping:30,maxAngle:.035,length:1.36,collision:false,category:'rabbit ears'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+side)],stiffness:140,damping:21,maxAngle:.06,length:.72,cloth:true,collision:false,category:'coat hem'});
  }
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Rear-hair endpoint torso capsule; restrained rabbit ears and coat springs. Not full mesh/self-collision.'};this.reset();
 }
 reset(){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics1=(()=>{const TailDynamics=(()=>{
const rear=new T.Vector3(0,0,-1);
// Local angular springs with world gravity; root position is always owned by hips.
class TailDynamics {
 constructor(rig){
  this.rig=rig;this.bones=[1,2,3].map(i=>rig.getObjectByName('tail_'+i));
  if(this.bones.some(b=>!b))throw Error('Tail requires three connected bones');
  this.lengths=[.34,.595,.68];this.angles=[0,0,0];this.vel=[0,0,0];this.yaw=[0,0,0];this.yawVel=[0,0,0];
  this.prev=new T.Vector3();this.prevVel=new T.Vector3();this.lastQ=new T.Quaternion();this.acc=0;this.contacts=0;this.reset(true);
 }
 reset(settled=true){this.angles.fill(0);this.vel.fill(0);this.yaw.fill(0);this.yawVel.fill(0);this.acc=0;this.apply();if(settled)for(let i=0;i<960;i++)this.step(1/120,0,0);this.apply();this.prev.copy(this.bones[0].getWorldPosition(new T.Vector3()));this.prevVel.set(0,0,0);this.lastQ.copy(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()));}
 kick(){this.yawVel[1]+=.9;this.vel[2]-=.9;}
 step(h,vertical,yawForce){
  const stiffness=[200,24,38],damping=[24,9,10],rest=[0,0,-.55],gravity=[22,38,14],limits=[[-.08,.30],[0,1.45],[-1.05,.25]];
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
  let minimum=Infinity;for(let segment=1;segment<3;segment++)for(const t of [.25,.5,.75,1]){const p=this.points[segment].clone().lerp(this.points[segment+1],t),radius=segment===1?.12:.08;
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
;return TailDynamics;})();


const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.tail=new TailDynamics(rig);
  this.chains=[{bones:[rig.getObjectByName('ponytail_1'),rig.getObjectByName('ponytail_2')],stiffness:82,damping:14,maxAngle:.16,length:.49,category:'low ponytail',collision:true}];
  for(const side of ['L','R'])this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:165,damping:22,maxAngle:.07,length:.63,collision:false,category:'face framing hair'});
  this.chains.push({bones:[rig.getObjectByName('tie_1')],stiffness:140,damping:20,maxAngle:.09,length:.46,collision:false,planar:true,cloth:true,category:'necktie'});
  for(const c of this.chains)if(c.bones.some(b=>!b))throw Error('Missing character-specific secondary bone');
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Rear hair endpoint torso collisions; bounded dragon tail and planar tie spring, not full mesh collision'};this.reset();
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
;return HairPhysics;})();
const Physics2=(()=>{const TailDynamics=(()=>{
const rear=new T.Vector3(0,0,-1);
// Local angular springs with world gravity; root position is always owned by hips.
class TailDynamics {
 constructor(rig){
  this.rig=rig;this.bones=[1,2,3].map(i=>rig.getObjectByName('tail_'+i));
  if(this.bones.some(b=>!b))throw Error('Tail requires three connected bones');
  this.lengths=[.2975,.51,.7225];this.angles=[0,0,0];this.vel=[0,0,0];this.yaw=[0,0,0];this.yawVel=[0,0,0];
  this.prev=new T.Vector3();this.prevVel=new T.Vector3();this.lastQ=new T.Quaternion();this.acc=0;this.contacts=0;this.reset(true);
 }
 reset(settled=true){this.angles.fill(0);this.vel.fill(0);this.yaw.fill(0);this.yawVel.fill(0);this.acc=0;this.apply();if(settled)for(let i=0;i<960;i++)this.step(1/120,0,0);this.apply();this.prev.copy(this.bones[0].getWorldPosition(new T.Vector3()));this.prevVel.set(0,0,0);this.lastQ.copy(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()));}
 kick(){this.yawVel[1]+=.9;this.vel[2]-=.9;}
 step(h,vertical,yawForce){
  const stiffness=[180,17,32],damping=[20,6,7],rest=[0,.1,-.10],gravity=[22,36,13],limits=[[-.08,.30],[0,1.45],[-.5,.5]];
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
  let minimum=Infinity;for(let segment=1;segment<3;segment++)for(const t of [.25,.5,.75,1]){const p=this.points[segment].clone().lerp(this.points[segment+1],t),radius=segment===1?.11:.055;
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
;return TailDynamics;})();


const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[
   ...['L','R'].map(s=>({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:155,damping:21,maxAngle:.075,length:.90,collision:false,category:'side locks'})),
   {bones:[rig.getObjectByName('pony_1'),rig.getObjectByName('pony_2')],stiffness:76,damping:14,maxAngle:.16,length:.66,collision:false,category:'low ponytail'},
   {bones:[rig.getObjectByName('tie_1')],stiffness:155,damping:22,maxAngle:.065,length:.52,cloth:true,collision:false,planar:true,category:'necktie'}
  ];
  this.tail=new TailDynamics(rig);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Bounded side-lock, ponytail and lateral tie springs; tail segment capsule samples only; not full mesh collision'};this.reset();
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
;return HairPhysics;})();
const Physics3=(()=>{const TailDynamics=(()=>{
// A muscular curled tail is authored in its supported neutral pose.
// Four bounded angular springs add inertia; this is not a gravity-drop solver.
class TailDynamics {
 constructor(rig){
  this.rig=rig;this.bones=[1,2,3,4].map(i=>rig.getObjectByName('tail_'+i));
  if(this.bones.some(b=>!b))throw Error('Chongyue tail requires four connected, weighted bones');
  this.angles=[0,0,0,0];this.vel=[0,0,0,0];this.yaw=[0,0,0,0];this.yawVel=[0,0,0,0];
  this.stiffness=[220,110,80,65];this.damping=[29,21,18,16];this.limits=[.025,.075,.10,.13];
  this.prev=new T.Vector3();this.lastQ=new T.Quaternion();this.acc=0;
  this.metrics={steps:0,maxAngle:0,finite:true,scope:'Bounded inertial springs around a reference-specific curled rest; no full collision solver'};
  this.reset();
 }
 reset(){this.angles.fill(0);this.vel.fill(0);this.yaw.fill(0);this.yawVel.fill(0);this.acc=0;this.apply();this.prev.copy(this.bones[0].getWorldPosition(new T.Vector3()));this.lastQ.copy(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()));}
 kick(){this.yawVel[1]+=.65;this.yawVel[2]+=.9;this.yawVel[3]+=1.1;this.vel[2]-=.45;}
 step(h,force,pitch){
  for(let i=0;i<4;i++){
   const coupling=i?this.yaw[i-1]*18:0;
   this.yawVel[i]+=(-this.stiffness[i]*this.yaw[i]-this.damping[i]*this.yawVel[i]+force*[.03,.22,.34,.45][i]+coupling)*h;
   this.vel[i]+=(-this.stiffness[i]*this.angles[i]-this.damping[i]*this.vel[i]+pitch*[.03,.12,.2,.28][i])*h;
   for(const [a,v]of [[this.yaw,this.yawVel],[this.angles,this.vel]]){a[i]+=v[i]*h;if(Math.abs(a[i])>this.limits[i]){a[i]=T.MathUtils.clamp(a[i],-this.limits[i],this.limits[i]);v[i]=0;}}
   this.metrics.maxAngle=Math.max(this.metrics.maxAngle,Math.abs(this.yaw[i]),Math.abs(this.angles[i]));
   this.metrics.finite&&=[this.yaw[i],this.angles[i],this.vel[i],this.yawVel[i]].every(Number.isFinite);
  }this.metrics.steps++;
 }
 apply(){for(let i=0;i<4;i++){this.bones[i].rotation.set(this.angles[i],this.yaw[i],0,'YXZ');this.bones[i].updateWorldMatrix(true,true);}this.points=this.bones.map(b=>b.getWorldPosition(new T.Vector3()));}
 update(dt){
  if(dt<=0)return;if(dt>.2){this.reset();return;}
  this.rig.updateMatrixWorld(true);const p=this.bones[0].getWorldPosition(new T.Vector3()),q=this.bones[0].parent.getWorldQuaternion(new T.Quaternion());
  if(p.distanceTo(this.prev)>1){this.reset();return;}
  const dq=q.clone().multiply(this.lastQ.clone().invert());if(dq.w<0)dq.set(-dq.x,-dq.y,-dq.z,-dq.w);
  const yawRate=T.MathUtils.clamp(2*dq.y/dt,-12,12),pitchRate=T.MathUtils.clamp(2*dq.x/dt,-12,12);
  const lateral=T.MathUtils.clamp((p.x-this.prev.x)/dt,-8,8);this.prev.copy(p);this.lastQ.copy(q);
  this.acc+=Math.min(dt,.05);while(this.acc>=1/120){this.acc-=1/120;this.step(1/120,-yawRate*8-lateral*3,-pitchRate*4);}this.apply();
 }
}
;return TailDynamics;})();


const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  this.tail=new TailDynamics(rig);
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:185,damping:24,maxAngle:.075,length:.45,collision:false,category:'short hair tips'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+side)],stiffness:145,damping:22,maxAngle:.07,length:.85,cloth:true,collision:false,category:'long coat and attached belt ends'});
  }
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Two short hair tips and two long-coat panels, plus four curled-tail bones; bounded springs, no full collision solver'};this.reset();
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
;return HairPhysics;})();
const Physics4=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const [side,sign]of [['L',1],['R',-1]]){
   this.chains.push({bones:[rig.getObjectByName('hair_tip_'+side)],stiffness:140,damping:22,maxAngle:.085,length:.68,category:'short hair tips',collision:true});
   this.chains.push({bones:[rig.getObjectByName('skirt_'+side)],stiffness:165,damping:24,maxAngle:.060,length:.45,cloth:true,collision:false,category:'skirt hem'});
   this.chains.push({bones:[rig.getObjectByName('waist_ribbon_'+side+'_1'),rig.getObjectByName('waist_ribbon_'+side+'_2')],stiffness:82,damping:14,maxAngle:.19,length:.44,cloth:true,collision:false,planar:true,category:'waist ribbon'});
  }
  for(const c of this.chains)if(c.bones.some(b=>!b))throw Error('Missing character-specific dynamic bone: '+c.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Short-hair endpoint torso proxy, bounded skirt and planar waist-ribbon springs. No full mesh collision.'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
  for(const c of this.chains)for(let i=0;i<c.bones.length;i++){const b=c.bones[i],previousRotation=b.quaternion.clone();if(c.cloth&&!this.clothEnabled){b.quaternion.identity();continue;}b.parent.updateWorldMatrix(true,false);const inverse=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),dir=c.p[i+1].clone().sub(c.p[i]).normalize().applyQuaternion(inverse);const restAxis=i<c.bones.length-1?c.bones[i+1].position.clone().normalize():(c.axis??down);b.quaternion.setFromUnitVectors(restAxis,dir);if(c.maxAngle){const angle=b.quaternion.angleTo(new THREE.Quaternion());if(angle>c.maxAngle)b.quaternion.slerp(new THREE.Quaternion(),1-c.maxAngle/angle);}if(c.planar){const turn=Math.atan2(dir.x,-dir.y)-Math.atan2(restAxis.x,-restAxis.y);b.rotation.set(0,0,THREE.MathUtils.clamp(Math.atan2(Math.sin(turn),Math.cos(turn)),-c.maxAngle,c.maxAngle));}if(c.chestAccessory){b.rotation.x=Math.min(0,b.rotation.x);b.rotation.y=0;}const desired=b.quaternion.clone();b.quaternion.copy(previousRotation).rotateTowards(desired,4*dt);b.updateWorldMatrix(false,true);}
 }
}
;return HairPhysics;})();
const Physics5=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:190,damping:24,maxAngle:.07,length:.34,collision:false,category:'short hair tips'});
   this.chains.push({bones:[rig.getObjectByName('back_hair_'+side)],stiffness:135,damping:20,maxAngle:.09,length:.28,collision:false,category:'short hair tips'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+side)],stiffness:130,damping:21,maxAngle:.085,length:.72,cloth:true,collision:false,category:'split coat hems'});
  }
  this.chains.push({bones:[rig.getObjectByName('ahoge')],axis:new THREE.Vector3(0,1,0),stiffness:95,damping:16,maxAngle:.15,length:.30,collision:false,category:'cowlick'});
  for(const c of this.chains)if(c.bones.some(b=>!b))throw new Error('Missing selected secondary joint');
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Seven fixed-step bounded hair/cowlick/coat springs; no full mesh or self-collision solver'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics6=(()=>{


// Character-specific bounded angular springs. No cloth solver or self-collision claim.
const secondaryConfig=[
 {bone:'hair_L_1',carrier:'head',kind:'hair',k:82,d:15,maxX:.09,minX:-.025,maxZ:.07,gain:.040,sign:1},
 {bone:'hair_L_2',carrier:'head',kind:'hair',k:58,d:12,maxX:.13,minX:-.035,maxZ:.11,gain:.061,sign:1},
 {bone:'hair_R_1',carrier:'head',kind:'hair',k:88,d:15.5,maxX:.09,minX:-.025,maxZ:.07,gain:.043,sign:-1},
 {bone:'hair_R_2',carrier:'head',kind:'hair',k:63,d:12.5,maxX:.13,minX:-.035,maxZ:.11,gain:.065,sign:-1},
 {bone:'coat_L',carrier:'hips',kind:'coat',k:135,d:21,maxX:.06,minX:-.015,maxZ:.055,gain:.036,sign:1},
 {bone:'coat_R',carrier:'hips',kind:'coat',k:145,d:22,maxX:.06,minX:-.015,maxZ:.055,gain:.039,sign:-1},
 {bone:'tassel_L',carrier:'head',kind:'tassel',k:105,d:15,maxX:0,minX:0,maxZ:.15,gain:.047,sign:1},
 {bone:'tassel_R',carrier:'head',kind:'tassel',k:112,d:15.5,maxX:0,minX:0,maxZ:.15,gain:.051,sign:-1}
];
const clamp=THREE.MathUtils.clamp;
class HairPhysics{
 constructor(rig){
  this.rig=rig;this._enabled=true;this.acc=0;this.strength=1;this.clothEnabled=true;this.helpers=new THREE.Group();this.helpers.visible=false;
  this.chains=secondaryConfig.map(c=>{
   const b=rig.getObjectByName(c.bone),carrier=rig.getObjectByName(c.carrier);
   if(!b||!carrier)throw Error('Missing secondary-motion bone '+c.bone);
   return {...c,bones:[b],b,anchor:carrier,x:0,z:0,vx:0,vz:0,lastQ:new THREE.Quaternion(),lastP:new THREE.Vector3(),targetX:0,targetZ:0,peak:0};
  });
  this.metrics={steps:0,resets:0,finite:true,maxAngle:0,scope:'Eight bounded angular springs; no full mesh collision solver'};this.reset();
 }
 get enabled(){return this._enabled;}
 set enabled(v){const b=!!v;if(b!==this._enabled){this._enabled=b;this.reset();}}
 reset(){
  for(const c of this.chains){c.x=c.z=c.vx=c.vz=c.targetX=c.targetZ=0;c.b.quaternion.identity();}
  this.rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor.getWorldQuaternion(c.lastQ);c.anchor.getWorldPosition(c.lastP);}
  this.lastRoot=this.rig.getWorldPosition(new THREE.Vector3());this.acc=0;this.metrics.resets++;
 }
 kick(){if(!this.enabled)return;for(const c of this.chains){c.vz+=c.sign*(c.kind==='tassel'?1.4:.85);if(c.kind!=='tassel')c.vx+=.6;}}
 update(dt){
  if(!this.enabled||!Number.isFinite(dt)||dt<=0)return;
  if(dt>.2){this.reset();return;}
  this.rig.updateMatrixWorld(true);
  const root=this.rig.getWorldPosition(new THREE.Vector3());if(root.distanceTo(this.lastRoot)>1){this.reset();return;}this.lastRoot.copy(root);
  for(const c of this.chains){
   const q=c.anchor.getWorldQuaternion(new THREE.Quaternion()),p=c.anchor.getWorldPosition(new THREE.Vector3());
   const delta=c.lastQ.clone().invert().multiply(q);if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
   const e=new THREE.Euler().setFromQuaternion(delta,'YXZ');
   const v=p.clone().sub(c.lastP).divideScalar(dt).applyQuaternion(q.clone().invert());
   const yaw=clamp(e.y/dt,-5,5),roll=clamp(e.z/dt,-5,5),pitch=clamp(e.x/dt,-5,5);
   c.targetZ=clamp((-yaw*.65-roll-v.x*.6)*c.gain,-c.maxZ,c.maxZ);
   c.targetX=clamp((pitch+v.z*.7+Math.abs(v.y)*.35)*c.gain,c.minX,c.maxX);
   c.lastQ.copy(q);c.lastP.copy(p);
  }
  this.acc+=Math.min(dt,.05);const h=1/120;
  while(this.acc>=h-1e-10){this.acc-=h;
   for(const c of this.chains){
    if(c.kind==='coat'&&!this.clothEnabled){c.x=c.z=c.vx=c.vz=0;continue;}
    c.vx+=(c.k*(c.targetX-c.x)-c.d*c.vx)*h;c.vz+=(c.k*(c.targetZ-c.z)-c.d*c.vz)*h;
    c.x+=c.vx*h;c.z+=c.vz*h;
    if(c.x>c.maxX||c.x<c.minX){c.x=clamp(c.x,c.minX,c.maxX);c.vx=0;}
    if(Math.abs(c.z)>c.maxZ){c.z=clamp(c.z,-c.maxZ,c.maxZ);c.vz=0;}
    c.peak=Math.max(c.peak,Math.abs(c.x),Math.abs(c.z));this.metrics.finite&&=[c.x,c.z,c.vx,c.vz].every(Number.isFinite);
   }this.metrics.steps++;
  }
  for(const c of this.chains){c.b.rotation.set(c.x,0,c.z);this.metrics.maxAngle=Math.max(this.metrics.maxAngle,c.b.quaternion.angleTo(new THREE.Quaternion()));}
 }
}
;return HairPhysics;})();
const Physics7=(()=>{

/** Elysium's 8 bounded angular springs, reusing the skill's fixed-step solver.
 * Hair tips (2), coat panels (2), and sewn blue streamers (4).
 * No mesh collisions or unbounded cloth simulation are implied.
 */
class HairPhysics extends AccessoryDynamics {
 constructor(rig){super(rig);this.metrics.character='elysium';this.metrics.springBones=this.states.length;}
}
;return HairPhysics;})();
const Physics8=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('rear_hair_'+side)],stiffness:115,damping:18,maxAngle:.085,length:.42,collision:false,category:'short rear hair'});
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:180,damping:24,maxAngle:.065,length:.48,collision:false,category:'short side hair'});
  }
  this.chains.push({bones:[rig.getObjectByName('waist_strap_1'),rig.getObjectByName('waist_strap_2')],stiffness:100,damping:17,maxAngle:.14,length:.20,collision:false,cloth:true,planar:true,category:'waist strap'});
  for(const chain of this.chains)if(chain.bones.some(b=>!b))throw Error('Missing Exusiai dynamics bone: '+chain.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Six bounded spring nodes: short rear/side tips and a belt-anchored planar strap. No mesh/self collision solver.'};this.reset();
 }
 reset(){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
  for(const c of this.chains)for(let i=0;i<c.bones.length;i++){const b=c.bones[i],previousRotation=b.quaternion.clone();if(c.cloth&&!this.clothEnabled){b.quaternion.identity();continue;}b.parent.updateWorldMatrix(true,false);const inverse=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),dir=c.p[i+1].clone().sub(c.p[i]).normalize().applyQuaternion(inverse);const restAxis=i<c.bones.length-1?c.bones[i+1].position.clone().normalize():(c.axis??down);b.quaternion.setFromUnitVectors(restAxis,dir);if(c.maxAngle){const angle=b.quaternion.angleTo(new THREE.Quaternion());if(angle>c.maxAngle)b.quaternion.slerp(new THREE.Quaternion(),1-c.maxAngle/angle);}if(c.planar){b.rotation.set(0,0,THREE.MathUtils.clamp(Math.atan2(dir.x,-dir.y)-Math.atan2(restAxis.x,-restAxis.y),-c.maxAngle,c.maxAngle));}if(c.chestAccessory){b.rotation.x=Math.min(0,b.rotation.x);b.rotation.y=0;}const desired=b.quaternion.clone();b.quaternion.copy(previousRotation).rotateTowards(desired,4*dt);b.updateWorldMatrix(false,true);}
 }
}
;return HairPhysics;})();
const Physics9=(()=>{

/** Character-specific, bounded inertial angular springs. No cloth collision solver. */
class HairPhysics {
 constructor(rig){
  this.rig=rig;this.strength=1;this._enabled=true;this.clothEnabled=true;this.acc=0;
  this.helpers=new THREE.Group();this.helpers.visible=false;
  this.metrics={steps:0,finite:true,maxAngle:0,resets:0,scope:'8 bounded angular springs; no full mesh or cloth self-collision'};
  this.states=[];
  for(const [side,sign] of [['L',1],['R',-1]]){
   for(const [name,drive,k,d,max,category,planar] of [
    ['hair_'+side+'_1','head',70,15,.095,'hair',false],
    ['hair_'+side+'_2','head',48,12,.13,'hair',false],
    ['coat_'+side,'hips',145,24,.045,'coat',false],
    ['ribbon_'+side,'chest',100,18,.07,'ribbon',true]]){
    const bone=rig.getObjectByName(name),anchor=rig.getObjectByName(drive);if(!bone||!anchor)throw Error('Missing dynamic bone '+name);
    this.states.push({name,bone,anchor,k,d,max,category,planar,sign,q:new THREE.Vector2(),v:new THREE.Vector2(),peak:0});
   }
  }
  // Kept for diagnostics; each state corresponds to one actually weighted bone.
  this.chains=this.states.map(s=>({bones:[s.bone],category:s.category,p:[new THREE.Vector3(),new THREE.Vector3()]}));
  this.reset();
 }
 get enabled(){return this._enabled;}
 set enabled(value){value=Boolean(value);if(value!==this._enabled){this._enabled=value;this.reset();}}
 reset(){
  for(const s of this.states){s.q.set(0,0);s.v.set(0,0);s.bone.quaternion.identity();}
  this.rig.updateMatrixWorld(true);
  for(const s of this.states){s.lastP=s.anchor.getWorldPosition(new THREE.Vector3());s.lastV=new THREE.Vector3();s.lastQ=s.anchor.getWorldQuaternion(new THREE.Quaternion());}
  this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());this.acc=0;this.metrics.resets++;
 }
 kick(){if(!this.enabled)return;for(const s of this.states){s.v.y+=s.category==='hair'?.58:s.category==='coat'?.28:.45;if(!s.planar)s.v.x+=.12*s.sign;}}
 update(dt){
  if(!this.enabled||!Number.isFinite(dt)||dt<=0)return;
  this.rig.updateMatrixWorld(true);const p=this.rig.getWorldPosition(new THREE.Vector3());
  if(dt>.2||p.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(p);
  this.acc+=Math.min(dt,.05);const h=1/120;
  while(this.acc+1e-10>=h){this.acc-=h;this.rig.updateMatrixWorld(true);
   for(const s of this.states){
    const wp=s.anchor.getWorldPosition(new THREE.Vector3()),wq=s.anchor.getWorldQuaternion(new THREE.Quaternion()),inverse=wq.clone().invert();
    const vel=wp.clone().sub(s.lastP).divideScalar(h),a=vel.clone().sub(s.lastV).divideScalar(h).applyQuaternion(inverse);
    const dq=s.lastQ.clone().invert().multiply(wq);if(dq.w<0)dq.set(-dq.x,-dq.y,-dq.z,-dq.w);
    const yaw=THREE.MathUtils.clamp(2*dq.y/h,-10,10);
    s.lastP.copy(wp);s.lastV.copy(vel);s.lastQ.copy(wq);
    const tx=s.planar?0:THREE.MathUtils.clamp(a.z*.0018,-s.max*.7,s.max*.7);
    const tz=THREE.MathUtils.clamp(-a.x*.0018-yaw*.018,-s.max*.75,s.max*.75);
    const active=this.clothEnabled||s.category==='hair';
    for(const [axis,target] of [[0,tx],[1,tz]]){
     let q=s.q.getComponent(axis),v=s.v.getComponent(axis);v+=(s.k*(target-q)-s.d*v)*h;q+=v*h;
     if(Math.abs(q)>s.max){q=THREE.MathUtils.clamp(q,-s.max,s.max);if(q*v>0)v=0;}
     if(!active||(s.planar&&axis===0)){q=0;v=0;}
     s.q.setComponent(axis,q);s.v.setComponent(axis,v);s.peak=Math.max(s.peak,Math.abs(q));
    }
    s.bone.rotation.set(s.q.x,0,s.q.y);s.bone.updateWorldMatrix(false,true);
    this.metrics.maxAngle=Math.max(this.metrics.maxAngle,s.peak);this.metrics.finite&&=s.q.toArray().concat(s.v.toArray()).every(Number.isFinite);
   }this.metrics.steps++;
  }
 }
}
;return HairPhysics;})();
const Physics10=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  const rules=[
   ['bob_hair','short bob',190,25,.065,.43,false],
   ['side_hair_L','right front lock',175,24,.065,.61,false],
   ['side_hair_R','left long front lock',115,18,.105,1.02,false],
   ['coat_L','front coat',130,20,.07,.78,true],
   ['coat_R','front coat',138,21,.07,.78,true],
   ['coat_back_L','rear coat',155,22,.055,.66,true],
   ['coat_back_R','rear coat',160,22,.055,.66,true],
   ['dress_hem','inner skirt',190,25,.045,.52,true]
  ];
  this.chains=rules.map(([name,category,stiffness,damping,maxAngle,length,cloth])=>{
   const b=rig.getObjectByName(name);if(!b)throw Error('Missing secondary bone '+name);
   return {bones:[b],category,stiffness,damping,maxAngle,length,cloth,collision:false};
  });
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Eight bounded inertial spring chains; fixed roots. No full mesh or self-collision solver.'};this.reset();
 }
 reset(){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
  // Anchor roots are kinematic even on display frames with no fixed simulation step.
  for(const c of this.chains)c.p[0].copy(c.local[0]).applyMatrix4(c.anchor.matrixWorld);
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
;return HairPhysics;})();
const Physics11=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const s of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('back_hair_'+s)],stiffness:s==='L'?105:112,damping:17,maxAngle:.13,length:.82,collision:false,category:'short back hair'});
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:160,damping:23,maxAngle:.085,length:.72,collision:false,category:'bob side panel'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:145,damping:22,maxAngle:.065,length:s==='L'?.91:1.13,cloth:true,collision:false,category:'long coat side'});
  }
  this.chains.push({bones:[rig.getObjectByName('coat_back')],stiffness:170,damping:24,maxAngle:.055,length:.95,cloth:true,collision:false,category:'coat back'});
  this.chains.push({bones:[rig.getObjectByName('dress_hem')],stiffness:190,damping:26,maxAngle:.040,length:.82,cloth:true,collision:false,category:'asymmetric dress'});
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Bounded bob and garment springs; no full mesh collision or cloth self-collision'};this.reset();
 }
 reset(){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics12=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=['L','R'].map(s=>({bones:[rig.getObjectByName('hair_'+s+'_1'),rig.getObjectByName('hair_'+s+'_2')],stiffness:s==='L'?72:79,damping:s==='L'?13:14,maxAngle:.09,length:.48,category:'rear hair',collision:false}));
  for(const s of ['L','R'])this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:160,damping:24,maxAngle:.035,length:.47,cloth:true,collision:false,category:'skirt hem'});
  for(const s of ['L','R'])this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:180,damping:25,maxAngle:.035,length:.73,collision:false,category:'free face-side hair tips'});
  for(const c of this.chains)if(c.bones.some(b=>!b))throw Error('Missing selected secondary-motion bone');
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Eight-bone bounded hair/hem springs; no full mesh self collision or IK'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.28;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics13=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  // Logos-specific chains: 8 genuinely weighted bones in three motion categories.
  this.chains=[{bones:['pony_1','pony_2'].map(n=>rig.getObjectByName(n)),stiffness:65,damping:12,maxAngle:.16,length:.48,collision:false,category:'long ponytail'}];
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:155,damping:23,maxAngle:.06,length:.45,collision:false,category:'face-side hair'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+side)],stiffness:135,damping:21,maxAngle:.055,length:.95,cloth:true,collision:false,category:'split coat tails'});
   this.chains.push({bones:[rig.getObjectByName('ribbon_'+side)],stiffness:88,damping:15,maxAngle:.085,length:1.45,cloth:true,planar:true,collision:false,category:'silver-blue streamers'});
  }
  for(const c of this.chains)if(c.bones.some(b=>!b))throw Error('Missing Logos secondary bone: '+c.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.helpers.clear(); // No collision proxy is shown: this lightweight rig has no collision solver.
  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Logos bounded inertia springs for ponytail, side locks, coat tails and streamers; no mesh/self-collision'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics14=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  this.chains=['L','R'].map(s=>({bones:[rig.getObjectByName('hair_'+s)],stiffness:s==='L'?108:118,damping:s==='L'?19:20,maxAngle:.105,length:1.1,collision:false,category:'gold loose hair'}));
  this.chains.push({bones:[rig.getObjectByName('braid_1'),rig.getObjectByName('braid_2')],stiffness:145,damping:23,maxAngle:.085,length:.50,collision:false,category:'side braid'});
  for(const s of ['L','R','F','B'])this.chains.push({bones:[rig.getObjectByName('skirt_'+s)],stiffness:s==='F'?210:185,damping:26,maxAngle:.050,length:.69,cloth:true,collision:false,category:'layered skirt'});
  for(const c of this.chains)if(c.bones.some(b=>!b))throw new Error('Secondary bone missing in '+c.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,collisionTested:false,finite:true,scope:'Eight bounded secondary joints, root-to-tip hair/braid/skirts; no full garment collision solver'};this.reset();
 }
 reset(){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics15=(()=>{
// Lightweight secondary motion, authored for Miss.Christine's curled tail and four ribbons.
// Angular spring model: not a cloth simulator and not full-body collision detection.

const STEP=1/120,clamp=THREE.MathUtils.clamp;
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.enabled=true;this.ambient=true;this.strength=1;this.time=0;this.acc=0;this.helpers=new THREE.Group();
  this.nodes=[];this.metrics={steps:0,finite:true,maxAngle:0,resetCount:0,scope:'7 bounded angular spring joints; fixed 120 Hz; no full self-collision'};
  for(let i=1;i<=3;i++)this.add('tail_'+i,'tail',{k:42+8*i,d:12+2*i,limit:.20+.035*i,phase:i*.8});
  for(const face of ['front','back'])for(const side of ['L','R'])this.add('ribbon_'+face+'_'+side,'ribbon',{k:82,d:18,limit:.085,phase:(side==='L'?0:1.2)+(face==='back'?1.7:0),front:face==='front'});
  this.lastPosition=new THREE.Vector3();this.lastQuaternion=new THREE.Quaternion();this.reset();
 }
 add(name,category,params){const bone=this.rig.getObjectByName(name);if(!bone)throw Error('Secondary bone missing: '+name);this.nodes.push({name,category,bone,...params,a:new THREE.Vector3(),v:new THREE.Vector3()});}
 reset(){for(const n of this.nodes){n.a.set(0,0,0);n.v.set(0,0,0);n.bone.quaternion.identity();}this.acc=0;this.rig.updateMatrixWorld(true);this.rig.getWorldPosition(this.lastPosition);this.rig.getWorldQuaternion(this.lastQuaternion);this.metrics.resetCount++;}
 setEnabled(value){const next=Boolean(value);if(next!==this.enabled){this.enabled=next;this.reset();}}
 kick(){if(!this.enabled)return;for(const n of this.nodes){if(n.category==='tail'){n.v.y+=.72;n.v.x+=.30;}else n.v.z+=(n.name.endsWith('L')?1:-1)*.50;}}
 update(dt){
  if(!this.enabled||!Number.isFinite(dt)||dt<=0)return;
  this.rig.updateMatrixWorld(true);const pos=this.rig.getWorldPosition(new THREE.Vector3()),quat=this.rig.getWorldQuaternion(new THREE.Quaternion());
  if(dt>.2||pos.distanceTo(this.lastPosition)>1){this.reset();return;}
  const dq=this.lastQuaternion.clone().invert().multiply(quat),rot=new THREE.Euler().setFromQuaternion(dq,'YXZ'),yaw=clamp(rot.y/dt,-9,9),vx=clamp((pos.x-this.lastPosition.x)/dt,-5,5);
  this.lastPosition.copy(pos);this.lastQuaternion.copy(quat);this.acc+=dt;
  while(this.acc>=STEP){this.acc-=STEP;this.time+=STEP;this.metrics.steps++;
   for(const n of this.nodes){
    let target=new THREE.Vector3();
    if(n.category==='tail')target.set((this.ambient?.017*Math.sin(this.time*1.6+n.phase):0)-.009*vx,(this.ambient?.043*Math.sin(this.time*1.25-n.phase):0)-.047*yaw,0);
    else target.set(0,0,(this.ambient?.008*Math.sin(this.time*1.65+n.phase):0)-.022*yaw-.014*vx);
    target.multiplyScalar(this.strength);
    for(const axis of ['x','y','z']){n.v[axis]+=(target[axis]-n.a[axis])*n.k*STEP;n.v[axis]*=Math.exp(-n.d*STEP);n.a[axis]+=n.v[axis]*STEP;if(Math.abs(n.a[axis])>n.limit){n.a[axis]=clamp(n.a[axis],-n.limit,n.limit);n.v[axis]*=.2;}}
    n.bone.quaternion.setFromEuler(new THREE.Euler(n.a.x,n.a.y,n.a.z,'XYZ'));
    this.metrics.maxAngle=Math.max(this.metrics.maxAngle,n.a.length());this.metrics.finite&&=n.a.toArray().every(Number.isFinite)&&n.v.toArray().every(Number.isFinite);
   }
  }
 }
 get state(){return {enabled:this.enabled,ambient:this.ambient,activeBones:this.nodes.length,fixedStep:STEP,nodes:this.nodes.map(n=>({name:n.name,category:n.category,angle:n.a.toArray(),velocity:n.v.toArray()})),metrics:{...this.metrics}};}
}
;return HairPhysics;})();
const Physics16=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('hair_'+side)],stiffness:150,damping:23,maxAngle:.055,length:.66,collision:false,category:'rear bob'});
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:92,damping:16,maxAngle:.095,length:1.36,collision:false,category:'long side tendril'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+side)],stiffness:150,damping:22,maxAngle:.05,length:.77,cloth:true,collision:false,category:'coat side'});
  }
  this.chains.push({bones:[rig.getObjectByName('coat_Back')],stiffness:170,damping:24,maxAngle:.04,length:.73,cloth:true,collision:false,category:'coat back'});
  this.chains.push({bones:[rig.getObjectByName('bow_tail')],stiffness:130,damping:19,maxAngle:.075,length:.39,planar:true,collision:false,category:'chest bow tail'});
  for(const chain of this.chains)if(chain.bones.some(b=>!b))throw Error('Missing Mizuki dynamic bone: '+chain.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Eight bounded Mizuki springs: four hair, three coat and one planar bow tail. Proxy displayed for spatial reference only; not full cloth collision.'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(let i=0;i<this.chains.length;i++){const c=this.chains[i];c.v.at(-1).x+=(i%2===0?1:-1)*.55;}}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics17=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=['L','R'].map(s=>({bones:[rig.getObjectByName('hair_'+s+'_1'),rig.getObjectByName('hair_'+s+'_2')],stiffness:s==='L'?62:68,damping:s==='L'?11:12,maxAngle:.11,category:'rear hair'}));
  for(const s of ['L','R'])this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:145,damping:22,maxAngle:.065,length:.78,cloth:true,collision:false,category:'coat tails'});
  for(const s of ['L','R'])this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:155,damping:23,maxAngle:.06,length:.90,collision:false,category:'face-side hair'});
  for(const c of this.chains)for(const b of c.bones)if(!b)throw Error('Selected secondary-motion bone is missing');
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Eight-bone hair/coat dynamics; rear-hair endpoint torso proxy only, not full mesh collision'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.48;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics18=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('back_hair_'+side)],stiffness:165,damping:23,maxAngle:.055,length:.50,collision:false,category:'short rear hair'});
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:205,damping:27,maxAngle:.045,length:.47,collision:false,category:'short face-side hair'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+side)],stiffness:165,damping:24,maxAngle:.05,length:.57,cloth:true,collision:false,category:'coat panels'});
  }
  this.chains.push({bones:[rig.getObjectByName('coat_back')],stiffness:180,damping:25,maxAngle:.045,length:.57,cloth:true,collision:false,category:'coat panels'});
  this.chains.push({bones:[rig.getObjectByName('back_strap')],stiffness:130,damping:21,maxAngle:.10,length:.82,collision:false,planar:true,cloth:true,category:'rear strap'});
  for(const c of this.chains)if(c.bones.some(b=>!b))throw Error('Missing character-specific secondary bone: '+c.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Eight bounded short-hair/coat/rear-strap chains; no full cloth or self-collision solver'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics19=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  this.chains=[
   {bones:['pony_1','pony_2','pony_3'].map(n=>rig.getObjectByName(n)),stiffness:85,damping:17,maxAngle:.10,length:.44,collision:false,category:'ponytail'},
   ...['L','R','Back'].map(s=>({bones:[rig.getObjectByName('coat_'+s)],stiffness:160,damping:25,maxAngle:.035,length:.8,cloth:true,collision:false,category:'coat'})),
   ...['L','R'].map(s=>({bones:[rig.getObjectByName('earring_'+s)],stiffness:185,damping:24,maxAngle:.09,length:.44,collision:false,category:'earring'}))
  ];
  for(const c of this.chains)if(c.bones.some(b=>!b))throw Error('Missing secondary bone in '+c.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Bounded ponytail / coat / earring springs; no full mesh collision solver'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled||!Number.isFinite(dt)||dt<=0)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics20=(()=>{const TailDynamics=(()=>{
// Authored curved fluffy tail: damped local angular response around its neutral curve.
// This is not the baseline's gravity-sagging straight tail, and has no collision solver.
class TailDynamics{
 constructor(rig){
  this.rig=rig;this.bones=[1,2,3].map(i=>rig.getObjectByName('tail_'+i));
  if(this.bones.some(b=>!b))throw Error('Pramanix tail requires three connected bones');
  this.angles=[0,0,0];this.vel=[0,0,0];this.yaw=[0,0,0];this.yawVel=[0,0,0];
  this.prev=new T.Vector3();this.prevVel=new T.Vector3();this.lastQ=new T.Quaternion();this.acc=0;this.contacts=0;this.reset();
 }
 reset(){this.angles.fill(0);this.vel.fill(0);this.yaw.fill(0);this.yawVel.fill(0);this.acc=0;this.apply();this.prev.copy(this.bones[0].getWorldPosition(new T.Vector3()));this.prevVel.set(0,0,0);this.lastQ.copy(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()));}
 kick(){this.yawVel[1]+=.6;this.vel[2]-=.45;}
 step(h,vertical,yawForce){
  for(let i=0;i<3;i++){
   this.vel[i]+=(-[210,105,70][i]*this.angles[i]-[26,18,15][i]*this.vel[i]+vertical*[.025,.05,.08][i])*h;
   this.angles[i]+=this.vel[i]*h;
   this.yawVel[i]+=(-[230,120,80][i]*this.yaw[i]-[28,20,16][i]*this.yawVel[i]+yawForce*[.05,.3,.48][i])*h;
   this.yaw[i]+=this.yawVel[i]*h;
   const max=[.035,.075,.11][i];
   for(const [a,v]of [[this.angles,this.vel],[this.yaw,this.yawVel]])if(Math.abs(a[i])>max){a[i]=T.MathUtils.clamp(a[i],-max,max);v[i]=0;}
  }
 }
 apply(){for(let i=0;i<3;i++){this.bones[i].rotation.set(this.angles[i],this.yaw[i],0,'YXZ');this.bones[i].updateWorldMatrix(true,true);}this.points=this.bones.map(b=>b.getWorldPosition(new T.Vector3()));}
 update(dt){
  if(dt<=0)return;if(dt>.2){this.reset();return;}
  this.rig.updateMatrixWorld(true);const pos=this.bones[0].getWorldPosition(new T.Vector3()),q=this.bones[0].parent.getWorldQuaternion(new T.Quaternion());
  if(pos.distanceTo(this.prev)>1){this.reset();return;}
  const velocity=pos.clone().sub(this.prev).divideScalar(dt),acceleration=velocity.clone().sub(this.prevVel).divideScalar(dt),dq=this.lastQ.clone().invert().multiply(q),yawRate=2*Math.atan2(dq.y,dq.w)/dt;
  this.prev.copy(pos);this.prevVel.copy(velocity);this.lastQ.copy(q);this.acc+=Math.min(dt,.05);
  while(this.acc>=1/120){this.acc-=1/120;this.step(1/120,T.MathUtils.clamp(acceleration.y,-15,15),T.MathUtils.clamp(yawRate*3,-10,10));}this.apply();
 }
}
;return TailDynamics;})();


const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[{bones:[rig.getObjectByName('mane')],stiffness:96,damping:16,maxAngle:.09,length:1.30,collision:false,category:'unified long hair'}];
  this.tail=new TailDynamics(rig);
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('braid_'+side)],stiffness:135,damping:20,maxAngle:.075,length:1.4,collision:false,category:'front braid'});
   this.chains.push({bones:[rig.getObjectByName('skirt_'+side)],stiffness:165,damping:23,maxAngle:.055,length:.94,cloth:true,collision:false,category:'skirt hem'});
  }
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Pramanix: bounded mane, braids, skirt and curved-tail inertia; no full mesh collision'};this.reset();
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
;return HairPhysics;})();
const Physics21=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=['L','R'].map(s=>({bones:[rig.getObjectByName('hair_'+s+'_1'),rig.getObjectByName('hair_'+s+'_2')],stiffness:s==='L'?68:72,damping:s==='L'?12:13,maxAngle:.22,category:'rear hair'}));
  for(const s of ['L','R'])this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:135,damping:20,maxAngle:.075,length:.72,cloth:true,collision:false,category:'side coat'});
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side+'_1'),rig.getObjectByName('side_hair_'+side+'_2')],stiffness:170,damping:23,maxAngle:.07,length:.44,collision:false,category:'face-side hair'});
   this.chains.push({bones:[rig.getObjectByName('outer_hair_'+side)],stiffness:100,damping:16,maxAngle:.10,length:.70,collision:false,category:'outer hair'});
   this.chains.push({bones:[rig.getObjectByName('ear_'+side)],axis:new THREE.Vector3(0,1,0),stiffness:300,damping:32,maxAngle:.022,length:.62,collision:false,category:'rabbit ears'});
   this.chains.push({bones:[rig.getObjectByName('sleeve_soft_'+side)],stiffness:130,damping:20,maxAngle:.07,length:.25,cloth:true,collision:false,category:'sleeve lower edge'});
   this.chains.push({bones:[rig.getObjectByName('coat_back_'+side)],stiffness:160,damping:22,maxAngle:.055,length:.72,cloth:true,collision:false,category:'rear coat'});
  }
  this.chains.push({bones:[rig.getObjectByName('chest_ribbon_1'),rig.getObjectByName('chest_ribbon_2')],stiffness:125,damping:20,maxAngle:.10,length:.28,collision:false,planar:true,category:'neck ribbon'});
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){
   c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();
   c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
   c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));
   c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));
  }
  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Rear/side hair, rabbit ears, coat and sleeve secondary motion; torso capsule proxy only; no full self-collision'};
  this.reset();
 }
 reset(){
  for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);
  for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}
  this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());
 }
 kick(){for(const c of this.chains)c.v.at(-1).x+=.65;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
  while(this.acc>=h){this.acc-=h;this.rig.updateMatrixWorld(true);
   for(const c of this.chains){const target=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.p[0].copy(target[0]);
    for(let i=1;i<c.p.length;i++){
     const before=c.p[i].clone();c.v[i].addScaledVector(target[i].clone().sub(c.p[i]),(c.stiffness??48)*h).multiplyScalar(Math.exp(-(c.damping??8)*h));c.p[i].addScaledVector(c.v[i],h);
     for(let q=0;q<10;q++){
      const direction=c.p[i].clone().sub(c.p[i-1]).normalize(),restDir=target[i].clone().sub(target[i-1]).normalize();
      if(c.maxAngle){const turn=new THREE.Quaternion().setFromUnitVectors(restDir,direction),angle=turn.angleTo(new THREE.Quaternion());if(angle>c.maxAngle)turn.slerp(new THREE.Quaternion(),1-c.maxAngle/angle);direction.copy(restDir).applyQuaternion(turn);}
      c.p[i].copy(c.p[i-1]).addScaledVector(direction,c.lengths[i-1]);const hit=this.clearance(c.p[i]);if(c.collision!==false&&hit.d<0){const outward=c.p[i].clone().sub(hit.q);if(outward.lengthSq()<1e-10)outward.set(0,0,-1);c.p[i].copy(hit.q).addScaledVector(outward.normalize(),this.capsule.radius);}
     }
     c.v[i].copy(c.p[i]).sub(before).divideScalar(h);this.metrics.maxLag=Math.max(this.metrics.maxLag,c.p[i].distanceTo(target[i]));this.metrics.maxLengthError=Math.max(this.metrics.maxLengthError,Math.abs(c.p[i].distanceTo(c.p[i-1])-c.lengths[i-1]));if(c.collision!==false)this.metrics.minProxyClearance=Math.min(this.metrics.minProxyClearance,this.clearance(c.p[i]).d);this.metrics.finite&&=c.p[i].toArray().every(Number.isFinite);
    }
   }
   this.metrics.steps++;
  }
  for(const c of this.chains)for(let i=0;i<c.bones.length;i++){
   const b=c.bones[i],previousRotation=b.quaternion.clone();if(c.cloth&&!this.clothEnabled){b.quaternion.identity();continue;}b.parent.updateWorldMatrix(true,false);
   const inverse=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),dir=c.p[i+1].clone().sub(c.p[i]).normalize().applyQuaternion(inverse),restAxis=i<c.bones.length-1?c.bones[i+1].position.clone().normalize():(c.axis??down);
   b.quaternion.setFromUnitVectors(restAxis,dir);if(c.maxAngle){const angle=b.quaternion.angleTo(new THREE.Quaternion());if(angle>c.maxAngle)b.quaternion.slerp(new THREE.Quaternion(),1-c.maxAngle/angle);}if(c.planar)b.rotation.set(0,0,THREE.MathUtils.clamp(Math.atan2(dir.x,-dir.y),-c.maxAngle,c.maxAngle));const desired=b.quaternion.clone();b.quaternion.copy(previousRotation).rotateTowards(desired,4*dt);b.updateWorldMatrix(false,true);
  }
 }
}
;return HairPhysics;})();
const Physics22=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('hair_'+side+'_1'),rig.getObjectByName('hair_'+side+'_2')],stiffness:side==='L'?76:82,damping:side==='L'?15:16,maxAngle:.13,length:.83,collision:false,category:'long wavy hair'});
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:180,damping:24,maxAngle:.055,length:1.20,collision:false,category:'face framing locks'});
   this.chains.push({bones:[rig.getObjectByName('skirt_'+side)],stiffness:175,damping:25,maxAngle:.045,length:.595,cloth:true,collision:false,category:'skirt hem'});
  }
  for(const chain of this.chains)if(chain.bones.some(b=>!b))throw Error('Missing required secondary bone for '+chain.category);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Eight bounded secondary bones; no runtime mesh collision solver; character clearances checked separately'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.38;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
  while(this.acc>=h){this.acc-=h;this.rig.updateMatrixWorld(true);
   for(const c of this.chains){const target=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.p[0].copy(target[0]);if(c.cloth&&!this.clothEnabled){c.p=target;c.v.forEach(v=>v.set(0,0,0));continue;}
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
;return HairPhysics;})();
const Physics23=(()=>{

/** Lightweight, fixed-step secondary rig for Shu. Authored tail curl is the rest shape.
 *  Not a full cloth solver; no IK or mesh self-collision. Bone axes are local. */
const SECONDARY_CONFIG=[
 {name:'hair_L_1',axis:[.75,0,.5],k:76,d:16,max:.062,gain:.72,sign:1},
 {name:'hair_L_2',axis:[.82,0,.35],k:55,d:13,max:.085,gain:.90,sign:1},
 {name:'hair_R_1',axis:[.75,0,-.5],k:82,d:17,max:.062,gain:.68,sign:-1},
 {name:'hair_R_2',axis:[.82,0,-.35],k:60,d:14,max:.085,gain:.86,sign:-1},
 {name:'tail_1',axis:[0,.85,.25],k:105,d:20,max:.035,gain:.52,sign:1},
 {name:'tail_2',axis:[.25,.8,.35],k:72,d:16,max:.055,gain:.72,sign:1},
 {name:'tail_3',axis:[.35,.7,.5],k:54,d:14,max:.075,gain:.95,sign:1},
 {name:'robe_hem',axis:[1,0,.15],k:155,d:24,max:.018,gain:.30,sign:1}
];
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.enabled=true;this.clock=0;this.metrics={steps:0,resets:0,maxAngle:0,finite:true};
  this.states=SECONDARY_CONFIG.map(c=>{
   const bone=rig.getObjectByName(c.name);if(!bone?.isBone)throw Error('Missing secondary bone: '+c.name);
   return {...c,bone,axis:new THREE.Vector3(...c.axis).normalize(),q0:bone.quaternion.clone(),prev:new THREE.Quaternion(),angle:0,velocity:0,maxObserved:0};
  });
  this.chains=this.states;this.previousPosition=rig.position.clone();this.q=new THREE.Quaternion();this.delta=new THREE.Quaternion();this.reset();
 }
 reset(){
  for(const s of this.states){s.angle=0;s.velocity=0;s.bone.quaternion.copy(s.q0);}
  this.rig.updateMatrixWorld(true);for(const s of this.states)s.bone.parent.getWorldQuaternion(s.prev);
  this.clock=0;this.previousPosition.copy(this.rig.position);this.metrics.resets++;
 }
 setEnabled(value){this.enabled=Boolean(value);this.reset();}
 kick(amount=1){if(!this.enabled)return;for(const s of this.states)s.velocity+=amount*.42*s.sign*(s.name==='robe_hem'?.22:1);}
 step(dt){
  this.rig.updateMatrixWorld(true);
  for(const s of this.states){
   s.bone.parent.getWorldQuaternion(this.q);
   this.delta.copy(s.prev).invert().multiply(this.q);if(this.delta.w<0)this.delta.set(-this.delta.x,-this.delta.y,-this.delta.z,-this.delta.w);
   const yaw=THREE.MathUtils.clamp(2*this.delta.y/dt,-4,4),pitch=THREE.MathUtils.clamp(2*this.delta.x/dt,-4,4);
   s.prev.copy(this.q);
   const force=-(yaw*s.sign+pitch*.45)*s.gain;
   s.velocity+=(-s.k*s.angle-s.d*s.velocity+force)*dt;
   s.velocity=THREE.MathUtils.clamp(s.velocity,-1.2,1.2);s.angle+=s.velocity*dt;
   if(Math.abs(s.angle)>s.max){s.angle=THREE.MathUtils.clamp(s.angle,-s.max,s.max);s.velocity=0;}
   s.bone.quaternion.copy(s.q0).multiply(this.delta.setFromAxisAngle(s.axis,s.angle));
   s.maxObserved=Math.max(s.maxObserved,Math.abs(s.angle));this.metrics.maxAngle=Math.max(this.metrics.maxAngle,Math.abs(s.angle));
   this.metrics.finite&&=Number.isFinite(s.angle)&&Number.isFinite(s.velocity);
  }
  this.rig.updateMatrixWorld(true);this.metrics.steps++;
 }
 update(dt){
  if(!this.enabled)return;if(!Number.isFinite(dt)||dt<=0)return;
  if(dt>.20||this.rig.position.distanceTo(this.previousPosition)>1.5){this.reset();return;}
  this.previousPosition.copy(this.rig.position);this.clock+=dt;
  while(this.clock>=1/120-1e-10){this.clock-=1/120;this.step(1/120);}
 }
}
;return HairPhysics;})();
const Physics24=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const rules=[
   ['long_hair_L','long back hair',95,19,.070,2.28,false],
   ['long_hair_R','long back hair',102,20,.070,2.28,false],
   ['front_hair_L','front hair lock',130,22,.050,1.82,false],
   ['front_hair_R','front hair lock',138,23,.050,1.82,false],
   ['coat_L','split coat tails',150,24,.055,.98,true],
   ['coat_R','split coat tails',158,25,.055,.98,true],
   ['tassel_L','earring tassel',80,12,.170,.42,false],
   ['tassel_R','earring tassel',88,13,.170,.42,false]
  ];
  this.chains=rules.map(([name,category,stiffness,damping,maxAngle,length,cloth])=>{
   const b=rig.getObjectByName(name);if(!b)throw Error('Missing secondary bone '+name);
   return {bones:[b],category,stiffness,damping,maxAngle,length,cloth,collision:false};
  });
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Eight bounded inertial spring chains; fixed roots. No full mesh or self-collision solver.'};this.reset();
 }
 reset(){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!Number.isFinite(dt)||dt<=0)return;if(!this.enabled){this.reset();return;}if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
  // Anchor roots are kinematic even on display frames with no fixed simulation step.
  for(const c of this.chains)c.p[0].copy(c.local[0]).applyMatrix4(c.anchor.matrixWorld);
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
;return HairPhysics;})();
const Physics25=(()=>{const TailDynamics=(()=>{
const rear=new T.Vector3(0,0,-1);
// Local angular springs with world gravity; root position is always owned by hips.
class TailDynamics {
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
;return TailDynamics;})();


const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  this.tail=new TailDynamics(rig);
  for(const s of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:190,damping:25,maxAngle:.045,length:.50,collision:false,category:'short hair ends'});
   this.chains.push({bones:[rig.getObjectByName('cape_'+s)],stiffness:145,damping:23,maxAngle:.065,length:1.58,cloth:true,collision:false,category:'split cape'});
  }
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Bounded short hair/cape springs; tail has pelvis/leg capsule sampling; no full cloth or self-collision'};this.reset();
 }
 reset(tailSettled=true){this.tail.reset(tailSettled);for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){this.tail.kick();for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled||dt<=0)return;if(dt>.2){this.reset();return;}
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
;return HairPhysics;})();
const Physics26=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[
   {bones:[rig.getObjectByName('hair_L_1'),rig.getObjectByName('hair_L_2')],stiffness:72,damping:14,maxAngle:.12,length:.72,collision:false,category:'gathered long hair'},
   {bones:[rig.getObjectByName('hair_R_1'),rig.getObjectByName('hair_R_2')],stiffness:86,damping:16,maxAngle:.10,length:.46,collision:false,category:'loose back hair'}
  ];
  for(const s of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:175,damping:25,maxAngle:.045,length:.68,collision:false,category:'front lock'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:145,damping:22,maxAngle:.055,length:1.12,cloth:true,collision:false,category:'split coat hem'});
  }
  for(const chain of this.chains)if(chain.bones.some(b=>!b?.isBone))throw Error('Missing Skadi dynamics bone');
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Eight bounded spring bones for hair and coattails; no mesh collision solver'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
  while(this.acc>=h){this.acc-=h;this.rig.updateMatrixWorld(true);
   for(const c of this.chains){if(c.cloth&&!this.clothEnabled){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v.forEach(v=>v.set(0,0,0));continue;}const target=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.p[0].copy(target[0]);
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
;return HairPhysics;})();
const Physics27=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
   this.chains=[{bones:['pony_1','pony_2','pony_3'].map(n=>rig.getObjectByName(n)),stiffness:64,damping:13,maxAngle:.16,length:.46,collision:false,category:'low-tied long hair'}];
   for(const s of ['L','R']){
    this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:170,damping:23,maxAngle:.06,length:.88,collision:false,category:'face-framing hair'});
    this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:145,damping:22,maxAngle:.065,length:1.25,cloth:true,collision:false,category:'split long coat'});
   }
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Seven bounded spring joints: tied hair, face strands and split coat. No full self collision.'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics28=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=['L','R'].map(s=>({bones:[rig.getObjectByName('hair_'+s+'_1'),rig.getObjectByName('hair_'+s+'_2')],stiffness:s==='L'?70:76,damping:s==='L'?15:16,maxAngle:.11,length:.82,collision:false,category:'rear hair'}));
  for(const s of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:145,damping:22,maxAngle:.055,length:.63,cloth:true,collision:false,category:'layered skirt'});
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:170,damping:25,maxAngle:.045,length:.83,collision:false,category:'face-side hair'});
  }
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Eight bounded secondary bones; long hair, face locks and skirt; no mesh/self-collision solver'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics29=(()=>{const TailDynamics=(()=>{
const rear=new T.Vector3(0,0,-1);
// Local angular springs with world gravity; root position is always owned by hips.
class TailDynamics {
 constructor(rig){
  this.rig=rig;this.bones=[1,2,3].map(i=>rig.getObjectByName('tail_'+i));
  if(this.bones.some(b=>!b))throw Error('Tail requires three connected bones');
  this.lengths=[.255,.425,.425];this.angles=[0,0,0];this.vel=[0,0,0];this.yaw=[0,0,0];this.yawVel=[0,0,0];
  this.prev=new T.Vector3();this.prevVel=new T.Vector3();this.lastQ=new T.Quaternion();this.acc=0;this.contacts=0;this.reset(true);
 }
 reset(settled=true){this.angles.fill(0);this.vel.fill(0);this.yaw.fill(0);this.yawVel.fill(0);this.acc=0;this.apply();if(settled)for(let i=0;i<960;i++)this.step(1/120,0,0);this.apply();this.prev.copy(this.bones[0].getWorldPosition(new T.Vector3()));this.prevVel.set(0,0,0);this.lastQ.copy(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()));}
 kick(){this.yawVel[1]+=.9;this.vel[2]-=.9;}
 step(h,vertical,yawForce){
  const stiffness=[180,17,32],damping=[20,6,7],rest=[0,0,-.10],gravity=[22,36,13],limits=[[-.08,.30],[0,1.45],[-.35,.45]];
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
;return TailDynamics;})();


const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  const rules=[
   [['back_hair_1','back_hair_2'],'layered rear hair',120,20,.11,.90,false],
   [['side_hair_L'],'left temple lock',175,24,.075,1.00,false],
   [['side_hair_R'],'right temple lock',175,24,.075,1.00,false],
   [['belt_tail'],'free waist strap',150,22,.08,.46,true]
  ];
  this.chains=rules.map(([names,category,stiffness,damping,maxAngle,length,cloth])=>{
   const bones=names.map(name=>{const b=rig.getObjectByName(name);if(!b)throw Error('Missing secondary bone '+name);return b;});
   return {bones,category,stiffness,damping,maxAngle,length,cloth,collision:false,planar:cloth};
  });
  this.tail=new TailDynamics(rig);
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Four bounded hair/belt chains plus a three-segment gravity tail; fixed roots. No full mesh or self-collision solver.'};this.reset();
 }
 reset(settled=true){this.tail?.reset(settled);for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){this.tail.kick();for(const c of this.chains)for(let i=1;i<c.v.length;i++)c.v[i].x+=.7*i/(c.v.length-1);}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
  // Anchor roots are kinematic even on display frames with no fixed simulation step.
  for(const c of this.chains)c.p[0].copy(c.local[0]).applyMatrix4(c.anchor.matrixWorld);
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
  this.tail.update(dt);
  for(const c of this.chains)for(let i=0;i<c.bones.length;i++){const b=c.bones[i],previousRotation=b.quaternion.clone();if(c.cloth&&!this.clothEnabled){b.quaternion.identity();continue;}b.parent.updateWorldMatrix(true,false);const inverse=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),dir=c.p[i+1].clone().sub(c.p[i]).normalize().applyQuaternion(inverse);const restAxis=i<c.bones.length-1?c.bones[i+1].position.clone().normalize():(c.axis??down);b.quaternion.setFromUnitVectors(restAxis,dir);if(c.maxAngle){const angle=b.quaternion.angleTo(new THREE.Quaternion());if(angle>c.maxAngle)b.quaternion.slerp(new THREE.Quaternion(),1-c.maxAngle/angle);}if(c.planar){b.rotation.set(0,0,THREE.MathUtils.clamp(Math.atan2(dir.x,-dir.y),-c.maxAngle,c.maxAngle));}if(c.chestAccessory){b.rotation.x=Math.min(0,b.rotation.x);b.rotation.y=0;}const desired=b.quaternion.clone();b.quaternion.copy(previousRotation).rotateTowards(desired,4*dt);b.updateWorldMatrix(false,true);}
 }
}
;return HairPhysics;})();
const Physics30=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[{bones:[rig.getObjectByName('pony_1'),rig.getObjectByName('pony_2')],stiffness:94,damping:17,maxAngle:.14,length:.28,collision:false,category:'short ponytail'}];
  for(const s of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+s)],stiffness:180,damping:24,maxAngle:.055,length:.38,collision:false,category:'short side locks'});
   this.chains.push({bones:[rig.getObjectByName('coat_'+s)],stiffness:150,damping:23,maxAngle:.065,length:.68,cloth:true,collision:false,category:'coat tails'});
  }
  this.chains.push({bones:[rig.getObjectByName('back_strap')],stiffness:125,damping:20,maxAngle:.075,length:.79,cloth:true,collision:false,planar:true,category:'rear strap'});
  this.chains.push({bones:[rig.getObjectByName('hip_strap')],stiffness:155,damping:23,maxAngle:.060,length:.62,cloth:true,collision:false,planar:true,category:'hip strap'});
  if(this.chains.some(c=>c.bones.some(b=>!b)))throw Error('Missing Thorns secondary bone');
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:null,finite:true,scope:'Bounded short-hair, coat and strap springs; no full mesh collision solver'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics31=(()=>{

const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[
   {bones:['pony_1','pony_2'],stiffness:76,damping:16,maxAngle:.13,length:.73,collision:false,category:'low ponytail'},
   ...['L','R'].map(side=>({bones:['side_hair_'+side],stiffness:190,damping:26,maxAngle:.045,length:.52,collision:false,category:'short face hair'})),
   ...['L','R'].map(side=>({bones:['coat_'+side],stiffness:145,damping:23,maxAngle:.07,length:1.08,cloth:true,collision:false,category:'split side coat'})),
   {bones:['coat_back'],stiffness:165,damping:25,maxAngle:.055,length:1.0,cloth:true,collision:false,category:'back coat'},
   {bones:['cravat'],stiffness:125,damping:21,maxAngle:.09,length:.46,cloth:true,collision:false,planar:true,category:'cravat'}
  ].map(c=>({...c,bones:c.bones.map(name=>{const bone=rig.getObjectByName(name);if(!bone)throw Error('Missing dynamic bone '+name);return bone;})}));
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'28-bone Urbian; bounded rooted hair/coat/cravat springs, no full mesh collision solver'};this.reset();
 }
 reset(tailSettled=true){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(p=>p.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 kick(){for(const c of this.chains)c.v.at(-1).x+=.7;}
 clearance(p){const {a,b,radius}=this.capsule,ab=b.clone().sub(a),q=a.clone().addScaledVector(ab,THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1));return {q,d:p.distanceTo(q)-radius};}
 update(dt){
  if(!this.enabled||!Number.isFinite(dt)||dt<=0)return;if(dt>.2){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.rig.updateMatrixWorld(true);this.capsule.a.set(0,1.15,0).applyMatrix4(this.rig.matrixWorld);this.capsule.b.set(0,2.12,0).applyMatrix4(this.rig.matrixWorld);this.helpers.position.copy(this.rig.position);this.helpers.quaternion.copy(this.rig.quaternion);this.acc+=Math.min(dt,.05);const h=1/120;
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
;return HairPhysics;})();
const Physics32=(()=>{

const down=new THREE.Vector3(0,-1,0),identity=new THREE.Quaternion();
/** Adapted from the skill's world-space spring chains. Lightweight, not a collision solver. */
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.enabled=true;this.acc=0;this.clothEnabled=true;this.helpers=new THREE.Group();
  const bone=n=>{const b=rig.getObjectByName(n);if(!b?.isBone)throw Error('Missing dynamic bone '+n);return b;};
  this.chains=[{name:'low ponytail',bones:[bone('hair_pony_1'),bone('hair_pony_2')],stiffness:68,damping:13,maxAngle:.13,length:.54}];
  for(const s of ['L','R']){
   this.chains.push({name:'rear locks '+s,bones:[bone('back_hair_'+s)],stiffness:115,damping:18,maxAngle:.09,length:.76});
   this.chains.push({name:'face framing '+s,bones:[bone('side_hair_'+s)],stiffness:180,damping:25,maxAngle:.045,length:.80});
   this.chains.push({name:'split panel '+s,bones:[bone('coat_'+s)],stiffness:145,damping:20,maxAngle:.065,length:.73,cloth:true});
  }
  rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();const p=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));p.push(p.at(-1).clone().addScaledVector(down,c.length));c.lengths=p.slice(1).map((v,i)=>v.distanceTo(p[i]));c.local=p.map(v=>v.clone().applyMatrix4(inv));}
  this.metrics={steps:0,maxLag:0,maxLengthError:0,maxAngle:0,finite:true,scope:'8 bounded spring bones; no full hair/garment/self-collision'};
  this.reset();
 }
 reset(){for(const c of this.chains)for(const b of c.bones)b.quaternion.identity();this.rig.updateMatrixWorld(true);for(const c of this.chains){c.p=c.local.map(v=>v.clone().applyMatrix4(c.anchor.matrixWorld));c.v=c.p.map(()=>new THREE.Vector3());}this.acc=0;this.lastPosition=this.rig.getWorldPosition(new THREE.Vector3());}
 setEnabled(value){this.enabled=Boolean(value);this.reset();}
 kick(){if(!this.enabled)return;for(const c of this.chains)c.v.at(-1).x+=c.cloth?.30:.55;}
 update(dt){
  if(!this.enabled||!Number.isFinite(dt)||dt<=0)return;
  if(dt>.20){this.reset();return;}
  const current=this.rig.getWorldPosition(new THREE.Vector3());if(current.distanceTo(this.lastPosition)>1){this.reset();return;}this.lastPosition.copy(current);
  this.acc+=Math.min(dt,.05);const h=1/120;this.rig.updateMatrixWorld(true);
  // Kinematic roots track their attachment even on frames without a fixed substep.
  for(const c of this.chains)c.p[0].copy(c.local[0]).applyMatrix4(c.anchor.matrixWorld);
  while(this.acc>=h){this.acc-=h;this.rig.updateMatrixWorld(true);
   for(const c of this.chains){
    if(c.cloth&&!this.clothEnabled)continue;
    const target=c.local.map(v=>v.clone().applyMatrix4(c.anchor.matrixWorld));c.p[0].copy(target[0]);
    for(let i=1;i<c.p.length;i++){
     const before=c.p[i].clone();c.v[i].addScaledVector(target[i].clone().sub(c.p[i]),c.stiffness*h).multiplyScalar(Math.exp(-c.damping*h));c.p[i].addScaledVector(c.v[i],h);
     const rest=target[i].clone().sub(target[i-1]).normalize(),dir=c.p[i].clone().sub(c.p[i-1]).normalize();
     const turn=new THREE.Quaternion().setFromUnitVectors(rest,dir),a=turn.angleTo(identity);if(a>c.maxAngle)turn.slerp(identity,1-c.maxAngle/a);
     dir.copy(rest).applyQuaternion(turn);c.p[i].copy(c.p[i-1]).addScaledVector(dir,c.lengths[i-1]);
     c.v[i].copy(c.p[i]).sub(before).divideScalar(h);
     this.metrics.maxLag=Math.max(this.metrics.maxLag,c.p[i].distanceTo(target[i]));this.metrics.maxLengthError=Math.max(this.metrics.maxLengthError,Math.abs(c.p[i].distanceTo(c.p[i-1])-c.lengths[i-1]));this.metrics.finite&&=c.p[i].toArray().every(Number.isFinite);
    }
   }this.metrics.steps++;
  }
  for(const c of this.chains)for(let i=0;i<c.bones.length;i++){
   const b=c.bones[i];if(c.cloth&&!this.clothEnabled){b.quaternion.identity();continue;}
   const prev=b.quaternion.clone();b.parent.updateWorldMatrix(true,false);const inv=b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),dir=c.p[i+1].clone().sub(c.p[i]).normalize().applyQuaternion(inv),axis=i<c.bones.length-1?c.bones[i+1].position.clone().normalize():down;
   const q=new THREE.Quaternion().setFromUnitVectors(axis,dir),angle=q.angleTo(identity);if(angle>c.maxAngle)q.slerp(identity,1-c.maxAngle/angle);
   b.quaternion.copy(prev).rotateTowards(q,4*dt);this.metrics.maxAngle=Math.max(this.metrics.maxAngle,b.quaternion.angleTo(identity));b.updateWorldMatrix(false,true);
  }
 }
}
;return HairPhysics;})();
const Physics33=(()=>{const TailDynamics=(()=>{
const rear=new T.Vector3(0,0,-1);
// Local angular springs with world gravity; root position is always owned by hips.
class TailDynamics {
 constructor(rig){
  this.rig=rig;this.bones=[1,2,3].map(i=>rig.getObjectByName('tail_'+i));
  if(this.bones.some(b=>!b))throw Error('Tail requires three connected bones');
  this.lengths=[.255,.425,.51];this.angles=[0,0,0];this.vel=[0,0,0];this.yaw=[0,0,0];this.yawVel=[0,0,0];
  this.prev=new T.Vector3();this.prevVel=new T.Vector3();this.lastQ=new T.Quaternion();this.acc=0;this.contacts=0;this.reset(true);
 }
 reset(settled=true){this.angles.fill(0);this.vel.fill(0);this.yaw.fill(0);this.yawVel.fill(0);this.acc=0;this.apply();if(settled)for(let i=0;i<960;i++)this.step(1/120,0,0);this.apply();this.prev.copy(this.bones[0].getWorldPosition(new T.Vector3()));this.prevVel.set(0,0,0);this.lastQ.copy(this.bones[0].parent.getWorldQuaternion(new T.Quaternion()));}
 kick(){this.yawVel[1]+=.9;this.vel[2]-=.9;}
 step(h,vertical,yawForce){
  const stiffness=[170,23,27],damping=[23,8,9],rest=[0,.12,.12],gravity=[17,40,30],limits=[[-.08,.22],[0,1.35],[-.1,.70]];
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
;return TailDynamics;})();


const down=new THREE.Vector3(0,-1,0);
class HairPhysics{
 constructor(rig){
  this.rig=rig;this.head=rig.getObjectByName('head');this.enabled=true;this.acc=0;this.strength=1;
  this.capsule={a:new THREE.Vector3(0,1.15,0),b:new THREE.Vector3(0,2.12,0),radius:.48};
  this.helpers=new THREE.Group();this.helpers.visible=false;
  const mat=new THREE.MeshBasicMaterial({color:0xffbd65,wireframe:true,transparent:true,opacity:.35});
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.97,4,8),mat);proxy.position.set(0,1.635,0);this.helpers.add(proxy);
  this.chains=[];
  this.tail=new TailDynamics(rig);
  for(const side of ['L','R']){
   this.chains.push({bones:[rig.getObjectByName('side_hair_'+side)],stiffness:190,damping:26,maxAngle:.055,length:.52,collision:false,category:'short face-side hair'});
   this.chains.push({bones:[rig.getObjectByName('cape_'+side)],stiffness:145,damping:23,maxAngle:.055,length:1.45,cloth:true,collision:false,category:'split cloak'});
  }
  this.clothEnabled=true;rig.updateMatrixWorld(true);
  for(const c of this.chains){c.anchor=c.bones[0].parent;const inv=c.anchor.matrixWorld.clone().invert();c.rest=c.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));c.rest.push(c.rest.at(-1).clone().add((c.axis??down).clone().applyQuaternion(c.bones.at(-1).getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(c.length??(c.bones.length===1?.48:.49))));c.lengths=c.rest.slice(1).map((p,i)=>p.distanceTo(c.rest[i]));c.local=c.rest.map(p=>p.clone().applyMatrix4(inv));}

  this.metrics={steps:0,maxLag:0,maxLengthError:0,minProxyClearance:Infinity,finite:true,scope:'Bounded short hair and cloak springs; tail pelvis/leg proxy checks only, not cloth self-collision'};this.reset();
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
;return HairPhysics;})();
export const byModel={"1abc0d392d92dc6525536e92be2d9e2194f6fd8bbaec26aea2ae09448b12accd": "6279a38f115602134a00f23b0abf71550f62a545b9a16e2353f109c642bd5501", "c0e6775b6d2a081fc85cbebd07e3582805fe58a77606fab328c4083af90be444": "f23bc2431dde4deb881a4b992873eec4f847c2571add1e7f3061a346e19843b3", "ad57b197e01f070f57468adc69d8ae06db746c974f825885548ef1ccc047999c": "1fc2c594216f901c89b6b6143a77189a9699f91af40ba1c9afa62d9a72372dc3", "8ca0e8ca9b44fc39b32f601e8e666f674f033f3a8c2fc2f39d404422e913d781": "21ecb2f4a799da80570ba8ece63b70d5ddcaa606bb5b305b4c5f9a6ecde91824", "1c25071c99dd761435fd1044401da8408ab48af796d6de70fb8dff7588100780": "4a837cda0a4f39503f4c7aa558711527d46177fab11032d62d33baaf82dad23e", "751158c569fbc1d0f1c18387d5b07a82626f8d149dcb4c2cc39617e77e7a28bf": "3f7c6121b0ecce62bef7ccba986c3628cf7e69dd9970425b6ed1e91a6b81e6b4", "31629de8b8c35769d9606579b29a9555b1de47fdcd29244699ac16a2a97560f0": "caa98a7ab09f4b2dfc0667afc757664534595a68f3eb9a251413a8543ae1488e", "91b3f49eacf2866dbd8e90486c033835576c4fcae2360ab386d3582913048d9a": "1a213598967cd4ee2b68507aa0dce135901aacf49a2a825b83259f24e61f6b45", "3d5dde1868649be968be443c954b047c1f4846eaf0e2a6549fea9c0600073707": "05ac004d9ae37a8b5779ad8067f9a55803827a60396638e0cc9ae4f65988873b", "d207783c708b12fa9a25e37915f30365fd33de963bc2467b7d03d0ff53f0b9f2": "0e44884ccc1e255ccd50ac394b2d053f964f85301cc75e70b8d6245d70d31271", "1f5385b262bac05f6ecb255c4a5ec70614d8774197d4b5a7b0244f38292227ec": "ab8beb27b6fdde9063c156617d25816b2e0139d4e499b4dfdd7818ddd47e79cb", "15137fc6e355ce149328315f461d5a62c2b262232201e73888808f2e4c94408a": "81a0c8bf5a4872f20831d2f19e26f357908dfae024cab3236789bc2854ef8ee5", "1c66e6c4bb227911afbe094980e8ef83577dcdc7d90941cb8bdc313bc31ffc2e": "5a0fc6334048f0b577ccb259771debfb04e60a6c6009290efca68619cca97a87", "f4c5401a76e6f6dc9ad3ce7e51b28e0a3c20dff012178bc659bff957889d8cc1": "087071369a5ddfa2f22fd820b5079cfaa11818c2e0aded7d6f59d34fce30188a", "4b2754f0619a00f3ce3117ce408ed703eeacfaf42b2ca1c43b39816bd910444d": "ab7091fa027ff8ea4e8583c942a59e7d218324041e0b6404bcdc0bf2262951f4", "136391db6ef30bc9800d58f85daabb3138a2041ac0275e274fecc6bf35aec930": "87794b109a20423bf3c36763c9f08d5e4538b78e33b7c2a557ffe451c531dd2c", "130a198a7c8e2272ca999c5f5c63ae474fa79e87e046c42108585592bf8681b6": "6d5bec7628ad8ee54937ab0dfd81b0f7712f2aadc84aa468637f5852ef1b5ac9", "c0857b3e5c0ac5c01c7e06456a5962768ab92ffb232612e5298efc670f5eaf4f": "6b87c568a883c38049c95fd56a1ddac833de96e47a42fb6ad63aefadf94a891c", "9e4709592318bf458a59869b0742cec09af2a67d77e097cd0d52598f7ed4452d": "e0261f9b422d6b0c66cfdf2ec95ad0212321782f90d3716ed85928109c3c1df6", "a4c19c780fbd95df95b413b56bc8c83dcf2ea603bc1af05269ca63c5260ef667": "60d16bed571a0a8b41303a1b779e24702b0d01f5d947fc8d0417c50742319dff", "eba772be315cff45652b07fb6310080d8849bf64b86e411d12064e5f23388f74": "49d37f6c3ed7b2a2b99423b7a3d664044e778c3a49918bd5b0b3f40034c5f13b", "a2cb014bf466d66a0acafb17a7b89d715764df8b5d5b42cf4f429c088e87a437": "94c5627a537c517b0b8b02dda6e781e30594c50aaa1b45a149919c7b47a28acc", "e41cfd52305db85512dfcf9d58af53dd24b2e815d3264d00fff51428174485a4": "76a59f9f16c5eb14fd6352f14d5617d9986bda31ecd4c5d7cb6d55786dd94e7d", "981cbd2a2d64cfdb07e4781a6ff0ee4f3a6aeb91211717d4671d5ee8bcda6560": "8ca8351a40fc95b04a9f05a64be45deaf7a6d8cfa322de20c22ec4511ed2fb06", "6ac2f992e147857849f1fe38a3f723b6f1c508e294593b4a23854d4073de9654": "24385c86fcd3aa4dc8d4a3fd3d4e0841f9c95abb6c22b9406b8d2b1da3a11b89", "209d49ff6c68b333af61d8f191ed77fece891484a8c07e61bf62f03d997f7f0c": "2ac7fd855b4abf81a118c823810cbf8730caffebce9f0aacfbaabb5f60f8d115", "9a8cc45af484cd062e4d73a0f09ad9f9170d877c704305aa8e248a6c877f01ca": "445a5a5b8f68582214172ac4d98cf525e0bc1afc3f4e1668d0b32b251247bc4f", "2572bd9f52c0d2768319c29d69b17480e9b7410badedbcaa662ee8245c478ff3": "19ec76c53f6e572a33e4cc5965420cf2688a0bf846afcb4aee8c549f0fcdf936", "212834ca2c4ee33fbf6c08982fd664e04642e9fd185897e269fdfaa981724ce2": "d2ebdec098d5f8f18ef89f0db44917ed5462f4cda056b2f9f2ce1d83d429a976", "b78cd637b144da98d8bb5f96e8819a5f1662ec2a8a7280fbc52239bc94639b9a": "4b80e9cdcdd1d860e8d2ee7043b0207aacddf46e3c16bb3aac670e53b7fba957", "d648415490d5365d52bad032d4d104d2965bd2924351a4b1d5e5a50ccdb5c4ea": "5c9cdea7ec4c391881016481f4a92ce066130919169d92eb7ef1485b30c2e788", "51979ecd8462ac9a6c3be77f736a766424a48a8b0506efae20e0b11d742fefdc": "7554fb17075bfe7ca00255ca77d381a4ba49ebb8387aa0fb345455f27f74d14a", "ef30e78fdaaa18198b0a0e87c7373fc419809c3104ae7a1d315c24f30c018b31": "2629f55c8db8acafd92bd32c10a48247c15e65cca4ca9e2ae4bd58d9615d30ec", "ab6e9b97f8b4baeb1ac9ee265cb8133aa6e52eef288515c063ceabf71e50d515": "8adf02d71b24109c309bdf744531cacab89c2b8b9ad65d3fc2230f45ae856356"};
export const physicsTypes={
"6279a38f115602134a00f23b0abf71550f62a545b9a16e2353f109c642bd5501":{Hair:Physics0,accessory:false},
"f23bc2431dde4deb881a4b992873eec4f847c2571add1e7f3061a346e19843b3":{Hair:Physics1,accessory:true},
"1fc2c594216f901c89b6b6143a77189a9699f91af40ba1c9afa62d9a72372dc3":{Hair:Physics2,accessory:true},
"21ecb2f4a799da80570ba8ece63b70d5ddcaa606bb5b305b4c5f9a6ecde91824":{Hair:Physics3,accessory:true},
"4a837cda0a4f39503f4c7aa558711527d46177fab11032d62d33baaf82dad23e":{Hair:Physics4,accessory:true},
"3f7c6121b0ecce62bef7ccba986c3628cf7e69dd9970425b6ed1e91a6b81e6b4":{Hair:Physics5,accessory:false},
"caa98a7ab09f4b2dfc0667afc757664534595a68f3eb9a251413a8543ae1488e":{Hair:Physics6,accessory:false},
"1a213598967cd4ee2b68507aa0dce135901aacf49a2a825b83259f24e61f6b45":{Hair:Physics7,accessory:false},
"05ac004d9ae37a8b5779ad8067f9a55803827a60396638e0cc9ae4f65988873b":{Hair:Physics8,accessory:true},
"0e44884ccc1e255ccd50ac394b2d053f964f85301cc75e70b8d6245d70d31271":{Hair:Physics9,accessory:false},
"ab8beb27b6fdde9063c156617d25816b2e0139d4e499b4dfdd7818ddd47e79cb":{Hair:Physics10,accessory:false},
"81a0c8bf5a4872f20831d2f19e26f357908dfae024cab3236789bc2854ef8ee5":{Hair:Physics11,accessory:true},
"5a0fc6334048f0b577ccb259771debfb04e60a6c6009290efca68619cca97a87":{Hair:Physics12,accessory:false},
"087071369a5ddfa2f22fd820b5079cfaa11818c2e0aded7d6f59d34fce30188a":{Hair:Physics13,accessory:false},
"ab7091fa027ff8ea4e8583c942a59e7d218324041e0b6404bcdc0bf2262951f4":{Hair:Physics14,accessory:true},
"87794b109a20423bf3c36763c9f08d5e4538b78e33b7c2a557ffe451c531dd2c":{Hair:Physics15,accessory:false},
"6d5bec7628ad8ee54937ab0dfd81b0f7712f2aadc84aa468637f5852ef1b5ac9":{Hair:Physics16,accessory:true},
"6b87c568a883c38049c95fd56a1ddac833de96e47a42fb6ad63aefadf94a891c":{Hair:Physics17,accessory:true},
"e0261f9b422d6b0c66cfdf2ec95ad0212321782f90d3716ed85928109c3c1df6":{Hair:Physics18,accessory:false},
"60d16bed571a0a8b41303a1b779e24702b0d01f5d947fc8d0417c50742319dff":{Hair:Physics19,accessory:false},
"49d37f6c3ed7b2a2b99423b7a3d664044e778c3a49918bd5b0b3f40034c5f13b":{Hair:Physics20,accessory:true},
"94c5627a537c517b0b8b02dda6e781e30594c50aaa1b45a149919c7b47a28acc":{Hair:Physics21,accessory:false},
"76a59f9f16c5eb14fd6352f14d5617d9986bda31ecd4c5d7cb6d55786dd94e7d":{Hair:Physics22,accessory:false},
"8ca8351a40fc95b04a9f05a64be45deaf7a6d8cfa322de20c22ec4511ed2fb06":{Hair:Physics23,accessory:false},
"24385c86fcd3aa4dc8d4a3fd3d4e0841f9c95abb6c22b9406b8d2b1da3a11b89":{Hair:Physics24,accessory:false},
"2ac7fd855b4abf81a118c823810cbf8730caffebce9f0aacfbaabb5f60f8d115":{Hair:Physics25,accessory:true},
"445a5a5b8f68582214172ac4d98cf525e0bc1afc3f4e1668d0b32b251247bc4f":{Hair:Physics26,accessory:true},
"19ec76c53f6e572a33e4cc5965420cf2688a0bf846afcb4aee8c549f0fcdf936":{Hair:Physics27,accessory:true},
"d2ebdec098d5f8f18ef89f0db44917ed5462f4cda056b2f9f2ce1d83d429a976":{Hair:Physics28,accessory:false},
"4b80e9cdcdd1d860e8d2ee7043b0207aacddf46e3c16bb3aac670e53b7fba957":{Hair:Physics29,accessory:false},
"5c9cdea7ec4c391881016481f4a92ce066130919169d92eb7ef1485b30c2e788":{Hair:Physics30,accessory:true},
"7554fb17075bfe7ca00255ca77d381a4ba49ebb8387aa0fb345455f27f74d14a":{Hair:Physics31,accessory:false},
"2629f55c8db8acafd92bd32c10a48247c15e65cca4ca9e2ae4bd58d9615d30ec":{Hair:Physics32,accessory:false},
"8adf02d71b24109c309bdf744531cacab89c2b8b9ad65d3fc2230f45ae856356":{Hair:Physics33,accessory:false}};
export {AccessoryDynamics};
