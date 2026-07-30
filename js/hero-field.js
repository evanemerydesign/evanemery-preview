/* Evan Emery — hero particle field.
   Self-initializing three.js curl-noise flock: particles grow toward the baked
   head point-cloud, then KEEP SWARMING around it (they never fully stick).
   Live-tweakable via window.EE_HERO_CFG (set by the DC from its Tweaks props):
     count  — number of particles
     tail   — trail length (segments per particle)
     curl   — swarm/curl-noise strength once formed (0 = stick)
     spring — pull toward the head
     speed  — simulation time scale
     size   — point size
     sway   — group rotation amount
   Count/tail changes rebuild the buffers on the fly. */

/* Resolve sibling assets against this file's own URL: the document that loads
   it lives at the site root, but the scripts live in js/. */
var EE_HERO_BASE = (function () {
  var cs = document.currentScript && document.currentScript.src;
  return cs ? cs.replace(/[^/]*$/, "") : "";
})();
(function () {
  var CANVAS_ID = "ee-hero-canvas";

  // Reveal fallback: if the component's IntersectionObserver reveal stalls or
  // throws, never leave sections hidden. Re-runs periodically after load.
  [1500, 3000, 6000, 10000].forEach(function (ms) {
    setTimeout(function () {
      document.querySelectorAll("[data-reveal]").forEach(function (el) {
        if (getComputedStyle(el).opacity === "0") { el.style.opacity = "1"; el.style.transform = "none"; }
      });
    }, ms);
  });
  var raf = null, ro = null, inited = false;

  var DEF = { count: 1700, tail: 46, curl: 1.0, spring: 1.0, speed: 1.0, size: 0.06, orbit: 1.0 };
  function cfg() {
    var c = window.EE_HERO_CFG || {};
    return {
      count: Math.max(100, Math.min(window.innerWidth < 700 ? 1100 : 4000, c.count != null ? c.count : DEF.count)),
      tail: Math.max(2, Math.min(400, c.tail != null ? c.tail : DEF.tail)),
      curl: c.curl != null ? c.curl : DEF.curl,
      spring: c.spring != null ? c.spring : DEF.spring,
      speed: c.speed != null ? c.speed : DEF.speed,
      size: c.size != null ? c.size : DEF.size,
      orbit: c.orbit != null ? c.orbit : DEF.orbit,
      stage: c.stage != null ? !!c.stage : false,
      stageShadow: c.stageShadow != null ? c.stageShadow : 0.55,
      stageReflect: c.stageReflect != null ? c.stageReflect : 0.45,
      stageRough: c.stageRough != null ? c.stageRough : 0.65,
      stageWall: c.stageWall != null ? !!c.stageWall : false,
      stageColor: c.stageColor || "#efece4",
      stageTex: c.stageTex || "none",
      stageTexAmt: c.stageTexAmt != null ? c.stageTexAmt : 0.5,
      head: c.head != null ? !!c.head : true,
      headOpacity: c.headOpacity != null ? c.headOpacity : 1.0,
      link: c.link != null ? c.link : 0.16,
      textSize: c.textSize != null ? c.textSize : 0.8,
      escape: c.escape != null ? c.escape : 0.6,
      burst: c.burst != null ? c.burst : 1.0,
      range: c.range != null ? c.range : 1.0,
      cycle: c.cycle != null ? c.cycle : 0,
      cycleFloor: c.cycleFloor != null ? c.cycleFloor : 0.35,
      introRamp: c.introRamp != null ? c.introRamp : 4.5,
      introDrift: c.introDrift != null ? c.introDrift : 10,
      headColor: c.headColor || "#ffffff",
      inkColor: c.inkColor || "#161616",
      cycleRatio: c.cycleRatio != null ? c.cycleRatio : 0.5,
      headShade: c.headShade != null ? c.headShade : 0.35,
      headTex: c.headTex || null,
      headTexScale: c.headTexScale != null ? c.headTexScale : 0.5,
      fov: Math.max(20, Math.min(90, c.fov != null ? c.fov : 42)),
      restYaw: c.restYaw != null ? c.restYaw : -0.65,
      restPitch: c.restPitch != null ? c.restPitch : -0.05,
      blur: Math.max(0, Math.min(0.92, c.blur != null ? c.blur : 0)),
      smooth: Math.max(0, Math.min(1, c.smooth != null ? c.smooth : 0)),
      wireColor: c.wireColor || "#161616",
      wire: !!c.wire,
      headStyle: c.headStyle === "silhouette" ? "silhouette" : "shaded",
      mouse: c.mouse != null ? c.mouse : 1.0,
      wireOpacity: c.wireOpacity != null ? c.wireOpacity : 0.16,
      shade: c.shade != null ? c.shade : 0.12,
    };
  }

  function start() {
    var canvas = document.getElementById(CANVAS_ID);
    var THREE = window.THREE;
    var PTS = window.EE_HEAD_POINTS;
    if (!canvas || !THREE || !PTS) { setTimeout(start, 80); return; }
    if (canvas.getBoundingClientRect().width < 50) { setTimeout(start, 120); return; }
    if (inited && canvas.__eeHero) return;
    inited = true;
    canvas.__eeHero = true;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // the reveal observer can miss this late-mounting tile — force its fade-in wrapper visible
    (function revealAncestors() {
      var n = canvas;
      while (n && n.tagName !== "BODY") {
        if (n.hasAttribute && n.hasAttribute("data-reveal")) { n.style.opacity = "1"; n.style.transform = "none"; }
        n = n.parentElement;
      }
    })();

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    var scene = new THREE.Scene();
    var group = new THREE.Group();
    scene.add(group);
    var headGroup = new THREE.Group(); // head rotates rigidly; the swarm follows with lag
    scene.add(headGroup);
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    // fill-framing: distance chosen so the head (~1.05 half-height, ~0.85 half-width)
    // fills the frame in its limiting dimension, at any aspect ratio
    var CAM_D = 4.6;
    function fitCamera() {
      var halfFovY = (camera.fov * Math.PI / 180) / 2;
      // wide panels: trails swing further past the silhouette — generous, aspect-scaled room
      var margin = camera.aspect > 1 ? 1.24 + 0.34 * Math.min(1, (camera.aspect - 1) / 0.7) : 1.22;
      var dY = (1.05 * margin) / Math.tan(halfFovY);                       // fit by height
      var dX = (0.85 * margin) / (Math.tan(halfFovY) * camera.aspect);     // fit by width
      CAM_D = Math.max(2.6, Math.min(7.5, Math.max(dX, dY)));
    }
    camera.position.set(0, 0, CAM_D);
    camera.lookAt(0, 0, 0);
    var ink = new THREE.Color(0x161616);
    // motion blur: instead of clearing, a fullscreen quad multiplies the previous
    // frame's color+alpha toward transparent (dst *= 1-srcAlpha) — GPU afterimage
    var fadeScene = new THREE.Scene();
    var fadeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var fadeMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uFade: { value: 0.3 } },
      vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: "uniform float uFade; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, uFade); }"
    });
    fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat));

    // ---- curved cyc backdrop + soft contact shadow + rough-floor reflection ----
    var FLOOR = -1.18; // floor meets the swarm's lower bound — the head sits ON the stage, not above it
    var stg = null; // { wall, floor, shadow, wrap, inner, mPts, mTails, mHead }
    // shared procedural surface texturing: uMode 0=none 1=paper grain 2=drafting grid
    var STG_TEX_GLSL =
      "float stgHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n" +
      "float stgTex(vec2 p, float mode, float amt){\n" +
      "  if (mode < 0.5 || amt <= 0.001) return 1.0;\n" +
      "  if (mode < 1.5) { float n = stgHash(floor(p * 160.0)); return 1.0 - amt * 0.10 * n; }\n" +
      "  if (mode < 2.5) { vec2 g = abs(fract(p / 0.35) - 0.5);\n" +
      "    float line = 1.0 - smoothstep(0.0, 0.045, min(g.x, g.y));\n" +
      "    return 1.0 - amt * 0.16 * line; }\n" +
      "  vec2 gm = abs(fract(p / 0.35) - 0.5);\n" +
      "  float minor = 1.0 - smoothstep(0.0, 0.05, min(gm.x, gm.y));\n" +
      "  vec2 gM = abs(fract(p / 1.75) - 0.5);\n" +
      "  float major = 1.0 - smoothstep(0.0, 0.016, min(gM.x, gM.y));\n" +
      "  vec2 gd = abs(fract(vec2(p.x + p.y, p.x - p.y) / 3.5) - 0.5);\n" +
      "  float diag = 1.0 - smoothstep(0.0, 0.006, min(gd.x, gd.y));\n" +
      "  float line2 = max(max(minor * 0.5, major), diag * 0.35);\n" +
      "  return 1.0 - amt * 0.22 * line2;\n" +
      "}\n";
    function buildStage() {
      var wallCol = new THREE.Color(0xefece4);
      // optional cyc wall (off by default — "Backdrop wall" tweak)
      var wallMat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide, depthWrite: true,
        uniforms: { uCol: { value: wallCol }, uFloor: { value: FLOOR }, uMode: { value: 0 }, uAmt: { value: 0.5 }, uHS: { value: 0.3 } },
        vertexShader: "varying vec3 vWp; void main(){ vWp = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: STG_TEX_GLSL + "uniform vec3 uCol; uniform float uFloor; uniform float uMode; uniform float uAmt; uniform float uHS; varying vec3 vWp; void main(){ float h = clamp((vWp.y - uFloor) / 9.0, 0.0, 1.0); vec3 col = uCol * (1.0 - 0.10 * h); col *= stgTex(vec2(vWp.x + vWp.z, vWp.y), uMode, uAmt); float d = length(vWp - vec3(0.0, 0.2, -26.0)); col *= 1.0 - uHS * (1.0 - smoothstep(5.0, 20.0, d)); gl_FragColor = vec4(col, 1.0); }"
      });
      var wall = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 40, 96, 1, true), wallMat);
      wall.position.y = FLOOR + 20; wall.renderOrder = -30; wall.frustumCulled = false; wall.visible = false;
      scene.add(wall);
      // mirrored swarm below the floor line (shared geometry — zero extra sim cost)
      var wrap = new THREE.Group();
      wrap.scale.y = -1; wrap.position.y = 2 * FLOOR;
      var inner = new THREE.Group();
      wrap.add(inner); scene.add(wrap);
      var mpMat = new THREE.PointsMaterial({ color: ink, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.3, depthWrite: false });
      var mtMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uColor: { value: ink }, uOp: { value: 0.3 } },
        vertexShader: "attribute float aAlpha; varying float vA; void main(){ vA=aAlpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
        fragmentShader: "uniform vec3 uColor; uniform float uOp; varying float vA; void main(){ float a = vA * uOp; if(a<=0.002) discard; gl_FragColor=vec4(uColor,a);} "
      });
      // translucent floor over the mirror = high-roughness \"blurred\" reflection.
      // Effectively infinite: reaches the cyc wall in every direction.
      var floorMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uCol: { value: wallCol }, uOp: { value: 0.75 }, uMode: { value: 0 }, uAmt: { value: 0.5 } },
        vertexShader: "varying vec3 vWp; void main(){ vWp = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: STG_TEX_GLSL + "uniform vec3 uCol; uniform float uOp; uniform float uMode; uniform float uAmt; varying vec3 vWp; void main(){ vec3 col = uCol * stgTex(vWp.xz, uMode, uAmt); gl_FragColor = vec4(col, uOp); }"
      });
      var floor = new THREE.Mesh(new THREE.CircleGeometry(26, 96), floorMat);
      floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.renderOrder = -10; floor.frustumCulled = false;
      scene.add(floor);
      // soft elliptical contact shadow — oversized plane, gradient dies well inside the edge, so no clipping
      var sc = document.createElement("canvas"); sc.width = sc.height = 256;
      var sx = sc.getContext("2d");
      var gr = sx.createRadialGradient(128, 128, 6, 128, 128, 108);
      gr.addColorStop(0, "rgba(20,19,17,0.8)"); gr.addColorStop(0.5, "rgba(20,19,17,0.26)"); gr.addColorStop(0.85, "rgba(20,19,17,0.03)"); gr.addColorStop(1, "rgba(20,19,17,0)");
      sx.fillStyle = gr; sx.fillRect(0, 0, 256, 256);
      var sTex = new THREE.CanvasTexture(sc);
      var shMat = new THREE.MeshBasicMaterial({ map: sTex, transparent: true, opacity: 0.55, depthWrite: false });
      var shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.0), shMat);
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = FLOOR + 0.02; shadow.renderOrder = -9; shadow.frustumCulled = false;
      scene.add(shadow);
      stg = { wall: wall, wallMat: wallMat, floor: floor, floorMat: floorMat, shadow: shadow, shMat: shMat, wrap: wrap, inner: inner, mpMat: mpMat, mtMat: mtMat, mPts: null, mTails: null, mHead: null, mHeadMat: null };
    }
    function stageSync(C) {
      if (!C.stage) { if (stg) { stg.wall.visible = stg.floor.visible = stg.shadow.visible = stg.wrap.visible = false; } return; }
      if (!stg) buildStage();
      stg.floor.visible = true;
      stg.wall.visible = !!C.stageWall;
      stg.shadow.visible = C.stageShadow > 0.01;
      stg.shMat.opacity = C.stageShadow;
      stg.floorMat.uniforms.uCol.value.set(C.stageColor);
      var texMode = C.stageTex === "grain" ? 1 : (C.stageTex === "grid" ? 2 : (C.stageTex === "mat" ? 3 : 0));
      stg.floorMat.uniforms.uMode.value = texMode;
      stg.floorMat.uniforms.uAmt.value = C.stageTexAmt;
      if (stg.wall.visible) {
        stg.wallMat.uniforms.uCol.value.set(C.stageColor);
        stg.wallMat.uniforms.uMode.value = texMode;
        stg.wallMat.uniforms.uAmt.value = C.stageTexAmt;
        stg.wallMat.uniforms.uHS.value = 0.55 * C.stageShadow;
      }
      var refl = C.stageReflect;
      stg.wrap.visible = refl > 0.01;
      // rougher floor = milkier overlay + dimmer mirror
      stg.floorMat.uniforms.uOp.value = 0.45 + 0.5 * C.stageRough;
      if (stg.wrap.visible) {
        if (pGeo && (!stg.mPts || stg.mPts.geometry !== pGeo)) {
          if (stg.mPts) { stg.inner.remove(stg.mPts); stg.inner.remove(stg.mTails); }
          stg.mPts = new THREE.Points(pGeo, stg.mpMat); stg.mPts.frustumCulled = false; stg.mPts.renderOrder = -20;
          stg.mTails = new THREE.LineSegments(tGeo, stg.mtMat); stg.mTails.frustumCulled = false; stg.mTails.renderOrder = -20;
          stg.inner.add(stg.mPts); stg.inner.add(stg.mTails);
        }
        if (headMesh && !stg.mHead) {
          stg.mHeadMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
          stg.mHead = new THREE.Mesh(headMesh.geometry, stg.mHeadMat);
          stg.mHead.frustumCulled = false; stg.mHead.renderOrder = -21;
          stg.inner.add(stg.mHead);
        }
        var mo = 0.35 * refl;
        stg.mpMat.opacity = 0.85 * mo;
        stg.mtMat.uniforms.uOp.value = mo;
        stg.mpMat.size = cfg().size;
        stg.mpMat.color.copy(ink); stg.mtMat.uniforms.uColor.value.copy(ink);
        if (stg.mHead) {
          stg.mHead.visible = headMesh && headMesh.visible;
          stg.mHeadMat.color.set(cfg().headColor);
          stg.mHeadMat.opacity = (cfg().headOpacity || 1) * mo;
        }
        // mirror follows the live group/head transforms
        stg.inner.rotation.copy(group.rotation);
        if (headMesh && stg.mHead) {
          stg.mHead.position.copy(headGroup.position);
          stg.mHead.rotation.copy(headGroup.rotation);
          stg.mHead.scale.copy(headGroup.scale);
        }
      }
    }

    // buffers (rebuilt when count/tail tweaks change)
    var N = 0, TAIL = 0;
    var pos, vel, tgt, ph, trad, trail, pGeo, pMat, points, segPos, segA, tGeo, tMat, tails;
    var curlC, curlS = [0, 0, 0], fcv = 0; // per-particle curl cache — recomputed on alternate frames
    // boid flocks: particles belong to one of FLOCKS groups that periodically
    // burst off the surface, flock (cohesion + alignment + curl), then return
    var FLOCKS = 20, flk; // many small flocks — groups break off in little squads
    var fState = new Uint8Array(FLOCKS);      // 0 = on head, 1 = airborne
    var fEnd = new Float32Array(FLOCKS);      // sim-time when the burst ends
    var fStart = new Float32Array(FLOCKS);    // sim-time when the burst launched
    var fEsc = new Uint8Array(FLOCKS);        // escaper flocks fly straight out of frame
    var fDirX = new Float32Array(FLOCKS), fDirY = new Float32Array(FLOCKS), fDirZ = new Float32Array(FLOCKS);
    var fLand = new Float32Array(FLOCKS);     // when the flock was told to come home (spring ramps in)
    var wpX = new Float32Array(FLOCKS), wpY = new Float32Array(FLOCKS), wpZ = new Float32Array(FLOCKS); // roaming waypoints
    var cenX = new Float32Array(FLOCKS), cenY = new Float32Array(FLOCKS), cenZ = new Float32Array(FLOCKS);
    var avX = new Float32Array(FLOCKS), avY = new Float32Array(FLOCKS), avZ = new Float32Array(FLOCKS);
    var accX = new Float32Array(FLOCKS), accY = new Float32Array(FLOCKS), accZ = new Float32Array(FLOCKS);
    var accVX = new Float32Array(FLOCKS), accVY = new Float32Array(FLOCKS), accVZ = new Float32Array(FLOCKS);
    var fCnt = new Float32Array(FLOCKS);
    var nextBurst = 1.8, lastLaunch = -10;
    var node, hdg, amb; // per-particle node/heading + ambient background flag
    // surface flow graph: k-nearest neighbors per baked point; particles WALK the
    // graph (target hops node→node along the curl flow) so they visibly stream
    // across the head instead of being pinned to one spot
    var KNB = 6, NBR = null, occ = null;
    function buildGraph() {
      var P = PTS.length;
      NBR = new Uint32Array(P * KNB);
      occ = new Float32Array(P);
      var bd = new Float64Array(KNB), bi = new Int32Array(KNB);
      for (var a = 0; a < P; a++) {
        for (var q = 0; q < KNB; q++) { bd[q] = 1e18; bi[q] = a; }
        var A = PTS[a];
        for (var b = 0; b < P; b++) {
          if (b === a) continue;
          var B = PTS[b];
          var dx = B[0]-A[0], dy = B[1]-A[1], dz = B[2]-A[2];
          var d2 = dx*dx + dy*dy + dz*dz;
          if (d2 < bd[KNB-1]) {
            var ins = KNB - 1;
            while (ins > 0 && bd[ins-1] > d2) { bd[ins] = bd[ins-1]; bi[ins] = bi[ins-1]; ins--; }
            bd[ins] = d2; bi[ins] = b;
          }
        }
        for (var w0 = 0; w0 < KNB; w0++) NBR[a*KNB + w0] = bi[w0];
      }
    }
    buildGraph();

    function build(n, tailLen) {
      N = n; TAIL = tailLen;
      if (points) { group.remove(points); pGeo.dispose(); }
      if (tails) { group.remove(tails); tGeo.dispose(); }
      pos = new Float32Array(N * 3);
      vel = new Float32Array(N * 3);
      curlC = new Float32Array(N * 3);
      tgt = new Float32Array(N * 3);
      ph = new Float32Array(N);
      trad = new Float32Array(N);
      trail = new Float32Array(N * TAIL * 3);
      flk = new Uint8Array(N);
      amb = new Uint8Array(N);
      node = new Uint32Array(N);
      hdg = new Float32Array(N * 3); // persistent heading — keeps walks sweeping instead of looping
      for (var h0 = 0; h0 < N; h0++) {
        var ha = Math.random() * Math.PI * 2, hb = Math.acos(2 * Math.random() - 1);
        hdg[h0*3] = Math.sin(hb) * Math.cos(ha); hdg[h0*3+1] = Math.sin(hb) * Math.sin(ha); hdg[h0*3+2] = Math.cos(hb);
      }
      var perm = [];
      for (var q0 = 0; q0 < PTS.length; q0++) perm.push(q0);
      for (var q1 = perm.length - 1; q1 > 0; q1--) { var q2 = (Math.random() * (q1 + 1)) | 0; var q3 = perm[q1]; perm[q1] = perm[q2]; perm[q2] = q3; }
      for (var i = 0; i < N; i++) {
        var pi = perm[i % PTS.length];
        node[i] = pi;
        if (occ) occ[pi]++;
        var p = PTS[pi];
        amb[i] = (i % 7 === 6) ? 1 : 0; // ~14% live as faint background drifters
        var j = (i / PTS.length) | 0; // extra layers get a small offset so duplicates don't overlap
        tgt[i*3] = p[0] + (j ? (Math.random()-0.5)*0.05 : 0);
        tgt[i*3+1] = p[1] + (j ? (Math.random()-0.5)*0.05 : 0);
        tgt[i*3+2] = p[2] + (j ? (Math.random()-0.5)*0.05 : 0);
        trad[i] = Math.sqrt(tgt[i*3]*tgt[i*3] + tgt[i*3+1]*tgt[i*3+1] + tgt[i*3+2]*tgt[i*3+2]);
        ph[i] = Math.random() * Math.PI * 2;
        if (amb[i]) flk[i] = 255;
        // spawn ON the surface — the swarm reads as growth on the head, never arrival from outside
        pos[i*3] = tgt[i*3] + (Math.random()-0.5) * 0.02;
        pos[i*3+1] = tgt[i*3+1] + (Math.random()-0.5) * 0.02;
        pos[i*3+2] = tgt[i*3+2] + (Math.random()-0.5) * 0.02;
        for (var k = 0; k < TAIL; k++) { trail[(i*TAIL+k)*3]=pos[i*3]; trail[(i*TAIL+k)*3+1]=pos[i*3+1]; trail[(i*TAIL+k)*3+2]=pos[i*3+2]; }
      }
      // spatial flocks: seed points on the head; each particle joins its nearest
      // seed so a launching flock is a local patch that leaves together
      var seeds = [];
      for (var s0 = 0; s0 < FLOCKS; s0++) seeds.push(PTS[(Math.random() * PTS.length) | 0]);
      for (var s1 = 0; s1 < N; s1++) {
        if (amb[s1]) continue;
        var bD = 1e9, bF = 0, sx = tgt[s1*3], sy = tgt[s1*3+1], sz = tgt[s1*3+2];
        for (var s2 = 0; s2 < FLOCKS; s2++) {
          var sdx = seeds[s2][0]-sx, sdy = seeds[s2][1]-sy, sdz = seeds[s2][2]-sz;
          var sd = sdx*sdx + sdy*sdy + sdz*sdz;
          if (sd < bD) { bD = sd; bF = s2; }
        }
        flk[s1] = bF;
      }
      pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      pMat = pMat || new THREE.PointsMaterial({ color: ink, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.92, depthWrite: false });
      points = new THREE.Points(pGeo, pMat);
      points.frustumCulled = false;
      group.add(points);
      var segCount = N * (TAIL - 1);
      segPos = new Float32Array(segCount * 2 * 3);
      segA = new Float32Array(segCount * 2);
      tGeo = new THREE.BufferGeometry();
      tGeo.setAttribute("position", new THREE.BufferAttribute(segPos, 3));
      tGeo.setAttribute("aAlpha", new THREE.BufferAttribute(segA, 1));
      tMat = tMat || new THREE.ShaderMaterial({
        transparent: true, depthTest: true, depthWrite: false,
        uniforms: { uColor: { value: ink } },
        vertexShader: "attribute float aAlpha; varying float vA; void main(){ vA=aAlpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
        fragmentShader: "uniform vec3 uColor; varying float vA; void main(){ if(vA<=0.002) discard; gl_FragColor=vec4(uColor,vA);} "
      });
      tails = new THREE.LineSegments(tGeo, tMat);
      tails.frustumCulled = false;
      group.add(tails);
    }
    var c0 = cfg();
    build(c0.count, c0.tail);

    // proximity net: connection lines between grounded particles (abstract mesh)
    var MAXSEG = 24000, netPos = new Float32Array(MAXSEG * 6), netA = new Float32Array(MAXSEG * 2);
    var netGeo = new THREE.BufferGeometry();
    netGeo.setAttribute("position", new THREE.BufferAttribute(netPos, 3));
    netGeo.setAttribute("aAlpha", new THREE.BufferAttribute(netA, 1));
    var netMesh = new THREE.LineSegments(netGeo, tMat);
    netMesh.frustumCulled = false;
    group.add(netMesh);

    // floating mono dim labels (live particle coordinates, drafting-sheet style)
    var LBLN = 6, labels = [], lblTick = -1;
    for (var lj = 0; lj < LBLN; lj++) {
      var cv = document.createElement("canvas"); cv.width = 340; cv.height = 64;
      var lctx = cv.getContext("2d");
      var tex = new THREE.CanvasTexture(cv);
      var sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0.85 });
      var spr = new THREE.Sprite(sm);
      spr.frustumCulled = false;
      group.add(spr);
      labels.push({ cv: cv, ctx: lctx, tex: tex, spr: spr });
    }

    // optional wireframe overlay (baked edges)
    var wireMesh = null, wMat = null;
    function ensureWire() {
      if (!wireMesh && !window.EE_HEAD_WIRE && !ensureWire._req) { // baked edges load on demand (4MB)
        ensureWire._req = 1;
        var ws = document.createElement("script");
        ws.src = EE_HERO_BASE + "head-wire.js";
        document.head.appendChild(ws);
      }
      if (!wireMesh && window.EE_HEAD_WIRE) {
        var wGeo = new THREE.BufferGeometry();
        wGeo.setAttribute("position", new THREE.BufferAttribute(window.EE_HEAD_WIRE, 3));
        wMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.16, depthWrite: false });
        wireMesh = new THREE.LineSegments(wGeo, wMat);
        wireMesh.frustumCulled = false;
        headGroup.add(wireMesh);
      }
    }
    // solid faceted head — always visible, opaque; `shade` tweak sets its darkness
    var headMesh = null, hMat = null, hMatFlat = null, paper = new THREE.Color(0xf6f3ec);
    (function ensureHead() {
      if (!window.EE_HEAD_MESH) { setTimeout(ensureHead, 120); return; }
      var hGeo = new THREE.BufferGeometry();
      hGeo.setAttribute("position", new THREE.BufferAttribute(window.EE_HEAD_MESH, 3));
      hGeo.computeVertexNormals(); // tri soup → flat facet shading
      scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 0.9));
      var dl = new THREE.DirectionalLight(0xffffff, 0.7);
      dl.position.set(2.5, 3, 4);
      scene.add(dl);
      hMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      // silhouette: opaque shader material — soft top-light shading (uShade) so it isn't
      // dead flat, plus an optional object-space projected texture (dazzle pattern etc.)
      var whiteTex = new THREE.DataTexture(new Uint8Array([255,255,255,255]), 1, 1);
      whiteTex.needsUpdate = true;
      hMatFlat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uBase: { value: new THREE.Color(0xffffff) },
          uAlpha: { value: 1 },
          uShade: { value: 0.35 },
          uTex: { value: whiteTex },
          uTexAmt: { value: 0 },
          uTexScale: { value: 0.5 }
        },
        vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 uBase; uniform float uAlpha; uniform float uShade; uniform sampler2D uTex; uniform float uTexAmt; uniform float uTexScale; varying vec3 vN; varying vec3 vP; void main(){ vec3 n = normalize(vN); float li = clamp(dot(n, normalize(vec3(0.35, 0.75, 0.55))), 0.0, 1.0); float sh = mix(1.0, 0.6 + 0.4 * li, uShade); vec2 uv = vP.xy * uTexScale + 0.5; vec3 t = texture2D(uTex, uv).rgb; vec3 col = uBase * mix(vec3(1.0), t, uTexAmt) * sh; gl_FragColor = vec4(col, uAlpha); }"
      });
      var headTexUrl = null, texLoader = new THREE.TextureLoader();
      hMatFlat._syncTex = function (url) {
        if (url === headTexUrl) return;
        headTexUrl = url;
        if (!url) { hMatFlat.uniforms.uTex.value = whiteTex; hMatFlat.uniforms.uTexAmt.value = 0; return; }
        texLoader.load(url, function (tx) {
          if (headTexUrl !== url) return;
          tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
          if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
          hMatFlat.uniforms.uTex.value = tx; hMatFlat.uniforms.uTexAmt.value = 1;
        });
      };
      headMesh = new THREE.Mesh(hGeo, hMat);
      headMesh.frustumCulled = false;
      headGroup.add(headMesh);
    })();

    // 3D curl noise from an analytic vector potential
    function Pf(x, y, z, t, c) {
      if (c === 0) return Math.sin(y * 1.3 + z * 0.7 + t) + Math.cos(z * 1.1 - t * 0.8);
      if (c === 1) return Math.sin(z * 1.2 + x * 0.6 + t * 0.9) + Math.cos(x * 1.0 + t);
      return Math.sin(x * 1.1 + y * 0.8 - t) + Math.cos(y * 0.9 + t * 0.7);
    }
    var e = 0.12, curlOut = [0, 0, 0];
    function curl(x, y, z, t) {
      var dZy = (Pf(x, y+e, z, t, 2) - Pf(x, y-e, z, t, 2)) / (2*e);
      var dYz = (Pf(x, y, z+e, t, 1) - Pf(x, y, z-e, t, 1)) / (2*e);
      var dXz = (Pf(x, y, z+e, t, 0) - Pf(x, y, z-e, t, 0)) / (2*e);
      var dZx = (Pf(x+e, y, z, t, 2) - Pf(x-e, y, z, t, 2)) / (2*e);
      var dYx = (Pf(x+e, y, z, t, 1) - Pf(x-e, y, z, t, 1)) / (2*e);
      var dXy = (Pf(x, y+e, z, t, 0) - Pf(x, y-e, z, t, 0)) / (2*e);
      curlOut[0] = dZy - dYz; curlOut[1] = dXz - dZx; curlOut[2] = dYx - dXy;
      return curlOut;
    }

    function resize() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
      renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      fitCamera();
      if (!window.__eeDragging) { camera.position.set(0, 0, CAM_D); camera.lookAt(0, 0, 0); }
    }
    resize();
    [250, 700, 1600].forEach(function (ms) { setTimeout(resize, ms); }); // RO can stall in background tabs
    ro = new ResizeObserver(function () { requestAnimationFrame(resize); });
    ro.observe(canvas);

    // mouse reactivity: unproject the pointer onto the z=0 plane, in world space
    var mouseActive = false, mx = 0, my = 0;
    var rayVec = new THREE.Vector3();
    canvas.addEventListener("pointermove", function (ev) {
      var r = canvas.getBoundingClientRect();
      var nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
      var ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
      rayVec.set(nx, ny, 0.5).unproject(camera);
      rayVec.sub(camera.position).normalize();
      var d = -camera.position.z / rayVec.z;
      mx = camera.position.x + rayVec.x * d;
      my = camera.position.y + rayVec.y * d;
      mouseActive = true;
    });
    canvas.addEventListener("pointerleave", function () { mouseActive = false; });

    // rubber-band orbit: drag rotates the head, release springs it back to front
    var rotY = 0, rotX = 0, rotYV = 0, rotXV = 0, dragging = false, lpx = 0, lpy = 0, lastDragT = -10;
    var dragVX = 0, dragVY = 0; // smoothed pointer velocity while grabbing (px/event) — the bg grid reads it
    canvas.style.cursor = "grab";
    // mobile: horizontal drags orbit (browser keeps vertical pan for page scroll)
    canvas.style.touchAction = "pan-y";
    // A touch drag must only claim the gesture when it is horizontal. Calling
    // preventDefault cancels scrolling whatever touch-action says, so blocking
    // every move left a visitor unable to scroll off the hero — stuck orbiting
    // the head. Decide the axis on the first move, then honour it.
    var tStartX = 0, tStartY = 0, tAxis = 0;   // 0 undecided, 1 orbit, -1 scroll
    canvas.addEventListener("touchstart", function (ev) {
      var t = ev.touches[0]; if (!t) return;
      tStartX = t.clientX; tStartY = t.clientY; tAxis = 0;
    }, { passive: true });
    canvas.addEventListener("touchmove", function (ev) {
      if (!dragging) return;
      var t = ev.touches[0]; if (!t) return;
      if (!tAxis) {
        var dx = Math.abs(t.clientX - tStartX), dy = Math.abs(t.clientY - tStartY);
        if (dx < 6 && dy < 6) return;               // too small to call yet
        tAxis = dx > dy ? 1 : -1;
        if (tAxis === -1) { endDrag(); return; }    // hand the gesture back to the page
      }
      if (tAxis === 1) ev.preventDefault();
    }, { passive: false });

    canvas.addEventListener("pointerdown", function (ev) {
      dragging = true; hideCue(); lpx = ev.clientX; lpy = ev.clientY;
      canvas.style.cursor = "grabbing";
      // Capturing a touch pointer would keep the move events here even after
      // the browser decides the gesture is a scroll.
      if (ev.pointerType !== "touch") {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      }
    });
    canvas.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      if (ev.pointerType === "touch" && tAxis === -1) return;   // the page owns this gesture
      var coarse = ev.pointerType === "touch";
      var sens = (coarse ? 0.008 : 0.0045) * (cfg().orbit || 1); // finger travel is shorter — higher gain so it feels grabbed
      rotYV = (ev.clientX - lpx) * sens;
      rotXV = (ev.clientY - lpy) * sens * 0.6;
      rotY += rotYV; rotX += rotXV;
      rotX = Math.max(-0.55, Math.min(0.55, rotX));
      dragVX = dragVX * 0.6 + (ev.clientX - lpx) * 0.4;
      dragVY = dragVY * 0.6 + (ev.clientY - lpy) * 0.4;
      lpx = ev.clientX; lpy = ev.clientY;
    });
    function hideCue() { var c = document.getElementById("ee-orbit-cue"); if (c) c.setAttribute("data-hide", "1"); }
    function endDrag() { dragging = false; lastDragT = simT; dragVX = dragVY = 0; canvas.style.cursor = "grab"; }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    var t0 = performance.now();
    var wallStart = performance.now(), t3 = null, warming = false, lastInkCol = null, subAcc = 0, netFrame = 0, lastSegN = 0, smBuf = null, lastWireCol = null;
    function step(t, C) {
      var intro = Math.min(1, t / 0.9); // short grow-in — dynamic from page load
      // pointer into group-local space (undo the orbit rotation)
      var rot = group.rotation.y, cosR = Math.cos(-rot), sinR = Math.sin(-rot);
      var lmx = mx * cosR, lmz = -mx * sinR, lmy = my;
      var mR = 1.2, mF = 0.06 * (C.mouse || 0) * intro;
      var crawlAmp = 0.012 * (0.3 + 0.7 * C.curl); // surface crawl speed
      // burst scheduler: flocks launch on their own; the mouse near the head
      // makes bursts much more frequent and pushes them away from the cursor
      var mBoost = mouseActive ? Math.max(1, 3 * (C.mouse || 0)) : 1;
      var airCount = 0;
      for (var fa = 0; fa < FLOCKS; fa++) if (fState[fa]) airCount++;
      var minAir = C.burst > 0.05 ? Math.max(1, Math.round(1.5 * C.burst)) : 0; // leave rate 0 = everyone stays home
      var wantLaunch = t > nextBurst || (airCount < minAir && t > lastLaunch + 0.5);
      // grow cycle: trails breathe from nothing to full length and back (ping-pong,
      // smoothstep-eased); while active every particle stays glued to the surface
      var cycT = C.cycle || 0, growAll = 1, cycOn = cycT > 0.1;
      if (cycOn) {
        var hold = Math.max(0, Math.min(0.45, C.cycleHold != null ? C.cycleHold : 0.18));
        var ratio = Math.max(0.1, Math.min(0.9, C.cycleRatio != null ? C.cycleRatio : 0.5));
        var floorL = Math.max(0, Math.min(0.95, C.cycleFloor != null ? C.cycleFloor : 0.35));
        var R = Math.max(0.5, C.introRamp != null ? C.introRamp : 4.5);
        var D = Math.max(0, C.introDrift != null ? C.introDrift : 10);
        var wallT = (performance.now() - wallStart) / 1000;
        var ss = function (x) { x = Math.max(0, Math.min(1, x)); x = x * x * (3 - 2 * x); return x * x * (3 - 2 * x); };
        if (wallT < R) growAll = ss(wallT / R) * 0.85;            // load: organic ramp to near-full
        else if (wallT < R + D) growAll = 0.85 + 0.15 * ss((wallT - R) / D); // slow drift to full
        else {                                                     // breathe: full -> floor -> full, never empty
          if (t3 == null) t3 = t;
          var growDur = (1 - hold) * ratio, retDur = (1 - hold) * (1 - ratio);
          var cph = ((t - t3) % cycT) / cycT, g;
          if (cph < retDur) g = 1 - cph / retDur;
          else if (cph < retDur + growDur) g = (cph - retDur) / growDur;
          else g = 1;
          growAll = floorL + (1 - floorL) * ss(g);
        }
      }
      if (intro >= 0.9 && wantLaunch && !cycOn) {
        lastLaunch = t;
        nextBurst = t + (1.6 + Math.random() * 2.6) / (mBoost * Math.max(0.05, C.burst));
        var cand = [];
        for (var f0 = 0; f0 < FLOCKS; f0++) if (!fState[f0]) cand.push(f0);
        if (cand.length) {
          var fl = cand[(Math.random() * cand.length) | 0];
          if (mouseActive) { // prefer the grounded flock nearest the cursor
            var bestD = 1e9;
            for (var f2 = 0; f2 < cand.length; f2++) {
              var cfl = cand[f2];
              var ddx = cenX[cfl]-lmx, ddy = cenY[cfl]-lmy, ddz = cenZ[cfl]-lmz;
              var dd = ddx*ddx + ddy*ddy + ddz*ddz;
              if (dd < bestD) { bestD = dd; fl = cfl; }
            }
          }
          fState[fl] = 1; fStart[fl] = t;
          fEsc[fl] = Math.random() < C.escape ? 1 : 0; // slider: how many groups draw lines out of frame
          fEnd[fl] = t + (fEsc[fl] ? 14 : 2.2 + Math.random() * 2.2);
          // re-form the flock as a coherent local patch around a seed particle
          var seedI = -1;
          if (mouseActive) { // seed = grounded particle nearest the cursor
            var sBest = 1e9;
            for (var q0 = 0; q0 < N; q0++) {
              if (amb[q0] || fState[flk[q0]]) continue;
              var qx = pos[q0*3]-lmx, qy = pos[q0*3+1]-lmy, qz = pos[q0*3+2]-lmz;
              var qd = qx*qx + qy*qy + qz*qz;
              if (qd < sBest) { sBest = qd; seedI = q0; }
            }
          } else {
            var tries = 0;
            do { seedI = (Math.random() * N) | 0; } while (fState[flk[seedI]] && ++tries < 40);
          }
          if (seedI >= 0) {
            var sx0 = pos[seedI*3], sy0 = pos[seedI*3+1], sz0 = pos[seedI*3+2], patchR2 = 0.34 * 0.34; // small squads
            var others = cand.filter(function (cf) { return cf !== fl; });
            for (var q1 = 0; q1 < N; q1++) {
              if (amb[q1]) continue;
              if (fState[flk[q1]] && flk[q1] !== fl) continue;
              var wx = pos[q1*3]-sx0, wy = pos[q1*3+1]-sy0, wz = pos[q1*3+2]-sz0;
              var inPatch = (wx*wx + wy*wy + wz*wz) < patchR2;
              if (inPatch) flk[q1] = fl;
              else if (flk[q1] === fl && others.length) flk[q1] = others[(Math.random() * others.length) | 0];
            }
          }
          var la = Math.random() * Math.PI * 2, lb = Math.acos(2 * Math.random() - 1);
          var ldx = Math.sin(lb) * Math.cos(la), ldy = Math.sin(lb) * Math.sin(la), ldz = Math.cos(lb);
          if (seedI >= 0) { // launch outward through the patch — not a random stray
            var opl = Math.sqrt(pos[seedI*3]*pos[seedI*3] + pos[seedI*3+1]*pos[seedI*3+1] + pos[seedI*3+2]*pos[seedI*3+2]) || 1e-6;
            ldx = pos[seedI*3]/opl; ldy = pos[seedI*3+1]/opl; ldz = pos[seedI*3+2]/opl;
          }
          if (mouseActive) { // launch away from the cursor
            var ax = cenX[fl]-lmx, ay = cenY[fl]-lmy, az = cenZ[fl]-lmz;
            var al = Math.sqrt(ax*ax + ay*ay + az*az) || 1e-6;
            ldx = ax/al; ldy = ay/al; ldz = az/al;
          }
          fDirX[fl] = ldx; fDirY[fl] = ldy; fDirZ[fl] = ldz; // no impulse — an eased launch force ramps them off the head
          wpX[fl] = ldx * 1.8; wpY[fl] = ldy * 1.1; wpZ[fl] = ldz * 1.2; // first waypoint out along the launch line
        }
      }
      for (var f1 = 0; f1 < FLOCKS; f1++) {
        if (fState[f1]) {
          // roam: when the squad reaches its waypoint, pick another spot in the
          // frame — their paths gradually fill the canvas
          var wdx = wpX[f1]-cenX[f1], wdy = wpY[f1]-cenY[f1], wdz = wpZ[f1]-cenZ[f1];
          var wd = Math.sqrt(wdx*wdx + wdy*wdy + wdz*wdz);
          if (wd < 0.45) {
            var rr = C.range;
            wpX[f1] = (Math.random()*2-1) * 1.9 * rr;
            wpY[f1] = (Math.random()*2-1) * 1.1 * rr;
            wpZ[f1] = (Math.random()*2-1) * 1.0 * rr;
            wd = 1; wdx = wpX[f1]-cenX[f1]; wdy = wpY[f1]-cenY[f1]; wdz = wpZ[f1]-cenZ[f1];
            wd = Math.sqrt(wdx*wdx + wdy*wdy + wdz*wdz) || 1;
          }
          fDirX[f1] = wdx/wd; fDirY[f1] = wdy/wd; fDirZ[f1] = wdz/wd; // steer toward the waypoint
          var cd = Math.sqrt(cenX[f1]*cenX[f1] + cenY[f1]*cenY[f1] + cenZ[f1]*cenZ[f1]);
          if (fEsc[f1] && (cd > 4.0 * C.range || t > fEnd[f1])) {
            fState[f1] = 0; fEsc[f1] = 0; fLand[f1] = t; // flock home like everyone else
          } else if (!fEsc[f1] && t > fEnd[f1]) { fState[f1] = 0; fLand[f1] = t; } // ease home
        }
        var n0 = fCnt[f1] || 1;
        cenX[f1] = accX[f1]/n0; cenY[f1] = accY[f1]/n0; cenZ[f1] = accZ[f1]/n0;
        avX[f1] = accVX[f1]/n0; avY[f1] = accVY[f1]/n0; avZ[f1] = accVZ[f1]/n0;
        accX[f1]=accY[f1]=accZ[f1]=accVX[f1]=accVY[f1]=accVZ[f1]=fCnt[f1]=0;
      }
      fcv++;
      for (var i = 0; i < N; i++) {
        var ix = i*3, iy = ix+1, iz = ix+2;
        var c;
        if (((i + fcv) & 1) === 0) { // half the swarm re-samples the field each frame; the rest reuses last frame's vector
          c = curl(pos[ix]*0.9, pos[iy]*0.9, pos[iz]*0.9, t * 0.25 + ph[i] * 0.6); // per-particle phase — decorrelates streamlines
          curlC[ix] = c[0]; curlC[iy] = c[1]; curlC[iz] = c[2];
        } else {
          curlS[0] = curlC[ix]; curlS[1] = curlC[iy]; curlS[2] = curlC[iz]; c = curlS;
        }
        if (amb[i] && C.burst > 0.02) { // background drifters (leave rate 0 = everyone rides the head): slow curl wander, held inside the frame
          var asp = Math.min(1.5, C.speed);
          vel[ix] += c[0] * 0.00030 * asp; vel[iy] += c[1] * 0.00030 * asp; vel[iz] += c[2] * 0.00030 * asp;
          if (pos[ix] > 2.3) vel[ix] -= 0.00025; else if (pos[ix] < -2.3) vel[ix] += 0.00025;
          if (pos[iy] > 1.35) vel[iy] -= 0.00025; else if (pos[iy] < FLOOR + 0.06) vel[iy] += 0.0004; // drifters stay above the stage floor
          if (pos[iz] > 1.3) vel[iz] -= 0.00025; else if (pos[iz] < -1.3) vel[iz] += 0.00025;
          vel[ix] *= 0.975; vel[iy] *= 0.975; vel[iz] *= 0.975;
          var asp2 = vel[ix]*vel[ix] + vel[iy]*vel[iy] + vel[iz]*vel[iz], avm = 0.009 * asp;
          if (asp2 > avm*avm) { var avs = avm / Math.sqrt(asp2); vel[ix]*=avs; vel[iy]*=avs; vel[iz]*=avs; }
          pos[ix]+=vel[ix]; pos[iy]+=vel[iy]; pos[iz]+=vel[iz];
          var ab = i*TAIL*3;
          trail.copyWithin(ab, ab + 3, ab + TAIL*3);
          trail[ab+(TAIL-1)*3]=pos[ix]; trail[ab+(TAIL-1)*3+1]=pos[iy]; trail[ab+(TAIL-1)*3+2]=pos[iz];
          continue;
        }
        var dx = tgt[ix]-pos[ix], dy = tgt[iy]-pos[iy], dz = tgt[iz]-pos[iz];
        // the mouse doesn't grab particles — but hovering stirs them subtly
        var freed = 0;
        if (mouseActive && !air && !dragging) { // no stir while grabbing — the swarm rides the head
          var rx = pos[ix] - lmx, ry2 = pos[iy] - lmy, rz = pos[iz] - lmz;
          var rd = Math.sqrt(rx*rx + ry2*ry2 + rz*rz);
          if (rd < 0.85 && rd > 1e-4) {
            var inf = (1 - rd / 0.85) * 0.0011 * Math.min(1.5, C.speed);
            vel[ix] += (rx / rd) * inf; vel[iy] += (ry2 / rd) * inf; vel[iz] += (rz / rd) * inf;
          }
        }
        var fi = flk[i], air = fState[fi] === 1;
        var k = air ? 0 : intro * C.spring * 0.035 * (1 - freed);
        if (!air && fLand[fi] > 0) k *= Math.min(1, (t - fLand[fi]) / 0.7); // return spring ramps in quickly // gentle pull — no snapping
        // stream along the surface: when close to the current node, hop to the
        // neighbor best aligned with the curl flow (creates coherent streams)
        if (!air && freed < 0.4 && intro > 0.4) {
          var hd2 = dx*dx + dy*dy + dz*dz;
          var hopR = 0.02 + 0.05 * C.curl;
          if (hd2 < hopR * hopR) {
            var cn = node[i], base2 = cn * KNB;
            var bestS = -1e9, bestN = cn;
            for (var nb0 = 0; nb0 < KNB; nb0++) {
              var cand = NBR[base2 + nb0], CP = PTS[cand];
              var ex = CP[0]-tgt[ix], ey = CP[1]-tgt[iy], ez = CP[2]-tgt[iz];
              var el = Math.sqrt(ex*ex + ey*ey + ez*ez) || 1e-6;
              // momentum-dominated score: keep heading, nudged by flow, avoid crowds
              var sc = (ex*hdg[ix] + ey*hdg[iy] + ez*hdg[iz]) / el * 1.5
                     + (ex*c[0] + ey*c[1] + ez*c[2]) / el * 0.7
                     + (Math.random() - 0.5) * 0.5 - occ[cand] * 0.45;
              if (sc > bestS) { bestS = sc; bestN = cand; }
            }
            occ[node[i]]--; occ[bestN]++;
            var hx = PTS[bestN][0]-tgt[ix], hy = PTS[bestN][1]-tgt[iy], hz = PTS[bestN][2]-tgt[iz];
            var hl = Math.sqrt(hx*hx + hy*hy + hz*hz) || 1e-6;
            hdg[ix] = hdg[ix]*0.5 + (hx/hl)*0.5; hdg[iy] = hdg[iy]*0.5 + (hy/hl)*0.5; hdg[iz] = hdg[iz]*0.5 + (hz/hl)*0.5;
            node[i] = bestN;
            tgt[ix] = PTS[bestN][0]; tgt[iy] = PTS[bestN][1]; tgt[iz] = PTS[bestN][2];
            trad[i] = Math.sqrt(tgt[ix]*tgt[ix] + tgt[iy]*tgt[iy] + tgt[iz]*tgt[iz]);
            dx = tgt[ix]-pos[ix]; dy = tgt[iy]-pos[iy]; dz = tgt[iz]-pos[iz];
          }
        }
        // crawl: curl noise projected tangent to the head surface, so particles
        // slide across the head without leaving it or warping it
        var px = pos[ix], py = pos[iy], pz = pos[iz];
        var pl = Math.sqrt(px*px + py*py + pz*pz) || 1e-6;
        var ux = px/pl, uy = py/pl, uz = pz/pl;
        var dot = c[0]*ux + c[1]*uy + c[2]*uz;
        var ca = air ? 0 : (0.4 + 0.6 * intro) * crawlAmp * 0.25 * (1 - freed); // surface flow live from the first frame
        vel[ix] += dx*k + (c[0] - dot*ux) * ca;
        vel[iy] += dy*k + (c[1] - dot*uy) * ca;
        vel[iz] += dz*k + (c[2] - dot*uz) * ca;
        if (air) {
          var age = t - fStart[fi];
          var ramp = Math.min(1, age / 1.3); ramp = ramp * ramp * (3 - 2 * ramp); // smooth ease-in
          var fade = fEsc[fi] ? 1 : Math.max(0, Math.min(1, (fEnd[fi] - t) / 1.3)); // ease-out before homing
          var w = ramp * fade, sp0 = C.speed;
          var lk = 0.00009 * sp0 * w; // soft steering — waypoints guide, never rail-straight
          var sw = 0.00018 * sp0 * w * (0.4 + C.curl); // strong curl swirl bends every flight path
          vel[ix] += fDirX[fi] * lk + (cenX[fi]-pos[ix]) * 0.00012 * sp0 * w + c[0] * sw + (avX[fi]-vel[ix]) * 0.04 * w;
          vel[iy] += fDirY[fi] * lk + (cenY[fi]-pos[iy]) * 0.00012 * sp0 * w + c[1] * sw + (avY[fi]-vel[iy]) * 0.04 * w;
          vel[iz] += fDirZ[fi] * lk + (cenZ[fi]-pos[iz]) * 0.00012 * sp0 * w + c[2] * sw + (avZ[fi]-vel[iz]) * 0.04 * w;
          var tetherR = 1.45 * C.range;
          var fr = Math.sqrt(pos[ix]*pos[ix] + pos[iy]*pos[iy]*2.6 + pos[iz]*pos[iz]);
          if (fr > tetherR && !fEsc[fi]) { var fk = (fr - tetherR) * 0.0008 * sp0 / fr; vel[ix] -= pos[ix]*fk; vel[iy] -= pos[iy]*fk; vel[iz] -= pos[iz]*fk; }
        }
        accX[fi]+=pos[ix]; accY[fi]+=pos[iy]; accZ[fi]+=pos[iz];
        accVX[fi]+=vel[ix]; accVY[fi]+=vel[iy]; accVZ[fi]+=vel[iz]; fCnt[fi]++;
        var d = air ? 0.96 : 0.86 + 0.06 * freed;
        vel[ix]*=d; vel[iy]*=d; vel[iz]*=d;
        if (!air) { // cap grounded speed — smooth glide, no accelerating snaps
          var sp2 = vel[ix]*vel[ix] + vel[iy]*vel[iy] + vel[iz]*vel[iz], vmax = (fLand[fi] > 0 && t - fLand[fi] < 3 ? 0.034 : 0.016) * Math.min(1.5, C.speed); // returners hurry home
          if (sp2 > vmax*vmax) { var vs = vmax / Math.sqrt(sp2); vel[ix]*=vs; vel[iy]*=vs; vel[iz]*=vs; }
        }
        pos[ix]+=vel[ix]; pos[iy]+=vel[iy]; pos[iz]+=vel[iz];
        // hard shell: never enter the head volume — clamp to the surface radius
        var minR = trad[i] * 0.99;
        var pl2 = Math.sqrt(pos[ix]*pos[ix] + pos[iy]*pos[iy] + pos[iz]*pos[iz]) || 1e-6;
        if (pl2 < minR) {
          var sc = minR / pl2;
          pos[ix]*=sc; pos[iy]*=sc; pos[iz]*=sc;
          var vd = (vel[ix]*pos[ix] + vel[iy]*pos[iy] + vel[iz]*pos[iz]) / (minR*minR);
          if (vd < 0) { vel[ix]-=vd*pos[ix]; vel[iy]-=vd*pos[iy]; vel[iz]-=vd*pos[iz]; }
        }
        var base = i*TAIL*3;
        trail.copyWithin(base, base + 3, base + TAIL*3);
        trail[base+(TAIL-1)*3]=pos[ix]; trail[base+(TAIL-1)*3+1]=pos[iy]; trail[base+(TAIL-1)*3+2]=pos[iz];
      }
      if (warming) return; // intro substep: sim only, skip the geometry build
      var si = 0;
      // path smoothing: neighbor-averaging passes over each trail before building
      // segments (render-only — the sim history is untouched)
      var smIt = Math.round(Math.max(0, Math.min(1, C.smooth || 0)) * 6);
      if (smIt > 0 && (!smBuf || smBuf.length < TAIL * 3)) smBuf = new Float32Array(TAIL * 3);
      for (var p = 0; p < N; p++) {
        var b0 = p*TAIL*3;
        var src = trail;
        if (smIt > 0) {
          for (var c0 = 0; c0 < TAIL*3; c0++) smBuf[c0] = trail[b0+c0];
          for (var itc = 0; itc < smIt; itc++) {
            var px0 = smBuf[0], py0 = smBuf[1], pz0 = smBuf[2];
            for (var q0 = 1; q0 < TAIL - 1; q0++) {
              var o3 = q0*3;
              var cx1 = smBuf[o3], cy1 = smBuf[o3+1], cz1 = smBuf[o3+2];
              smBuf[o3]   = cx1 * 0.5 + (px0 + smBuf[o3+3]) * 0.25;
              smBuf[o3+1] = cy1 * 0.5 + (py0 + smBuf[o3+4]) * 0.25;
              smBuf[o3+2] = cz1 * 0.5 + (pz0 + smBuf[o3+5]) * 0.25;
              px0 = cx1; py0 = cy1; pz0 = cz1;
            }
          }
          src = smBuf; b0 = 0;
        }
        var aw = amb[p] ? 0.22 : (fState[flk[p]] ? 0.18 : 0.35); // background reads darker now
        // per-particle stagger so the retraction sweeps organically, not in lockstep
        var stag = C.cycleStagger != null ? C.cycleStagger : 0.3;
        var gP = cycOn ? Math.max(0, Math.min(1, growAll * (1 + stag) - (ph[p] % 1) * stag)) : 1;
        var cut = (1 - gP) * (TAIL - 1), edge = 1 / Math.max(1, TAIL * 0.04);
        for (var q = 1; q < TAIL; q++) {
          segPos[si*6]=src[b0+(q-1)*3]; segPos[si*6+1]=src[b0+(q-1)*3+1]; segPos[si*6+2]=src[b0+(q-1)*3+2];
          segPos[si*6+3]=src[b0+q*3]; segPos[si*6+4]=src[b0+q*3+1]; segPos[si*6+5]=src[b0+q*3+2];
          var m0 = cycOn ? Math.max(0, Math.min(1, (q - 1 - cut) * edge)) : 1;
          var m1 = cycOn ? Math.max(0, Math.min(1, (q - cut) * edge)) : 1;
          segA[si*2]=aw*((q-1)/TAIL)*m0; segA[si*2+1]=aw*(q/TAIL)*m1; si++;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
      tGeo.attributes.position.needsUpdate = true;
      tGeo.attributes.aAlpha.needsUpdate = true;
      // rebuild the proximity net every other frame (spatial hash allocates; halving
      // its rate is invisible but saves real time at high particle counts)
      netFrame ^= 1;
      var segN = lastSegN, link = C.link;
      if (link > 0.005 && netFrame) {
        segN = 0;
        var inv = 1 / link, cells = {};
        for (var g0 = 0; g0 < N; g0++) {
          if (amb[g0] || fState[flk[g0]]) continue;
          var gx = Math.floor(pos[g0*3] * inv), gy = Math.floor(pos[g0*3+1] * inv), gz = Math.floor(pos[g0*3+2] * inv);
          var gk = gx + "_" + gy + "_" + gz;
          (cells[gk] || (cells[gk] = [])).push(g0);
        }
        var l2 = link * link, LINKCAP = 5, linkCnt = new Uint8Array(N);
        outer:
        for (var a0 = 0; a0 < N; a0++) {
          if (fState[flk[a0]] || linkCnt[a0] >= LINKCAP) continue;
          var ax0 = pos[a0*3], ay0 = pos[a0*3+1], az0 = pos[a0*3+2];
          var cx0 = Math.floor(ax0 * inv), cy0 = Math.floor(ay0 * inv), cz0 = Math.floor(az0 * inv);
          for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) for (var oz = -1; oz <= 1; oz++) {
            var bucket = cells[(cx0+ox) + "_" + (cy0+oy) + "_" + (cz0+oz)];
            if (!bucket) continue;
            for (var b0 = 0; b0 < bucket.length; b0++) {
              var j0 = bucket[b0];
              if (j0 <= a0 || linkCnt[j0] >= LINKCAP) continue;
              var jx = j0*3;
              var ddx = pos[jx]-ax0, ddy = pos[jx+1]-ay0, ddz = pos[jx+2]-az0;
              var dd2 = ddx*ddx + ddy*ddy + ddz*ddz;
              if (dd2 > l2) continue;
              linkCnt[a0]++; linkCnt[j0]++;
              var s6 = segN * 6;
              netPos[s6]=ax0; netPos[s6+1]=ay0; netPos[s6+2]=az0;
              netPos[s6+3]=pos[jx]; netPos[s6+4]=pos[jx+1]; netPos[s6+5]=pos[jx+2];
              var lt0 = 1 - Math.sqrt(dd2) / link;
              var la0 = 0.14 * lt0 * lt0; // quadratic falloff — keeps the net airy
              netA[segN*2] = la0; netA[segN*2+1] = la0;
              if (++segN >= MAXSEG) break outer;
              if (linkCnt[a0] >= LINKCAP) break;
            }
          }
        }
      }
      if (netFrame) {
        lastSegN = segN;
        netGeo.setDrawRange(0, segN * 2);
        netGeo.attributes.position.needsUpdate = true;
        netGeo.attributes.aAlpha.needsUpdate = true;
      }
      if (link <= 0.005 && lastSegN) { lastSegN = 0; netGeo.setDrawRange(0, 0); }
      // dim labels: anchored to spread-out particles, redrawn periodically
      var ts = C.textSize;
      var showLbl = ts > 0.01 && N > 0;
      var tick = Math.floor(t / 0.5);
      for (var l0 = 0; l0 < LBLN; l0++) {
        var L = labels[l0];
        L.spr.visible = showLbl;
        if (!showLbl) continue;
        var ai = ((l0 * 2654435761 + 7919) % N) | 0, a3 = ai * 3;
        L.spr.position.set(pos[a3] * 1.06, pos[a3+1] * 1.06 + 0.06, pos[a3+2] * 1.06);
        L.spr.scale.set(0.85 * ts, 0.16 * ts, 1);
        if (tick !== lblTick) {
          var f2d = function (v) { return (v >= 0 ? "+" : "") + v.toFixed(2); };
          L.ctx.clearRect(0, 0, 340, 64);
          L.ctx.font = "400 26px 'Space Mono', monospace";
          L.ctx.fillStyle = "#161616";
          L.ctx.fillText("X:" + f2d(pos[a3]) + " Y:" + f2d(pos[a3+1]) + " Z:" + f2d(pos[a3+2]), 6, 40);
          L.tex.needsUpdate = true;
        }
      }
      if (tick !== lblTick) lblTick = tick;
      // rubber band: underdamped spring back to the rest view on release
      if (!dragging) {
        var kS = 0.035, dampS = 0.94;
        rotYV += -rotY * kS; rotYV *= dampS; rotY += rotYV;
        rotXV += -rotX * kS; rotXV *= dampS; rotX += rotXV;
      }
      // idle drift: gentle sway even when not grabbed
      var swayY = Math.sin(t * 0.35) * 0.10 + Math.sin(t * 0.13) * 0.05;
      var swayX = Math.sin(t * 0.27 + 1.3) * 0.035;
      var headYaw = Math.PI + C.restYaw + swayY; // rest pose yaw is tweakable (sway only — the mouse orbits the camera)
      var headPitch = C.restPitch + swayX;
      headGroup.rotation.y = headYaw;
      headGroup.rotation.x = headPitch;
      group.rotation.y = headYaw;
      group.rotation.x = headPitch;
      // true camera orbit: the sim keeps living while you swing around it
      var cy = -rotY, cx = Math.max(-1.2, Math.min(1.2, rotX));
      camera.position.set(CAM_D * Math.sin(cy) * Math.cos(cx), CAM_D * Math.sin(cx), CAM_D * Math.cos(cy) * Math.cos(cx));
      camera.lookAt(0, 0, 0);
    }

    var simT = 0, lastNow = null;
    var onScreen = true;
    if (window.IntersectionObserver) { new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(canvas); }
    function loop(now) {
      if (!onScreen) { lastNow = null; raf = requestAnimationFrame(loop); return; } // parked offscreen: no sim, no render
      var C = cfg();
      if (C.count !== N || C.tail !== TAIL) { build(C.count, C.tail); }
      if (C.wire) ensureWire();
      if (wireMesh) { wireMesh.visible = C.wire && C.wireOpacity > 0.005; if (wMat) { if (wMat.opacity !== C.wireOpacity) wMat.opacity = C.wireOpacity; if (lastWireCol !== C.wireColor) { lastWireCol = C.wireColor; wMat.color.set(C.wireColor); } } }
      // head is a solid white shaded material (facets from flat normals)
      if (headMesh) {
        headMesh.visible = C.head && C.headOpacity > 0.005;
        var wantMat = (C.headStyle === "silhouette" && hMatFlat) ? hMatFlat : hMat;
        if (headMesh.material !== wantMat) headMesh.material = wantMat;
        if (wantMat === hMatFlat) {
          // full opacity: opaque + depth-written (clean occlusion). Lower opacity:
          // transparent, drawn first, so trails BLEND through instead of clipping.
          hMatFlat.uniforms.uBase.value.set(C.headColor);
          hMatFlat.uniforms.uAlpha.value = C.headOpacity;
          hMatFlat.depthWrite = C.headOpacity > 0.95;
          headMesh.renderOrder = C.headOpacity > 0.95 ? 0 : -1;
          hMatFlat.uniforms.uShade.value = C.headShade;
          hMatFlat.uniforms.uTexScale.value = C.headTexScale;
          hMatFlat._syncTex(C.headTex);
        } else if (wantMat && wantMat.opacity !== C.headOpacity) { wantMat.opacity = C.headOpacity; wantMat.depthWrite = C.headOpacity > 0.9; }
        if (hMat) hMat.color.set(C.headColor);
        if (lastInkCol !== C.inkColor) { lastInkCol = C.inkColor; if (pMat) pMat.color.set(C.inkColor); if (tMat) tMat.uniforms.uColor.value.set(C.inkColor); ink.set(C.inkColor); }
      }
      if (pMat.size !== C.size) { pMat.size = C.size; pMat.needsUpdate = true; }
      if (lastNow == null) lastNow = now;
      var dtw = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      // intro time-lapse: extra sim substeps for the first 3s so the walk history
      // (the dense scribble) builds up fast, decelerating smoothly into real time
      var wallNow = (now - wallStart) / 1000;
      var Rw = C.introRamp != null ? C.introRamp : 4.5;
      // smooth, fractional time-lapse: the boost eases to zero slope at the end of the
      // ramp, and fractional substeps accumulate so the speed never jumps between frames
      var eIn = Math.max(0, Math.min(1, 1 - wallNow / Rw)); eIn = eIn * eIn * (3 - 2 * eIn);
      subAcc += 1 + 5 * eIn;
      var sub = Math.floor(subAcc); subAcc -= sub;
      if (sub < 1) sub = 1;
      try {
        if (camera.fov !== C.fov) { camera.fov = C.fov; camera.updateProjectionMatrix(); fitCamera(); }
        for (var sb = 0; sb < sub; sb++) { simT += dtw * C.speed; warming = sb < sub - 1; step(simT, C); }
        warming = false;
        stageSync(C);
        if (C.blur > 0.01) {
          renderer.autoClear = false;
          fadeMat.uniforms.uFade.value = 1 - C.blur;
          renderer.render(fadeScene, fadeCam);
          renderer.clearDepth();
        } else { renderer.autoClear = true; }
        renderer.render(scene, camera);
        publishHeadScreen();
      } catch (err) {
        if (!window.__eeHeroErr) { window.__eeHeroErr = String(err && (err.stack || err.message || err)); console.error("EEHERO " + window.__eeHeroErr); }
      }
      if (!canvas.isConnected) { cancelAnimationFrame(raf); raf = null; inited = false; canvas.__eeHero = false; if (ro) ro.disconnect(); window.EE_HEAD_SCREEN = null; setTimeout(start, 200); return; }
      raf = requestAnimationFrame(loop);
    }
    // publish the head's projected screen ellipse (client px) so the background grid fades behind it
    var hsV = new THREE.Vector3();
    var hsRect = null, hsRectT = 0;
    window.addEventListener("scroll", function () { hsRect = null; }, { passive: true, capture: true });
    function heroRect() {
      var n = performance.now();
      if (!hsRect || n - hsRectT > 400) { hsRect = canvas.getBoundingClientRect(); hsRectT = n; }
      return hsRect;
    }
    var HS_PTS = [[0.85,0,0],[-0.85,0,0],[0,1.05,0],[0,-1.05,0],[0,0,0.9],[0,0,-0.9]];
    function publishHeadScreen() {
      var r = heroRect();
      if (r.width < 2) return;
      hsV.set(0, 0, 0).project(camera);
      var cx = r.left + (hsV.x + 1) / 2 * r.width, cy = r.top + (1 - hsV.y) / 2 * r.height;
      var mX = 0, mY = 0;
      for (var hp = 0; hp < HS_PTS.length; hp++) {
        hsV.set(HS_PTS[hp][0], HS_PTS[hp][1], HS_PTS[hp][2]).applyEuler(headGroup.rotation).project(camera);
        var px = r.left + (hsV.x + 1) / 2 * r.width, py = r.top + (1 - hsV.y) / 2 * r.height;
        if (Math.abs(px - cx) > mX) mX = Math.abs(px - cx);
        if (Math.abs(py - cy) > mY) mY = Math.abs(py - cy);
      }
      window.EE_HEAD_SCREEN = { x: cx, y: cy, rx: mX, ry: mY, t: performance.now(), drag: dragging ? 1 : 0, dvx: dragVX, dvy: dragVY };
    }

    if (reduce) {
      var C0 = cfg();
      wallStart -= 4000; // reduced motion: land directly on the fully-grown state
      for (var w2 = 0; w2 < 220; w2++) step(3.2 + w2 * 0.016, C0);
      renderer.render(scene, camera);
      publishHeadScreen();
    } else {
      raf = requestAnimationFrame(loop);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
