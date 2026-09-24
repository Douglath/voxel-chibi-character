import {physicsTypes,byModel,AccessoryDynamics} from './physics-registry.mjs';
// Run source solvers in original model units while preserving the real actor's motion.
export function inPhysicsFrame(e,fn){
 const position=e.slot.position.clone(),offset=e.offset.position.clone(),scale=e.offset.scale.clone();
 try{e.slot.position.divideScalar(e.scale);e.offset.position.set(0,0,0);e.offset.scale.setScalar(1);e.slot.updateMatrixWorld(true);return fn();}
 finally{e.slot.position.copy(position);e.offset.position.copy(offset);e.offset.scale.copy(scale);e.slot.updateMatrixWorld(true);}
}
export function attachPhysics(e){
 const key=e.record.physics||byModel[e.hash],type=physicsTypes[key];if(!type)return false;
 e.record.physics=key;e.physics=inPhysicsFrame(e,()=>({hair:new type.Hair(e.rig),accessory:type.accessory?new AccessoryDynamics(e.rig):null}));e.physicsEnabled=e.record.physicsEnabled!==false;e.physicsReset=true;return true;
}
export function updatePhysics(e,dt){
 if(!e.physics)return;
 inPhysicsFrame(e,()=>{const {hair,accessory}=e.physics;if(e.physicsReset){hair.reset();accessory?.reset();e.physicsReset=false;}hair.enabled=e.physicsEnabled;if(accessory)accessory.enabled=e.physicsEnabled;if(e.physicsEnabled&&e.state!=='bind'){hair.update(dt);accessory?.update(dt);}});
}
export function kickPhysics(e){if(e.physics)inPhysicsFrame(e,()=>{e.physics.hair.enabled=true;if(e.physics.accessory)e.physics.accessory.enabled=true;if(e.physicsReset){e.physics.hair.reset();e.physics.accessory?.reset();e.physicsReset=false;}e.physics.hair.kick?.();e.physics.accessory?.kick?.();});}
export function supportsPhysics(key){return Object.hasOwn(physicsTypes,key??'');}
