// Synthetic construction fixture fitted to the approved Silver Wolf body.
// This is not a reconstruction of a named character or a new style baseline.
export function technicalKit() {
  const spec = {version:1, palette:{webbing:'#a3493e',hardware:'#a6b1b7',card:'#e3e7e4',cardInk:'#496d83',bag:'#394857',zip:'#79838a',screen:'#5aa8a5'}, anchors:{}, bones:[], dynamics:[], parts:[]};
  const anchor=(id,position,bone,owner)=>spec.anchors[id]={position,bone,owner,evidence:'inferred'};
  const part=(id,kind,geometry,color,bone,extra={})=>spec.parts.push({id,kind,geometry,color,shapeMode:'rigid',motionMode:'follow',binding:{bone},priority:'structure',evidence:'inferred',...extra});
  const attach=(name)=>[{anchor:name,at:spec.anchors[name].position}];
  const spring=(name,parent,position,axis,maxAngle)=>{spec.bones.push({name,parent,position});spec.dynamics.push({bone:name,axis,stiffness:70,damping:17,maxAngle});};

  // Sewn strip -> actual open ring -> rigid card/frame; only the hanging group swings.
  anchor('badge_seam',[-.22,2.24,.3925],'chest','Collar');
  spring('acc_badge','chest',[-.22,2.15,.448],[0,0,1],.12);
  part('badge_strap','strap',{points:[[-.22,2.24,.3925],[-.22,2.20,.435],[-.22,2.15,.448]],width:.045,thickness:.02,step:.035},'webbing','chest',{shapeMode:'deformable',attachments:attach('badge_seam')});
  part('badge_ring','frame',{center:[-.22,2.11,.448],size:[.075,.08,.025],opening:[.041,.045]},'hardware','acc_badge',{motionMode:'secondary'});
  anchor('card_top',[-.22,2.075,.448],'acc_badge','Acc_badge_ring');
  part('badge_card','plate',{center:[-.22,1.94,.448],size:[.21,.28,.025]},'card','acc_badge',{motionMode:'secondary',attachments:attach('card_top'),priority:'identity'});
  part('badge_frame','frame',{center:[-.22,1.94,.45],size:[.23,.30,.028],opening:[.205,.275]},'hardware','acc_badge',{motionMode:'secondary'});
  part('badge_picture','plate',{center:[-.265,1.972,.465],size:[.06,.085,.009]},'cardInk','acc_badge',{motionMode:'secondary'});
  part('badge_bar','plate',{center:[-.18,1.944,.465],size:[.075,.018,.009]},'cardInk','acc_badge',{motionMode:'secondary'});

  // Two body attachment bones, intermediate path stations, rigid adjuster, independent tail.
  anchor('sling_top',[.32,2.25,.3075],'chest','Bodice');
  anchor('sling_bottom',[-.32,1.4875,.3075],'hips','Shorts');
  part('sling','strap',{points:[[.32,2.25,.3075],[.20,2.08,.4075],[-.02,1.83,.4075],[-.32,1.54,.4075],[-.32,1.4875,.3075]],width:.075,thickness:.02,step:.045},'webbing','chest',{shapeMode:'deformable',binding:{stations:[{t:0,bone:'chest'},{t:.6,bone:'chest'},{t:1,bone:'hips'}]},attachments:[...attach('sling_top'),...attach('sling_bottom')],priority:'identity'});
  part('sling_adjuster','frame',{center:[-.32,1.50,.405],size:[.11,.08,.028],opening:[.080,.043]},'hardware','hips');
  part('sling_crossbar','plate',{center:[-.32,1.50,.405],size:[.10,.014,.028]},'hardware','hips');
  spring('acc_tail','hips',[-.32,1.465,.416],[0,0,1],.12);
  part('sling_tail','strap',{points:[[-.32,1.51,.415],[-.32,1.465,.416],[-.32,1.29,.423],[-.30,1.12,.423]],width:.06,thickness:.018,step:.04},'webbing','hips',{shapeMode:'deformable',motionMode:'secondary',binding:{stations:[{t:0,bone:'hips'},{t:.12,bone:'hips'},{t:.35,bone:'acc_tail'},{t:1,bone:'acc_tail'}]}});

  // Zipper tape follows the garment; the long pull is a separately mounted rigid piece.
  anchor('zip_seam',[.32,1.88,.3075],'chest','Bodice');
  part('zip_tape','strap',{points:[[.32,2.12,.3075],[.32,1.67,.3075]],width:.026,thickness:.020,step:.08},'zip','chest',{shapeMode:'deformable',attachments:attach('zip_seam')});
  part('zip_slider','plate',{center:[.32,1.91,.333],size:[.054,.067,.036]},'hardware','chest');
  spring('acc_pull','chest',[.32,1.897,.358],[0,0,1],.09);
  part('zip_pull','frame',{center:[.32,1.83,.358],size:[.045,.145,.023],opening:[.019,.10]},'hardware','acc_pull',{motionMode:'secondary'});

  // Front thigh pouch backed by a closed wrap. Follows thigh, not pelvis.
  const x=.22405460067,y=.98;
  anchor('thigh_wrap',[x,y,.128],'thigh.L','Leg_L');
  part('thigh_wrap','strap',{points:[[x-.129,y,-.128],[x+.129,y,-.128],[x+.129,y,.128],[x-.129,y,.128],[x-.129,y,-.128]],widthAxis:[0,1,0],width:.06,thickness:.027,step:.05},'webbing','thigh.L',{shapeMode:'deformable',attachments:attach('thigh_wrap')});
  part('pouch','shell',{center:[x,.944,.213],size:[.20,.235,.143],wall:.02},'bag','thigh.L');
  part('pouch_flap','plate',{center:[x,1.018,.287],size:[.20,.087,.025]},'bag','thigh.L');
  part('pouch_button','plate',{center:[x,1.003,.303],size:[.035,.028,.009]},'hardware','thigh.L');
  return spec;
}

// A separate composition to check reuse outside the four reference assemblies.
export function wristKit() {
  const spec=technicalKit();
  spec.parts=[];spec.anchors={};spec.bones=[];spec.dynamics=[];
  const bone='forearm.L',base={shapeMode:'rigid',motionMode:'follow',binding:{bone},priority:'structure',evidence:'inferred'};
  spec.parts.push(
    {id:'wrist_case',kind:'shell',geometry:{center:[.89,1.985,.289],size:[.20,.17,.12],wall:.018},color:'bag',...base},
    {id:'wrist_screen',kind:'plate',geometry:{center:[.89,1.985,.339],size:[.151,.12,.013]},color:'screen',...base},
    {id:'wrist_cable',kind:'cord',geometry:{points:[[.795,1.985,.29],[.755,1.98,.305],[.735,1.9,.29],[.80,1.87,.23]],width:.025,step:.025},color:'zip',...base,shapeMode:'deformable'}
  );
  return spec;
}
