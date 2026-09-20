import fs from 'node:fs';
import {Quaternion,Vector3,Matrix4} from 'three';
const b=fs.readFileSync(new URL('silver-wolf.glb',import.meta.url)),jl=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+jl));
let bin=Buffer.from(b.subarray(28+jl,28+jl+b.readUInt32LE(20+jl)));
const r=j.nodes[0].extras.limbReference;
function add(values,type,integer=false){const array=integer?new Uint16Array(values):new Float32Array(values),raw=Buffer.from(array.buffer),view=j.bufferViews.push({buffer:0,byteOffset:bin.length,byteLength:raw.length})-1;bin=Buffer.concat([bin,raw,Buffer.alloc((4-raw.length%4)%4)]);const n={SCALAR:1,VEC4:4,MAT4:16}[type],acc={bufferView:view,componentType:integer?5123:5126,count:values.length/n,type};if(type==='SCALAR'){acc.min=[Math.min(...values)];acc.max=[Math.max(...values)];}return j.accessors.push(acc)-1;}
const bones=[];
function bone(name,parent,position){const index=bones.length;bones.push({name,parent,position,node:j.nodes.length});const parentPos=parent===null?[0,0,0]:bones[parent].position;j.nodes.push({name,translation:position.map((v,i)=>v-parentPos[i]),children:[]});if(parent===null)j.nodes[0].children.push(bones[index].node);else j.nodes[bones[parent].node].children.push(bones[index].node);return index;}
const refinement=j.nodes[0].extras.headRefinement;
const root=bone('root',null,[0,0,0]),hips=bone('hips',root,[0,r.hipY,0]),spine=bone('spine',hips,[0,1.65,0]),chest=bone('chest',spine,[0,r.shoulderY,0]),neck=bone('neck',chest,[0,refinement?.neckJointY??2.28,0]),head=bone('head',neck,[0,refinement?.headJointY??2.465,0]);
for(const sign of [1,-1]){const s=sign>0?'L':'R',shoulder=bone('shoulder.'+s,chest,[sign*.25,r.shoulderY,0]),arm=bone('upper_arm.'+s,shoulder,[sign*r.shoulderX,r.shoulderY,0]),forearm=bone('forearm.'+s,arm,[sign*r.elbowX,r.shoulderY,0]);bone('hand.'+s,forearm,[sign*r.wristX,r.shoulderY,0]);const thigh=bone('thigh.'+s,hips,[sign*r.legX,r.hipY,0]),shin=bone('shin.'+s,thigh,[sign*r.legX,r.kneeY,0]);bone('foot.'+s,shin,[sign*r.legX,r.ankleY,0]);}
for(const [s,x]of [['L',.40],['R',-.40]]){const a=bone('hair_'+s+'_1',head,[x,2.465,-.66]);bone('hair_'+s+'_2',a,[x,1.99,-.66]);}
const tail=bone('tail_1',hips,[0,1.2325,-.2125]);const tailMid=bone('tail_2',tail,[0,1.2325,-.4675]);bone('tail_3',tailMid,[0,1.2325,-.8925]);
for(const [s,x]of [['L',.34],['R',-.34]])bone('coat_'+s,hips,[x,1.615,0]);
for(const [s,sign]of [['L',1],['R',-1]]){
 const side=bone('side_hair_'+s+'_1',head,[sign*.6375,2.89,.4675]);bone('side_hair_'+s+'_2',side,[sign*.6375,2.465,.4675]);
 bone('outer_hair_'+s,head,[sign*.76,2.89,-.085]);
 bone('ear_'+s,head,[sign*.6375,3.70,-.085]);
 bone('sleeve_soft_'+s,bones.findIndex(b=>b.name==='forearm.'+s),[sign*.88,r.shoulderY,0]);
 bone('coat_back_'+s,hips,[sign*.25,1.615,-.30]);
}
const chestRibbon=bone('chest_ribbon_1',chest,[.255,2.125,.4725]);bone('chest_ribbon_2',chestRibbon,[.255,1.785,.4725]);
const id=name=>{const i=bones.findIndex(b=>b.name===name);if(i<0)throw Error(name);return i;};
const clamp=v=>Math.max(0,Math.min(1,v));
let vertices=0,maxWeightError=0;
for(const node of j.nodes){if(node.mesh===undefined)continue;node.skin=0;
 for(const p of j.meshes[node.mesh].primitives){const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView],joints=[],weights=[];
  for(let k=0;k<a.count;k++){const off=(v.byteOffset??0)+(a.byteOffset??0)+k*12,x=bin.readFloatLE(off),y=bin.readFloatLE(off+4),z=bin.readFloatLE(off+8),name=node.name,s=name.endsWith('_L')?'L':'R';let w;
   if(name==='ChestRibbon'){const a=clamp((2.125-y)/.17),b=clamp((1.785-y)/.17);w=[[chest,1-a],[id('chest_ribbon_1'),a*(1-b)],[id('chest_ribbon_2'),a*b]];}
   else if(name.startsWith('SideHair_')){const a=clamp((2.89-y)/.17),b=clamp((2.465-y)/.2);w=[[head,1-a],[id('side_hair_'+s+'_1'),a*(1-b)*.75],[id('side_hair_'+s+'_2'),a*b*.75],[id('outer_hair_'+s),a*.25]];}
   else if(name==='Hair'&&Math.abs(x)>.63&&z>-.40&&y<2.89){const a=clamp((2.89-y)/.42);w=[[head,1-a],[id('outer_hair_'+(x>0?'L':'R')),a]];}
   else if(name==='Ears')w=[[id('ear_'+(x>0?'L':'R')),1]];
   else if(['Head','Hair','Fringe','Face','Clips'].includes(name))w=[[head,1]];
   else if(name.startsWith('LongHair_')){const s=name.slice(-1),a=clamp((2.465-y)/.3),b=clamp((2.10-y)/.3);w=[[head,1-a],[id('hair_'+s+'_1'),a*(1-b)],[id('hair_'+s+'_2'),a*b]];}
   else if(name==='Tail'){const d=-z-.2125;const a=clamp(d/.17),b=clamp((d-.20)/.14),c=clamp((d-.61)/.14);w=[[hips,1-a],[id('tail_1'),a*(1-b)],[id('tail_2'),a*b*(1-c)],[id('tail_3'),a*b*c]];}
   else if(name==='Neck')w=[[neck,1]];
   else if(name==='Shorts')w=[[hips,1]];
   else if(name.startsWith('Coat_')){const a=clamp((1.615-y)/.65);const back=clamp((-z-.05)/.25);w=[[hips,1-a],[id('coat_'+s),a*(1-back)],[id('coat_back_'+s),a*back]];}
   else if(name.startsWith('Patch_'))w=[[id('upper_arm.'+s),1]];
   else if(name.startsWith('Arm_')||name.startsWith('Sleeve_')){const t=clamp((Math.abs(x)-(r.elbowX-.04))/.08),h=clamp((Math.abs(x)-(r.wristX-.03))/.06);w=[[id('upper_arm.'+s),1-t],[id('forearm.'+s),t*(1-h)],[id('hand.'+s),t*h]];if(name.startsWith('Sleeve_')){const a=.40*clamp((r.shoulderY-y-.05)/.17)*clamp((Math.abs(x)-.65)/.30);w=w.map(([b,v])=>[b,v*(1-a)]);w.push([id('sleeve_soft_'+s),a]);}}
   else if(name.startsWith('Leg_')){const t=clamp((y-(r.kneeY-.04))/.08);w=[[id('thigh.'+s),t],[id('shin.'+s),1-t]];}
   else if(name.startsWith('Sock_'))w=[[id('shin.'+s),1]];
   else if(name.startsWith('Shoe_')||name.startsWith('ShoeBand_')||name.startsWith('ShoeBuckle_')||name.startsWith('ShoeStrap_')||name.startsWith('Sole_'))w=[[id('foot.'+s),1]];
   else if(['Bodice','Collar','NeckRibbon'].includes(name))w=[[chest,1]];
   else throw new Error('Missing explicit binding for '+name);
   maxWeightError=Math.max(maxWeightError,Math.abs(w.reduce((n,v)=>n+v[1],0)-1));while(w.length<4)w.push([0,0]);joints.push(...w.map(v=>v[0]));weights.push(...w.map(v=>v[1]));vertices++;
  }p.attributes.JOINTS_0=add(joints,'VEC4',true);p.attributes.WEIGHTS_0=add(weights,'VEC4');
 }
}
j.skins=[{name:'SilverWolf_Humanoid',skeleton:bones[root].node,joints:bones.map(b=>b.node),inverseBindMatrices:add(bones.flatMap(b=>new Matrix4().makeTranslation(...b.position.map(v=>-v)).toArray()),'MAT4')}];
function clip(name,specs){const duration=name==='Idle'?4:2,times=Array.from({length:duration*24+1},(_,i)=>i/24),input=add(times,'SCALAR'),anim={name,samplers:[],channels:[]};for(const [name,axis,fn]of specs){const vec=new Vector3(...({x:[1,0,0],y:[0,1,0],z:[0,0,1]}[axis])),vals=times.flatMap(t=>new Quaternion().setFromAxisAngle(vec,fn(t)*Math.PI/180).toArray());anim.channels.push({sampler:anim.samplers.length,target:{node:bones[id(name)].node,path:'rotation'}});anim.samplers.push({input,output:add(vals,'VEC4'),interpolation:'LINEAR'});}return anim;}
j.animations=[clip('Idle',[['head','y',t=>1.5*Math.sin(Math.PI*t/2)],['upper_arm.L','z',t=>-45+.7*Math.sin(Math.PI*t/2+.8)],['upper_arm.R','z',t=>45-.55*Math.sin(Math.PI*t/2+2.2)]]),clip('Rig_Test',[['head','y',t=>12*Math.sin(Math.PI*t)],...['L','R'].flatMap((s,i)=>{const sign=i?-1:1;return [['upper_arm.'+s,'z',t=>-sign*25*Math.sin(Math.PI*t)],['forearm.'+s,'y',t=>-sign*35*Math.sin(Math.PI*t)**2],['thigh.'+s,'x',t=>sign*15*Math.sin(Math.PI*t)],['shin.'+s,'x',t=>20*Math.sin(Math.PI*t)**2],['hand.'+s,'y',t=>sign*8*Math.sin(Math.PI*t)],['foot.'+s,'x',t=>8*Math.sin(Math.PI*t)]];})])];
j.nodes[0].name='SilverWolf_TPose_Rigged';j.nodes[0].extras={...j.nodes[0].extras,static:false,rig:bones.length+' deform/control bones; T-pose bind; no IK solver',animations:j.animations.map(a=>a.name)};
j.buffers[0].byteLength=bin.length;const raw=Buffer.from(JSON.stringify(j)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);const h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(new URL('silver-wolf-rigged.glb',import.meta.url),Buffer.concat([h,jh,json,bh,bin]));fs.writeFileSync(new URL('rig-info.json',import.meta.url),JSON.stringify({bones,vertices,maxWeightError,clips:j.animations.map(a=>({name:a.name,tracks:a.channels.length,duration:a.name==='Idle'?4:2})),source:'silver-wolf.glb; geometry and T-pose preserved'},null,2));console.log({bones:bones.length,vertices,maxWeightError});
