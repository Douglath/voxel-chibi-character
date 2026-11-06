import data from './sui-v4-local-data.mjs';

// Build in part-local coordinates, then bake exactly one placement matrix.
// No world-grid rounding is performed. Result meshes have identity transforms
// so exporters that only copy BufferGeometry still preserve placement.
export function createApprovedPart(THREE,kind,options={}){
 const preset=data.parts[kind];if(!preset)throw Error('Unknown approved part: '+kind);
 const {position=[0,0,0],rotation=[0,0,0],order='XYZ',scale=[1,1,1],mirror=false,palette={},includeMotifs=false,namePrefix=''}=options;
 if(![...position,...rotation,...scale].every(Number.isFinite)||scale.some(x=>x<=0))throw Error('Finite pose and positive local scale required');
 if(!['XYZ','YXZ','ZXY','ZYX','YZX','XZY'].includes(order))throw Error('Invalid Euler order');
 const local=new THREE.Matrix4().makeScale(scale[0]*(mirror?-1:1),scale[1],scale[2]);
 const pose=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation,order)),new THREE.Vector3(1,1,1));
 const combined=pose.clone().multiply(local),group=new THREE.Group();group.name=namePrefix+kind;
 for(const saved of preset.meshes){
  if(!includeMotifs&&saved.name==='HatHeart')continue;
  const g=new THREE.BufferGeometry();for(const a of ['position','normal','color'])g.setAttribute(a,new THREE.Float32BufferAttribute(saved.attributes[a],3));
  let indices=saved.index.slice();
  if(!includeMotifs&&kind==='halo')indices=indices.filter((_,i)=>{const start=Math.floor(i/3)*3;return ![0,1,2].every(k=>saved.semantic[indices[start+k]]==='goldLight');});
  if(mirror)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  g.setIndex(indices);
  for(let i=0;i<saved.semantic.length;i++){const value=palette[saved.semantic[i]];if(value!==undefined){const c=new THREE.Color(value);g.attributes.color.setXYZ(i,c.r,c.g,c.b);}}
  g.applyMatrix4(combined);g.computeBoundingBox();g.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,...saved.material,flatShading:true});
  const mesh=new THREE.Mesh(g,material);mesh.name=namePrefix+saved.name;mesh.userData.component={kind,localScale:scale,mirror,position,rotation,order};group.add(mesh);
 }
 return group;
}

// Convenience for reproducing the approved reference pose. For a new character
// pass that character's anchors and proportions instead of copying this pose.
export function approvedPose(kind){const p=data.parts[kind];if(!p)throw Error(kind);return structuredClone(p.defaultPose);}

// Model builders/exporters often traverse only root.children. Attach the baked
// meshes directly without losing material or creating double transformations.
export function attachApprovedPart(root,part){for(const mesh of [...part.children])root.add(mesh);return root;}
