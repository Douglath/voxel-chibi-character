// Hair construction helper; coordinates are local, Y up, +Z toward face.
// No reference interpretation, rigging, or inter-part face culling is performed.
export function createLockGeometry(THREE, sections) {
  if (!Array.isArray(sections) || sections.length < 2) throw Error('At least two sections required');
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (![s.x,s.y,s.z,s.width,s.depth].every(Number.isFinite) || s.width <= 0 || s.depth <= 0)
      throw Error('Sections need finite coordinates and positive width/depth');
    if (i && s.y >= sections[i-1].y) throw Error('Sections must descend in local Y; rotate the finished lock for other orientations');
  }
  const rings = sections.map(s => [
    [s.x-s.width/2,s.y,s.z-s.depth/2], [s.x+s.width/2,s.y,s.z-s.depth/2],
    [s.x+s.width/2,s.y,s.z+s.depth/2], [s.x-s.width/2,s.y,s.z+s.depth/2]
  ]);
  const positions=[], along=[];
  const quad=(a,b,c,d,ta,tb,tc,td)=>{
    for (const v of [a,c,b,a,d,c]) positions.push(...v);
    along.push(ta,tc,tb,ta,td,tc);
  };
  quad(...rings[0],0,0,0,0);
  const last=rings.length-1;
  quad(rings[last][3],rings[last][2],rings[last][1],rings[last][0],1,1,1,1);
  for(let i=0;i<last;i++) for(let j=0;j<4;j++) {
    const k=(j+1)%4;
    quad(rings[i][k],rings[i][j],rings[i+1][j],rings[i+1][k],i/last,i/last,(i+1)/last,(i+1)/last);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  // Semantic root-to-tip fraction for the caller's skin weights; this is not a simulation.
  geometry.setAttribute('lockAlong',new THREE.Float32BufferAttribute(along,1));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function mirrorSections(sections) {
  return sections.map(s=>({...s,x:-s.x}));
}

// Occupancy cells, not overlapping box meshes. Feed into the project's voxel mesher.
// The mesher must retain support faces across separately moving parts.
export function voxelizeLock(sections, step) {
  if (!Number.isFinite(step) || step<=0) throw Error('Positive voxel step required');
  // Reuse the public validation without allocating Three.js geometry.
  if (!Array.isArray(sections) || sections.length<2 || sections.some((s,i)=>
    ![s.x,s.y,s.z,s.width,s.depth].every(Number.isFinite)||s.width<=0||s.depth<=0||
    (i>0 && s.y>=sections[i-1].y))) throw Error('Invalid descending sections');
  const cells=[];
  let segment=0;
  for(let iy=Math.ceil(sections.at(-1).y/step);iy<=Math.floor(sections[0].y/step);iy++) {
    const y=iy*step;
    // y increases, so search independently (short lists of semantic control sections).
    segment=sections.findIndex((s,i)=>i<sections.length-1 && y<=s.y && y>=sections[i+1].y);
    if(segment<0) continue;
    const a=sections[segment],b=sections[segment+1],t=(a.y-y)/(a.y-b.y);
    const mix=k=>a[k]+(b[k]-a[k])*t, x=mix('x'),z=mix('z');
    const halfX=mix('width')/2,halfZ=mix('depth')/2;
    // Keep at least one cell for sub-grid tips; intentionally changes thickness to grid size.
    const xs=[Math.ceil((x-halfX)/step),Math.floor((x+halfX)/step)];
    const zs=[Math.ceil((z-halfZ)/step),Math.floor((z+halfZ)/step)];
    if(xs[0]>xs[1]) xs[0]=xs[1]=Math.round(x/step);
    if(zs[0]>zs[1]) zs[0]=zs[1]=Math.round(z/step);
    for(let ix=xs[0];ix<=xs[1];ix++) for(let iz=zs[0];iz<=zs[1];iz++) cells.push([ix,iy,iz]);
  }
  return cells;
}
