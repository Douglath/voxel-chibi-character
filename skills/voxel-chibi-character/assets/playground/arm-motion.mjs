import * as T from 'three';
// Calibrate from the actual bind pose, including A-pose arms and mirrored local axes.
export function captureArmFrames(rig,bone){
 rig.updateMatrixWorld(true);const inverse=rig.getWorldQuaternion(new T.Quaternion()).invert(),frames=[];
 for(const side of ['L','R'])for(const [name,child] of [['upper_arm','forearm'],['forearm','hand']]){
  const joint=bone(name+'.'+side),tip=bone(child+'.'+side);if(!joint||!tip)continue;
  const direction=tip.getWorldPosition(new T.Vector3()).sub(joint.getWorldPosition(new T.Vector3())).normalize().applyQuaternion(inverse);
  frames.push({joint,side,name,direction,rotation:inverse.clone().multiply(joint.getWorldQuaternion(new T.Quaternion()))});
 }return frames;
}
export function applyArmSwing(rig,frames,phase,kind){
 const rigQ=rig.getWorldQuaternion(new T.Quaternion()),inverse=rigQ.clone().invert(),amp=kind==='walk'?.23:.46;
 // Upper arms remain outside the ribs; elbows flex forward, never across the midline.
 for(const f of frames){
  const sign=f.side==='L'?1:-1,swing=-sign*amp*Math.sin(phase),bend=kind==='walk'?.15:.55;
  const target=new T.Vector3(sign*.5,-Math.sqrt(.75),0);
  if(f.name==='forearm')target.set(sign*.5*Math.cos(bend),-Math.sqrt(.75)*Math.cos(bend),Math.sin(bend));
  target.applyAxisAngle(new T.Vector3(1,0,0),swing).normalize();
  const desired=new T.Quaternion().setFromUnitVectors(f.direction,target).multiply(f.rotation);
  const parent=inverse.clone().multiply(f.joint.parent.getWorldQuaternion(new T.Quaternion()));
  f.joint.quaternion.copy(parent.invert().multiply(desired));f.joint.updateWorldMatrix(false,true);
 }
}
