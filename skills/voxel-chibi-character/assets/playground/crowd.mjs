// Ground-plane navigation. All agents share the complete walkable domain, never a home-radius.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const length=(x,z)=>Math.hypot(x,z);
export class Crowd {
 constructor({extent=27,halfWidth=10.4,cross=true,random=Math.random}={}){this.random=random;this.configure({extent,halfWidth,cross});this.agents=new Map();this.time=0;}
 configure({extent,halfWidth,cross}){this.extent=extent;this.halfWidth=halfWidth;this.cross=cross;this.step=2;this.gridHalf=Math.floor(extent/this.step);}
 valid(x,z,r=.85){const edge=this.extent-r;if(Math.abs(x)>edge||Math.abs(z)>edge)return false;return !this.cross||Math.abs(x)<=this.halfWidth-r||Math.abs(z)<=this.halfWidth-r;}
 project(x,z,r=.85){const edge=this.extent-r;x=clamp(x,-edge,edge);z=clamp(z,-edge,edge);if(this.cross&&Math.abs(x)>this.halfWidth-r&&Math.abs(z)>this.halfWidth-r){if(Math.abs(x)<Math.abs(z))x=Math.sign(x)*(this.halfWidth-r);else z=Math.sign(z)*(this.halfWidth-r);}return {x,z};}
 add(id,x,z,r=.8){const p=this.project(x,z,r);const a={id,...p,r,vx:0,vz:0,path:[],speed:1.55+this.random()*.8,pause:this.random()*1.6,distance:0,trips:0,stalled:0,phase:'idle',target:null,lastX:p.x,lastZ:p.z};this.agents.set(id,a);return a;}
 remove(id){this.agents.delete(id);}
 clear(){this.agents.clear();}
 sample(){const margin=2.2,r=this.random,e=this.extent-margin,w=this.halfWidth-margin;if(!this.cross)return {x:(r()*2-1)*e,z:(r()*2-1)*e};const arm=Math.floor(r()*4),far=w+2+r()*Math.max(1,e-w-2),lane=(r()*2-1)*w*.85;return arm===0?{x:lane,z:-far}:arm===1?{x:far,z:lane}:arm===2?{x:lane,z:far}:{x:-far,z:lane};}
 lineClear(a,b,r){const n=Math.ceil(length(a.x-b.x,a.z-b.z)/.5);for(let i=0;i<=n;i++){const t=n?i/n:0;if(!this.valid(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,r+.12))return false;}return true;}
 pathfind(a,b){
  if(this.lineClear(a,b,a.r))return [b];const s=this.step,h=this.gridHalf,key=(x,z)=>x+','+z;
  const cell=p=>({x:clamp(Math.round(p.x/s),-h,h),z:clamp(Math.round(p.z/s),-h,h)}),start=cell(a),end=cell(b);
  const nearValid=c=>{if(this.valid(c.x*s,c.z*s,a.r+.15))return c;for(let r=1;r<=3;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)if(this.valid((c.x+dx)*s,(c.z+dz)*s,a.r+.15))return {x:c.x+dx,z:c.z+dz};return c;};
  const from=nearValid(start),to=nearValid(end),open=[{...from,g:0,f:0}],cost=new Map([[key(from.x,from.z),0]]),parents=new Map(),closed=new Set();let found=false;
  while(open.length){open.sort((a,b)=>b.f-a.f);const c=open.pop(),k=key(c.x,c.z);if(closed.has(k))continue;closed.add(k);if(c.x===to.x&&c.z===to.z){found=true;break;}
   for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=c.x+dx,z=c.z+dz,nk=key(x,z);if(closed.has(nk)||!this.valid(x*s,z*s,a.r+.15))continue;if(dx&&dz&&(!this.valid((c.x+dx)*s,c.z*s,a.r+.15)||!this.valid(c.x*s,(c.z+dz)*s,a.r+.15)))continue;const g=c.g+Math.hypot(dx,dz);if(g>=(cost.get(nk)??Infinity))continue;cost.set(nk,g);parents.set(nk,k);open.push({x,z,g,f:g+Math.hypot(x-to.x,z-to.z)});}
  }
  if(!found)return [];const route=[b];let k=key(to.x,to.z),initial=key(from.x,from.z);while(k!==initial){const [x,z]=k.split(',').map(Number);route.unshift({x:x*s,z:z*s});k=parents.get(k);if(!k)return [];}
  const simple=[];let current=a;for(let i=0;i<route.length;){let next=i;for(let j=route.length-1;j>=i;j--)if(this.lineClear(current,route[j],a.r)){next=j;break;}simple.push(route[next]);current=route[next];i=next+1;}return simple;
 }
 choose(a){for(let trial=0;trial<30;trial++){const goal=this.sample();if(length(goal.x-a.x,goal.z-a.z)<this.extent*.7)continue;const path=this.pathfind(a,goal);if(path.length){a.path=path;a.target=goal;a.phase='walk';a.stalled=0;return;}}a.pause=.2;}
 distribute(items,preserve=false){
  this.clear();const placed=[];
  for(const item of items){let p=preserve?this.project(item.x,item.z,item.r):null;
   if(!p||placed.some(a=>length(a.x-p.x,a.z-p.z)<a.r+item.r+.3)){
    let best=null,bestGap=-Infinity;for(let t=0;t<200;t++){const r=this.random,edge=this.extent-3,q={x:(r()*2-1)*edge,z:(r()*2-1)*edge};if(!this.valid(q.x,q.z,item.r+1))continue;const gap=placed.length?Math.min(...placed.map(a=>length(a.x-q.x,a.z-q.z)-a.r-item.r)):99;if(gap>bestGap){best=q;bestGap=gap;}if(gap>3.7)break;}p=best??{x:0,z:0};
   }
   const a=this.add(item.id,p.x,p.z,item.r);placed.push(a);
  }return placed;
 }
 update(dt,activeIds=null){
  // Bounded fixed-size substeps keep avoidance stable at all display frame rates.
  let remaining=Math.min(dt,.15);while(remaining>1e-7){const h=Math.min(remaining,1/30);this.advance(h,activeIds);remaining-=h;}
 }
 advance(dt,activeIds){
  this.time+=dt;const list=[...this.agents.values()].filter(a=>!activeIds||activeIds.has(a.id));
  for(const a of list){
   if(a.pause>0){a.pause-=dt;a.vx*=Math.exp(-dt*10);a.vz*=Math.exp(-dt*10);if(a.phase!=='wave')a.phase='idle';continue;}
   if(!a.path.length)this.choose(a);if(!a.path.length)continue;let target=a.path[0],dx=target.x-a.x,dz=target.z-a.z,d=length(dx,dz);
   if(d<.5){a.path.shift();if(!a.path.length){a.trips++;a.pause=.4+this.random()*1.4;a.phase=this.random()<.2?'wave':'idle';a.vx=a.vz=0;continue;}target=a.path[0];dx=target.x-a.x;dz=target.z-a.z;d=length(dx,dz);}
   const nx=dx/Math.max(d,.001),nz=dz/Math.max(d,.001),speed=a.speed*Math.min(1,d*1.8);let vx=nx*speed,vz=nz*speed;
   for(const b of list){if(b===a)continue;const rx=b.x-a.x,rz=b.z-a.z,dist=length(rx,rz),safe=a.r+b.r+.28;if(dist>5.5)continue;
    if(dist<safe+.55){const strength=(safe+.55-dist)*2.8;vx-=rx/Math.max(dist,.01)*strength;vz-=rz/Math.max(dist,.01)*strength;}
    const relx=vx-b.vx,relz=vz-b.vz,rel2=relx*relx+relz*relz,t=clamp((rx*relx+rz*relz)/Math.max(.01,rel2),0,1.7),closest=length(rx-relx*t,rz-relz*t);
    if(t>.02&&closest<safe+.45&&rx*nx+rz*nz>0){const strength=(safe+.45-closest)*(1-t/2)*1.6;vx+=nz*strength;vz-=nx*strength;}
   }
   // Keep preferred velocity away from walls before hard projection becomes necessary.
   const probe=this.project(a.x+vx*.65,a.z+vz*.65,a.r+.15);vx+=(probe.x-(a.x+vx*.65))*3;vz+=(probe.z-(a.z+vz*.65))*3;
   const len=length(vx,vz);if(len>a.speed*1.15){vx*=a.speed*1.15/len;vz*=a.speed*1.15/len;}const blend=1-Math.exp(-dt*7);a.vx+=(vx-a.vx)*blend;a.vz+=(vz-a.vz)*blend;a.phase='walk';
  }
  for(const a of list){const oldx=a.x,oldz=a.z,p=this.project(a.x+a.vx*dt,a.z+a.vz*dt,a.r);a.x=p.x;a.z=p.z;a.distance+=length(a.x-oldx,a.z-oldz);if(a.phase==='walk'&&length(a.vx,a.vz)<.18)a.stalled+=dt;else a.stalled=Math.max(0,a.stalled-dt);if(a.stalled>2){a.path=[];a.stalled=0;a.vx=(this.random()-.5)*2;a.vz=(this.random()-.5)*2;}}
  for(let iteration=0;iteration<3;iteration++)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j],dx=b.x-a.x,dz=b.z-a.z,d=length(dx,dz),min=a.r+b.r+.06;if(d>=min)continue;const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0,push=(min-d)*.51;Object.assign(a,this.project(a.x-nx*push,a.z-nz*push,a.r));Object.assign(b,this.project(b.x+nx*push,b.z+nz*push,b.r));}
 }
}
