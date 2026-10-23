// Isolated voxel construction examples, not character defaults or rigs.
export const step=.085;
export function sampleCells(bounds, predicate) {
 const result=[];
 for(let x=Math.ceil(bounds[0][0]/step);x<=Math.floor(bounds[0][1]/step);x++)
 for(let y=Math.ceil(bounds[1][0]/step);y<=Math.floor(bounds[1][1]/step);y++)
 for(let z=Math.ceil(bounds[2][0]/step);z<=Math.floor(bounds[2][1]/step);z++) {
  const material=predicate(x*step,y*step,z*step);
  if(material!==null)result.push({cell:[x,y,z],material});
 }
 return result;
}
export function earSurface(x,y,z) {
 const radius=(x/.68)**2+(y/.85)**2;
 if(radius>1)return null;
 const back=-.34+.48*radius;
 if(z<back-.08||z>back+.08)return null;
 return radius>.68?0:1;
}
export function coatSurface(x,y,z) {
 if(y<-.9||y>.85)return null;
 const t=(.85-y)/1.75,outer=.72+.18*t,opening=.12+.32*t;
 if(Math.abs(x)>outer||Math.abs(z)>.46)return null;
 if(y>.68) {
  if(Math.abs(x)<outer-.12&&Math.abs(z)<.31)return null;
  return y>.76?2:3;
 }
 const back=z<-.32,side=Math.abs(x)>outer-.12,front=z>.32&&Math.abs(x)>opening;
 return back||side||front?0:null;
}
export function sleeveSurface(x,y,z) {
 if(y<-.95||y>.85)return null;
 const t=(.85-y)/1.8,w=.28+.35*t,d=.23+.21*t;
 if(Math.abs(x)>w||Math.abs(z)>d)return null;
 if(Math.abs(x)<w-.13&&Math.abs(z)<d-.13)return null;
 return y<-.76?2:0;
}
export function makeParts(){return [
 {label:'杯状耳：凹度、耳缘和整体朝向分开',cells:sampleCells([[-.8,.8],[-.9,.9],[-.5,.3]],earSurface)},
 {label:'开襟：下摆外展，领圈连续',cells:sampleCells([[-1,1],[-1,1],[-.5,.5]],coatSurface)},
 {label:'扩口袖：外壳体积与内部空腔',cells:sampleCells([[-.7,.7],[-1,1],[-.5,.5]],sleeveSurface)}
];}
