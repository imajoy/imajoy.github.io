/* Original procedural character study. No external models or CDN requests. */
import * as THREE from './vendor/three.module.min.js';
const canvas = document.querySelector('#stage');
const host = document.querySelector('#motion-stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch {
  host.classList.add('scene-unavailable');
  document.querySelectorAll('[data-scene], #scrub').forEach(control => { control.disabled = true; });
  const toggle = document.querySelector('#motion-toggle');
  let paused = reduced.matches;
  const sync = () => { document.documentElement.toggleAttribute('data-motion-paused', paused); toggle.textContent = paused ? 'Play motion' : 'Pause motion'; toggle.setAttribute('aria-pressed', String(paused)); document.dispatchEvent(new CustomEvent('ajoy:motionchange', {detail:{paused}})); if (paused) document.querySelector('#motion-video')?.pause(); };
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  sync();
}
if (renderer) start();
function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080e1b, .035);
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xc5e6ff, 0x1b2737, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 4);
  key.position.set(4, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left:-8,right:8,top:8,bottom:-8,near:.1,far:30});
  key.shadow.bias=-.001; scene.add(key);
  const rim = new THREE.PointLight(0x55dcf5, 65, 18);rim.position.set(-4, 4, -3);scene.add(rim);
  const warm = new THREE.PointLight(0xffaa66, 40, 14);warm.position.set(4, 2, 2);scene.add(warm);
  const material=(color,metalness=.15,roughness=.4)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const pearl=material(0xe4e8e9,.35,.3),dark=material(0x172c3e,.55,.24),accent=material(0xf8ae67,.55,.25);
  const glow=new THREE.MeshStandardMaterial({color:0x7ce9f6,emissive:0x39b9d8,emissiveIntensity:1.5,metalness:.3,roughness:.25});
  const mesh=(geo,mat,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const sphere=(r,mat,parent,x=0,y=0,z=0)=>mesh(new THREE.SphereGeometry(r,24,16),mat,parent,x,y,z);
  const capsule=(r,len,mat,parent,x=0,y=0,z=0)=>mesh(new THREE.CapsuleGeometry(r,len,5,16),mat,parent,x,y,z);
  const floor=mesh(new THREE.PlaneGeometry(80,80),material(0x080e1b,.5,.7),scene,0,-.12,0);floor.rotation.x=-Math.PI/2;
  const grid=new THREE.GridHelper(50,50,0x244657,0x142432);grid.position.y=-.1;grid.material.transparent=true;grid.material.opacity=.5;scene.add(grid);
  const platform=mesh(new THREE.CylinderGeometry(3.35,3.55,.2,96),material(0x122331,.65,.3),scene,0,-.01,0);
  const rings=[];
  for(let i=0;i<3;i++){
    const ring=mesh(new THREE.TorusGeometry(3.1+i*.45,.012,8,128),new THREE.MeshBasicMaterial({color:i?0x28485b:0x72dce8,transparent:true,opacity:i?.5:.8}),scene,0,.11+i*.005,0);
    ring.rotation.x=-Math.PI/2;rings.push(ring);
  }
  const character=new THREE.Group();scene.add(character);
  const hip=new THREE.Group();hip.position.y=2;character.add(hip);
  sphere(.38,dark,hip,0,0,0).scale.set(1.25,.7,.8);
  const torso=new THREE.Group();torso.position.y=.28;hip.add(torso);
  capsule(.43,.42,pearl,torso,0,.25,0).scale.set(1,.95,.7);
  capsule(.17,.38,dark,torso,0,.24,.31).rotation.z=Math.PI/2;
  sphere(.055,glow,torso,0,.3,.47);
  const neck=new THREE.Group();neck.position.y=.89;torso.add(neck);
  sphere(.13,accent,neck,0,0,0);
  const head=sphere(.39,pearl,neck,0,.39,0);head.scale.set(1,.95,.94);
  const visor=sphere(.335,dark,neck,0,.39,.12);visor.scale.set(.97,.58,.85);
  for(const x of [-.12,.12]) {const eye=capsule(.025,.08,glow,neck,x,.4,.415);eye.rotation.z=Math.PI/2;}
  mesh(new THREE.TorusGeometry(.4,.026,12,64),accent,neck,0,.39,0).rotation.y=Math.PI/2;
  const limbs=[];
  function limb(side,isArm){
    const root=new THREE.Group();root.position.set(side*(isArm?.5:.25),isArm?.58:-.12,0);(isArm?torso:hip).add(root);
    const length=isArm?.65:.84, radius=isArm?.13:.17;
    sphere(radius*1.25,accent,root);
    capsule(radius,length-radius*2,pearl,root,0,-length/2,0);
    const joint=new THREE.Group();joint.position.y=-length;root.add(joint);
    sphere(radius,dark,joint);
    capsule(radius*.86,length-radius*2,pearl,joint,0,-length/2,0);
    const tip=new THREE.Group();tip.position.y=-length;joint.add(tip);
    sphere(radius,accent,tip);
    const end=capsule(isArm?.13:.19,isArm?.15:.3,isArm?dark:pearl,tip,0,-.1,isArm?0:.13);
    if(!isArm)end.rotation.x=Math.PI/2;
    const control=mesh(new THREE.TorusGeometry(isArm?.22:.3,.012,6,40),new THREE.MeshBasicMaterial({color:0x83e6ec,transparent:true,opacity:.75}),tip);
    control.rotation.x=isArm?0:Math.PI/2;
    const obj={root,joint,tip,side,isArm};limbs.push(obj);return obj;
  }
  const leftArm=limb(-1,true),rightArm=limb(1,true),leftLeg=limb(-1,false),rightLeg=limb(1,false);
  const waist=mesh(new THREE.TorusGeometry(.65,.015,8,64),new THREE.MeshBasicMaterial({color:0xffbe80}),hip,0,0,0);waist.rotation.x=Math.PI/2;
  const ghosts=[];
  for(let i=0;i<3;i++){
    const geo=new THREE.TorusGeometry(1.4+i*.14,.014,8,80);
    const g=mesh(geo,new THREE.MeshBasicMaterial({color:0x59cce6,transparent:true,opacity:.22-i*.045}),scene,-1.5,2.2,-1.8-i*.22);
    g.rotation.y=.6;ghosts.push(g);
  }
  const satellites=new THREE.Group();scene.add(satellites);
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const box=mesh(new THREE.BoxGeometry(.12,.12,.12),i%2?accent:glow,satellites,Math.cos(a)*4.3,1.1+(i%3)*.9,Math.sin(a)*3);
    box.rotation.set(a,a,.7);
  }
  const particles=new Float32Array(180*3);
  for(let i=0;i<180;i++){particles[i*3]=Math.sin(i*13.3)*14;particles[i*3+1]=((i*7.13)%8);particles[i*3+2]=Math.cos(i*17.2)*12;}
  const points=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(particles,3)),new THREE.PointsMaterial({color:0x72c8de,size:.023,transparent:true,opacity:.6}));scene.add(points);
  let mode='flow',time=0,paused=reduced.matches,visible=true,last=performance.now(),pointer={x:0,y:0};
  const toggle=document.querySelector('#motion-toggle'),scrub=document.querySelector('#scrub'),output=document.querySelector('#frame-number');
  function syncPause(){toggle.textContent=paused?'Play motion':'Pause motion';toggle.setAttribute('aria-pressed',String(paused));document.documentElement.toggleAttribute('data-motion-paused',paused);if(paused)document.querySelector('#motion-video')?.pause();document.dispatchEvent(new CustomEvent('ajoy:motionchange',{detail:{paused}}));}
  syncPause();toggle.addEventListener('click',()=>{paused=!paused;syncPause();});
  reduced.addEventListener('change',e=>{paused=e.matches;syncPause();});
  scrub.addEventListener('input',()=>{paused=true;time=Number(scrub.value)/120*Math.PI*2;syncPause();render();});
  document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.scene;document.querySelectorAll('[data-scene]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
  host.addEventListener('pointermove',e=>{const r=host.getBoundingClientRect();pointer.x=(e.clientX-r.left)/r.width-.5;pointer.y=(e.clientY-r.top)/r.height-.5;});
  host.addEventListener('pointerleave',()=>{pointer={x:0,y:0};});
  new IntersectionObserver(es=>{visible=es[0].isIntersecting;},{rootMargin:'100px'}).observe(host);
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();}
  function pose(t){
    const stride=Math.sin(t*2),opposite=Math.sin(t*2+Math.PI);
    hip.position.y=2+Math.abs(Math.cos(t*2))*.11;
    hip.rotation.y=Math.sin(t)*.08;torso.rotation.z=Math.sin(t*2)*.045;neck.rotation.y=Math.sin(t*.5)*.2;
    character.rotation.y=mode==='orbit'?t*.3: -.35+Math.sin(t*.35)*.13;
    if(mode==='pose'){
      character.rotation.y=-.35;hip.position.y=1.9+Math.sin(t)*.07;
      leftArm.root.rotation.set(-.2,0,-.9-Math.sin(t)*.2);leftArm.joint.rotation.x=-1.5;
      rightArm.root.rotation.set(-.3,0,1.2+Math.sin(t)*.35);rightArm.joint.rotation.x=-.8;
      leftLeg.root.rotation.x=.25;leftLeg.joint.rotation.x=.4;
      rightLeg.root.rotation.x=-.25;rightLeg.joint.rotation.x=.25;
    }else{
      leftArm.root.rotation.set(opposite*.65,0,-.14);rightArm.root.rotation.set(stride*.65,0,.14);
      leftArm.joint.rotation.x=-.7-Math.max(0,stride)*.5;rightArm.joint.rotation.x=-.7-Math.max(0,opposite)*.5;
      leftLeg.root.rotation.x=stride*.7;rightLeg.root.rotation.x=opposite*.7;
      leftLeg.joint.rotation.x=.2+Math.max(0,-stride)*1.05;rightLeg.joint.rotation.x=.2+Math.max(0,-opposite)*1.05;
    }
    satellites.rotation.y=t*.08;ghosts.forEach((g,i)=>{g.rotation.z=t*.14+i*.12;g.scale.setScalar(1+Math.sin(t+i)*.06);});
    points.rotation.y=t*.009;waist.rotation.z=t*.1;
  }
  function render(){
    pose(time);
    const aspect=camera.aspect;
    const dist=aspect<.9?18:aspect<1.6?14:11.7;
    camera.position.set(4+pointer.x*1.1,4.1-pointer.y*.6,dist);
    camera.lookAt(0,1.95,0);renderer.render(scene,camera);
    const frame=Math.floor((time%(Math.PI*2))/(Math.PI*2)*120)+1;
    scrub.value=String(frame-1);output.value=String(frame).padStart(3,'0');
    canvas.dataset.frame=String(frame);
  }
  let frameId;
  function frame(now){const dt=Math.min((now-last)/1000,.04);last=now;if(visible&&!document.hidden&&!paused){time+=dt;render();}frameId=requestAnimationFrame(frame);}
  new ResizeObserver(resize).observe(host);
  resize();host.classList.add('scene-ready');host.dataset.engine='three-webgl';
  frameId=requestAnimationFrame(frame);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frameId);host.classList.remove('scene-ready');host.classList.add('scene-unavailable');});
}
