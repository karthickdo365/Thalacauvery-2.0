import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ---------------- utils ---------------- */
const TEAL='#20bea5';
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=THREE.MathUtils.lerp, damp=THREE.MathUtils.damp;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const UP=new THREE.Vector3(0,1,0);
const easeOutBack=x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);};
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const tag=(o,label)=>{o.userData.label=label;return o;};

const _tv=new THREE.Vector3(), _a=new THREE.Vector3(), _b=new THREE.Vector3(), _tgt=new THREE.Vector3();


/* ---------------- machine catalogue ---------------- */
const MACHINES={
  big:{
    key:'big',idx:'01',title:'BIG MACHINE',tag:'HEAVY-DUTY RIG',
    desc:'Built for deep bores, high-volume output and large-diameter drilling.',
    color:'#16a34a',lt:'#4ade80',hex:0x16a34a,
    cb:'rgba(22,163,74,.55)',csh:'rgba(22,163,74,.22)',
    view:{stowT:[.1,2.5],upT:[1.6,6.4],distStow:15.8,distUp:20.5},
    lightPos:[9,16,8],shadowR:14,stageR:5.6,
    raiseLambda:2.1,dustSize:.2,rippleR:.34,scaleCard:.8,
    drill:{strokeFt:28,rpm:128,torque:18.6,psi:340,downSec:7.5},
    specs:[
      ['MAX DEPTH','1,500 ft'],['BORE Ø','6½″ – 12½″'],['ENGINE','351 HP · Diesel'],
      ['MAST','8.3 m box truss'],['MUD PUMP','Triplex 5×6'],['TOOL JOINTS','4¼″ API'],
    ],
    builder:buildBigRig,
  },
  small:{
    key:'small',idx:'02',title:'SMALL MACHINE',tag:'COMPACT RIG',
    desc:'Perfect for narrow sites, quick jobs and tight-access drilling.',
    color:'#d97706',lt:'#fbbf24',hex:0xd97706,
    cb:'rgba(217,119,6,.55)',csh:'rgba(217,119,6,.22)',
    view:{stowT:[-.4,1.8],upT:[.5,3.4],distStow:7.8,distUp:9.2},
    lightPos:[5,10,6],shadowR:8,stageR:3.6,
    raiseLambda:2.4,dustSize:.13,rippleR:.22,scaleCard:.9,
    drill:{strokeFt:9,rpm:210,torque:3.2,psi:118,downSec:6},
    specs:[
      ['MAX DEPTH','350 ft'],['BORE Ø','4″ – 8″'],['ENGINE','62 HP · Diesel'],
      ['MAST','4.4 m guide frame'],['PUMP','3″ centrifugal'],['GROSS WEIGHT','2.4 t'],
    ],
    builder:buildSmallRig,
  },
};

/* ---------------- canvas textures ---------------- */
function brandTex(accent,line2){
  const c=document.createElement('canvas'); c.width=512; c.height=160;
  const x=c.getContext('2d');
  x.fillStyle='#10161f'; x.fillRect(0,0,512,160);
  x.fillStyle=accent; x.fillRect(0,0,10,160);
  x.fillStyle='#f2f5f7'; x.font='700 62px "Chakra Petch", sans-serif';
  x.textBaseline='middle'; x.fillText('THALACUVERY',44,62);
  x.fillStyle=accent; x.fillRect(44,104,220,5);
  x.fillStyle='rgba(255,255,255,.6)'; x.font='600 25px "IBM Plex Mono", monospace';
  x.fillText(line2,44,130);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  return t;
}
function stripeTex(){
  const c=document.createElement('canvas'); c.width=c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#141922'; x.fillRect(0,0,128,128);
  x.fillStyle='#f0c419';
  x.save(); x.translate(64,64); x.rotate(-Math.PI/4);
  for(let i=-4;i<=4;i++) x.fillRect(-96,i*32-8,192,16);
  x.restore();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1.4,1);
  return t;
}
function stageTexture(cssAccent){
  const S=512,c=document.createElement('canvas'); c.width=c.height=S;
  const x=c.getContext('2d'),cx=S/2;
  x.fillStyle='#0b111d'; x.fillRect(0,0,S,S);
  x.strokeStyle='rgba(255,255,255,.06)'; x.lineWidth=2;
  for(const f of[.28,.5,.72]){ x.beginPath(); x.arc(cx,cx,cx*f,0,Math.PI*2); x.stroke(); }
  x.strokeStyle='rgba(255,255,255,.12)';
  x.beginPath(); x.arc(cx,cx,cx*.94,0,Math.PI*2); x.stroke();
  x.strokeStyle=cssAccent; x.globalAlpha=.28; x.lineWidth=3;
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2,r1=cx*.88,r2=cx*.955;
    x.beginPath(); x.moveTo(cx+Math.cos(a)*r1,cx+Math.sin(a)*r1);
    x.lineTo(cx+Math.cos(a)*r2,cx+Math.sin(a)*r2); x.stroke();
  }
  x.globalAlpha=.5; x.strokeStyle='rgba(255,255,255,.25)'; x.lineWidth=2;
  x.beginPath(); x.moveTo(cx-14,cx); x.lineTo(cx+14,cx); x.moveTo(cx,cx-14); x.lineTo(cx,cx+14); x.stroke();
  x.globalAlpha=1;
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  return t;
}
function softTex(){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.35,'rgba(255,255,255,.5)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

/* ---------------- material + primitive helpers ---------------- */
const std=o=>new THREE.MeshStandardMaterial(o);
function palette(accent){
  const c=new THREE.Color(accent);
  return {
    body:     std({color:c,metalness:.32,roughness:.5,envMapIntensity:.7}),
    bodyDark: std({color:c.clone().multiplyScalar(.45),metalness:.4,roughness:.55,envMapIntensity:.6}),
    steel:    std({color:0x9aa3b0,metalness:.72,roughness:.34,envMapIntensity:1}),
    dark:     std({color:0x272e3a,metalness:.45,roughness:.6,envMapIntensity:.5}),
    tire:     std({color:0x14171d,metalness:.05,roughness:.95,envMapIntensity:.2}),
    glass:    std({color:0x0e1a28,metalness:.9,roughness:.14,envMapIntensity:1.3}),
    pipe:     std({color:0xd7dde6,metalness:.85,roughness:.28,envMapIntensity:1.1}),
    cable:    std({color:0x1b212c,metalness:.6,roughness:.5,envMapIntensity:.5}),
    beacon:   std({color:0x552f06,emissive:0xffb020,emissiveIntensity:1.2,roughness:.4}),
    lamp:     std({color:0x0e1c28,emissive:0xd9edff,emissiveIntensity:2.4,roughness:.3}),
    led:      std({color:0x0a2018,emissive:accent,emissiveIntensity:.7,roughness:.35}),
    hole:     std({color:0x05070a,roughness:1,metalness:0,side:THREE.DoubleSide}),
  };
}
function box(w,h,d,m){const x=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);x.castShadow=x.receiveShadow=true;return x;}
function cyl(rt,rb,h,m,seg=16){const x=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),m);x.castShadow=x.receiveShadow=true;return x;}
function bar(a,b,w,m){
  const d=_tv.subVectors(b,a).clone(),len=Math.max(d.length(),.001);
  const x=new THREE.Mesh(new THREE.BoxGeometry(w,len,w),m);
  x.castShadow=x.receiveShadow=true;
  x.position.copy(a).addScaledVector(d,.5);
  x.quaternion.setFromUnitVectors(UP,d.normalize());
  return x;
}
function updateBar(mesh,a,b){
  _tv.subVectors(b,a);
  const len=Math.max(_tv.length(),.001);
  mesh.position.copy(a);
  mesh.scale.set(1,len,1);
  mesh.quaternion.setFromUnitVectors(UP,_tv.normalize());
}
function dynCyl(r,m){ // unit-length dynamic cylinder (driven by updateBar)
  const geo=new THREE.CylinderGeometry(r,r,1,10); geo.translate(0,.5,0);
  const x=new THREE.Mesh(geo,m); x.castShadow=true; return x;
}
function spinWrap(mesh,axis){ // lets mesh.rotation.y spin about a world axis
  const g=new THREE.Group();
  if(axis==='z') g.rotation.x=Math.PI/2;
  else g.rotation.z=Math.PI/2;
  g.add(mesh); return g;
}
function makeTricone(p,s){ // s = scale
  const bit=new THREE.Group();
  bit.add(cyl(.17*s,.17*s,.24*s,p.steel,12));
  const cones=[];
  for(let i=0;i<3;i++){
    const az=i/3*Math.PI*2;
    const cg=new THREE.Group();
    cg.position.set(Math.cos(az)*.11*s,-.1*s,Math.sin(az)*.11*s);
    cg.rotation.order='YZX'; cg.rotation.y=-az; cg.rotation.z=-.5;
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.13*s,.3*s,10),p.steel);
    cone.castShadow=true; cone.rotation.x=Math.PI;
    for(let t=0;t<3;t++){
      const ta=t/3*Math.PI*2;
      const tooth=box(.05*s,.06*s,.05*s,p.dark);
      tooth.position.set(Math.cos(ta)*.085*s,-.04*s,Math.sin(ta)*.085*s);
      cone.add(tooth);
    }
    cg.add(cone); bit.add(cg); cones.push(cone);
  }
  return {bit,cones};
}

/* ================================================================
   BIG RIG — truck-mounted heavy-duty drilling rig
   ================================================================ */
function buildBigRig(accent){
  const p=palette(accent), g=new THREE.Group(), u=g.userData;
  const A=3.55, P=3.7, L=8.3;               // mast pivot x / y / mast length
  u.stow=1.5;                               // stowed (folded) mast angle
  u.headOff=.5;
  u.headTopLocal=7.6; u.headLowLocal=.55;   // top-drive travel (mast-local)
  u.bitTopLocal=-3.45; u.bitDeepLocal=-4.15;
  u.holeX=A;

  /* ---- carrier ---- */
  const chassis=box(7.4,.5,2.5,p.dark); chassis.position.set(0,1.16,0); g.add(chassis);
  const deck=box(4.95,.12,2.42,p.steel); deck.position.set(1.1,1.5,0); g.add(deck);

  const cab=tag(box(2.0,1.7,2.3,p.body),'OPERATOR CAB'); cab.position.set(-2.55,2.27,0); g.add(cab);
  const skirt=box(1.9,.5,2.34,p.dark); skirt.position.set(-2.55,1.6,0); g.add(skirt);
  const wind=box(.07,.85,2.0,p.glass); wind.position.set(-3.57,2.5,0); g.add(wind);
  const grille=box(.1,.7,1.5,p.dark); grille.position.set(-3.6,1.95,0); g.add(grille);
  const bumper=box(.32,.44,2.4,p.dark); bumper.position.set(-3.8,1.5,0); g.add(bumper);
  for(const s of[-1,1]){
    const sw=box(1.3,.55,.06,p.glass); sw.position.set(-2.55,2.55,s*1.16); g.add(sw);
    const hl=cyl(.11,.11,.09,p.lamp,14); hl.rotation.y=Math.PI/2; hl.position.set(-3.55,1.66,s*.85); g.add(hl);
    const bc=cyl(.08,.08,.16,p.beacon,10); bc.position.set(-2.95,3.2,s*.78); g.add(bc);
    g.add(bar(V(-3.45,2.85,s*1.2),V(-3.62,3.16,s*1.32),.03,p.dark));
    const mi=box(.3,.22,.05,p.glass); mi.position.set(-3.64,3.18,s*1.33); g.add(mi);
  }

  for(const x of[-1.9,1.4,2.4]) for(const s of[-1,1]){
    const t=tag(cyl(.62,.62,.5,p.tire,26),'AXLE'); t.rotation.x=Math.PI/2; t.position.set(x,.62,s*1.31); g.add(t);
    const h=cyl(.2,.2,.52,p.steel,12); h.rotation.x=Math.PI/2; h.position.set(x,.62,s*1.31); g.add(h);
  }
  for(const s of[-1,1]){
    const f1=box(2.15,.16,.6,p.body); f1.position.set(1.9,1.31,s*1.31); g.add(f1);
    const f2=box(1.05,.16,.6,p.body); f2.position.set(-1.9,1.31,s*1.31); g.add(f2);
  }

  for(const x of[.6,3.35]){
    const beam=tag(box(.34,.26,4.4,p.dark),'OUTRIGGER'); beam.position.set(x,1.16,0); g.add(beam);
    for(const s of[-1,1]){
      const leg=cyl(.13,.13,1.05,p.steel,10); leg.position.set(x,.55,s*2.05); g.add(leg);
      const pad=cyl(.3,.34,.16,p.dark,14); pad.position.set(x,.08,s*2.05); g.add(pad);
    }
  }

  /* ---- control cabin + ladder + handrail ---- */
  const cc=tag(box(1.05,1.45,1.9,p.bodyDark),'CONTROL CABIN'); cc.position.set(-1.35,2.22,0); g.add(cc);
  const ccw=box(.06,.6,1.4,p.glass); ccw.position.set(-.81,2.55,0); g.add(ccw);
  const ccr=box(1.15,.08,2.0,p.dark); ccr.position.set(-1.35,2.99,0); g.add(ccr);
  for(const s of[-1,1]) g.add(bar(V(-.86,1.56,s*.16),V(-.86,2.86,s*.16),.04,p.steel));
  for(let i=0;i<4;i++){const r=box(.32,.045,.045,p.steel); r.position.set(-.86,1.85+i*.33,0); g.add(r);}
  for(const x of[-1.1,-.1,.9,1.9]){const post=cyl(.03,.03,.78,p.steel,8); post.position.set(x,1.94,1.14); g.add(post);}
  g.add(bar(V(-1.15,2.32,1.14),V(2.0,2.32,1.14),.035,p.steel));
  g.add(bar(V(-1.15,1.98,1.14),V(2.0,1.98,1.14),.03,p.steel));

  /* ---- engine deck ---- */
  const eng=tag(box(1.35,1.05,1.8,p.body),'ENGINE · 351 HP'); eng.position.set(.55,2.0,0); g.add(eng);
  for(const s of[-1,1]){const vent=box(1.1,.5,.05,p.dark); vent.position.set(.55,2.0,s*.92); g.add(vent);}
  const exh=cyl(.07,.07,.8,p.dark,10); exh.position.set(.3,2.95,-.75); g.add(exh);
  u.smokeAnchor=V(.3,3.4,-.75);
  const air=cyl(.16,.16,.72,p.steel,14); air.rotation.z=Math.PI/2; air.position.set(.55,2.6,.6); g.add(air);

  /* ---- drawworks (spinning drum) ---- */
  const dwb=tag(box(1.2,.45,1.95,p.dark),'DRAWWORKS'); dwb.position.set(1.75,1.75,0); g.add(dwb);
  const drum=cyl(.32,.32,.9,p.steel,18);
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    const lug=box(.07,.84,.07,p.dark);
    lug.position.set(Math.cos(a)*.35,0,Math.sin(a)*.35); drum.add(lug);
  }
  for(const s of[-1,1]){const fl=cyl(.44,.44,.07,p.bodyDark,20); fl.position.y=s*.48; drum.add(fl);}
  const dwg=spinWrap(drum,'z'); dwg.position.set(1.75,2.28,0); g.add(dwg);
  u.drum=drum;

  /* ---- mud tank + racked drill pipes ---- */
  const tank=tag(box(1.3,1.0,2.0,p.bodyDark),'MUD TANK'); tank.position.set(2.85,1.98,0); g.add(tank);
  const trf=box(1.36,.06,2.06,p.steel); trf.position.set(2.85,2.51,0); g.add(trf);
  for(const s of[-1,1]){const cap=cyl(.09,.09,.15,p.dark,10); cap.position.set(2.85,2.6,s*.62); g.add(cap);}
  for(const z of[-.55,0,.55]){
    const dp=tag(cyl(.09,.09,3.1,p.pipe,12),'DRILL PIPE RACK');
    dp.rotation.z=Math.PI/2; dp.position.set(2.7,2.64,z); g.add(dp);
    const cpl=box(.22,.2,.2,p.steel); cpl.position.set(3.9,2.64,z); g.add(cpl);
  }

  /* ---- mast tower + hazard board ---- */
  for(const s of[-1,1]){
    const plate=tag(box(.14,2.3,.6,p.bodyDark),'MAST TOWER'); plate.position.set(3.55,2.62,s*.75); g.add(plate);
    g.add(bar(V(3.55,3.5,s*.68),V(2.35,1.56,s*1.0),.07,p.steel));
  }
  const tbeam=box(.5,.2,1.7,p.dark); tbeam.position.set(3.55,3.66,0); g.add(tbeam);
  const hz=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,2.2),std({map:stripeTex(),roughness:.7}));
  hz.position.set(3.73,1.16,0); g.add(hz);

  /* ---- the mast (folds / raises about the tower pivot) ---- */
  const mast=new THREE.Group(); mast.position.set(A,P,0); g.add(mast);
  tag(mast,'BOX-TRUSS MAST'); u.mast=mast;

  const RX=[-.36,.36],RZ=[-.42,.42];
  for(const x of RX) for(const z of RZ){
    const leg=cyl(.09,.09,L,p.steel,10); leg.position.set(x,L/2,z); mast.add(leg);
  }
  const segs=7, dy=L/segs;
  for(let i=0;i<segs;i++){
    const y0=i*dy,y1=y0+dy;
    for(const x of RX){
      if(i>0) mast.add(bar(V(x,y0,RZ[0]),V(x,y0,RZ[1]),.055,p.steel));
      mast.add(i%2===0?bar(V(x,y0,RZ[0]),V(x,y1,RZ[1]),.05,p.steel)
                      :bar(V(x,y0,RZ[1]),V(x,y1,RZ[0]),.05,p.steel));
    }
    for(const z of RZ){
      if(i>0) mast.add(bar(V(RX[0],y0,z),V(RX[1],y0,z),.05,p.steel));
      mast.add(i%2===0?bar(V(RX[0],y0,z),V(RX[1],y1,z),.05,p.steel)
                      :bar(V(RX[1],y0,z),V(RX[0],y1,z),.05,p.steel));
    }
  }
  for(const z of RZ) mast.add(bar(V(RX[0],L,z),V(RX[1],L,z),.07,p.steel));
  for(const x of RX) mast.add(bar(V(x,L,RZ[0]),V(x,L,RZ[1]),.07,p.steel));

  const crown=tag(box(1.2,.4,1.05,p.bodyDark),'CROWN BLOCK'); crown.position.set(0,L+.25,0); mast.add(crown);
  u.sheaves=[];
  for(const s of[-1,1]){
    mast.add(bar(V(0,L-.15,s*.42),V(0,L+.05,s*.58),.06,p.steel));
    const sh=cyl(.17,.17,.09,p.steel,16);
    const wrap=spinWrap(sh,'z'); wrap.position.set(0,L+.05,s*.58); mast.add(wrap);
    u.sheaves.push(sh);
  }
  const cb=cyl(.07,.07,.18,p.beacon,10); cb.position.set(0,L+.52,0); mast.add(cb);

  const npb=box(1.56,.56,.04,p.dark); npb.position.set(0,6.7,.44); mast.add(npb);
  const np=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.5),
    new THREE.MeshBasicMaterial({map:brandTex(accent,'HEAVY-DUTY RIG · 1500 FT')}));
  np.position.set(0,6.7,.465); mast.add(np);

  /* top-drive head */
  const head=new THREE.Group(); head.position.set(0,u.headTopLocal,0); mast.add(head);
  tag(head,'TOP DRIVE');
  head.add(box(1.0,.75,.95,p.body));
  for(const s of[-1,1]){
    const mo=cyl(.16,.16,.5,p.dark,12); mo.rotation.x=Math.PI/2; mo.position.set(s*.32,.62,0); head.add(mo);
  }
  const hplate=box(.92,.1,.82,p.steel); hplate.position.y=-.44; head.add(hplate);
  const hconn=cyl(.15,.15,.2,p.steel,12); hconn.position.y=-.52; head.add(hconn);
  const led=box(.16,.05,.05,p.led); led.position.set(.3,.12,.49); head.add(led);
  u.ledMat=p.led; u.head=head;

  /* hex kelly (rotation reads via flat faces + stripe) */
  const pg=new THREE.CylinderGeometry(.11,.11,1,6); pg.translate(0,-.5,0);
  const pipe=new THREE.Mesh(pg,p.pipe); pipe.castShadow=true;
  const stripe=box(.03,1,.05,p.dark); stripe.position.set(0,-.5,.1); pipe.add(stripe);
  tag(pipe,'KELLY · HEX'); u.pipe=pipe; mast.add(pipe);

  /* tricone bit + guide collar + conductor hole */
  const tc=makeTricone(p,1);
  tc.bit.position.set(0,u.bitTopLocal,0); mast.add(tc.bit);
  tag(tc.bit,'TRICONE BIT'); tc.bit.visible=false;
  u.bitGroup=tc.bit; u.cones=tc.cones;

  const collar=new THREE.Group(); collar.position.set(0,-3.32,0); mast.add(collar);
  for(const [x,z] of [[-.26,-.26],[.26,-.26],[-.26,.26],[.26,.26]])
    collar.add(bar(V(x,-.25,z),V(x,.25,z),.06,p.dark));
  for(const zz of[-.26,.26]){
    collar.add(bar(V(-.26,.25,zz),V(.26,.25,zz),.05,p.dark));
    collar.add(bar(V(-.26,-.25,zz),V(.26,-.25,zz),.05,p.dark));
  }
  u.collar=collar; collar.visible=false;

  const hole=new THREE.Group(); hole.position.set(A,0,0); g.add(hole);
  const casing=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.55,24,1,true),p.hole);
  casing.position.y=.275; casing.castShadow=true; hole.add(casing);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(.28,24),p.hole);
  floor.rotation.x=-Math.PI/2; floor.position.y=.08; hole.add(floor);
  const hring=new THREE.Mesh(new THREE.TorusGeometry(.3,.05,10,28),p.steel);
  hring.rotation.x=Math.PI/2; hring.position.y=.55; hring.castShadow=true; hole.add(hring);
  tag(hole,'BOREHOLE · CONDUCTOR'); hole.visible=false; u.hole=hole;

  /* dynamic rigging: crown→head cables, drum→crown fastline, hydraulic rams */
  u.cables=[];
  for(const [fx,fz,ox,oz] of [[-.2,-.3,-.16,-.3],[.2,.3,.16,.3]]){
    const mesh=dynCyl(.03,p.cable); mast.add(mesh);
    u.cables.push({mesh,from:V(fx,L-.12,fz),off:V(ox,.42,oz)});
  }
  const fl=dynCyl(.03,p.cable); g.add(fl);
  const flA=new THREE.Object3D(); flA.position.set(0,L+.02,.55); mast.add(flA);
  u.fastline={mesh:fl,base:V(1.75,2.55,.3),anchor:flA};

  u.hyd=[];
  for(const s of[-1,1]){
    const mesh=dynCyl(.07,p.steel); g.add(mesh);
    const anch=new THREE.Object3D(); anch.position.set(0,2.6,s*.5); mast.add(anch);
    const lugB=box(.14,.14,.1,p.dark); lugB.position.set(0,2.6,s*.44); mast.add(lugB);
    const lugA=box(.16,.14,.14,p.dark); lugA.position.set(2.15,1.62,s*.9); g.add(lugA);
    u.hyd.push({mesh,base:V(2.15,1.6,s*.9),anchor:anch});
  }

  u.beaconMat=p.beacon;
  return g;
}

/* ================================================================
   SMALL RIG — compact trailer-mounted rig
   ================================================================ */
function buildSmallRig(accent){
  const p=palette(accent), g=new THREE.Group(), u=g.userData;
  const A=1.45, P=2.1, L=4.35;
  const PX=.12;                              // drill-line offset in mast local X
  u.stow=1.5; u.headOff=.3;
  u.headTopLocal=3.7; u.headLowLocal=.4;
  u.bitTopLocal=-1.85; u.bitDeepLocal=-2.3;
  u.holeX=A+PX;

  /* frame + tongue */
  const frame=tag(box(3.0,.32,1.5,p.body),'MAIN FRAME'); frame.position.set(.15,.96,0); g.add(frame);
  for(const s of[-1,1]) g.add(tag(bar(V(-1.32,.98,s*.3),V(-2.42,.68,s*.08),.06,p.steel),'TONGUE'));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.12,.035,10,24),p.steel);
  ring.rotation.y=Math.PI/2; ring.position.set(-2.55,.68,0); ring.castShadow=true; g.add(ring);
  const hz=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,1.2),std({map:stripeTex(),roughness:.7}));
  hz.position.set(1.66,1.0,0); g.add(hz);

  for(const s of[-1,1]){
    const t=tag(cyl(.5,.5,.32,p.tire,22),'HUB'); t.rotation.x=Math.PI/2; t.position.set(.95,.5,s*.86); g.add(t);
    const h=cyl(.15,.15,.34,p.steel,10); h.rotation.x=Math.PI/2; h.position.set(.95,.5,s*.86); g.add(h);
    const f=box(.82,.12,.66,p.body); f.position.set(.95,1.06,s*.88); g.add(f);
    const ml=cyl(.06,.06,.05,p.lamp,10); ml.rotation.y=Math.PI/2; ml.position.set(-1.33,1.05,s*.6); g.add(ml);
  }

  /* power pack + fuel */
  const eng=tag(box(.85,.6,.8,p.body),'POWER PACK · 62 HP'); eng.position.set(-.05,1.42,0); g.add(eng);
  const exh=cyl(.045,.045,.5,p.dark,8); exh.position.set(-.35,1.9,.22); g.add(exh);
  u.smokeAnchor=V(-.35,2.18,.22);
  const recoil=new THREE.Mesh(new THREE.TorusGeometry(.09,.02,8,20),p.steel);
  recoil.position.set(-.05,1.42,.42); g.add(recoil);
  const fuel=tag(cyl(.16,.16,.72,p.body,14),'FUEL TANK'); fuel.rotation.z=Math.PI/2; fuel.position.set(-.95,1.22,.55); g.add(fuel);
  const fcap=cyl(.05,.05,.06,p.dark,8); fcap.position.set(-.62,1.33,.55); g.add(fcap);

  /* winch drum with crank */
  const wbr=tag(box(.4,.26,.7,p.bodyDark),'WINCH DRUM'); wbr.position.set(-1.15,1.2,0); g.add(wbr);
  const wm=cyl(.16,.16,.44,p.steel,14);
  const crank=box(.34,.05,.05,p.dark); crank.position.set(.19,0,0); wm.add(crank);
  const knob=cyl(.05,.05,.14,p.dark,8); knob.rotation.z=Math.PI/2; knob.position.set(.4,0,0); wm.add(knob);
  const wg=spinWrap(wm,'z'); wg.position.set(-1.15,1.47,0); g.add(wg);
  u.drum=wm;

  /* toolbox + spare rods */
  const tb=tag(box(.55,.34,.8,p.bodyDark),'TOOLBOX'); tb.position.set(.65,1.29,0); g.add(tb);
  for(const s of[-1,1]){
    const rod=tag(cyl(.05,.05,2.1,p.pipe,10),'DRILL RODS');
    rod.rotation.z=Math.PI/2; rod.position.set(.55,1.51,s*.26); g.add(rod);
  }

  /* jacks + handle */
  for(const s of[-1,1]){
    const leg=tag(cyl(.05,.05,1.0,p.steel,8),'JACK LEG'); leg.position.set(-1.28,.6,s*.55); g.add(leg);
    const pad=cyl(.13,.15,.08,p.dark,12); pad.position.set(-1.28,.1,s*.55); g.add(pad);
  }
  for(const s of[-1,1]) g.add(tag(bar(V(1.6,1.08,s*.36),V(2.26,1.5,s*.28),.045,p.steel),'TOW HANDLE'));
  const cross=cyl(.04,.04,.62,p.dark,8); cross.rotation.x=Math.PI/2; cross.position.set(2.26,1.52,0); g.add(cross);

  /* mast */
  const mast=new THREE.Group(); mast.position.set(A,P,0); g.add(mast);
  tag(mast,'GUIDE MAST'); u.mast=mast;
  const spine=box(.2,L,.36,p.steel); spine.position.set(-.26,L/2,0); mast.add(spine);
  for(const s of[-1,1]){
    const rail=box(.06,L,.08,p.dark); rail.position.set(.12,L/2,s*.17); mast.add(rail);
    mast.add(bar(V(-.26,.12,s*.28),V(.1,.9,s*.17),.04,p.steel));
  }
  for(let i=0;i<7;i++){const rung=box(.3,.04,.03,p.dark); rung.position.set(-.05,.6+i*.5,.19); mast.add(rung);}

  const plate=box(.5,.08,.5,p.dark); plate.position.set(0,L+.04,0); mast.add(plate);
  const sh=cyl(.12,.12,.09,p.steel,14);
  const sw=spinWrap(sh,'z'); sw.position.set(.3,L+.02,0); mast.add(sw);
  u.sheaves=[sh];
  mast.add(bar(V(.1,L-.06,0),V(.3,L,0),.05,p.steel));
  const bcn=cyl(.055,.055,.15,p.beacon,10); bcn.position.set(0,L+.16,0); mast.add(bcn);
  const np=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.36),
    new THREE.MeshBasicMaterial({map:brandTex(accent,'COMPACT RIG · 350 FT')}));
  np.position.set(-.05,2.6,.2); np.rotation.y=.35; mast.add(np);

  /* head + rod + bit + collar + hole */
  const head=new THREE.Group(); head.position.set(PX,u.headTopLocal,0); mast.add(head);
  tag(head,'FEED HEAD');
  head.add(box(.42,.5,.46,p.body));
  const mo=cyl(.1,.1,.34,p.dark,10); mo.rotation.x=Math.PI/2; mo.position.y=.38; head.add(mo);
  const hpl=box(.44,.08,.48,p.steel); hpl.position.y=-.26; head.add(hpl);
  const sled=box(.16,.05,.05,p.led); sled.position.set(.1,.08,.24); head.add(sled);
  u.ledMat=p.led; u.head=head;

  const pg=new THREE.CylinderGeometry(.055,.055,1,6); pg.translate(0,-.5,0);
  const pipe=new THREE.Mesh(pg,p.pipe); pipe.castShadow=true; pipe.position.x=PX;
  const stripe=box(.016,1,.026,p.dark); stripe.position.set(0,-.5,.05); pipe.add(stripe);
  tag(pipe,'DRILL ROD'); u.pipe=pipe; mast.add(pipe);

  const tc=makeTricone(p,.62);
  tc.bit.position.set(PX,u.bitTopLocal,0); mast.add(tc.bit);
  tag(tc.bit,'TRICONE BIT'); tc.bit.visible=false;
  u.bitGroup=tc.bit; u.cones=tc.cones;

  const collar=new THREE.Mesh(new THREE.TorusGeometry(.11,.045,10,18),p.dark);
  collar.rotation.x=Math.PI/2; collar.position.set(PX,-1.8,0); collar.castShadow=true;
  mast.add(collar); u.collar=collar; collar.visible=false;

  const hole=new THREE.Group(); hole.position.set(u.holeX,0,0); g.add(hole);
  const casing=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.34,20,1,true),p.hole);
  casing.position.y=.17; hole.add(casing);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(.18,20),p.hole);
  floor.rotation.x=-Math.PI/2; floor.position.y=.05; hole.add(floor);
  const hring=new THREE.Mesh(new THREE.TorusGeometry(.2,.04,10,24),p.steel);
  hring.rotation.x=Math.PI/2; hring.position.y=.34; hring.castShadow=true; hole.add(hring);
  tag(hole,'BOREHOLE · CONDUCTOR'); hole.visible=false; u.hole=hole;

  /* dynamic rigging */
  const cable=dynCyl(.02,p.cable); mast.add(cable);
  u.cables=[{mesh:cable,from:V(.3,L-.06,0),off:V(-.15,.3,0)}];
  const wr=dynCyl(.02,p.cable); g.add(wr);
  const wa=new THREE.Object3D(); wa.position.set(.3,L-.04,0); mast.add(wa);
  u.fastline={mesh:wr,base:V(-1.15,1.6,0),anchor:wa};

  u.hyd=[];
  for(const s of[-1,1]){
    const mesh=dynCyl(.05,p.steel); g.add(mesh);
    const anch=new THREE.Object3D(); anch.position.set(-.1,1.4,s*.3); mast.add(anch);
    const lug=box(.12,.12,.1,p.dark); lug.position.set(.55,1.14,s*.6); g.add(lug);
    u.hyd.push({mesh,base:V(.55,1.12,s*.6),anchor:anch});
  }

  u.beaconMat=p.beacon;
  return g;
}

/* ---------------- showroom turntable ---------------- */
function buildStage(radius,accentHex,colorCss){
  const g=new THREE.Group();
  const top=std({color:0xffffff,map:stageTexture(colorCss),roughness:.93,metalness:.08});
  const side=std({color:0x0a0f18,roughness:.85,metalness:.2});
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.18,72),[side,top,side]);
  disc.position.y=-.09; disc.receiveShadow=true; g.add(disc);
  const ringMat=std({
    color:new THREE.Color(accentHex).multiplyScalar(.3),
    emissive:accentHex,emissiveIntensity:1.1,roughness:.6,metalness:.1,
  });
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius-.07,.032,10,96),ringMat);
  ring.rotation.x=Math.PI/2; ring.position.y=.02; g.add(ring);
  g.userData.ringMat=ringMat;
  return g;
}

/* ---------------- particles: drill dust ---------------- */
class Dust{
  constructor(parent,origin,accentHex,size){
    this.N=90; this.origin=origin;
    this.pos=new Float32Array(this.N*3); this.col=new Float32Array(this.N*3);
    this.parts=[];
    for(let i=0;i<this.N;i++) this.parts.push({life:-1,ttl:1,x:0,y:-99,z:0,vx:0,vy:0,vz:0});
    const geo=new THREE.BufferGeometry();
    this.pa=new THREE.BufferAttribute(this.pos,3); this.ca=new THREE.BufferAttribute(this.col,3);
    this.pa.setUsage(THREE.DynamicDrawUsage); this.ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position',this.pa); geo.setAttribute('color',this.ca);
    this.pts=new THREE.Points(geo,new THREE.PointsMaterial({
      size,map:softTex(),transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,vertexColors:true,
    }));
    this.pts.frustumCulled=false;
    this.base=new THREE.Color(0xc09a6e).lerp(new THREE.Color(accentHex),.25);
    parent.add(this.pts);
  }
  burst(n){
    for(let k=0;k<n;k++){
      const i=this.parts.findIndex(p=>p.life<0||p.life>=p.ttl);
      if(i<0) return;
      const p=this.parts[i],a=Math.random()*Math.PI*2,sp=.5+Math.random()*1.3;
      p.x=this.origin.x+(Math.random()-.5)*.25;
      p.z=this.origin.z+(Math.random()-.5)*.25;
      p.y=this.origin.y+Math.random()*.1;
      p.vx=Math.cos(a)*sp; p.vz=Math.sin(a)*sp; p.vy=.9+Math.random()*1.5;
      p.ttl=.7+Math.random()*.7; p.life=0;
    }
  }
  update(dt){
    let any=false;
    for(let i=0;i<this.N;i++){
      const p=this.parts[i];
      if(p.life>=0&&p.life<p.ttl){
        p.life+=dt; p.vy-=dt*1.6;
        p.vx*=Math.exp(-dt*1.6); p.vz*=Math.exp(-dt*1.6);
        p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
        if(p.y<.05){p.y=.05;p.vy*=-.25;}
        if(p.life>=p.ttl){
          this.pos[i*3+1]=-99; this.col[i*3]=this.col[i*3+1]=this.col[i*3+2]=0; any=true; continue;
        }
        const k=1-p.life/p.ttl,f=k*k;
        this.pos[i*3]=p.x; this.pos[i*3+1]=p.y; this.pos[i*3+2]=p.z;
        this.col[i*3]=this.base.r*f; this.col[i*3+1]=this.base.g*f; this.col[i*3+2]=this.base.b*f;
        any=true;
      }
    }
    if(any){this.pa.needsUpdate=true;this.ca.needsUpdate=true;}
  }
}

/* ---------------- particles: exhaust smoke ---------------- */
class Smoke{
  constructor(parent,anchor){
    this.anchor=anchor; this.pool=[]; this.acc=0; this.rate=.8;
    const geo=new THREE.SphereGeometry(1,8,6);
    for(let i=0;i<14;i++){
      const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
        color:0x3d454f,transparent:true,opacity:0,roughness:1,metalness:0,depthWrite:false,
      }));
      m.visible=false; m.userData={age:-1}; parent.add(m); this.pool.push(m);
    }
  }
  spawn(boost=1){
    const m=this.pool.find(p=>p.userData.age<0); if(!m) return;
    const u=m.userData;
    u.ttl=1.3+Math.random()*.8; u.age=0; u.ph=Math.random()*9;
    u.p=this.anchor.clone().add(V((Math.random()-.5)*.1,0,(Math.random()-.5)*.1));
    u.vx=(Math.random()-.5)*.3+.15; u.vz=(Math.random()-.5)*.3; u.vy=.7+Math.random()*.5;
    u.s0=.09*boost; u.s1=(.42+Math.random()*.25)*boost; u.o=.6+.4*Math.random();
    m.visible=true;
  }
  burst(n){ for(let i=0;i<n;i++) this.spawn(1.6); }
  update(dt,t){
    this.acc+=dt*this.rate;
    while(this.acc>1){this.acc-=1;this.spawn();}
    for(const m of this.pool){
      const u=m.userData; if(u.age<0) continue;
      u.age+=dt;
      const k=u.age/u.ttl;
      if(k>=1){u.age=-1;m.visible=false;continue;}
      u.p.y+=u.vy*dt; u.p.x+=u.vx*dt+Math.sin((t+u.ph)*3)*dt*.25; u.p.z+=u.vz*dt;
      u.vy*=Math.exp(-dt*.35);
      m.position.copy(u.p);
      m.scale.setScalar(u.s0+(u.s1-u.s0)*k);
      m.material.opacity=.3*Math.sin(Math.PI*Math.min(k,1))*u.o;
    }
  }
}

/* ---------------- mud ripple rings at the hole ---------------- */
class Ripple{
  constructor(parent,x,rIn,color){
    this.rings=[];
    for(let i=0;i<3;i++){
      const m=new THREE.Mesh(new THREE.RingGeometry(rIn,rIn*1.32,28),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
      m.rotation.x=-Math.PI/2; m.position.set(x,.045,0); m.userData.t=-1;
      parent.add(m); this.rings.push(m);
    }
    this.next=0;
  }
  emit(){ const m=this.rings[this.next++%3]; m.userData.t=0; }
  update(dt){
    for(const m of this.rings){
      if(m.userData.t<0) continue;
      m.userData.t+=dt;
      const k=m.userData.t/1.1;
      if(k>=1){m.userData.t=-1;m.material.opacity=0;continue;}
      const s=.7+k*1.6; m.scale.set(s,s,1);
      m.material.opacity=.4*(1-k)*(k<.15?k/.15:1);
    }
  }
}

/* ================================================================
   RigViewer — orbit + mast rig-up + drilling + part inspection
   ================================================================ */
class RigViewer{
  constructor({canvas,machine,mode,scale}){
    const cfg=MACHINES[machine];
    this.cfg=cfg; this.canvas=canvas; this.mode=mode; this.scale=scale;
    this.active=true; this.w=0;
    this.hover=0; this.hoverT=0; this.flash=0; this.idleT=0;
    this.orbit={yaw:.8,pitch:.3,zoom:1,vYaw:REDUCED?0:1.4};
    this.born=performance.now()/1000;

    const r=this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    r.setClearColor(0x000000,0);
    r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap;
    r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.1;

    this.scene=new THREE.Scene();
    const pmrem=new THREE.PMREMGenerator(r);
    this.scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
    pmrem.dispose();

    this.holder=new THREE.Group(); this.scene.add(this.holder);
    const stage=buildStage(cfg.stageR,cfg.hex,cfg.color);
    this.ringMat=stage.userData.ringMat;
    this.rig=cfg.builder(cfg.hex);
    this.holder.add(stage,this.rig);
    const u=this.rig.userData;

    this.camera=new THREE.PerspectiveCamera(40,1,.1,160);

    this.scene.add(new THREE.HemisphereLight(0x5a6a86,0x05070c,.75));
    const key=new THREE.DirectionalLight(0xffffff,2.1);
    key.position.set(...cfg.lightPos); key.castShadow=true;
    key.shadow.mapSize.set(1536,1536);
    const sc=key.shadow.camera,R=cfg.shadowR;
    sc.left=-R; sc.right=R; sc.top=R; sc.bottom=-R; sc.near=1; sc.far=60;
    key.shadow.normalBias=.04; key.shadow.bias=-.0002;
    this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x2bd4bd,.9); rim.position.set(-8,6,-7); this.scene.add(rim);
    const fill=new THREE.DirectionalLight(cfg.hex,.55); fill.position.set(6,3,-8); this.scene.add(fill);
    this.accent=new THREE.PointLight(cfg.hex,60,26,2);
    this.scene.add(this.accent);

    this.dust=new Dust(this.rig,V(u.holeX,.32,0),cfg.hex,cfg.dustSize*scale);
    this.smoke=new Smoke(this.rig,u.smokeAnchor);
    this.ripple=new Ripple(this.rig,u.holeX,cfg.rippleR,cfg.color);

    /* rig state */
    this.mastAngle=u.stow; this.mastTarget=u.stow; this.camProg=0;
    this.locked=false; this.ready=false; this.pipeRun=0;
    this.bitLocal=u.headTopLocal-u.headOff-.55;
    this.autoRaiseAt=(mode==='page')?this.born+.55:Infinity;
    this._raisedOnce=false;
    this.drill={on:false,phase:'idle',head:u.headTopLocal,depth:0};
    this._spin=0; this._lastHead=u.headTopLocal; this._lastAngle=u.stow;
    this.dustAcc=0; this.rippleAcc=0;
    this.onStroke=null; this.onReady=null; this.onMastUp=null; this.onRigStart=null;

    /* part-inspection raycaster + tooltip */
    this.ray=new THREE.Raycaster(); this.ray.params.Points.threshold=.05;
    this._ndc=new THREE.Vector2();
    this.tipEl=document.createElement('div'); this.tipEl.className='tip';
    canvas.parentElement.appendChild(this.tipEl);

    this._bindControls();
    this._ro=new ResizeObserver(()=>this._resize());
    this._ro.observe(canvas.parentElement);
    this._resize();
  }

  _resize(){
    const p=this.canvas.parentElement,w=p.clientWidth,h=p.clientHeight;
    if(!w||!h){this.w=0;return;}
    this.w=w;
    this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
  }

  _bindControls(){
    const c=this.canvas,ptrs=this._ptrs=new Map();
    let lastPinch=0;
    c.addEventListener('pointerdown',e=>{
      c.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      this.orbit.vYaw=0; this.idleT=0; this._tip(null);
    });
    c.addEventListener('pointermove',e=>{
      this._pick(e);
      const prev=ptrs.get(e.pointerId);
      if(!prev) return;
      if(ptrs.size===2){
        ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const [a,b]=[...ptrs.values()];
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        if(lastPinch>0) this.orbit.zoom=clamp(this.orbit.zoom*lastPinch/d,.5,1.9);
        lastPinch=d; return;
      }
      const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
      this.orbit.yaw-=dx*.0052; this.orbit.vYaw=-dx*.0052;
      this.orbit.pitch=clamp(this.orbit.pitch+dy*.0032,.1,1.05);
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      this.idleT=0;
    });
    const up=e=>{ptrs.delete(e.pointerId); if(ptrs.size<2) lastPinch=0;};
    c.addEventListener('pointerup',up);
    c.addEventListener('pointercancel',up);
    c.addEventListener('pointerleave',()=>this._tip(null));
    c.addEventListener('wheel',e=>{
      e.preventDefault();
      this.orbit.zoom=clamp(this.orbit.zoom*Math.exp(e.deltaY*.0011),.5,1.9);
    },{passive:false});
  }

  _pick(e){
    if(this._ptrs.size>0||!this.w) return;
    const r=this.canvas.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) return;
    this._ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    this.ray.setFromCamera(this._ndc,this.camera);
    const hits=this.ray.intersectObject(this.rig,true);
    let label=null;
    for(const h of hits){
      if(!this._shown(h.object)) continue;
      label=this._labelOf(h.object);
      if(label) break;
    }
    this._tip(label,e);
  }
  _labelOf(o){for(;o&&o!==this.rig;o=o.parent){if(o.userData.label)return o.userData.label;}return null;}
  _shown(o){for(;o&&o!==this.rig;o=o.parent){if(!o.visible)return false;}return true;}
  _tip(label,e){
    const el=this.tipEl;
    if(!label){
      el.classList.remove('on');
      if(this._ptrs.size===0) this.canvas.style.cursor='grab';
      return;
    }
    el.textContent=label; el.classList.add('on');
    const r=this.canvas.parentElement.getBoundingClientRect();
    let x=e.clientX-r.left+14,y=e.clientY-r.top+16;
    x=Math.max(4,Math.min(x,r.width-el.offsetWidth-6));
    y=Math.max(4,Math.min(y,r.height-el.offsetHeight-6));
    el.style.left=x+'px'; el.style.top=y+'px';
    el.style.borderColor=this.cfg.color; el.style.color=this.cfg.lt;
    this.canvas.style.cursor='help';
  }

  /* public API */
  setHover(on){this.hoverT=on?1:0;}
  hoverCard(on){ this.setHover(on); if(this.mode==='card') this.mastTarget=on?0:this.rig.userData.stow; }
  powerFlash(){ this.flash=1; this.mastTarget=0; this.dust.burst(14); this.smoke.burst(4); }
  startDrill(){ if(this.ready&&!this.drill.on){this.drill.on=true;this.drill.phase='down';} }
  stopDrill(){ this.drill.on=false; }
  drillDepth(){
    const d=this.drill,u=this.rig.userData,c=this.cfg.drill;
    const span=u.headTopLocal-u.headLowLocal;
    const prog=(this.ready&&d.on&&d.phase==='down')?clamp((u.headTopLocal-d.head)/span,0,1):0;
    return d.depth+prog*c.strokeFt;
  }

  update(dt,t){
    const u=this.rig.userData,c=this.cfg,o=this.orbit,drag=this._ptrs.size>0;

    /* orbit with inertia + idle drift */
    if(!drag){
      o.yaw+=o.vYaw; o.vYaw*=Math.exp(-dt*3.1); this.idleT+=dt;
      if(this.idleT>2.2&&!REDUCED) o.yaw+=(.10+.14*this.hover)*dt;
    }
    this.hover+=(this.hoverT-this.hover)*Math.min(1,dt*6);
    this.flash*=Math.exp(-dt*2.6);

    /* auto rig-up on machine page */
    if(!this._raisedOnce&&t>this.autoRaiseAt){
      this._raisedOnce=true; this.mastTarget=0;
      this.onRigStart&&this.onRigStart();
    }

    /* mast raise / lower */
    const lam=REDUCED?18:c.raiseLambda;
    this.mastAngle=damp(this.mastAngle,this.mastTarget,lam,dt);
    u.mast.rotation.z=this.mastAngle;
    const prog=clamp(1-this.mastAngle/u.stow,0,1);
    this.camProg=damp(this.camProg,prog,4,dt);
    this.rigging=Math.abs(this.mastAngle-this.mastTarget)>.03;

    if(this.mastTarget===0){
      if(!this.locked&&this.mastAngle<.06){
        this.locked=true; this.pipeRun=0; this.smoke.burst(3);
        this.onMastUp&&this.onMastUp();
      }
      if(this.locked&&!this.ready){                 /* drill string run-in */
        this.pipeRun=Math.min(1,this.pipeRun+dt/.8);
        const e=1-Math.pow(1-this.pipeRun,3);
        this.bitLocal=lerp(u.headTopLocal-u.headOff-.55,u.bitTopLocal,e);
        u.bitGroup.visible=this.pipeRun>.4;
        u.collar.visible=this.pipeRun>.3;
        u.hole.visible=this.pipeRun>.25;
        if(this.pipeRun>=1){ this.ready=true; this.onReady&&this.onReady(); }
      }
    }else{
      if(this.mastAngle>u.stow*.6){this.locked=false;this.ready=false;this.pipeRun=0;}
      this.bitLocal=u.headTopLocal-u.headOff-.55;
      u.bitGroup.visible=false; u.collar.visible=false; u.hole.visible=false;
    }

    /* drilling stroke */
    const d=this.drill;
    if(this.ready&&d.on){
      const span=u.headTopLocal-u.headLowLocal;
      if(d.phase==='down'){
        d.head-=span*dt/c.drill.downSec;
        const pr=clamp((u.headTopLocal-d.head)/span,0,1);
        this.bitLocal=lerp(u.bitTopLocal,u.bitDeepLocal,pr);
        this.dustAcc+=dt*22;
        while(this.dustAcc>1){this.dustAcc-=1;this.dust.burst(1);}
        this.rippleAcc+=dt;
        if(this.rippleAcc>.5){this.rippleAcc=0;this.ripple.emit();}
        if(d.head<=u.headLowLocal){
          d.head=u.headLowLocal; this.bitLocal=u.bitDeepLocal;
          d.phase='bottom'; d.wait=.55; d.depth+=c.drill.strokeFt;
          this.dust.burst(24);
          this.onStroke&&this.onStroke();
        }
      }else if(d.phase==='bottom'){
        d.wait-=dt; if(d.wait<=0) d.phase='up';
      }else if(d.phase==='up'){
        d.head+=span*dt/2.6;
        const pr=clamp((d.head-u.headLowLocal)/span,0,1);
        this.bitLocal=lerp(u.bitDeepLocal,u.bitTopLocal,pr);
        if(d.head>=u.headTopLocal){d.head=u.headTopLocal;this.bitLocal=u.bitTopLocal;d.phase='down';}
      }
    }

    /* head / kelly / bit */
    const wob=(this.ready&&d.on)?Math.sin(t*31)*.02:0;
    u.head.position.y=d.head+wob;
    const pipeTop=d.head-u.headOff;
    u.pipe.position.y=pipeTop;
    u.pipe.scale.y=Math.max(.02,pipeTop-this.bitLocal);
    u.bitGroup.position.y=this.bitLocal;

    /* rotary spin (hex kelly + tricone) */
    const spinRate=(d.on&&d.phase!=='up'?1:.12)*c.drill.rpm*.105+this.flash*22;
    this._spin+=spinRate*dt;
    u.pipe.rotation.y=this._spin;
    u.bitGroup.rotation.y=this._spin*1.7;
    for(const cn of u.cones) cn.rotation.y+=dt*(d.on?9:1.5)+this.flash*8*dt;

    /* crown cables (mast-local) */
    for(const cb of u.cables)
      updateBar(cb.mesh,cb.from,_b.copy(u.head.position).add(cb.off));

    /* drum + sheaves spool with head & mast motion */
    const dHead=d.head-this._lastHead, dAng=this.mastAngle-this._lastAngle;
    this._lastHead=d.head; this._lastAngle=this.mastAngle;
    if(u.drum) u.drum.rotation.y+=dHead*6+dAng*3;
    for(const s of u.sheaves) s.rotation.y+=dHead*5+dAng*2.5;

    /* engine vibration while drilling */
    const shk=(this.ready&&d.on)?1:0;
    this.rig.position.set(Math.sin(t*53)*.013*shk,Math.sin(t*47)*.011*shk,0);

    /* pop-in scale, then world-space ropes & hydraulic rams */
    const age=clamp((t-this.born)/.8,0,1);
    this.holder.scale.setScalar(this.scale*(REDUCED?1:Math.max(.001,easeOutBack(age))));
    this.holder.updateMatrixWorld(true);
    for(const h of u.hyd){
      h.anchor.getWorldPosition(_a); this.rig.worldToLocal(_a);
      updateBar(h.mesh,h.base,_a);
    }
    if(u.fastline){
      u.fastline.anchor.getWorldPosition(_a); this.rig.worldToLocal(_a);
      updateBar(u.fastline.mesh,u.fastline.base,_a);
    }

    /* beacons / status LED / smoke rate */
    const bm=u.beaconMat;
    if(this.ready&&d.on) bm.emissiveIntensity=Math.sin(t*18)>0?3.6:.15;
    else if(this.rigging||(this.locked&&!this.ready)) bm.emissiveIntensity=Math.sin(t*12)>0?3.2:.15;
    else bm.emissiveIntensity=1+Math.sin(t*2.2)*.7+this.flash*3;
    u.ledMat.emissiveIntensity=(this.ready&&d.on)?1.6+Math.sin(t*9)*.8:.7;

    this.smoke.rate=this.mode==='page'?(d.on?5:1.1):(this.rigging?3.2:.8);
    if(this.flash>.2) this.smoke.rate+=6;
    this.smoke.update(dt,t);
    this.dust.update(dt);
    this.ripple.update(dt);

    /* stage glow */
    this.ringMat.emissiveIntensity=.9+.9*this.hover+2.4*this.flash+.12*Math.sin(t*1.6);
    this.accent.intensity=50+70*this.hover+150*this.flash;

    /* camera follows the rig-up choreography */
    const v=c.view,cp=this.camProg,s=this.scale;
    _tgt.set(lerp(v.stowT[0],v.upT[0],cp),lerp(v.stowT[1],v.upT[1],cp),0).multiplyScalar(s);
    this.accent.position.set(_tgt.x*.4,_tgt.y+2.2*s,7*s);
    const dist=lerp(v.distStow,v.distUp,cp)*s*o.zoom*(1-.06*(this.hover+this.flash));
    this.camera.position.set(
      _tgt.x+dist*Math.cos(o.pitch)*Math.sin(o.yaw),
      _tgt.y+dist*Math.sin(o.pitch),
      _tgt.z+dist*Math.cos(o.pitch)*Math.cos(o.yaw));
    this.camera.lookAt(_tgt);

    if(this.active&&this.w) this.renderer.render(this.scene,this.camera);
  }

  dispose(){
    this.active=false;
    this._ro?.disconnect();
    this.tipEl?.remove();
    this.renderer?.dispose();
    this.renderer?.renderLists?.dispose?.();
  }
}


export { MACHINES, RigViewer, clamp };
