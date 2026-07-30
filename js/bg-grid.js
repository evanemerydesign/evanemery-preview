/* ee bg-grid — full-page background particle grid (2D canvas, fixed layer).
   A drafting-grid of ink dots that breathe slowly, linked by hairlines to their
   grid neighbours, on spring physics. The pointer is tracked at window level so
   the field reacts anywhere on the page (including over the hero canvas);
   influence decays smoothly when the cursor leaves the browser window.
   Live-tweakable via window.EE_BG_CFG: { on, spacing, intensity, mouseR, mouseF }. */
(function () {
  var CANVAS_ID = "ee-bg-grid";
  var DEF = { on: true, spacing: 64, intensity: 1.0, mouseR: 190, mouseF: 1.0, distort: 0.15, major: 5, node: "sphere" };
  function cfg() {
    var c = window.EE_BG_CFG || {};
    return {
      on: c.on != null ? !!c.on : DEF.on,
      spacing: Math.max(18, Math.min(160, c.spacing != null ? c.spacing : DEF.spacing)),
      intensity: Math.max(0, Math.min(2.5, c.intensity != null ? c.intensity : DEF.intensity)),
      mouseR: Math.max(40, Math.min(600, c.mouseR != null ? c.mouseR : DEF.mouseR)),
      mouseF: Math.max(0, Math.min(3, c.mouseF != null ? c.mouseF : DEF.mouseF)),
      distort: Math.max(0, Math.min(1, c.distort != null ? c.distort : DEF.distort)),
      major: c.major != null ? (c.major | 0) : DEF.major,
      node: c.node === "cross" ? "cross" : "sphere",
      ink: typeof c.ink === "string" ? c.ink : "22,22,22",
    };
  }

  var inited = false;
  var _rc = null, _rcT = 0;
  function start() {
    var canvas = document.getElementById(CANVAS_ID);
    if (!canvas) { setTimeout(start, 120); return; }
    if (inited && canvas.__eeBg) return;
    inited = true;
    canvas.__eeBg = true;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, DPR = 1;
    var pts = null, cols = 0, rows = 0, builtSpacing = 0;

    function build(S) {
      builtSpacing = S;
      cols = Math.ceil(W / S) + 2;
      rows = Math.ceil(H / S) + 2;
      var n = cols * rows;
      pts = { hx: new Float32Array(n), hy: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n),
              vx: new Float32Array(n), vy: new Float32Array(n), ph: new Float32Array(n) };
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        var hx = (c - 0.5) * S, hy = (r - 0.5) * S;
        pts.hx[i] = hx; pts.hy[i] = hy; pts.x[i] = hx; pts.y[i] = hy;
        pts.ph[i] = (hx * 0.011 + hy * 0.017) + Math.sin(hx * 0.031) * 1.7; // spatial wave phase
      }
    }

    var host = canvas.parentElement || document.body;
    function resize() {
      var fixed = getComputedStyle(canvas).position === "fixed";
      W = fixed ? window.innerWidth : (host.clientWidth || window.innerWidth);
      H = fixed ? window.innerHeight : (host.clientHeight || window.innerHeight);
      DPR = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      build(cfg().spacing);
    }
    resize();
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) { var ro = new ResizeObserver(function () { requestAnimationFrame(function () { if ((host.clientWidth !== W || host.clientHeight !== H) && canvas.isConnected) resize(); }); }); ro.observe(host); }

    // window-level pointer: reacts across the whole page, decays after leaving
    var mx = -1e5, my = -1e5, pmx = -1e5, pmy = -1e5, mvx = 0, mvy = 0, mPow = 0, mTarget = 0;
    window.addEventListener("scroll", function () { _rc = null; }, { passive: true, capture: true });
    function bgRect() {
      var n = performance.now();
      if (!_rc || n - _rcT > 400) { _rc = canvas.getBoundingClientRect(); _rcT = n; }
      return _rc;
    }
    window.addEventListener("pointermove", function (ev) {
      var rect = bgRect();
      var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      if (pmx > -1e4) { mvx = mvx * 0.7 + (x - pmx) * 0.3; mvy = mvy * 0.7 + (y - pmy) * 0.3; }
      pmx = mx = x; pmy = my = y;
      mTarget = 1;
    }, { passive: true });
    document.addEventListener("mouseleave", function () { mTarget = 0; });
    window.addEventListener("blur", function () { mTarget = 0; });

    var t0 = performance.now(), lastT = t0;
    var onScreen = true;
    if (window.IntersectionObserver) { new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(canvas); }
    function loop(now) {
      if (!onScreen) { lastT = now; requestAnimationFrame(loop); return; }
      var C = cfg();
      var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      var t = (now - t0) / 1000;
      if (!C.on || C.intensity <= 0.001) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(loop);
        return;
      }
      if (Math.abs(C.spacing - builtSpacing) > 1) build(C.spacing);

      mPow += (mTarget - mPow) * Math.min(1, dt * (mTarget ? 10 : 2.2)); // fast attack, slow release
      mvx *= 0.88; mvy *= 0.88;

      // head screen ellipse (published by the hero) — used for fabric push while orbiting + fade-behind
      var hs = window.EE_HEAD_SCREEN, hOn = false, hcx = 0, hcy = 0, hrx = 1, hry = 1;
      if (hs && hs.rx > 4 && (performance.now() - hs.t) < 500) {
        var crc = bgRect();
        hcx = hs.x - crc.left; hcy = hs.y - crc.top;
        hrx = hs.rx * 1.04; hry = hs.ry * 1.04;
        hOn = true;
      }
      var dragOn = hOn && hs.drag, dragSpd = dragOn ? Math.min(34, Math.abs(hs.dvx) + Math.abs(hs.dvy)) : 0;

      var k = 14, damp = Math.exp(-5.2 * dt); // spring home + damping
      var R = C.mouseR, R2 = R * R, F = 620 * C.mouseF * mPow;
      var RB = R * 3, RB2 = RB * RB, A = 340 * C.mouseF * mPow; // wide, gentle follow-attraction
      var breatheOn = !reduce;
      var wAmp = breatheOn ? 9 * C.distort : 0; // distort 0 = clean grid at rest
      var i, n = cols * rows;
      for (i = 0; i < n; i++) {
        // positional breathing: home point sways slowly
        var wobX = wAmp * Math.sin(t * 0.55 + pts.ph[i]);
        var wobY = wAmp * Math.cos(t * 0.47 + pts.ph[i] * 1.31);
        var dxh = pts.hx[i] + wobX - pts.x[i], dyh = pts.hy[i] + wobY - pts.y[i];
        pts.vx[i] += dxh * k * dt; pts.vy[i] += dyh * k * dt;
        if (mPow > 0.01) {
          var dx = pts.x[i] - mx, dy = pts.y[i] - my, d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            var d = Math.sqrt(d2), fall = 1 - d / R; fall *= fall;
            var f = F * fall * dt / d;
            pts.vx[i] += dx * f + mvx * fall * dt * 5.5; // push away + drag along with cursor motion
            pts.vy[i] += dy * f + mvy * fall * dt * 5.5;
          } else if (d2 < RB2 && d2 > 0.01) {
            var db = Math.sqrt(d2), fb = 1 - db / RB; fb *= fb; // lean toward the cursor from far away
            pts.vx[i] -= (dx / db) * A * fb * dt;
            pts.vy[i] -= (dy / db) * A * fb * dt;
          }
        }
        pts.vx[i] *= damp; pts.vy[i] *= damp;
        // fabric push: orbiting the head shoves the surrounding weave outward, sheared along the drag
        if (dragOn && dragSpd > 0.5) {
          var fdx = pts.x[i] - hcx, fdy = pts.y[i] - hcy;
          var eN = Math.sqrt((fdx / hrx) * (fdx / hrx) + (fdy / hry) * (fdy / hry));
          if (eN > 0.55 && eN < 2.3) {
            var band = 1 - Math.abs(eN - 1.15) / 1.15;
            if (band > 0) {
              var fd = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
              var pf = dragSpd * 11 * band * dt;
              pts.vx[i] += (fdx / fd) * pf + hs.dvx * band * dt * 3.5;
              pts.vy[i] += (fdy / fd) * pf + hs.dvy * band * dt * 3.5;
            }
          }
        }
        pts.x[i] += pts.vx[i] * dt; pts.y[i] += pts.vy[i] * dt; // v is px/s
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var I = C.intensity;
      var inkRGB = C.ink;
      if (inkRGB.charAt(0) === "#") { var hx = inkRGB.length === 4 ? inkRGB.replace(/[0-9a-f]/gi, function(ch){return ch==="#"?"#":ch+ch;}) : inkRGB; inkRGB = parseInt(hx.substr(1,2),16) + "," + parseInt(hx.substr(3,2),16) + "," + parseInt(hx.substr(5,2),16); }
      var gBreathe = breatheOn ? t * 0.55 : 0;
      var brAmp = Math.min(1, C.distort * 2.5); // distort 0 = perfectly uniform grid (no alpha/size shimmer either)


      // lines to right + down neighbours
      ctx.lineWidth = 1;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        i = r * cols + c;
        var br = breatheOn ? 0.5 + 0.5 * brAmp * Math.sin(gBreathe + pts.ph[i]) : 0.5;
        var hFade = 1;
        if (hOn) {
          var ex = (pts.x[i] - hcx) / hrx, ey = (pts.y[i] - hcy) / hry;
          var ed = Math.sqrt(ex * ex + ey * ey); // 1 = head edge
          hFade = Math.max(0, Math.min(1, (ed - 0.9) / 0.35)); // hidden inside, soft fade at the rim
          if (hFade <= 0.002) continue;
        }
        var near = 0;
        if (mPow > 0.01) {
          var mdx = pts.x[i] - mx, mdy = pts.y[i] - my, md2 = mdx * mdx + mdy * mdy;
          if (md2 < R2) { near = 1 - Math.sqrt(md2) / R; near *= near * mPow; }
        }
        var la = (0.028 + 0.062 * br + 0.10 * near) * I * hFade;
        if (la > 0.004) {
          var M = C.major; // horizontal segments belong to row line r, vertical to column line c
          if (c + 1 < cols) { var j = i + 1; var laH = (M && r % M === 0) ? Math.min(0.4, la * 2.4) : la; ctx.strokeStyle = "rgba(" + inkRGB + "," + laH.toFixed(3) + ")"; ctx.beginPath(); ctx.moveTo(pts.x[i], pts.y[i]); ctx.lineTo(pts.x[j], pts.y[j]); ctx.stroke(); }
          if (r + 1 < rows) { var j2 = i + cols; var laV = (M && c % M === 0) ? Math.min(0.4, la * 2.4) : la; ctx.strokeStyle = "rgba(" + inkRGB + "," + laV.toFixed(3) + ")"; ctx.beginPath(); ctx.moveTo(pts.x[i], pts.y[i]); ctx.lineTo(pts.x[j2], pts.y[j2]); ctx.stroke(); }
        }
        // dot
        var rad = (0.8 + 1.1 * br + 1.1 * near) * Math.min(1.4, I);
        var da = (0.05 + 0.12 * br + 0.22 * near) * I * hFade;
        if (C.node === "cross") {
          var cr = rad * 1.9;
          ctx.strokeStyle = "rgba(" + inkRGB + "," + Math.min(0.55, da * 1.15).toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(pts.x[i] - cr, pts.y[i]); ctx.lineTo(pts.x[i] + cr, pts.y[i]);
          ctx.moveTo(pts.x[i], pts.y[i] - cr); ctx.lineTo(pts.x[i], pts.y[i] + cr);
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(" + inkRGB + "," + Math.min(0.5, da).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(pts.x[i], pts.y[i], rad, 0, 6.2832); ctx.fill();
        }
      }
      if (!canvas.isConnected) { inited = false; canvas.__eeBg = false; setTimeout(start, 200); return; }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
  start();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
})();
