/* Landing page 3D scene: a Maya-style graph space. The Wrapline curve runs through it between keys; scrolling flies the camera along the curve while a playhead travels it. */
import * as THREE from './vendor/three.module.min.js';
/* the set-up runs in short pieces with a breath between them, so the page can keep painting and responding while the scene is built */
const tick=()=>new Promise(r=>setTimeout(r,0));
export async function start(canvas){
 const root=document.documentElement;
 const phone=matchMedia('(max-width:680px)').matches,coarse=matchMedia('(pointer:coarse)').matches;
 /* a browser that draws with the processor instead of a graphics chip (a virtual machine, a speed test, some old PCs) gets a lighter picture:
    lower resolution, no edge smoothing, about 30 frames a second. Anything with a graphics chip is unchanged. */
 let soft=false;
 try{const g=document.createElement('canvas').getContext('webgl'),x=g&&g.getExtension('WEBGL_debug_renderer_info');
  soft=!!x&&/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(String(g.getParameter(x.UNMASKED_RENDERER_WEBGL)));
  g&&g.getExtension('WEBGL_lose_context')&&g.getExtension('WEBGL_lose_context').loseContext();}catch{}
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!coarse&&!soft,powerPreference:'high-performance'});}catch{return false;}
 if(!renderer.getContext())return false;
 renderer.setClearColor(0x000000,0);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,120);
 const BLUE=0x3D8BFF,GOLD=0xF2B64F;
 const theme=()=>root.getAttribute('data-theme')==='dark';
 const pal=()=>theme()?{bg:0x080C18,ink:0xDDE6FF,grid:.13,dust:.5,face:0x121930}:{bg:0xE9EDF3,ink:0x0E1220,grid:.12,dust:.34,face:0xFFFFFF};
 let P=pal();
 scene.fog=new THREE.Fog(P.bg,9,31);
 /* the curve */
 const pts=[[2.4,-2.5,10],[2.2,-1.5,3],[3.2,2.1,-4],[6.4,2.5,-10],[1,-.7,-16],[-4.4,-1.1,-22],[-1,2,-28],[4.2,2.6,-34],[.4,.2,-41],[0,.6,-52]].map(a=>new THREE.Vector3(...a));
 const curve=new THREE.CatmullRomCurve3(pts,false,'catmullrom',.5);
 const SEG=phone?360:640;
 const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,SEG,.045,8,false),new THREE.MeshBasicMaterial({color:BLUE}));
 const halo=new THREE.Mesh(new THREE.TubeGeometry(curve,SEG,.16,8,false),new THREE.MeshBasicMaterial({color:BLUE,transparent:true,opacity:.1,depthWrite:false}));
 const total=tube.geometry.index.count;tube.geometry.setDrawRange(0,0);halo.geometry.setDrawRange(0,0);
 scene.add(halo,tube); await tick();
 /* keys with their tangent handles, as in the graph editor */
 const ink=new THREE.LineBasicMaterial({color:P.ink,transparent:true,opacity:.42});
 const face=new THREE.MeshBasicMaterial({color:P.face});
 const edge=new THREE.LineBasicMaterial({color:BLUE});
 const keyGeo=new THREE.OctahedronGeometry(.34,0),keyEdges=new THREE.EdgesGeometry(keyGeo),dotGeo=new THREE.SphereGeometry(.07,10,10);
 const dotMat=new THREE.MeshBasicMaterial({color:P.ink});
 const keys=[];
 for(let i=1;i<pts.length-1;i++){
  const u=i/(pts.length-1),g=new THREE.Group();g.position.copy(pts[i]);
  const body=new THREE.Group();body.add(new THREE.Mesh(keyGeo,face),new THREE.LineSegments(keyEdges,edge));g.add(body);
  const t=curve.getTangentAt(Math.min(.999,Math.max(.001,u))).multiplyScalar(1.5);
  const a=t.clone(),b=t.clone().negate();
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([b,a]),ink));
  for(const v of [a,b]){const d=new THREE.Mesh(dotGeo,dotMat);d.position.copy(v);g.add(d);}
  scene.add(g);keys.push({g,body,u});
 } await tick();
 /* floor grid */
 const gv=[];const GX=34,Z0=14,Z1=-64,STEP=2;
 for(let x=-GX;x<=GX;x+=STEP)gv.push(x,0,Z0,x,0,Z1);
 for(let z=Z0;z>=Z1;z-=STEP)gv.push(-GX,0,z,GX,0,z);
 const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(gv,3));
 const gridMat=new THREE.LineBasicMaterial({color:P.ink,transparent:true,opacity:P.grid});
 const grid=new THREE.LineSegments(gridGeo,gridMat);grid.position.y=-2.6;scene.add(grid); await tick();
 /* joint chains: the way Maya draws bones, swaying as if keyed */
 const boneMat=new THREE.LineBasicMaterial({color:P.ink,transparent:true,opacity:.5});
 const jointGeo=new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.2,0));
 const chains=[];
 function chain(x,y,z,lens,lean){
  const base=new THREE.Group();base.position.set(x,y,z);base.rotation.z=lean;let parent=base;const joints=[];
  for(const len of lens){
   const j=new THREE.Group();parent.add(j);if(parent!==base)j.position.y=parent.userData.len;
   j.userData.len=len;
   const cone=new THREE.ConeGeometry(.2,len,4,1,true);cone.translate(0,len/2,0);
   j.add(new THREE.LineSegments(new THREE.EdgesGeometry(cone),boneMat),new THREE.LineSegments(jointGeo,edge));
   joints.push(j);parent=j;
  }
  const tip=new THREE.LineSegments(jointGeo,edge);tip.position.y=lens[lens.length-1];parent.add(tip);
  scene.add(base);chains.push({joints,seed:chains.length*1.7});
 }
 chain(7.6,-2.4,-6,[2.1,1.7,1.1],.5);chain(-8.6,-2.4,-21,[1.9,1.6,1],-.45);chain(7,-2.4,-31,[2.2,1.6,1.1],.4); await tick();
 /* dust for depth */
 const N=phone?140:320,dp=new Float32Array(N*3);
 for(let i=0;i<N;i++){dp[i*3]=(Math.random()-.5)*36;dp[i*3+1]=Math.random()*9-2.4;dp[i*3+2]=10-Math.random()*62;}
 const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dp,3));
 const dustMat=new THREE.PointsMaterial({color:P.ink,size:.055,transparent:true,opacity:P.dust,sizeAttenuation:true,depthWrite:false});
 scene.add(new THREE.Points(dustGeo,dustMat)); await tick();
 /* playhead that rides the curve */
 const head=new THREE.Group();
 head.add(new THREE.Mesh(new THREE.SphereGeometry(.13,16,16),new THREE.MeshBasicMaterial({color:GOLD})));
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.3,.012,8,40),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.8}));head.add(ring);
 scene.add(head);
 function paint(){P=pal();scene.fog.color.setHex(P.bg);for(const m of [ink,boneMat,gridMat,dustMat,dotMat])m.color.setHex(P.ink);gridMat.opacity=P.grid;dustMat.opacity=P.dust;face.color.setHex(P.face);halo.material.opacity=theme()?.16:.1;}
 paint();new MutationObserver(paint).observe(root,{attributes:true,attributeFilter:['data-theme']});
 /* sizing */
 let W=0,H=0,cap=soft?.6:coarse?1.25:1.5,slow=0,lastDraw=0,frames=0,lastT=0;
 function size(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;if(w===W&&h===H)return;W=w;H=h;renderer.setPixelRatio(Math.min(devicePixelRatio||1,cap));renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?56:42;camera.updateProjectionMatrix();}
 size();addEventListener('resize',size,{passive:true});
 /* motion */
 let wasDeep=false,target=0,p=0,mx=0,my=0,cx=0,cy=0,born=0,alive=true,raf=0;
 /* the page length is measured rarely (never during a scroll), so scrolling itself does no layout work */
 let max=1;const span=()=>{max=Math.max(1,document.documentElement.scrollHeight-innerHeight);};span();addEventListener('resize',span,{passive:true});addEventListener('load',span,{once:true});setInterval(span,2500);
 const read=()=>{target=Math.min(1,Math.max(0,scrollY/max));};
 read();p=target;addEventListener('scroll',read,{passive:true});
 if(!coarse)addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5;},{passive:true});
 const look=new THREE.Vector3(),aim=new THREE.Vector3(),tmp=new THREE.Vector3();
 const near=new THREE.Vector3(),goal=new THREE.Vector3();let first=true;
 /* where the curve is at a given depth (the curve only ever travels away from the viewer, so depth picks one point) */
 const LUT=curve.getSpacedPoints(400);
 function at(z,out){let lo=0,hi=LUT.length-1;if(z>=LUT[0].z)return out.copy(LUT[0]);if(z<=LUT[hi].z)return out.copy(LUT[hi]);while(hi-lo>1){const m=(lo+hi)>>1;if(LUT[m].z>z)lo=m;else hi=m;}const a=LUT[lo],b=LUT[hi],t=(a.z-z)/((a.z-b.z)||1);return out.lerpVectors(a,b,t);}
 const ease=t=>1-Math.pow(1-t,3);
 function frame(now){
  raf=requestAnimationFrame(frame);if(!alive)return;
  if(soft){if(now-lastDraw<30)return;lastDraw=now;}
  if(!born)born=now;const t=(now-born)/1000;
  /* if this device cannot keep up, the scene drops to a lighter resolution instead of making the page stutter */
  if(lastT&&cap>.75){const dt=now-lastT;if(dt<200){frames++;if(dt>24)slow++;if(frames>=90){if(slow>30){cap=cap>1?1:.75;W=0;size();}frames=0;slow=0;}}}lastT=now;
  p+=(target-p)*.065;const deep=scrollY>innerHeight*.55;if(deep!==wasDeep){wasDeep=deep;root.classList.toggle('lx-deep',deep);}cx+=(mx-cx)*.04;cy+=(my-cy)*.04;
  const d=Math.round(total*ease(Math.min(1,t/2.2))/3)*3;tube.geometry.setDrawRange(0,d);halo.geometry.setDrawRange(0,d);
  /* camera: flies beside the curve, always on its left and a little above it. The curve therefore stays on the right of the view and never
     sweeps across the middle of the screen, where the words are. */
  const cz=10-p*44;at(cz,near);
  const off=W>H?3.9:3.1;
  goal.set(near.x-off+cx*.9,near.y*.45+1.25-cy*.6,cz);
  if(first)camera.position.copy(goal);else camera.position.lerp(goal,.09);
  at(cz-11,aim);aim.x-=off*.42;aim.y=aim.y*.55+.2;
  /* upright screens: in the hero the scene sits above the headline */
  if(W<=H)aim.y-=(1-Math.min(1,p*5))*4.4;
  look.lerp(aim,first?1:.08);camera.lookAt(look);first=false;
  /* anything that drifts too close to the lens shrinks away instead of filling the screen */
  for(const k of keys){const d=camera.position.distanceTo(k.g.position);k.g.scale.setScalar(Math.min(1,Math.max(0,(d-2.2)/3)));}
  const u=Math.min(.995,.115+p*.82+Math.sin(t*.6)*.004);
  curve.getPointAt(u,tmp);head.position.copy(tmp);ring.lookAt(camera.position);ring.scale.setScalar(1+Math.sin(t*2.4)*.12);
  for(const k of keys){k.body.rotation.y=t*.5+k.u*6;k.body.rotation.x=Math.sin(t*.7+k.u*9)*.25;const near=1-Math.min(1,Math.abs(k.u-u)*9);k.body.scale.setScalar(1+near*.5);}
  for(const c of chains){c.joints.forEach((j,i)=>{j.rotation.z=Math.sin(t*.9+c.seed+i*.8)*(.16+i*.1);j.rotation.x=Math.cos(t*.6+c.seed+i)*.1;});}
  renderer.render(scene,camera);
 }
 document.addEventListener('visibilitychange',()=>{alive=!document.hidden;});
 return new Promise(res=>{requestAnimationFrame(now=>{frame(now);res(true);});});
}
