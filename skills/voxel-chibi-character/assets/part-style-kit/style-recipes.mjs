// Local voxel style recipes. Outputs occupancy, not a rig or finished character.
export const step=.075;
export function sample(surface,bounds=[[-1.25,1.25],[-1.15,1.2],[-.85,.85]]){
 const cells=[];
 for(let x=Math.ceil(bounds[0][0]/step);x<=Math.floor(bounds[0][1]/step);x++)
 for(let y=Math.ceil(bounds[1][0]/step);y<=Math.floor(bounds[1][1]/step);y++)
 for(let z=Math.ceil(bounds[2][0]/step);z<=Math.floor(bounds[2][1]/step);z++){
  const mat=surface(x*step,y*step,z*step);if(mat!==null)cells.push({cell:[x,y,z],material:mat});
 }
 return cells;
}
const oct=(x,z)=>Math.max(Math.abs(x),Math.abs(z))+.38*Math.min(Math.abs(x),Math.abs(z));
export function ear({cupDepth=.38,fur=false,pointed=false}={}){
 if(!Number.isFinite(cupDepth)||cupDepth<0||cupDepth>.6)throw Error('cupDepth must be 0..0.6');
 return (x,y,z)=>{
  const yy=y+.04;
  const radius=pointed?Math.max(Math.abs(x)/(.68-Math.max(0,yy)*.4),Math.abs(yy)/1.02):(x/.68)**2+(yy/.91)**2;
  if(radius>1)return null;
  const bowl=-cupDepth*(1-radius),rim=radius>.7;
  // Three broad tufts rise from the inner shell, leaving upper cavity visible.
  const tuft=fur&&[[-.24,-.02],[0,.18],[.24,-.15]].some(([cx,top])=>{
   const t=(y+.64)/(top+.64);return t>=0&&t<=1&&Math.abs(x-cx*(1+.25*t))<.18*(1-t)+.035;
  });
  const front=tuft?Math.min(.07,bowl+.23):bowl+.075;
  if(z<bowl-.075||z>front)return null;
  return tuft&&z>bowl+.06?0:rim?0:1;
 };
}
// Descending y, half width/depth; hollow shell keeps arms independent.
export function sleeve({profile='bishop'}={}){
 const profiles={straight:[[.9,.31,.27],[-1,.31,.27]],bishop:[[.9,.29,.25],[.5,.49,.37],[-.3,.62,.44],[-.72,.4,.31],[-1,.28,.25]],long:[[.9,.29,.25],[.3,.34,.28],[-.35,.46,.35],[-1,.68,.48]]};
 const rows=profiles[profile];if(!rows)throw Error('Unknown sleeve profile');
 return (x,y,z)=>{
  if(y>rows[0][0]||y<rows.at(-1)[0])return null;
  const i=rows.findIndex((r,i)=>i<rows.length-1&&y<=r[0]&&y>=rows[i+1][0]);
  const a=rows[i],b=rows[i+1],t=(a[0]-y)/(a[0]-b[0]),w=a[1]+(b[1]-a[1])*t,d=a[2]+(b[2]-a[2])*t;
  const radius=oct(x/w,z/d);
  if(radius>1.13||radius<.77)return null;
  return y<-.85?2:z<-.05?4:0;
 };
}
export function coat({opening='flared',layered=false}={}){
 return (x,y,z)=>{
  if(y>1||y<-1)return null;
  const t=(1-y)/2,w=.54+.27*t,d=.31+.15*t;
  const r=oct(x/w,z/d);
  if(r>1.18||r<.90)return null;
  if(y>.8)return y>.94?2:3;
  const gap=opening==='slit'?.1:.13+.42*t;
  if(z>0&&Math.abs(x)<gap)return null;
  if(y<-.89)return 2;
  // Lapel colour follows existing front edges, not added floating armour.
  if(layered&&z>.12&&Math.abs(x)<gap+.15)return 3;
  return z<0?4:0;
 };
}
export function layers({kind='skirt',layered=true}={}){
 const rows=kind==='cape'?[[.7,.12,.72,.52],[.7,-.15,.82,.55]]:
   layered?[[.9,-.15,.95,.62],[.9,-.57,1.04,.68],[.9,-1,1.07,.70]]:[[.9,-1,1.07,.70]];
 return (x,y,z)=>{
  let mat=null;
  for(let i=rows.length-1;i>=0;i--){
   const [top,bottom,endW,endD]=rows[i];if(y>top||y<bottom)continue;
   const t=(top-y)/(top-bottom),w=.34+(endW-.34)*t,d=.25+(endD-.25)*t,r=oct(x/w,z/d);
   if(r<=1.12&&r>=.86)mat=y<bottom+.1?2:(i%2?4:0);
  }
  return mat;
 };
}
export const collections={
 ears:{title:'耳朵：轮廓、内凹与少量毛簇',note:'左：平板对照；中：杯状耳；右：少量内耳毛。保持相同外轮廓，凹度与毛量分别调节。',items:[['平板：缺少内凹',ear({cupDepth:0})],['杯状：耳缘与壳体',ear()],['杯状＋三组宽毛簇',ear({fur:true})]]},
 coats:{title:'外套：从直缝到敞开的前襟',note:'相同衣身，改变前襟开口；连续领圈不随前襟断开。右侧示范沿裁片分配边饰。',items:[['直缝：开襟感不足',coat({opening:'slit'})],['下摆两侧展开',coat()],['沿前襟加边饰',coat({layered:true})]]},
 sleeves:{title:'袖子：直筒、蓬袖与过手扩口袖',note:'三种服装设计，按参考选择；蓬袖中段鼓起后收口，长袖向自由端展开。内部保持空腔。',items:[['直筒袖',sleeve({profile:'straight'})],['蓬袖：中段饱满＋收口',sleeve()],['长袖：自由端扩口',sleeve({profile:'long'})]]},
 layers:{title:'叠层：共享根部、错开下缘',note:'少数有厚度的大裁片，层差先于碎褶。裙长、外展和层数分别控制；肩披与裙摆不能互套比例。',items:[['单层裙摆',layers({layered:false})],['三层裙摆',layers()],['两层肩披',layers({kind:'cape'})]]}
};
