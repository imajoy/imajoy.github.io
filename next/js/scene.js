import * as THREE from './vendor/three.module.min.js';
/* Hero stage: a clay animator character, floating tool tiles, soft light.
   The character's arm is solved with two-bone IK, so it really reaches
   for the Ajoy tile that follows your cursor. */
(function () {
  'use strict';
  var canvas = document.getElementById('stage');
  if (!canvas) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { canvas.style.display = 'none'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 600 ? 1.25 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);

  /* ---------- light ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c2e6, 0.95));
  var sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(4, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(window.innerWidth < 600 ? 512 : 1024, window.innerWidth < 600 ? 512 : 1024);
  var sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 30;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  var fill = new THREE.PointLight(0x9fc0ff, 0.5, 40); fill.position.set(-7, 4, 6); scene.add(fill);

  function mat(c, r, m) { return new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.55 : r, metalness: m || 0.04 }); }
  function shadowed(o) { o.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); return o; }

  /* ---------- floor + platform ---------- */
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  var stage = new THREE.Group(); scene.add(stage);
  var plat = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.45, 0.36, 72), mat(0xffffff, 0.4));
  plat.position.y = 0.18; shadowed(plat); stage.add(plat);
  var ring = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.035, 8, 120), mat(0x3d8bff, 0.4));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.37; stage.add(ring);
  var step1 = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.3, 40), mat(0x48d1c9, 0.45));
  step1.position.set(-2.1, 0.5, 0.4); shadowed(step1); stage.add(step1);
  var step2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.3, 40), mat(0x3d8bff, 0.45));
  step2.position.set(-2.1, 0.8, 0.4); shadowed(step2); stage.add(step2);

  /* ---------- character ---------- */
  var SKIN = 0xf0c8ac, SHIRT = 0x3d8bff, PANTS = 0x232b45, SHOE = 0xffffff, HAIR = 0x232b45, CORAL = 0xff7a5c;
  function capsule(r, len, m) {
    var g = new THREE.Group();
    var c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 22), m);
    var a = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), m);
    var b = a.clone();
    a.position.y = len / 2; b.position.y = -len / 2;
    g.add(c, a, b);
    return g;
  }

  var hero = new THREE.Group();
  hero.position.set(0, 0.36, 0.2);
  stage.add(hero);

  var mSkin = mat(SKIN, 0.6), mShirt = mat(SHIRT, 0.5), mPants = mat(PANTS, 0.6), mShoe = mat(SHOE, 0.45), mHair = mat(HAIR, 0.7);

  /* legs */
  function leg(x) {
    var g = new THREE.Group(); g.position.set(x, 1.25, 0);
    var th = capsule(0.15, 0.55, mPants); th.position.y = -0.34; g.add(th);
    var knee = new THREE.Group(); knee.position.y = -0.7; g.add(knee);
    var sh = capsule(0.13, 0.5, mPants); sh.position.y = -0.3; knee.add(sh);
    var foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), mShoe);
    foot.scale.set(0.95, 0.6, 1.5); foot.position.set(0, -0.68, 0.1); knee.add(foot);
    return { g: g, knee: knee };
  }
  var legL = leg(-0.2), legR = leg(0.2);
  hero.add(legL.g, legR.g);
  hero.position.y += 0.0;

  /* torso */
  var torso = new THREE.Group(); torso.position.y = 1.3; hero.add(torso);
  var body = capsule(0.42, 0.55, mShirt); body.position.y = 0.42; body.scale.z = 0.78; torso.add(body);
  var pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), mPants); pelvis.scale.set(1, 0.7, 0.8); pelvis.position.y = 0.0; torso.add(pelvis);
  /* little keyframe badge on the chest */
  var badge = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  badge.position.set(0.17, 0.62, 0.34); torso.add(badge);

  /* head */
  var neck = new THREE.Group(); neck.position.y = 1.18; torso.add(neck);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 36, 28), mSkin); head.position.y = 0.3; neck.add(head);
  var hair = new THREE.Mesh(new THREE.SphereGeometry(0.415, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.52), mHair);
  hair.position.y = 0.31; hair.rotation.x = -0.25; neck.add(hair);
  var band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.035, 10, 48, Math.PI), mat(0x232b45, 0.5));
  band.position.y = 0.3; band.rotation.z = 0; neck.add(band);
  var cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 24), mat(CORAL, 0.45)); cupL.rotation.z = Math.PI / 2; cupL.position.set(-0.44, 0.3, 0); neck.add(cupL);
  var cupR = cupL.clone(); cupR.position.x = 0.44; neck.add(cupR);
  var eyes = new THREE.Group(); eyes.position.set(0, 0.34, 0.34); neck.add(eyes);
  var eyeM = new THREE.MeshBasicMaterial({ color: 0x151a2c });
  var eL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), eyeM); eL.scale.set(1, 1.35, 0.6); eL.position.x = -0.14;
  var eR = eL.clone(); eR.position.x = 0.14;
  eyes.add(eL, eR);
  var smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 20, Math.PI), eyeM);
  smile.rotation.z = Math.PI; smile.position.set(0, -0.05, 0.015); eyes.add(smile);

  /* arms with joints (hang along -Y) */
  var L1 = 0.55, L2 = 0.5;
  function arm(side) {
    var sh = new THREE.Group(); sh.position.set(side * 0.5, 0.88, 0); torso.add(sh);
    var joint = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), mShirt); sh.add(joint);
    var up = capsule(0.12, L1 - 0.12, mShirt); up.position.y = -L1 / 2; sh.add(up);
    var el = new THREE.Group(); el.position.y = -L1; sh.add(el);
    var ej = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 12), mSkin); el.add(ej);
    var fo = capsule(0.1, L2 - 0.1, mSkin); fo.position.y = -L2 / 2; el.add(fo);
    var hand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), mSkin); hand.position.y = -L2 - 0.05; el.add(hand);
    return { sh: sh, el: el, hand: hand };
  }
  var armR = arm(1), armL = arm(-1);
  shadowed(hero);

  /* two-bone IK in the shoulder's parent frame */
  var UP = new THREE.Vector3(0, -1, 0);
  var tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3(), qS = new THREE.Quaternion();
  function solveArm(a, targetWorld, pole) {
    var par = a.sh.parent; par.updateWorldMatrix(true, false);
    var t = par.worldToLocal(tmpA.copy(targetWorld)).sub(a.sh.position);
    var d = t.length() || 1e-4;
    var dc = Math.min(L1 + L2 - 0.002, Math.max(Math.abs(L1 - L2) + 0.002, d));
    var dir = tmpB.copy(t).divideScalar(d);
    var cosA = (L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc);
    var A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    var axis = tmpC.crossVectors(dir, pole).normalize();
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    var u1 = dir.clone().applyAxisAngle(axis, A), u2 = dir.clone().applyAxisAngle(axis, -A);
    var u = u1.dot(pole) > u2.dot(pole) ? u1 : u2;
    qS.setFromUnitVectors(UP, u);
    a.sh.quaternion.copy(qS);
    var f = tmpD.copy(dir).multiplyScalar(dc).sub(u.clone().multiplyScalar(L1)).normalize();
    f.applyQuaternion(qS.clone().invert());
    a.el.quaternion.setFromUnitVectors(UP, f);
  }

  /* ---------- floating tiles ---------- */
  function rrShape(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function roundedBox(w, h, d, r, m) {
    var g = new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 5, curveSegments: 12 });
    g.translate(0, 0, -d / 2); g.computeVertexNormals();
    return new THREE.Mesh(g, m);
  }
  function glyph(kind, color) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 15; x.lineCap = 'round'; x.lineJoin = 'round';
    var p = function () { x.beginPath(); };
    if (kind === 'logo') {
      p(); x.moveTo(58, 190); x.bezierCurveTo(120, 190, 136, 66, 198, 66); x.stroke();
      [[58, 190], [198, 66]].forEach(function (k) { p(); x.moveTo(k[0], k[1] - 26); x.lineTo(k[0] + 26, k[1]); x.lineTo(k[0], k[1] + 26); x.lineTo(k[0] - 26, k[1]); x.closePath(); x.fill(); });
    } else if (kind === 'fbx') {
      p(); x.moveTo(128, 50); x.lineTo(128, 150); x.moveTo(86, 112); x.lineTo(128, 154); x.lineTo(170, 112); x.stroke();
      p(); x.moveTo(60, 184); x.lineTo(60, 208); x.lineTo(196, 208); x.lineTo(196, 184); x.stroke();
    } else if (kind === 'abc') {
      p(); x.moveTo(128, 46); x.lineTo(204, 88); x.lineTo(204, 168); x.lineTo(128, 210); x.lineTo(52, 168); x.lineTo(52, 88); x.closePath(); x.stroke();
      p(); x.moveTo(52, 88); x.lineTo(128, 130); x.lineTo(204, 88); x.moveTo(128, 130); x.lineTo(128, 210); x.stroke();
    } else if (kind === 'ik') {
      p(); x.arc(78, 84, 26, 0, 7); x.stroke(); p(); x.arc(178, 176, 26, 0, 7); x.stroke();
      p(); x.moveTo(98, 102); x.bezierCurveTo(150, 120, 110, 150, 158, 160); x.stroke();
    } else if (kind === 'rivet') {
      p(); x.arc(128, 128, 52, 0, 7); x.stroke();
      p(); x.moveTo(128, 44); x.lineTo(128, 212); x.moveTo(44, 128); x.lineTo(212, 128); x.stroke();
      p(); x.arc(128, 128, 14, 0, 7); x.fill();
    } else if (kind === 'udim') {
      [[52, 52], [140, 52], [52, 140], [140, 140]].forEach(function (k) { p(); x.rect(k[0], k[1], 64, 64); x.stroke(); });
    } else if (kind === 'play') {
      p(); x.rect(48, 66, 160, 108, 0); x.stroke(); p(); x.moveTo(114, 94); x.lineTo(158, 120); x.lineTo(114, 146); x.closePath(); x.fill();
      p(); x.moveTo(92, 206); x.lineTo(164, 206); x.stroke();
    } else if (kind === 'keys') {
      p(); x.rect(40, 80, 176, 100, 0); x.stroke();
      [[78, 112], [128, 112], [178, 112]].forEach(function (k) { p(); x.arc(k[0], k[1], 5, 0, 7); x.fill(); });
      p(); x.moveTo(84, 150); x.lineTo(172, 150); x.stroke();
    } else if (kind === 'revert') {
      p(); x.moveTo(96, 80); x.lineTo(56, 120); x.lineTo(96, 160); x.moveTo(56, 120); x.lineTo(150, 120); x.bezierCurveTo(206, 120, 206, 200, 150, 200); x.lineTo(124, 200); x.stroke();
    }
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }

  var tiles = [], lines = [];
  function makeTile(o) {
    var g = new THREE.Group();
    var body = roundedBox(o.s, o.s, 0.22, o.s * 0.26, mat(o.body, 0.32, 0.02));
    g.add(body);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(o.s * 0.66, o.s * 0.66),
      new THREE.MeshBasicMaterial({ map: glyph(o.glyph, o.ink), transparent: true }));
    face.position.z = 0.175; g.add(face);
    shadowed(g);
    g.position.set(o.x, o.y, o.z);
    g.userData = { base: new THREE.Vector3(o.x, o.y, o.z), ph: o.ph || 0, amp: o.amp || 0.12, par: o.par || 0.3 };
    scene.add(g);
    return g;
  }
  var centre = makeTile({ s: 1.35, x: 1.35, y: 3.0, z: 0.9, body: 0x3d8bff, ink: '#ffffff', glyph: 'logo', ph: 0, amp: 0.05 });
  var defs = [
    { s: 1.0, x: -3.9, y: 3.2, z: -0.4, body: 0xffffff, ink: '#3d8bff', glyph: 'fbx', ph: 1.1 },
    { s: 0.9, x: -5.2, y: 1.4, z: 0.4, body: 0xff7a5c, ink: '#ffffff', glyph: 'abc', ph: 2.3 },
    { s: 0.95, x: -2.7, y: 4.6, z: -1.2, body: 0xffffff, ink: '#ff7a5c', glyph: 'ik', ph: 0.6 },
    { s: 1.05, x: 4.4, y: 4.3, z: -0.6, body: 0x48d1c9, ink: '#ffffff', glyph: 'rivet', ph: 3.0 },
    { s: 0.92, x: 4.9, y: 1.8, z: 0.2, body: 0xffffff, ink: '#232b45', glyph: 'udim', ph: 4.1 },
    { s: 0.9, x: 3.0, y: 5.0, z: -1.6, body: 0xffffff, ink: '#3d8bff', glyph: 'play', ph: 5.0 },
    { s: 0.8, x: -4.6, y: 4.9, z: -2.0, body: 0x232b45, ink: '#ffffff', glyph: 'keys', ph: 2.0 },
    { s: 0.8, x: 5.8, y: 3.3, z: -1.8, body: 0xffffff, ink: '#48d1c9', glyph: 'revert', ph: 1.7 }
  ];
  defs.forEach(function (d) {
    var t = makeTile(d);
    tiles.push(t);
    var geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    var ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x8fa2d6, transparent: true, opacity: 0.55 }));
    scene.add(ln);
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshBasicMaterial({ color: 0x3d8bff }));
    scene.add(dot);
    lines.push({ ln: ln, dot: dot, tile: t });
  });

  /* ---------- input + layout ---------- */
  var px = 0, py = 0, spx = 0, spy = 0, visible = true, narrow = false;
  window.addEventListener('pointermove', function (e) {
    px = (e.clientX / window.innerWidth) * 2 - 1;
    py = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var tanH = Math.tan(THREE.MathUtils.degToRad(15));
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    var aspect = w / h;
    camera.aspect = aspect;
    narrow = aspect < 1.1;
    var split = !narrow && w > 980;
    var halfW = narrow ? 3.4 : (split ? 5.2 : 5.6);
    var dist = Math.max(11, halfW / (tanH * aspect * (split ? 0.5 : 1)));
    if (split) camera.setViewOffset(w, h, -w * 0.22, 0, w, h); else camera.clearViewOffset();
    var visH = 2 * dist * tanH;
    var feet = 0.36;
    var centerY = feet + (narrow ? 0.40 : 0.42) * visH;
    camera.position.set(0, centerY + 0.9, dist);
    camera.lookAt(0, centerY, 0);
    camera.updateProjectionMatrix();
    tiles.forEach(function (t, i) { t.visible = !narrow || i < 3; });
    lines.forEach(function (l, i) { l.ln.visible = l.dot.visible = !narrow || i < 3; });
  }
  window.addEventListener('resize', resize);
  resize();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
  }

  /* ---------- frame ---------- */
  var clock = new THREE.Clock(), time = 0;
  var handOffset = new THREE.Vector3(-0.5, -0.62, 0.12), hv = new THREE.Vector3(), sw = new THREE.Vector3();
  var poleR = new THREE.Vector3(0.45, -1, -0.55).normalize();
  var poleL = new THREE.Vector3(-0.45, -1, -0.55).normalize();
  var leftT = new THREE.Vector3();

  function update(dt) {
    time += dt;
    var k = Math.min(1, dt * 5);
    spx += (px - spx) * k; spy += (py - spy) * k;

    /* body language */
    hero.rotation.y = spx * 0.28;
    torso.scale.y = 1 + Math.sin(time * 1.7) * 0.008;
    neck.rotation.y = spx * 0.55;
    neck.rotation.x = spy * 0.28 + Math.sin(time * 1.1) * 0.02;
    eyes.position.x = spx * 0.05; eyes.position.y = 0.34 - spy * 0.025;
    legL.knee.rotation.x = 0.03; legR.knee.rotation.x = 0.03;

    /* the Ajoy tile follows the cursor inside the arm's reach */
    var b = centre.userData.base;
    var tx = b.x + spx * 1.0, ty = b.y - spy * 0.8 + Math.sin(time * 1.2) * 0.07, tz = b.z;
    centre.position.x += (tx - centre.position.x) * Math.min(1, dt * 6);
    centre.position.y += (ty - centre.position.y) * Math.min(1, dt * 6);
    centre.position.z = tz;
    centre.rotation.y = -0.3 + spx * 0.35 + Math.sin(time * 0.9) * 0.05;
    centre.rotation.x = spy * -0.2 + Math.cos(time * 1.1) * 0.03;
    centre.rotation.z = -spx * 0.06;

    /* keep the hand target inside reach, pulling the tile with it */
    hv.copy(centre.position).add(handOffset);
    armR.sh.getWorldPosition(sw);
    var off = hv.clone().sub(sw), maxR = (L1 + L2) * 0.93;
    if (off.length() > maxR) { off.setLength(maxR); hv.copy(sw).add(off); centre.position.copy(hv).sub(handOffset); }
    solveArm(armR, hv, poleR);

    /* left arm rests, with a small idle sway */
    armL.sh.getWorldPosition(sw);
    leftT.set(sw.x - 0.35 + Math.sin(time * 1.3) * 0.03, sw.y - 0.88, sw.z + 0.22 + Math.cos(time * 1.1) * 0.02);
    solveArm(armL, leftT, poleL);

    /* drifting tiles + connectors */
    tiles.forEach(function (t, i) {
      var u = t.userData;
      t.position.x = u.base.x + Math.sin(time * 0.6 + u.ph) * 0.12 - spx * u.par * 0.5;
      t.position.y = u.base.y + Math.sin(time * 0.9 + u.ph) * u.amp - spy * u.par * 0.3;
      t.rotation.y = Math.sin(time * 0.5 + u.ph) * 0.3 + spx * 0.3;
      t.rotation.x = Math.cos(time * 0.7 + u.ph) * 0.1 - spy * 0.15;
      var l = lines[i], pos = l.ln.geometry.attributes.position;
      pos.setXYZ(0, centre.position.x, centre.position.y, centre.position.z - 0.15);
      pos.setXYZ(1, t.position.x, t.position.y, t.position.z - 0.15);
      pos.needsUpdate = true;
      l.dot.position.copy(t.position); l.dot.position.z -= 0.15;
    });
  }

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());
    if (!visible || document.hidden || document.documentElement.hasAttribute('data-ui-paused') || (reduce && !document.documentElement.hasAttribute('data-ui-motion'))) return;
    update(dt);
    renderer.render(scene, camera);
  }
  update(0.016); renderer.render(scene, camera);
  frame();
})();
