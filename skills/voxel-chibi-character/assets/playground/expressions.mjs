import * as THREE from 'three';
export const names={Normal:'普通',Happy:'开心',Angry:'生气',Crying:'哭泣',Scared:'害怕',Confused:'困惑',Hungry:'馋了',Closed:'闭眼'};
export const defaults={Normal:[],Happy:['blush'],Angry:['anger'],Crying:['tears'],Scared:['sweat'],Confused:[],Hungry:['spark','drool'],Closed:[]};
export const layerNames={blush:'腮红',tears:'眼泪',sweat:'汗滴',anger:'怒气',spark:'饥饿闪光',drool:'口水'};
// Row-major templates, top to bottom. W white, H highlight, U/I/L iris, D liner.
// Coordinates are the v5 voxel coordinates before its head Y offset.
const normal=[['WDDD','WUHU','WIII','WLLL'],['DDDW','UHUW','IIIW','LLLW']];
export const blinkTemplates={
 // Upper lid descends; the original iris bottom stays at row 33.
 // The highlight is occluded, rather than moving down with the lid.
 half:{rows:[['WDDD','WLLL'],['DDDW','LLLW']],y:34,step:1},
 // Neutral flat closure: same one-voxel weight and three-voxel span as
 // each original upper liner, at the lower closing position. No smiling tips.
 shut:{rows:[['.DDD'],['DDD.']],y:33.5,step:1}
};
export const templates={Normal:{rows:normal,y:36,step:1},Crying:{rows:normal,y:36,step:1},
 Happy:{rows:[['.DD.','D..D'],['.DD.','D..D']],y:34,step:1},
 Angry:{rows:[['DDDD','WUII'],['DDDD','IIUW']],y:34,step:1},
 Scared:{rows:[['WDDD','WDHD','WDHD','WDDD'],['DDDW','DHDW','DHDW','DDDW']],y:36,step:1},
 Confused:{rows:[['DDDDDDD','D.....D','D.DDD.D','D.D.D.D','D.D...D','D.DDDDD','D......'],['DDDDDDD','D.....D','D.DDD.D','D.D.D.D','D.D...D','D.DDDDD','D......']],y:36,step:4/7},
 Hungry:{rows:[['DDDD','WUHI'],['DDDD','IHUW']],y:34,step:1},
 Closed:{rows:[['DDDD'],['DDDD']],y:34,step:1}};
export function irisPalette(hex){
 if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Expected #rrggbb');
 const v=hex.slice(1).match(/../g).map(x=>parseInt(x,16));
 const shade=d=>'#'+v.map((x,i)=>Math.max(0,Math.min(255,x+d[i])).toString(16).padStart(2,'0')).join('');
 return {U:shade([-13,-12,-12]),I:hex,L:shade([10,10,9])};
}
export function attachExpressions(rig,characterPalette={},layout={}){
 const face=rig.getObjectByName('Face'),head=rig.getObjectByName('head');
 if(!face||!head)throw Error('v5 Face/head contract missing');
 rig.updateMatrixWorld(true);
 const original=face.geometry,skin=original.clone(),colors=skin.attributes.color;
 const skinColor=new THREE.Color(characterPalette.skin??'#f3d9cb');for(let i=0;i<colors.count;i++)colors.setXYZ(i,skinColor.r,skinColor.g,skinColor.b);
 const material=face.material,group=new THREE.Group();group.name='ExpressionLayers';head.add(group);
 // Transform authored world coordinates into the existing head bind frame.
 const inverse=head.matrixWorld.clone().invert();
 const sourceIris=characterPalette.iris??'#788c86';
 let base=sourceIris,current='Normal',enabled=new Set(),eye;
 let blinkEnabled=true,blinkTime=-1,blinkWait=1+Math.random()*3.8,blinkFrame='open',previewBlink=false;
 const blinkMeshes={};
 const layers={};
 const palette=()=>({D:characterPalette.dark??'#24282e',O:'#18212c',W:characterPalette.eyeWhite??'#f5f4ed',H:characterPalette.eyeHighlight??'#ffffff',...irisPalette(base),B:'#f28a99',T:'#38bafa',t:'#9ee5ff',A:'#ed303e',S:'#f5d928'});
 function build(cells,name){
  const p=[],c=[],n=[],idx=[],pal=palette();
  for(const [x,y,size,key,z=.554,height=size] of cells){const rgb=new THREE.Color(pal[key]),start=p.length/3;
   for(const [dx,dy] of [[0,0],[size,0],[size,height],[0,height]]){const point=new THREE.Vector3((x-.5+dx)*.085,(y-1+dy)*.085,z).applyMatrix4(inverse);p.push(...point.toArray());c.push(rgb.r,rgb.g,rgb.b);n.push(0,0,1);}idx.push(start,start+1,start+2,start,start+2,start+3);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeBoundingSphere();const m=new THREE.Mesh(g,material);m.name=name;group.add(m);return m;
 }
 function raster(rows,x,y,step=1,z=.556){return rows.flatMap((row,r)=>[...row].flatMap((k,col)=>k==='.'?[]:[[x+col*step,y-r*step,step,k,z]]));}
 function outlined(rows){
  const x=layout.symbolX??4.8,y=layout.symbolY??43.9,step=1.05,unit=step/4,occupied=new Set(),border=new Set();
  rows.forEach((row,r)=>[...row].forEach((key,c)=>{if(key!=='.')for(let dx=0;dx<4;dx++)for(let dy=0;dy<4;dy++)occupied.add(`${c*4+dx},${-r*4+dy}`);}));
  for(const cell of occupied){const [a,b]=cell.split(',').map(Number);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const k=`${a+dx},${b+dy}`;if(!occupied.has(k))border.add(k);}}
  const cells=raster(rows,x,y,step,layout.symbolZ??.79);
  // Merge the quarter-pixel outline into rectangles: one mesh, no extra material.
  while(border.size){const [a,b]=border.values().next().value.split(',').map(Number);let w=1,h=1;while(border.has(`${a+w},${b}`))w++;
   outer:while(true){for(let i=0;i<w;i++)if(!border.has(`${a+i},${b+h}`))break outer;h++;}
   for(let i=0;i<w;i++)for(let j=0;j<h;j++)border.delete(`${a+i},${b+j}`);
   cells.push([x+a*unit,y+b*unit,w*unit,'O',layout.symbolZ??.79,h*unit]);
  }return cells;
 }
 function displayBlink(frame){
  blinkFrame=frame;
  const exact=(current==='Normal'||current==='Crying')&&base===sourceIris;
  face.geometry=frame==='open'&&exact?original:skin;eye.visible=frame==='open'&&!exact;
  for(const [key,m]of Object.entries(blinkMeshes))m.visible=key===frame;
 }
 function cacheBlink(){
  for(const [key,t]of Object.entries(blinkTemplates)){if(blinkMeshes[key]){blinkMeshes[key].geometry.dispose();group.remove(blinkMeshes[key]);}blinkMeshes[key]=build(t.rows.flatMap((rows,i)=>raster(rows,i===0?-6:3,t.y,t.step)),'Blink_'+key);blinkMeshes[key].visible=false;}
 }
 function resetBlink(){blinkTime=-1;blinkWait=1+Math.random()*3.8;previewBlink=false;displayBlink('open');}
 function rebuild(){
  if(eye){eye.geometry.dispose();group.remove(eye);}
  const t=templates[current];eye=build(t.rows.flatMap((rows,i)=>raster(rows,i===0?-6:3,t.y,t.step)),'ExpressionEyes');
  displayBlink(blinkFrame);
  for(const [key,m]of Object.entries(layers))m.visible=enabled.has(key);
 }
 layers.blush=build([-6,5].flatMap(x=>raster(['BB'],x,31,.8,layout.blushZ??.558)),'Layer_blush');
 layers.tears=build([-6,6].flatMap(x=>raster(['t','T','T','T','T','T'],x,33,.85,layout.tearsZ??.560)),'Layer_tears');
 // All emblem-like marks sit inside the upper-right hair silhouette, in front of fringe/clips.
 layers.anger=build(outlined(['.A.A.','AA.AA','.....','AA.AA','.A.A.']),'Layer_anger');
 layers.sweat=build(outlined(['..T..','.TTT.','.TtT.','..T..']),'Layer_sweat');
 layers.spark=build(outlined(['..S..','..S..','SS.SS','..S..','..S..']),'Layer_spark');
 layers.drool=build(raster(['.T','TT','.T'],5,30.6,.65,layout.droolZ??.563),'Layer_drool');
 cacheBlink();
 return {group,layers,set(name){if(!templates[name])throw Error(name);current=name;enabled=new Set(defaults[name]);blinkFrame='open';rebuild();resetBlink();},setColor(hex){irisPalette(hex);base=hex;cacheBlink();rebuild();},toggle(key,value){if(!layers[key])throw Error(key);value?enabled.add(key):enabled.delete(key);layers[key].visible=value;},
 setBlinkEnabled(value){blinkEnabled=Boolean(value);resetBlink();},
 previewBlink(value){if(current!=='Normal')return;previewBlink=Boolean(value);blinkTime=-1;displayBlink(value?'shut':'open');},
 blink(){if(current==='Normal'){previewBlink=false;blinkTime=0;displayBlink('half');}},
 update(dt){
  if(current!=='Normal'||previewBlink||!Number.isFinite(dt)||dt<=0)return false;
  if(blinkTime<0){if(!blinkEnabled)return false;blinkWait-=dt;if(blinkWait>0)return false;blinkTime=0;}
  else blinkTime+=dt;
  const next=blinkTime<.055?'half':blinkTime<.135?'shut':blinkTime<.215?'half':'open';
  const changed=next!==blinkFrame;if(changed)displayBlink(next);
  if(next==='open'){blinkTime=-1;blinkWait=3.0+Math.random()*1.8;}return changed;
 },
 get state(){return {expression:current,iris:base,palette:irisPalette(base),layers:[...enabled],blinkEnabled,blinkFrame,previewBlink};},stats(){const visible=group.children.filter(m=>m.visible);return {addedMeshes:group.children.length,visibleAddedMeshes:visible.length,addedVertices:group.children.reduce((s,m)=>s+m.geometry.attributes.position.count,0),visibleAddedTriangles:visible.reduce((s,m)=>s+m.geometry.index.count/3,0),residentAddedTriangles:group.children.reduce((s,m)=>s+m.geometry.index.count/3,0),addedMaterials:0,addedBones:0,addedDynamicParticles:0,perFrameBlinkTimer:current==='Normal'&&blinkEnabled?1:0,perFrameGeometryRebuilds:0,skinCloneVertices:skin.attributes.position.count};}};
}
