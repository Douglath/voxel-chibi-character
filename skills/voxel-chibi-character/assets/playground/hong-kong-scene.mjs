import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// An original, compact Hong Kong-inspired street set. No reference image is used as geometry.
export function createHongKongScene(extent=28){
 const root=new T.Group();root.name='Hong_Kong_Blue_Hour_Crossroads';root.userData={units:'playground units',characterHeight:4,description:'Original fictional shops, blue-hour pedestrian crossroads'};
 const materials=new Map(),unitBox=new T.BoxGeometry(1,1,1),roadHalf=11.6,blockSize=15.8,center=roadHalf+2.5+blockSize/2,outer=Math.max(extent+6,center+blockSize/2+1.1);
 function material(color,roughness=.78,emissive=null,intensity=0){const key=[color,roughness,emissive,intensity].join(':');if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness,metalness:roughness<.5?.2:0,emissive:emissive??0,emissiveIntensity:intensity}));return materials.get(key);}
 function box(g,name,x,y,z,w,h,d,color,rough=.78,emissive=null,intensity=0){const m=new T.Mesh(unitBox,typeof color==='object'?color:material(color,rough,emissive,intensity));m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 function cylinder(g,name,x,y,z,r,h,color,sides=10){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,sides),material(color,.55));m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 function line(g,name,a,b,width,color){const from=new T.Vector3(...a),to=new T.Vector3(...b),m=box(g,name,0,0,0,width,from.distanceTo(to),width,color,.5);m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.sub(from).normalize());return m;}
 function sign(g,name,text,sub,x,y,z,w,h,bg,fg,rotation=0,vertical=false){
  const canvas=document.createElement('canvas');canvas.width=vertical?256:1024;canvas.height=vertical?1024:256;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle=fg;c.lineWidth=5;c.strokeRect(14,14,canvas.width-28,canvas.height-28);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';
  if(vertical){c.font='bold 148px "Microsoft JhengHei","Microsoft YaHei",sans-serif';[...text].forEach((ch,i)=>c.fillText(ch,128,150+i*210));}
  else{c.font='bold 118px "Microsoft JhengHei","Microsoft YaHei",sans-serif';c.fillText(text,512,108,940);c.font='27px "Segoe UI",sans-serif';c.fillText(sub,512,210,930);}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;const mat=new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:1.45,roughness:.55});
  const panel=new T.Group();panel.name=name;panel.position.set(x,y,z);panel.rotation.y=rotation;box(panel,'metal sign casing',0,0,-.08,w+.16,h+.16,.22,0x26323c,.45);const face=new T.Mesh(new T.PlaneGeometry(w,h),mat);face.name='painted illuminated lettering';face.position.z=.044;panel.add(face);g.add(panel);return panel;
 }
 function plane(g,name,w,h,color,opacity,x,y,z){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.name=name;g.add(m);return m;}
 function lightPool(g,x,z,color,radius,opacity=.16){const cvs=document.createElement('canvas');cvs.width=cvs.height=128;const c=cvs.getContext('2d'),gradient=c.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.7)');gradient.addColorStop(.3,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gradient;c.fillRect(0,0,128,128);const m=plane(g,'soft reflected shop light',radius*2,radius*2,color,opacity,x,.035,z);m.material.map=new T.CanvasTexture(cvs);m.userData.webEffect=true;}
 function batch(group){
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),buckets=new Map(),remove=[];
  group.traverse(m=>{if(!m.isMesh||m.material.transparent||m.userData.webEffect)return;const key=m.material.uuid;if(!buckets.has(key))buckets.set(key,{material:m.material,geometries:[]});const geo=m.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld));buckets.get(key).geometries.push(geo.index?geo.toNonIndexed():geo);remove.push(m);});
  for(const m of remove)m.removeFromParent();for(const b of buckets.values()){const geometry=mergeGeometries(b.geometries,false);b.geometries.forEach(g=>g.dispose());if(!geometry)continue;const mesh=new T.Mesh(geometry,b.material);mesh.name=group.name+' / '+(b.material.map?'lettering':'structure');mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
 }

 const base=new T.Group();base.name='Roads_Pavements_and_Base';root.add(base);
 box(base,'solid diorama foundation',0,-.58,0,outer*2+1,1.05,outer*2+1,0x101925,.75);
 box(base,'blue hour asphalt',0,-.07,0,outer*2,.13,outer*2,0x283442,.42);
 const marking=material(0xe5c56a,.87),lineWhite=material(0xacb6ad,.9);
 // Broad perpendicular roads, real curb thickness and tiled pavement in the four corners.
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const size=outer-roadHalf,x=sx*(roadHalf+size/2),z=sz*(roadHalf+size/2);box(base,'raised corner pavement',x,.07,z,size,.2,size,0x667074,.9);
  for(let i=0;i<Math.ceil(size/2);i++){
   box(base,'pavement slab joint X',sx*(roadHalf+.8+i*2),.179,z,.027,.008,size,0x3e4a55);
   box(base,'pavement slab joint Z',x,.18,sz*(roadHalf+.8+i*2),size,.008,.027,0x3e4a55);
  }
  box(base,'continuous curb along x',x,.19,sz*(roadHalf+.08),size,.32,.23,0xa5a49a);
  box(base,'continuous curb along z',sx*(roadHalf+.08),.19,z,.23,.32,size,0xa5a49a);
 }
 for(const sign of [-1,1]){
  for(const off of [0,.28]){
   box(base,'double yellow kerb line',sign*(roadHalf-.48-off),.013,0,.085,.015,outer*2,marking);
   box(base,'double yellow kerb line',0,.014,sign*(roadHalf-.48-off),outer*2,.015,.085,marking);
  }
  for(let i=0;i<6;i++){
   const at=sign*(16+i*3.0);box(base,'lane centre dash',0,.016,at,.13,.012,1.7,lineWhite);box(base,'lane centre dash',at,.016,0,1.7,.012,.13,lineWhite);
  }
  // Hong Kong-inspired yellow pedestrian crossings, four independently readable arms.
  for(let i=-6;i<=6;i++){box(base,'yellow zebra crossing',i*1.32,.018,sign*12.9,.64,.017,3.1,marking);box(base,'yellow zebra crossing',sign*12.9,.018,i*1.32,3.1,.017,.64,marking);}
 }
 const half=7.8;
 for(const sign of [-1,1])for(let k=-12;k<=12;k+=2.6){const points=[];for(const x of [-half,half]){const z=sign*x+k;if(Math.abs(z)<=half)points.push([x,z]);}for(const z of [-half,half]){const x=(z-k)/sign;if(Math.abs(x)<half)points.push([x,z]);}if(points.length>=2){const [a,b]=points;line(base,'yellow box junction hatch',[a[0],.018,a[1]],[b[0],.018,b[1]],.045,marking);}}
 for(const z of [-half,half])box(base,'box junction outline',0,.018,z,half*2,.018,.075,marking);for(const x of [-half,half])box(base,'box junction outline',x,.018,0,.075,.018,half*2,marking);
 for(const p of [[-3,18],[17,3],[-17,-3],[3,-18]]){box(base,'drain frame',p[0],.02,p[1],.9,.025,1.5,0x172632,.4);for(let i=0;i<6;i++)box(base,'drain slot',p[0],.037,p[1]-.58+i*.22,.68,.018,.06,0x596168,.35);}
 batch(base);

 const shopConfigs=[
  {x:-center,z:-center,rotation:0,height:19.2,wall:0x8a8b82,trim:0x465862,title:'青禾茶餐廳',sub:'QING HE  ·  MILK TEA & TOAST',second:'夜半麵家',bg:'#681f2b',fg:'#ffd3a0',accent:0xdd8360,interior:0xffc48b},
  {x:center,z:-center,rotation:-Math.PI/2,height:16.4,wall:0x738c83,trim:0x345f66,title:'海角便利',sub:'HARBOUR MART  ·  OPEN 24 HOURS',second:'星光冰室',bg:'#193d41',fg:'#c3f5d3',accent:0x70d5c1,interior:0xc6ffe0},
  {x:-center,z:center,rotation:Math.PI/2,height:11.1,wall:0x9a8576,trim:0x5c5360,title:'金記燒味',sub:'KAM KEE  ·  ROAST & RICE',second:'永安茶行',bg:'#692f29',fg:'#ffe0a5',accent:0xeb9a5c,interior:0xffb474},
  {x:center,z:center,rotation:Math.PI,height:8.9,wall:0x707e8a,trim:0x3e5167,title:'海風士多',sub:'SEA BREEZE  ·  CORNER STORE',second:'港角糖水',bg:'#23485d',fg:'#afe8ff',accent:0x69bfe6,interior:0xffc89a}
 ];
 const interiors=[];
 function facade(g,c,rotation,side=false){
  const f=new T.Group();f.name=side?'Side_Storefront':'Main_Storefront';f.rotation.y=rotation;g.add(f);const z=blockSize/2;
  // Recessed interior with actual shelves, counters and products behind the shopfront.
  box(f,'shop interior rear wall',0,2.5,z-2.4,15,4.65,.16,0xa69a7e);box(f,'shop ceiling',0,4.96,z-1.2,15.3,.16,2.9,0x3b454a);
  box(f,'shop tiled floor',0,.26,z-1.15,15.4,.12,3,0x969284,.48);
  for(const x of [-5.5,-2.7,3.7,6.2]){
   box(f,'stock shelf back',x,2.2,z-2.16,1.8,3.6,.14,0x6c6557);
   for(let shelf=0;shelf<4;shelf++){
    const yy=.68+shelf*.84;box(f,'shelf',x,yy,z-1.83,1.82,.09,.7,0xa49d82);
    for(let k=0;k<5;k++)box(f,'simplified shop stock',x-.68+k*.33,yy+.27,z-1.85,.2,.44,.28,[0xe1c7a0,0x88714a,0x6d9382,0xc78565,0xb9c6a5][(k+shelf)%5],.75);
   }
  }
  box(f,'service counter',-4.4,1.03,z-.65,4,.95,.85,0x826b50);box(f,'counter top',-4.4,1.54,z-.65,4.2,.12,1,0xc0b397,.48);
  for(const x of [-5.5,-4.8,-4.1])cylinder(f,'tea cups',x,1.79,z-.6,.14,.36,0xe4d5b9,10);
  box(f,'interior fluorescent panel',0,4.78,z-1.15,10,.09,.34,0xf8e6c0,.4,0xffddaa,3.2);
  for(const x of [-7.35,-2,.6,7.35])box(f,'storefront vertical frame',x,2.48,z+.06,.12,4.8,.18,c.trim,.4);
  box(f,'storefront upper frame',0,4.72,z+.07,15,.15,.2,c.trim,.4);box(f,'storefront lower frame',0,.4,z+.07,15,.18,.2,c.trim,.4);
  const glassMaterial=new T.MeshStandardMaterial({color:0xb8dce0,roughness:.2,metalness:.15,transparent:true,opacity:.13,depthWrite:false});
  for(const [x,w]of [[-4.7,5.1],[4.05,6.5]])box(f,'glass shop window',x,2.52,z+.015,w,4.1,.026,glassMaterial);
  box(f,'door handle',.41,2.06,z+.2,.055,.72,.07,0xb9bcb7,.22);
  sign(f,'illuminated main shop fascia',side?c.second:c.title,side?'HONG KONG · AFTER HOURS':c.sub,0,5.42,z+.4,14.7,1.27,c.bg,c.fg);
  // Thin striped awning held by two real struts.
  const awning=new T.Group();awning.position.set(0,4.62,z+.24);awning.rotation.x=-.12;
  for(let i=0;i<16;i++)box(awning,'awning stripe',-7.25+i*.96,0,.7,.96,.12,1.6,i%2?0xc6b898:c.accent);f.add(awning);
  for(const x of [-6.5,6.5])line(f,'awning support',[x,3.8,z+.1],[x,4.62,z+1.62],.055,0x52585b);
  const menus=new T.Group();menus.position.set(6.1,.21,z+1.38);menus.rotation.y=-.16;box(menus,'menu board frame',0,1.05,0,1.25,2.1,.12,0x7a6c4e);sign(menus,'small menu','營業中','OPEN · 歡迎光臨',0,1.07,.09,1.06,1.68,'#263b3c','#e9dbb5');f.add(menus);
  // A shallow, physically illuminated shop entrance. The pool is a restrained viewport accent.
  if(!side){const lamp=new T.PointLight(c.interior,110,26,2);lamp.position.set(-.7,3.7,z+1.0);lamp.name='Shop_Entrance_Light';f.add(lamp);interiors.push(lamp);lightPool(f,0,z+3.3,c.interior,6,.12);}
 }
 shopConfigs.forEach((c,index)=>{
  const g=new T.Group();g.name='Block_'+(index+1)+'_'+c.title;g.position.set(c.x,.19,c.z);g.rotation.y=c.rotation;root.add(g);
  box(g,'ground floor service core',-1.32,2.55,-1.32,13.16,5.1,13.16,0x566069);box(g,'upper tenement mass',0,(c.height+5.8)/2,0,blockSize,c.height-5.8,blockSize,c.wall);
  for(const x of [-7.9,0,7.9])box(g,'masonry corner pier',x,2.5,7.86,.28,5,.42,c.wall);box(g,'side masonry corner pier',7.86,2.5,0,.42,5,.28,c.wall);
  facade(g,c,0);facade(g,c,Math.PI/2,true);
  const floors=Math.floor((c.height-6.5)/3.0);
  for(let floor=0;floor<floors;floor++){
   const y=7.6+floor*3.0;
   for(const rot of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const f=new T.Group();f.rotation.y=rot;g.add(f);
    box(f,'horizontal floor band',0,y+1.5,8.01,16.1,.13,.24,c.trim);
    for(let col=0;col<4;col++){
     const x=-5.85+col*3.9,lit=(floor+col+index)%3!==0;
     box(f,'window surround',x,y,8.035,2.72,2.24,.18,c.trim);box(f,'window recess',x,y,8.143,2.42,1.99,.04,lit?0xcfaf73:0x263c52,.44,lit?0xfac789:0x477296,lit?.5:.05);
     box(f,'window mullion',x,y,8.2,.065,2.02,.075,0xb5b4a2);box(f,'window transom',x,y-.2,8.2,2.46,.055,.075,0xb5b4a2);
     if((col+floor)%2===0){box(f,'external AC casing',x+.95,y-1.28,8.4,.93,.55,.7,0xb0ada0);for(let slat=0;slat<4;slat++)box(f,'AC grille',x+.95,y-1.48+slat*.13,8.765,.69,.035,.025,0x505963);}
     if(rot===0&&floor===0){box(f,'balcony slab',x,y-1.26,8.36,2.96,.17,.96,0x888c83);for(const bx of [-1.22,-.4,.4,1.22])box(f,'balcony rail',x+bx,y-.74,8.83,.055,1,.055,c.trim);box(f,'balcony top rail',x,y-.23,8.83,2.62,.065,.065,c.trim);}
    }
   }
  }
  box(g,'roof coping',0,c.height+.08,0,16.4,.23,16.4,0x6d7b83);box(g,'roof surface',0,c.height+.22,0,15.75,.12,15.75,0x4e5b65);
  for(const x of [-7.86,7.86])box(g,'roof parapet',x,c.height+.75,0,.16,1.1,16,0x7c898c);for(const z of [-7.86,7.86])box(g,'roof parapet',0,c.height+.75,z,16,1.1,.16,0x7c898c);
  for(const x of [-4.5,2.8]){box(g,'rooftop service enclosure',x,c.height+1.2,-3.8,2.8,1.8,2.6,0x65747d);cylinder(g,'rooftop vent',x,c.height+2.23,-3.8,.55,.28,0x9aa4a7,12);}
  cylinder(g,'roof antenna',4.7,c.height+2.45,4,.055,4.4,0x879ca7,8);for(const yy of [c.height+3.1,c.height+3.7])box(g,'antenna crossbar',4.7,yy,4,2.4,.055,.06,0x879ca7);
  // Projecting vertical signs connect to the facade on metal brackets.
  const neon=sign(g,'projecting vertical sign',index===0?'茶餐廳':index===1?'便利店':index===2?'燒味飯':'糖水舖','',-6.3,8.2,9.45,1.36,5.4,c.bg,c.fg,-.10,true);
  for(const yy of [6.2,10.3])line(g,'vertical sign bracket',[-6.3,yy,7.95],[-6.3,yy,9.3],.07,0x364957);
  // Utility pipes and small pavement props sit outside the traversable road domain.
  line(g,'wall utility pipe',[7.65,.4,8.21],[7.65,c.height,8.21],.08,0x536977);
  box(g,'stacked delivery crate',-7,.55,9.5,.9,.72,.8,0x678879);box(g,'stacked delivery crate',-7,1.15,9.5,.9,.43,.8,0x819c83);
  batch(g);
 });

 const street=new T.Group();street.name='Street_Furniture_and_Lamps';root.add(street);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=sx*(roadHalf+.75),z=sz*(roadHalf+.75);cylinder(street,'pedestrian signal pole',x,2.35,z,.095,4.7,0x364452,10);
  const signal=new T.Group();signal.position.set(x,4.0,z);signal.rotation.y=Math.atan2(-sx,-sz);box(signal,'traffic signal housing',0,0,0,.46,1.12,.32,0x192531,.45);box(signal,'red signal',0,.25,.18,.2,.2,.025,0x6c303a,.5,0xff5853,.3);box(signal,'green pedestrian signal',0,-.23,.18,.2,.26,.025,0x66e5bc,.4,0x66e5bc,3);street.add(signal);
  const lx=sx*(roadHalf+1.0),lz=sz*24.6;cylinder(street,'street lamp mast',lx,4.3,lz,.115,8.6,0x536478,10);line(street,'lamp arm',[lx,8.5,lz],[lx-sx*2.8,8.5,lz],.12,0x536478);box(street,'street light casing',lx-sx*2.65,8.42,lz,1.25,.22,.58,0x475765);box(street,'street light diffuser',lx-sx*2.65,8.28,lz,1.08,.045,.43,0xc9e6ff,.4,0xc9e6ff,3.1);
  const light=new T.PointLight(0xc1d9ff,72,25,2);light.name='Blue_White_Street_Lamp';light.position.set(lx-sx*2.65,7.7,lz);street.add(light);lightPool(street,lx-sx*2.6,lz,0xa6c7ee,7,.08);
  // Curb bollards don't obstruct the navigation channel.
  for(let k=0;k<3;k++)cylinder(street,'curb bollard',sx*(roadHalf+.9),.65,sz*(17.3+k*2.6),.10,1.3,0x7b878a,8);
  const plaque=sign(street,'bilingual street name','海角街','HARBOUR STREET',sx*(roadHalf+1.0),3.15,sz*(roadHalf+1.0),2.3,.67,'#233b3e','#d6e8d8',Math.atan2(-sx,-sz));
 }
 batch(street);
 root.updateMatrixWorld(true);
 return {root,extent,halfWidth:roadHalf-1.05,outer,shops:shopConfigs.map(c=>c.title),obstacleBoxes:shopConfigs.map(c=>({minX:c.x-blockSize/2,maxX:c.x+blockSize/2,minZ:c.z-blockSize/2,maxZ:c.z+blockSize/2})),exportRoot:root};
}
