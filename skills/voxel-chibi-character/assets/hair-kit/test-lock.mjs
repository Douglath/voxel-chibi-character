import assert from 'node:assert/strict';
import * as THREE from '../dependencies/three/build/three.module.js';
import {createLockGeometry,mirrorSections,voxelizeLock} from './lock-geometry.mjs';
const s=[{x:.6,y:1,z:.5,width:.4,depth:.2},{x:.8,y:.4,z:.6,width:.3,depth:.16},{x:.5,y:-.4,z:.65,width:.1,depth:.08}];
const g=createLockGeometry(THREE,s),p=g.attributes.position,edges=new Map();let volume=0;
const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
for(let i=0;i<p.count;i+=3){
 a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
 assert(new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).length()>1e-8,'degenerate triangle');
 volume+=a.dot(new THREE.Vector3().crossVectors(b,c))/6;
 const pts=[a,b,c].map(v=>v.toArray().join(','));
 for(let j=0;j<3;j++){const u=pts[j],v=pts[(j+1)%3],key=[u,v].sort().join('|');const e=edges.get(key)||[0,0];e[0]++;e[1]+=u<v?1:-1;edges.set(key,e);}
}
assert(volume>0,'outward winding');assert([...edges.values()].every(([n,d])=>n===2&&d===0),'watertight oriented surface');
assert.deepEqual(mirrorSections(mirrorSections(s)),s);
const cells=voxelizeLock(s,.085),set=new Set(cells.map(c=>c.join(',')));
assert.equal(cells.length,set.size);assert(cells.every(c=>c.every(Number.isInteger)));
const reached=new Set(),queue=[cells[0]];
while(queue.length){const c=queue.pop(),key=c.join(',');if(reached.has(key))continue;reached.add(key);for(let axis=0;axis<3;axis++)for(const d of [-1,1]){const n=[...c];n[axis]+=d;if(set.has(n.join(','))&&!reached.has(n.join(',')))queue.push(n);}}
assert.equal(reached.size,cells.length,'example lock voxel occupancy is connected');
assert.throws(()=>createLockGeometry(THREE,[s[0],s[0]]));assert.throws(()=>voxelizeLock(s,0));
assert.throws(()=>createLockGeometry(THREE,[s[0],{...s[1],depth:0}]));
console.log(JSON.stringify({closed:true,outward:true,connectedVoxelCells:cells.length,triangles:p.count/3}));
