import * as THREE from '../three/build/three.module.js';
import {CHARACTER_BASELINE} from './character-baseline.mjs';
import {applyTonalColors} from './tonal-colors.mjs';
import {applyHairColors} from './hair-colors.mjs';
export const palette={skin:'#f3d9cb',hair:'#bac3c9',hairLight:'#e4e7e6',hairShade:'#82909e',backHairLight:'#919eaa',backHairDeep:'#798793',sideHairShade:'#aeb9c2',hairSoftLight:'#d4dadd',hairSoftShade:'#a1aeb9',coat:'#20242b',coatLight:'#30353c',lining:'#192c43',trim:'#9fa4a4',eyeWhite:'#f5f4ed',eyeHighlight:'#ffffff',irisUpper:'#6b807a',iris:'#788c86',irisLower:'#82968f',dark:'#24282e',sole:'#151a20',ear:'#505b66'};
export function createCharacter(){
 const vox=new Map(),s=.085;
 const headParts=new Set(['Head','Hair','Fringe','Face','Bow','Ribbon_L','Ribbon_R','BowWing_L','BowWing_R','SideHair_L','SideHair_R','HairBand_L','HairBand_R','Ears','Clips']);
 function motionGroup(p){if(headParts.has(p)&&!p.startsWith('Ribbon_')&&!p.startsWith('BowWing_')&&!p.startsWith('SideHair_')&&!p.startsWith('HairBand_'))return 'head';if(p==='Bodice')return 'chest';return p;}
 function put(x,y,z,c,p){
  // Broad, gently stepped tonal locks; no new geometry or independently moving strands.
  if(p==='Hair'&&z<=-6&&y<=41){
   const shift=y<27?1:0;
   const left=y>=20&&y<=39&&x>=-6+shift&&x<=-3+shift;
   const right=y>=18&&y<=36&&x>=1-shift&&x<=4-shift;
   if(left||right)c='backHairLight';
   else if(y>=22&&y<=37&&x>=5&&x<=7)c='backHairDeep';
  }
  if(p==='Hair'&&Math.abs(x)>=8&&z>=-5&&z<=-2&&y>=23&&y<=36)c='sideHairShade';
  if(headParts.has(p))y-=1;if(p==='Hair'&&Math.abs(x)>=7&&y<=32&&z>=3&&z<=4)return;if(p==='Hair'&&Math.abs(x)>=7&&z>=-5&&y<34)p='SideHair_'+(x<0?'R':'L');if(p==='Hair'&&z<=-5&&y<29)p='LongHair_'+(x<0?'R':'L');vox.set(`${motionGroup(p)}|${x},${y},${z}`,{x,y,z,c,p});}
 function box(x0,x1,y0,y1,z0,z1,c,p){for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)put(x,y,z,c,p);}
 // Chamfered block head, face points +Z. The model is authored as voxel regions.
 for(let x=-8;x<=8;x++)for(let y=29;y<=43;y++)for(let z=-6;z<=6;z++)if(Math.abs(x)+Math.abs(z)<=12)put(x,y,z,'skin','Head');
 box(-1,1,26,28,-1,1,'skin','Neck');
 for(let x=-10;x<=10;x++)for(let y=28;y<=46;y++)for(let z=-8;z<=7;z++){
  const corner=Math.abs(x)+Math.abs(z)<=15, top=y<=46-Math.floor(Math.abs(x)/4)-Math.floor(Math.max(0,Math.abs(z)-3)/3);
  const side=Math.abs(x)>=8&&y>=29+(Math.abs(z)%3),back=z<=-5&&y>=29+(Math.abs(x)%3),cap=y>=41;
  if(corner&&top&&(side||back||cap))put(x,y,z,y>=44?'hairLight':z<-5?'hairShade':'hair','Hair');
 }
 // Broad silver locks; two moving back groups and rigid face framing locks.
 for(let x=-9;x<=9;x++)for(let y=16+Math.floor(Math.abs(x)/3);y<=38;y++)for(let z=-9;z<=-6;z++){
  if(Math.abs(x)<=8+Math.floor((y-20)/9))put(x,y,z,'hairShade','Hair');
 }
 for(const sign of [-1,1]){
  // One broad continuous side lock with a single tapered end; no horizontal highlight bands.
  for(let y=20;y<=35;y++){const lo=8,hi=y<22?9:10;box(sign>0?lo:-hi,sign>0?hi:-lo,y,y,-5,y<34?2:5,'hair','Hair');}
  box(sign>0?7:-9,sign>0?9:-7,25,35,5,6,'hair','SideHair_'+(sign>0?'L':'R'));
  // Pointed ears, firm silhouette rooted in the skull cap.
  for(let y=44;y<=51;y++){const width=Math.max(1,4-Math.floor((y-44)/2)),cx=sign*(7+Math.floor((y-44)/3));box(cx-width,cx+width,y,y,-3,0,'ear','Ears');if(y<50)box(cx-width+1,cx+width-1,y,y,1,1,'hairLight','Ears');}
 }
 box(5,8,40,40,8,8,'dark','Clips');box(6,9,42,42,7,7,'dark','Clips');
 for(let x=-8;x<=8;x++){
  const bottom= x< -4?35+(x+8)%3:x<=0?37+Math.abs(x)%3:x<5?36+Math.abs(x-2):36+(x%3);
  for(let y=bottom;y<=43;y++)for(let z=6;z<=(x>=-2&&x<=0?8:7);z++){
   const highlight=(x>=-5&&x<=-3&&y>=39&&y<=41)||(x>=0&&x<=2&&y>=41&&y<=43);
   const shadow=x>=4&&x<=6&&y>=37&&y<=39;
   put(x,y,z,z>=7&&highlight?'hairSoftLight':z>=7&&shadow?'hairSoftShade':'hair','Fringe');
  }
 }
 for(const sign of [-1,1]){
  box(sign<0?-6:3,sign<0?-3:6,33,36,6,6,'eyeWhite','Face');
  // Keep the original iris in the middle; use only a small shift above/below it.
  for(let y=33;y<=35;y++)box(sign<0?-5:3,sign<0?-3:5,y,y,6,6,y===35?'irisUpper':y===33?'irisLower':'iris','Face');
  box(sign<0?-5:3,sign<0?-3:5,36,36,6,6,'dark','Face');
  put(sign*4,35,6,'eyeHighlight','Face');
  box(sign<0?-8:7,sign<0?-7:8,31,32,6,6,'skin','Head');
 }
 // Jacket torso, high collar, asymmetric closure and two metallic ring clasps.
 box(-4,4,18,26,-3,3,'coat','Bodice');
 for(let y=26;y<=28;y++)for(let x=-3;x<=3;x++)for(let z=-3;z<=4;z++)if(Math.abs(x)===3||z===-3||z===4)put(x,y,z,'coatLight','Collar');
 for(let y=19;y<=26;y++){const x=Math.floor((y-21)/2);put(x,y,4,'coatLight','Bodice');}
 // Chest strip is a separate, thin suspended ribbon below.
 for(const yy of [22,24]){for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])put(-1+dx,yy+dy,4,'trim','Bodice');put(-1,yy,4,'dark','Bodice');}
 // Open split coat panels, rooted at waistband, no skirt across bare legs.
 for(let y=10;y<=18;y++){
  const rx=5+Math.floor((18-y)/4),rz=4;
  for(let x=-rx;x<=rx;x++)for(let z=-rz;z<=rz;z++){
   if(!(Math.abs(x)===rx||Math.abs(z)===rz))continue;
   if(z>0&&Math.abs(x)<2+Math.floor((18-y)/3))continue;
   if(z===-4&&Math.abs(x)<=1&&y>=13&&y<=15)continue; // Tail opening in back coat.
   put(x,y,z,y===10?'coatLight':z===-4?'coat':'coatLight','Coat_'+(x<0?'R':'L'));
  }
 }
 box(-4,4,15,17,-2,2,'dark','Shorts');box(-4,-1,13,14,-2,2,'dark','Shorts');box(1,4,13,14,-2,2,'dark','Shorts');
 box(-4,4,17,17,3,3,'coatLight','Shorts');box(-1,0,17,17,4,4,'trim','Shorts');
 // Bind tail straight rearwards from the pelvis; geometry follows three longitudinal joints.
 for(let t=0;t<=13;t++){
  const z=-3-t,w=t<3?1:t<10?2:Math.max(1,Math.floor((13-t)/2)),cy=14;
  for(let x=-w;x<=w;x++)for(let y=cy-w;y<=cy+w;y++)if(Math.abs(x)+Math.abs(y-cy)<=w+1)
   put(x,y,z,t>=11?'hairLight':x===-w?'hair':'hairShade','Tail');
 }
 // Greedy mesh only exposed faces; merge coplanar cells by region and color.
 const planes=new Map();
 for(const v of vox.values())for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const xyz=[v.x,v.y,v.z],nb=[...xyz];nb[axis]+=sign;if(vox.has(`${motionGroup(v.p)}|${nb.join(',')}`))continue;
  const u=(axis+1)%3,w=(axis+2)%3,key=[v.p,v.c,axis,sign,xyz[axis]+sign*.5,(v.p.startsWith('SideHair_')||v.p.startsWith('Coat_')||v.p.startsWith('LongHair')||v.p.startsWith('Ribbon_'))?Math.floor(v.y/2):v.p==='Tail'?v.z:0].join('|');
  if(!planes.has(key))planes.set(key,new Set());planes.get(key).add(`${xyz[u]},${xyz[w]}`);
 }
 const parts=new Map();
 for(const [key,cells] of planes){const [part,color,aa,ss,pp]=key.split('|'),axis=+aa,sign=+ss,plane=+pp,u=(axis+1)%3,w=(axis+2)%3;
  if(!parts.has(part))parts.set(part,{position:[],normal:[],color:[],index:[]});const data=parts.get(part),rgb=new THREE.Color(palette[color]);
  while(cells.size){const [a,b]=cells.values().next().value.split(',').map(Number);let width=1,height=1;
   while(cells.has(`${a+width},${b}`))width++;
   outer:while(true){for(let i=0;i<width;i++)if(!cells.has(`${a+i},${b+height}`))break outer;height++;}
   for(let i=0;i<width;i++)for(let j=0;j<height;j++)cells.delete(`${a+i},${b+j}`);
   const corners=[[a-.5,b-.5],[a+width-.5,b-.5],[a+width-.5,b+height-.5],[a-.5,b+height-.5]],base=data.position.length/3;
   for(const [xx,yy]of corners){const p=[0,0,0],n=[0,0,0];p[axis]=plane;p[u]=xx;p[w]=yy;p[1]+=.5;n[axis]=sign;data.position.push(...p.map(v=>v*s));data.normal.push(...n);data.color.push(rgb.r,rgb.g,rgb.b);}
   data.index.push(...(sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).map(i=>i+base));
  }
 }
 const root=new THREE.Group();root.name='SilverWolf_Voxel_Static';const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
 for(const [name,d]of parts){const g=new THREE.BufferGeometry();for(const attr of ['position','normal','color'])g.setAttribute(attr,new THREE.Float32BufferAttribute(d[attr],3));g.setIndex(d.index);g.computeBoundingBox();const mesh=new THREE.Mesh(g,material);mesh.name=name;root.add(mesh);}
 // Fixed proportions from the approved, iteratively refined Reimu character.
 const {detailScale:k,shoulderY,shoulderX,elbowX,wristX,tipX,hipY,kneeY,ankleY,legX,thickness}=CHARACTER_BASELINE;
 function prism(name,x0,x1,y0,y1,z0,z1,color,axis=0,cuts=[]){
  // Every longitudinal ring is retained so later elbow/knee weights can vary.
  const low=[x0,y0,z0],high=[x1,y1,z1],u=(axis+1)%3,v=(axis+2)%3;
  const rings=[low[axis],...cuts.filter(t=>t>low[axis]&&t<high[axis]),high[axis]].sort((a,b)=>a-b),pos=[],idx=[];
  for(const t of rings)for(const [a,b]of [[0,0],[1,0],[1,1],[0,1]]){const p=[0,0,0];p[axis]=t;p[u]=a?high[u]:low[u];p[v]=b?high[v]:low[v];pos.push(...p);}
  idx.push(0,2,1,0,3,2);const end=(rings.length-1)*4;idx.push(end,end+1,end+2,end,end+2,end+3);
  for(let r=0;r<rings.length-1;r++)for(let c=0;c<4;c++){const a=r*4+c,b=r*4+(c+1)%4;idx.push(a,b,b+4,a,b+4,a+4);}
  let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
  // Explicit hard face normals survive GLB export (flatShading is not glTF data).
  g=g.toNonIndexed();g.computeVertexNormals();g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  const rgb=new THREE.Color(palette[color]),colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(rgb.r,rgb.g,rgb.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();
  const mesh=new THREE.Mesh(g,material);mesh.name=name;root.add(mesh);
 }
 function wideSleeve(side,sign){
  const xs=[shoulderX-CHARACTER_BASELINE.sleeveRootOverlap,.40,.44,.56,elbowX-.04,elbowX,elbowX+.04,wristX-.03,wristX,1.075,1.11];
  const positions=[],indices=[],colors=[];
  function ring(x,inside){const t=(x-xs[0])/(xs.at(-1)-xs[0]),d=.17+.06*t,lower=.17+.08*t,wall=inside?.035:0;return [[-lower+wall,-d+wall],[.17-wall,-d+wall],[.17-wall,d-wall],[-lower+wall,d-wall]].map(([y,z])=>[sign*x,shoulderY+y,z]);}
  function quad(a,b,c,d,color){const start=positions.length/3,pts=sign>0?[a,b,c,d]:[d,c,b,a],rgb=new THREE.Color(palette[color]);for(const p of pts){positions.push(...p);colors.push(rgb.r,rgb.g,rgb.b);}indices.push(start,start+1,start+2,start,start+2,start+3);}
  for(let k=0;k<xs.length-1;k++){const a=ring(xs[k],false),b=ring(xs[k+1],false),ai=ring(xs[k],true),bi=ring(xs[k+1],true),color=xs[k]>=1.075?'trim':'coat';for(let c=0;c<4;c++){const n=(c+1)%4;quad(a[c],a[n],b[n],b[c],color);quad(ai[n],ai[c],bi[c],bi[n],'lining');}}
  for(const [x,flip]of [[xs[0],true],[xs.at(-1),false]]){const a=ring(x,false),b=ring(x,true);for(let c=0;c<4;c++){const n=(c+1)%4;if(flip)quad(a[n],a[c],b[c],b[n],'coatLight');else quad(a[c],a[n],b[n],b[c],'coatLight');}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();const mesh=new THREE.Mesh(g,material);mesh.name='Sleeve_'+side;root.add(mesh);
 }
 for(const sign of [-1,1]){
  const side=sign>0?'L':'R',span=(a,b)=>sign>0?[a,b]:[-b,-a],h=thickness/2;
  prism('Arm_'+side,...span(shoulderX,tipX),shoulderY-h,shoulderY+h,-h,h,'skin',0,[shoulderX+.1,elbowX-.04,elbowX,elbowX+.04,wristX].map(x=>sign*x));
  // Cover the arm's proximal cap beyond the shoulder pivot, including in motion.
  wideSleeve(side,sign);
  const cx=sign*legX;
  prism('Leg_'+side,cx-h,cx+h,ankleY,hipY,-h,h,'skin',1,[kneeY-.04,kneeY,kneeY+.04]);
  prism('Sock_'+side,cx-.145*k,cx+.145*k,.18*k,.32*k,-.145*k,.15*k,'coat');
  prism('Shoe_'+side,cx-.15*k,cx+.15*k,.045*k,.18*k,-.15*k,.25*k,'coat');
  prism('Sole_'+side,cx-.15*k,cx+.15*k,0,.045*k,-.15*k,.25*k,'sole');
  prism('ShoeBand_'+side,cx-.16*k,cx+.16*k,.135*k,.17*k,.25*k,.27*k,'trim');
  prism('ShoeBuckle_'+side,cx+.06*k,cx+.12*k,.22*k,.29*k,.15*k,.17*k,'trim');
  prism('ShoeStrap_'+side,cx-.14*k,cx+.14*k,.37*k,.405*k,-.14*k,.15*k,'coat');
  prism('Patch_'+side,...span(.43,.56),shoulderY+.171,shoulderY+.181,-.085,.085,'trim');

 }
 prism('ChestRibbon',.2125,.2975,1.445,2.295,.46,.485,'trim',1,[1.53,1.615,1.70,1.785,1.87,1.955,2.04,2.125,2.21]);
 // Sew the upper band onto the collar. A short fixed ramp connects to the free strip.
 const ribbonGeometry=root.getObjectByName('ChestRibbon').geometry,ribbonPositions=ribbonGeometry.attributes.position;
 for(let i=0;i<ribbonPositions.count;i++){const y=ribbonPositions.getY(i),t=THREE.MathUtils.clamp((y-2.125)/.085,0,1);ribbonPositions.setZ(i,ribbonPositions.getZ(i)-.0875*t);}
 ribbonGeometry.computeVertexNormals();ribbonGeometry.computeBoundingBox();

 material.flatShading=true;
 root.userData={reference:"Silver Wolf approved model; see baseline-provenance.json",styleBaseline:CHARACTER_BASELINE.id,style:'stepped voxel chibi',pose:'T-pose authored geometry',static:true,wings:false,voxelSize:s,voxelCount:vox.size,headRefinement:{headOffsetY:-s,neckWidth:3*s,neckJointY:2.26,headJointY:2.465-s},limbReference:{source:CHARACTER_BASELINE.id,detailScale:k,shoulderX,shoulderY,elbowX,wristX,tipX,hipY,kneeY,ankleY,legX,thickness},triangles:root.children.reduce((n,m)=>n+m.geometry.index.count/3,0)};
 applyTonalColors(root);
 applyHairColors(root,palette);
 return root;
}
