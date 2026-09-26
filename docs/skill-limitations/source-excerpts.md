# 可复核的短摘录

[返回入口](README.md) · [来源说明](sources.md)

以下为现场文件的指定行摘录，原始行号保留；源文件 SHA-256 用于定位读取版本。摘录不是可执行工程。各路径是逻辑来源，不依赖读者本机盘符。
## C1

来源：`playground/characters/ak-sixstarfresh/char_1013_chen2/source/chen-holiday-project/character/model.mjs`

SHA-256：`b36e7c2f42fbbc6a59631ba8c17efb6d2b669f02fc211955507caa48eec0cede`

```text
189:   const shoulder=new THREE.Vector3(sign*r.shoulderX,r.shoulderY,0),elbow=new THREE.Vector3(sign*r.elbowX,r.elbowY,0),wrist=new THREE.Vector3(sign*r.wristX,r.wristY,0);
190:   const axis=wrist.clone().sub(shoulder).normalize(),u=new THREE.Vector3(-axis.y,axis.x,0).normalize(),zv=new THREE.Vector3(0,0,1);
191:   const length=shoulder.distanceTo(wrist),at=t=>shoulder.clone().addScaledVector(axis,t);
192:   function armRing(t,rad,depth=rad){const center=at(t),coords=[[.62,1],[1,.62],[1,-.62],[.62,-1],[-.62,-1],[-1,-.62],[-1,.62],[-.62,1]];
193:    return coords.map(([x,z])=>center.clone().addScaledVector(u,x*rad).addScaledVector(zv,z*depth).toArray()).reverse();
194:   }
195:   // Cross-section order here matches the downhill arm tangent.
196:   const armRings=[-.07,.05,.24,.32,.39,.46,.58,length+.04].map(t=>armRing(t,.116,.115));
197:   loft('Arm_'+side,armRings,'skin','skinShade');
198:   const sleeveT=[-.085,-.01,.11,.25,.34,.41,.49,.60,length-.015],sleeveR=[.17,.23,.235,.225,.235,.235,.22,.18,.145];
199:   const outer=sleeveT.map((t,i)=>armRing(t,sleeveR[i],sleeveR[i]*.92)),inner=sleeveT.map((t,i)=>armRing(t,sleeveR[i]-.035,sleeveR[i]*.92-.035));
208:   // Palm plus four stepped fingers and inner thumb. All empty, all attached.
209:   const handM=new THREE.Matrix4().makeBasis(u,axis.clone().negate(),zv);handM.setPosition(wrist.clone().addScaledVector(axis,.10));
210:   cuboid('Hand_'+side,-.095,.095,-.070,.090,-.060,.065,'skin',handM);
211:   for(let i=0;i<4;i++){const xx=-.092+i*.047;const end=-.155+Math.abs(i-1.5)*.012;cuboid('Hand_'+side,xx,xx+.040,end,-.025,-.042,.057,'skin',handM);}
212:   cuboid('Hand_'+side,sign>0?-.139:.081,sign>0?-.081:.139,-.065,.060,-.004,.080,'skin',handM);
213:   const cx=sign*r.legX;
214:   const ys=[.165,.23,.42,.62,.67,.73,.79,.87,1.05,1.27,1.35];
215:   loft('Leg_'+side,ys.map(y=>{const rad=y<.45?.105:y<.8?.12:.145;return ring8(cx,y,0,rad,rad);}), 'skin','skinShade');
```

## C2

来源：`playground/characters/ak-sixstarfresh/char_1044_hsgma2/source/Hoshiguma_Karma_Project/character/model.mjs`

SHA-256：`f79c3eec7e9ab583c8fbeecce526b0e9ccdac49eeaddb00e45661b433548b45e`

```text
139:   const armPoints=[[r.shoulderX,2.13,0],[.53,1.98,0],[r.elbowX,1.795,0],[r.elbowX,1.745,0],[.70,1.695,0],[r.wristX,r.wristY,.01]];
140:   // Slightly overlapping squared limb segments with soft blend rings at the joint.
141:   g.sweep('Arm_'+side,armPoints.slice().reverse().map(([x,y,z],k)=>({x:sign*x,y,z,rx:k<2?.101:.112,rz:.104})),'skin');
161:   // Relaxed, empty hands: block palm, four finger tips, a separate thumb.
162:   const handKey=side==='L'?'glove':'skin';g.line('Hand_'+side,mirror([.823,1.367,.010]),mirror([.865,1.19,.034]),.182,.137,handKey);
163:   for(let i=0;i<4;i++){const x=.803+i*.043,yy=1.134+([.03,0,.007,.043][i]);g.box('Hand_'+side,mirror([x,yy,.056]),[.037,.106,.074],handKey,[0,0,sign*.13]);}
164:   g.line('Hand_'+side,mirror([.785,1.264,.042]),mirror([.775,1.167,.096]),.066,.075,handKey);
165:   if(side==='L')for(const yy of [1.358,1.303])for(let k=0;k<8;k++){const a=2*Math.PI*k/8,xx=.817+(1.365-yy)*.26;g.box('Bracelet_L',[xx+Math.cos(a)*.124,yy,.02+Math.sin(a)*.132],[.050,.047,.050],'beads',[0,a,0]);}
```

## C2G

来源：`playground/characters/ak-sixstarfresh/char_1044_hsgma2/source/Hoshiguma_Karma_Project/character/geometry.mjs`

SHA-256：`3ee78562aa9d4ecc7506b0a3dc304f2c9d4eb96603daa451b813b77c973a4217`

```text
22:  /** Closed hard-edged octagonal sweep, ordered bottom -> top stations. */
23:  sweep(name,stations,key){const rings=stations.map(({y,rx,rz,x=0,z=0})=>[[-.62,1],[.62,1],[1,.62],[1,-.62],[.62,-1],[-.62,-1],[-1,-.62],[-1,.62]].map(([u,v])=>[x+u*rx,y,z+v*rz]));for(let k=0;k<rings.length-1;k++)for(let i=0;i<8;i++){let j=(i+1)%8;this.quad(name,rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i],typeof key==='function'?key(k,i):key);}for(const [k,top]of [[0,false],[rings.length-1,true]]){const r=rings[k],c=[stations[k].x??0,stations[k].y,stations[k].z??0];for(let i=0;i<8;i++)this.tri(name,c,r[top?i:(i+1)%8],r[top?(i+1)%8:i],typeof key==='function'?key(k,8):key);}}
24:  /** Hollow garment with inner wall and hem rims, no solid disk through legs. */
```

## C3

来源：`playground/characters/ak-sixstarfresh/char_1040_blaze2/source/Zhuhuang_Default_Editable/character/model.mjs`

SHA-256：`8e1a7eecad749ce5d308d4801d72e6afad24ba87a5a7b7706fdba51709ec3cd0`

```text
174:  function sweep(name,points,width,depth,col){
175:   const rings=points.map(([x,y,z],i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dir=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize(),u=new THREE.Vector3(-dir.y,dir.x,0).normalize(),v=new THREE.Vector3().crossVectors(dir,u).normalize();
176:    const w=Array.isArray(width)?width[i]:width,d=Array.isArray(depth)?depth[i]:depth;
177:    return [[-.35,-.5],[.35,-.5],[.5,-.35],[.5,.35],[.35,.5],[-.35,.5],[-.5,.35],[-.5,-.35]].map(([p,q])=>[x+u.x*p*w+v.x*q*d,y+u.y*p*w+v.y*q*d,z+u.z*p*w+v.z*q*d]);});
178:   for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++)quad(name,[rings[i][j],rings[i][(j+1)%8],rings[i+1][(j+1)%8],rings[i+1][j]],col);
185:   const points=[[x,A.hipY,0],[x,1.20,0],[x,.86,0],[x,.80,0],[x,.73,0],[x,.62,0],[x,.25,0]];
186:   sweep('Leg_'+side,points,[.285,.285,.245,.23,.225,.215,.21],[.28,.28,.235,.225,.22,.21,.21],'skin');
202:   const p=[[sign*.37,2.245,0],[sign*A.shoulderX,A.shoulderY,0],[sign*.52,2.065,0],[sign*.585,1.965,.007],[sign*A.elbowX,A.elbowY,.012],[sign*.655,1.86,.018],[sign*.744,1.73,.022],[sign*A.wristX,A.wristY,.03]];
203:   sweep('Arm_'+side,p,[.245,.255,.232,.219,.214,.211,.19,.177],[.24,.245,.225,.21,.205,.203,.19,.18],'skin');
204:   sweep('Guard_'+side,[[sign*.575,1.985,.015],[sign*.615,1.925,.015],[sign*.66,1.858,.02],[sign*.73,1.75,.025]],[.263,.26,.251,.226],[.26,.252,.244,.221],'coat');
205:   for(const [cx,cy]of [[.535,2.047],[.63,1.902],[.735,1.752],[.798,1.648]])solid('Guard_'+side,[sign*cx,cy,.038],[.241,.052,.228],cy===1.902?'coatLight':'coat',sign*.575);
206:   bar('Guard_'+side,[sign*.624,1.96,.157],[sign*.699,1.836,.157],.029,.022,'trim');buckle('Guard_'+side,sign*.636,1.925,.17,.086,.097,'trim',sign*.575);
207:   solid('Hand_'+side,[sign*.871,1.52,.038],[.17,.208,.17],'skin',sign*.30);
208:   // A broad relaxed palm, four short stepped digits and one visible thumb.
209:   for(let j=0;j<4;j++)solid('Hand_'+side,[sign*(.805+j*.043),1.405+Math.abs(j-1.5)*.008,.05],[.045,.10,.132],'skin',sign*.08);
210:   solid('Hand_'+side,[sign*.778,1.53,.108],[.087,.127,.103],'skin',-sign*.35);
```

## C4

来源：`playground/characters/ak-sixstarfresh/char_017_huang/source/huang-default/character/model.mjs`

SHA-256：`a252115e65e87831a64402f53420bf933b3b9b9a16b6315603060d83ec72cc1c`

```text
99:   const M=new THREE.Matrix4().makeRotationZ(sign*r.armAngle);M.setPosition(sign*r.shoulderX,r.shoulderY,0);
100:   b.add('Arm_'+s,new THREE.BoxGeometry(.210,.685,.217,1,20,1).translate(0,-.335,0),'skin',M);
111:   for(let i=0;i<3;i++){const x=-.074+i*.073;b.box('Hand_'+s,'skin',[x,-.832, .060],[.051,.089,.113],M);b.box('Hand_'+s,'metal',[x,-.722,.137],[.025,.021,.018],M);}
112:   b.box('Hand_'+s,'skin',[sign*.142,-.757,.035],[.056,.114,.09],M);
```

## C5

来源：`playground/characters/ak-sixstarfresh/char_1033_swire2/source/Swire_Elegant_Editable_Project/character/model.mjs`

SHA-256：`4c21bc6b16dd9c557a349eca01a18ceccb766591fe226029edcd083014287e21`

```text
9: export const ARM_POINTS=[[.30,2.04,.015],[.40,1.95,.015],[.51,1.78,.015],[.62,1.60,.025],[.71,1.46,.03],[.80,1.28,.04],[.845,1.18,.04]];
101:  bind('Arm_'+side,{kind:'arm',side});w.tube('Arm_'+side,ARM_POINTS.map(mirror),[.132,.133,.122,.114,.103,.092,.087],'skin');
102:  bind('Sleeve_'+side,{kind:'arm',side});
103:  const sleevePoints=[[.50,1.81,.014],[.54,1.75,.018],[.60,1.65,.024],[.65,1.57,.027],[.71,1.46,.030],[.74,1.405,.033]].map(mirror);
104:  const rings=w.tube('Sleeve_'+side,sleevePoints,[.162,.174,.196,.221,.243,.248],(i,k)=>i===0?'coatLight':'coat',{open:true,inner:.026,lining:'lining'});
111:  w.tube(hb,[[.81,1.30,.04],[.855,1.18,.052],[.864,1.13,.052]].map(mirror),[.092,.097,.078],'skin');
112:  for(let j=0;j<4;j++)w.block(hb,mirror([.809+j*.034,1.105-(j===0||j===3?-.017:0),.096]),[.031,.087,.072],'skin');
113:  w.tube(hb,[[.781,1.225,.105],[.76,1.18,.13]].map(mirror),[.038,.034],'skin');
114:  const wr='Bracelet_'+side;bind(wr,'hand.'+side);w.tube(wr,[[.795,1.295,.04],[.806,1.272,.04]].map(mirror),[.105,.105],'gold',{open:true,inner:.02});
115:  // Legs and open-toe heels; two ankle crossings, forefoot strap, real rectangular buckles.
116:  const cx=sign*CHARACTER_BASELINE.legX;bind('Leg_'+side,{kind:'leg',side});
117:  w.tube('Leg_'+side,[[cx,1.29,0],[cx,1.13,0],[cx,.77,0],[cx,.71,0],[cx,.67,0],[cx,.63,0],[cx,.56,0],[cx,.22,0],[cx,.14,.025]],[.134,.134,.119,.115,.115,.115,.114,.099,.098],'skin');
```

## C6

来源：`playground/characters/ak-sixstarfresh/char_1043_leizi2/source/jingzhe-project/character/model.mjs`

SHA-256：`571c9aebb1836b5966a4efa960fe1ea2cc67cc4c52f18e86d2da82011dd18b18`

```text
87:  for(const sign of [1,-1]){const side=sign>0?'L':'R',a=[sign*.37,2.18,.16],e=[sign*.655,1.855,.16],w=[sign*.855,1.475,.16];
88:  const lerp=(u,v,t)=>u.map((x,i)=>x+(v[i]-x)*t);
89:  b.limb('Arm_'+side,[a,lerp(a,e,.22),lerp(a,e,.50),e,lerp(e,w,.2),w],[.139,.145,.12,.106,.098,.083],'skin');
90:  b.limb('Bracer_'+side,[lerp(e,w,.18),lerp(e,w,.34),lerp(e,w,.58),lerp(e,w,.88),w],[.13,.137,.127,.106,.098],['coat','coatLight','coat','coatShade']);
91:  // Edge bands on bracers follow the actual sloped limb axis.
92:  b.limb('BracerTrim_'+side,[lerp(e,w,.28),lerp(e,w,.32)],[.142,.142],'silver');b.limb('BracerTrim_'+side,[lerp(e,w,.83),lerp(e,w,.875)],[.111,.111],'silver');
93:  const hand=lerp(e,w,1.15);b.limb('Glove_'+side,[w,hand,lerp(e,w,1.32)],[.08,.094,.072],'glove');
94:  // Block thumb, no grip target or concealed prop.
95:  b.solidBox('Glove_'+side,[sign*.83,1.365,.23],[.060,.09,.07],'glove',new T.Matrix4().makeTranslation(sign*.83,1.365,.23).multiply(new T.Matrix4().makeRotationZ(-sign*.25)).multiply(new T.Matrix4().makeTranslation(-sign*.83,-1.365,-.23)));
```

## C6G

来源：`playground/characters/ak-sixstarfresh/char_1043_leizi2/source/jingzhe-project/character/geometry.mjs`

SHA-256：`b82fbafdf41d628f91d3ca0608e36942cc918cfc4010c027feaafb9a22baed76`

```text
23:  limb(name,points,radii,colors){const frames=points.map((p,i)=>{const dir=new T.Vector3(...points[Math.min(points.length-1,i+1)]).sub(new T.Vector3(...points[Math.max(0,i-1)]));dir.normalize();let u=new T.Vector3(0,0,1).cross(dir).normalize(),v=dir.clone().cross(u).normalize();return Array.from({length:8},(_,k)=>new T.Vector3(...p).addScaledVector(u,Math.cos(k*Math.PI/4)*radii[i]).addScaledVector(v,Math.sin(k*Math.PI/4)*radii[i]).toArray());});
24:   for(let i=0;i<frames.length-1;i++)for(let k=0;k<8;k++){const j=(k+1)%8;this.quad(name,[frames[i][k],frames[i][j],frames[i+1][j],frames[i+1][k]],Array.isArray(colors)?colors[i]:colors);}
```

## W3

来源：`playground/backups/glove-wrap-v4/character/model.mjs`

SHA-256：`0716e138c2dadf5d1cce817830fb288286621baf64d08abe5aaa9476fce42a06`

```text
139:   // One straight square column; longitudinal divisions retain elbow bending.
140:   const armTop=new THREE.Vector3(sign*r.shoulderX,r.shoulderY,0),armEnd=new THREE.Vector3(sign*r.wristX,r.wristY,.01),armDir=armTop.clone().sub(armEnd);
141:   const armMatrix=new THREE.Matrix4().compose(armTop.clone().add(armEnd).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),armDir.clone().normalize()),new THREE.Vector3(1,1,1));
142:   g.add('Arm_'+side,new THREE.BoxGeometry(.20,armDir.length()+.035,.20,1,20,1),'skin',armMatrix);
152:    g.line('Bracer_L',[.702,1.705,0],[.815,1.36,.014],.217,.232,'glove');
153:    g.line('Bracer_L',[.715,1.69,.125],[.805,1.395,.137],.025,.014,'gloveLight');
162:   // Single squared hand block; retain the asymmetric red glove.
163:   const handKey=side==='L'?'glove':'skin';
164:   g.line('Hand_'+side,mirror([.823,1.367,.010]),mirror([.873,1.145,.034]),.205,.17,handKey);
165:   if(side==='L')for(const yy of [1.358,1.303])for(let k=0;k<8;k++){const a=2*Math.PI*k/8,xx=.817+(1.365-yy)*.26;g.box('Bracelet_L',[xx+Math.cos(a)*.124,yy,.02+Math.sin(a)*.132],[.050,.047,.050],'beads',[0,a,0]);}
166:   // Fully modeled covered legs, leather shafts, stepped toes and heavy soles.
167:   g.sweep('Leg_'+side,[{y:.19,rx:.115,rz:.112,x:cx},{y:.69,rx:.117,rz:.114,x:cx},{y:.735,rx:.12,rz:.115,x:cx},{y:.78,rx:.12,rz:.115,x:cx},{y:1.285,rx:.141,rz:.135,x:cx}],'skin');
168:   g.sweep('BootShaft_'+side,[{y:.19,rx:.15,rz:.155,x:cx},{y:.38,rx:.147,rz:.143,x:cx},{y:.71,rx:.142,rz:.138,x:cx}],(k,f)=>f===0?'leatherLight':f===1?'leather':'leatherShade');
169:   g.box('Boot_'+side,[cx,.19,.093],[.323,.245,.452],'leather');g.box('Boot_'+side,[cx,.126,.215],[.343,.145,.264],'leatherLight');
170:   g.box('Sole_'+side,[cx,.0475,.10],[.355,.095,.488],'sole');
171:   for(const y of [.335,.475,.627]){g.box('BootStraps_'+side,[cx,y,.161],[.317,.036,.039],'leatherShade');g.box('BootStraps_'+side,[cx+.108,y,.19],[.049,.042,.022],'metalDark');}
172:   for(let i=0;i<4;i++)g.box('BootLaces_'+side,[cx,.377+i*.065,.161],[.088,.016,.015],'leatherLight');
173:  }
174:  for(const [name,data] of g.parts){
175:   if(!/^(Bracer_|BracerPattern_|Bracelet_|Cuff_|Hand_)/.test(name))continue;
176:   const sign=name.endsWith('_L')?1:-1;
177:   for(let k=0;k<data.position.length;k+=3){const y=data.position[k+1];
178:    const oldX=name.startsWith('Hand_')?.823+(1.367-y)*(.05/.222):name.startsWith('Bracelet_')?.817+(1.365-y)*.26:.815+(1.36-y)*(.113/.345);
179:    const newX=r.shoulderX+(r.shoulderY-y)*(r.wristX-r.shoulderX)/(r.shoulderY-r.wristY);
180:    data.position[k]+=sign*(newX-oldX);
```

## W4

来源：`playground/characters/ak-sixstarfresh/char_1044_hsgma2/revision-v2/character/model.mjs`

SHA-256：`8c229dcb356016ecbe415fa8a6c1e7ccc7d79012206604f66be9ea5fb303840c`

```text
150:   // All glove and wrist pieces share the arm's orthonormal frame.
151:   const wristMatrix=armMatrix.clone();wristMatrix.setPosition(armEnd);
152:   const localBox=(name,center,size,key)=>g.add(name,new THREE.BoxGeometry(...size).translate(...center),key,wristMatrix);
153:   if(side==='L'){
154:    localBox('Bracer_L',[0,.19,0],[.244,.42,.244],'glove');
155:    localBox('Bracer_L',[.086,.19,.127],[.022,.37,.014],'gloveLight');
156:    const flame=[[-.054,.114],[-.071,.075],[-.025,.048],[.026,.08],[.006,.117],[-.026,.099],[-.014,.063],[.04,.023],[.023,-.009],[-.035,-.035],[-.053,-.07],[-.012,-.103],[.02,-.073],[.003,-.05]];
157:    for(let k=0;k<flame.length-1;k++){
158:     const va=new THREE.Vector3(flame[k][0],.20+flame[k][1],.133),vb=new THREE.Vector3(flame[k+1][0],.20+flame[k+1][1],.133),d=vb.clone().sub(va);
159:     const m=new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()),new THREE.Vector3(1,1,1));
160:     g.add('BracerPattern_L',new THREE.BoxGeometry(.015,d.length(),.010),'pattern',wristMatrix.clone().multiply(m));
161:    }
162:    localBox('Hand_L',[0,-.12,0],[.222,.27,.222],'glove');
163:    for(const y of [.01,-.055]){
164:     // Closed four-sided bands, with separate square beads on every face.
165:     for(const z of [-.13,.13])localBox('Bracelet_L',[0,y,z],[.274,.022,.019],'trim');
166:     for(const x of [-.13,.13])localBox('Bracelet_L',[x,y,0],[.019,.022,.274],'trim');
167:     for(const t of [-.092,0,.092]){
168:      for(const z of [-.137,.137])localBox('Bracelet_L',[t,y,z],[.045,.043,.037],'beads');
169:      for(const x of [-.137,.137])localBox('Bracelet_L',[x,y,t],[.037,.043,.045],'beads');
170:     }
171:    }
172:   }else{
173:    localBox('Cuff_R',[0,-.005,0],[.254,.145,.254],'coat');
174:    for(const y of [-.049,.039])localBox('Cuff_R',[0,y,.135],[.231,.024,.018],'coatEdge');
175:    localBox('Cuff_R',[-.065,-.005,.151],[.042,.049,.018],'trim');
176:    localBox('Hand_R',[0,-.12,0],[.20,.25,.20],'skin');
```

## S5

来源：`skills/ak-model-batch-import/references/style-repair.md`

SHA-256：`17a55b946cf164180c5152acbb7bea5c73334ac28d95153651982e6f98036666`

```text
23: ## 用户确认的手部修复阈值（优先于统一方手偏好）
24:
25: 判断时打开这些原始用户截图，结合待处理模型的正面及斜侧面，按相近显示尺度比较。不要只统计手指数量或用是否存在独立指头判定。
26:
27: | 手部程度 | 手臂正常 | 手臂存在弯曲轮廓、肌肉化或不合风格等问题 |
28: | --- | --- | --- |
29: | 轻度，图一、二水平 | 保留手部 | 必须修手臂；轻度手部仍可保留，仅做必要衔接和包覆调整 |
30: | 临界，图三、四水平 | 保留手部，不为统一而修 | 必须修手臂，并一起修正临界手部及腕部衔接 |
31: | 明显比图三、四严重 | 必须修手部 | 手臂与手部都修 |
32:
```

## R1

来源：`playground/characters/ak-sixstarfresh/char_1013_chen2/revision-v2/REVISION.md`

SHA-256：`f75515af1b1565ed1478547fe3e9bd8c5400dbd4f530279ae8559c357d70c70b`

修订说明节选（省略本机入口及备份地址）：

```text
5: - 腿改为等宽矩形截面（宽/深 0.255），取消膝盖/小腿收细及分面肤色色差。
6: - 脚底至原始 y=1.42 的下身压缩至 86%，上身整体下移 0.1988；头、发型、配件的原形状与颜色保持。
7: - 双手各为一个 24 顶点方块，不含手指和突出拇指。
8: - 袖子采用矩形截面、宽直衣袖与窄幅袖口变化，保留橙色标记、内壁、开口和原骨骼渐变权重。
9: - 骨骼绑定坐标和表情 faceOffsetY 同步修正；原七骨头发/尾巴模块保留。
10: - 正/侧/背/斜视与跑动、代表表情已实际查看。骨骼权重误差 0，非有限权重 0；八表情、自然眨眼、30/60/144 FPS 下 18 组掉落/跳下和动态生命周期通过。
11: - 全局物理与该角色物理仍默认关闭。当前模型键和数据库链接不变，不额外增加收藏条目。
17: 这是按用户反馈完成的修正版，尚未替用户作出视觉批准。
```

## R2

来源：`playground/characters/ak-sixstarfresh/char_1044_hsgma2/revision-v2/REVISION.md`

SHA-256：`37971d5e0863fff1277c0b7dce70e7ecd54c52b8d6d7f372882166565b6fec13`

修订说明节选（省略本机入口及备份地址）：

```text
5: 手臂改为四边方块截面，去除解剖式削角和独立手指、拇指；保留服装与配饰。
14: 肩至腕中心线共线，恒定方形截面；肘关节随之对齐。保持原动态与默认物理关闭。v2 备份见 backups/straight-arms-v3。
17: 手套、手与腕带统一使用手臂局部正交坐标；红手套完整包覆，双排手环四面闭合，黑腕带闭合。正侧背面与动作检查通过。
```

## R3

来源：`playground/characters/ak-sixstarfresh/char_1040_blaze2/revision-v2/REVISION.md`

SHA-256：`0fb4d5322ca99772d0b094fb056bbb217ad65562f49e0d362607ba38004e0e94`

修订说明节选（省略本机入口及备份地址）：

```text
5: 手臂改为四边方块截面，去除解剖式削角和独立手指、拇指；保留服装与配饰。
14: 肩至腕中心线共线，恒定方形截面；肘关节随之对齐。保持原动态与默认物理关闭。v2 备份见 backups/straight-arms-v3。
```

## R4

来源：`playground/characters/ak-sixstarfresh/char_017_huang/revision-v2/REVISION.md`

SHA-256：`fe203d981bb31b1e2eaea66c8500a5ddae7c4dfd278206c74556a61e3889a870`

修订说明节选（省略本机入口及备份地址）：

```text
5: 仅双手修改，保留手套装饰；手臂及其余 39 个网格逐字节不变。
```

## R5

来源：`playground/characters/ak-sixstarfresh/char_1033_swire2/revision-v2/REVISION.md`

SHA-256：`8921ef32e787721319123f6e2e4a40eb10b700f6d662b81c03798d8d9ece000b`

修订说明节选（省略本机入口及备份地址）：

```text
5: 直臂、方块手、完整腕带包覆；琳琅诗怀雅同时修正方形等粗腿与方形飘袖。司霆惊蛰红色臂带位置重新贴合。
```

## R6

来源：`playground/characters/ak-sixstarfresh/char_1043_leizi2/revision-v2/REVISION.md`

SHA-256：`a51d1893cb1bd44d57bb1737a05937241cbe58628d4ee6602966d900779ef375`

修订说明节选（省略本机入口及备份地址）：

```text
5: 直臂、方块手、完整腕带包覆；琳琅诗怀雅同时修正方形等粗腿与方形飘袖。司霆惊蛰红色臂带位置重新贴合。
```

## K2

来源：`skillupdate/output/kaltsit-refined-20260924/character/necklace-validation.json`

SHA-256：`7432b42daea0ef2271bc956990f76505342b2fac797f386e0ff334e820fb342a`

选定字段原值（非完整报告；不是本轮测试）：

```json
{
  "pass": true,
  "sourceSHA256": "1cf7d96fa106f944cddeeee60099ed2dbe02223b5482f9bfb560c832ee56044a",
  "summary": {
    "poses": 25,
    "samplesPerPose": 840,
    "failed": []
  }
}
```

## K3

来源：`skillupdate/output/kaltsit-refined-20260924/character/forward-run-validation.json`

SHA-256：`bcb76c2557429829293b0012ea68e33e21fd35b08a18e1defc8736f7c004f33e`

选定字段原值（非完整报告；不是本轮测试）：

```json
{
  "pass": true,
  "sourceSHA256": "1cf7d96fa106f944cddeeee60099ed2dbe02223b5482f9bfb560c832ee56044a",
  "summary": {
    "results": [
      {
        "fps": 30,
        "pass": true,
        "maxForward": 13.860000000000003,
        "maxSpeed": 4.2,
        "contactPass": true,
        "failedChains": [],
        "failedContacts": [],
        "failedNecklace": []
      },
      {
        "fps": 60,
        "pass": true,
        "maxForward": 13.860000000000003,
        "maxSpeed": 4.2,
        "contactPass": true,
        "failedChains": [],
        "failedContacts": [],
        "failedNecklace": []
      },
      {
        "fps": 144,
        "pass": true,
        "maxForward": 13.860000000000003,
        "maxSpeed": 4.2,
        "contactPass": true,
        "failedChains": [],
        "failedContacts": [],
        "failedNecklace": []
      }
    ],
    "sustainedDrive": {
      "strongHairMeanSum": 0.3395399461754561,
      "noDriveHairMeanSum": 0.008137012613355733,
      "difference": 0.3314029335621003,
      "pass": true,
      "method": "Same actual root path and gait; control ignores setMotionDrive, retaining inertial acceleration. Compare sum of per-hair-chain mean skin displacement during cruise."
    }
  }
}
```

## K4

来源：`skillupdate/output/kaltsit-refined-20260924/character/forward-live-validation.json`

SHA-256：`bcd76234af96a9e568bedd206a185dce86a6f176b1d7c2b7e0a65d82fe3df3b6`

选定字段原值（非完整报告；不是本轮测试）：

```json
{
  "sourceSHA256": "1cf7d96fa106f944cddeeee60099ed2dbe02223b5482f9bfb560c832ee56044a",
  "completed": true,
  "frames": 1080,
  "distance": 13.860000000000003,
  "errors": [],
  "metrics": {
    "finite": true,
    "strongMotionValidation": "unverified",
    "scope": "Weighted short hair, rigid ears, connected coat hems and sleeve edges; bounded bone springs, not full mesh collision"
  }
}
```
