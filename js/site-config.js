/* Evan Emery — site configuration.
   In the Claude-Design export these 71 values lived on the document's
   `data-props` attribute and a React logic class republished them to
   window.EE_HERO_CFG / EE_BG_CFG on every render. This file is that preset,
   lifted verbatim, plus the same prop -> engine-key mapping.

   hero-field.js re-reads EE_HERO_CFG every frame and bg-grid.js re-reads
   EE_BG_CFG, so every value below stays hot: assign to window.EE_TWEAKS and
   call EE_APPLY_TWEAKS() and the change lands on the next frame. Only `count`
   and `tail` rebuild buffers. That is what admin.html drives. */
(function () {
  "use strict";

  // ---- the delivered v1 preset (Light v1) --------------------------------
  var TWEAKS = {
    // Artwork
    sheetBg: "Grid + paper",
    artworkBg: "White",
    // Print FX v2
    inkBleed: 0,
    accentColor: "None",      // greyscale only, per the design system
    simGrain: 1,
    paperTexture: 0.1,
    filmGrain: false,
    grainIntensity: 1,
    cropMarks: true,
    chromaAberration: 0,
    halftone: false,
    // Scroll FX v2
    scrollParallax: true,
    drawInRules: true,
    scrollProgress: true,
    // Timing
    introRampSeconds: 5,
    introDriftSeconds: 7,
    breatheCycleSeconds: 20,
    breatheMinTrails: 0.3,
    breatheGrowShare: 0.5,
    breatheHoldShare: 0.06,
    breatheStagger: 1,
    simSpeed: 1.3,
    orbitSpeed: 3,
    // Colors
    headColor: "#ffffff",
    particleColor: "#161616",
    wireColor: "#000000",
    bgGridColor: "#8a8a8a",
    paperColor: "#f6f3ec",
    // Camera
    cameraFov: 30,
    headYawDeg: -58,
    headPitchDeg: 0,
    motionBlur: 0.66,
    pathSmoothing: 0.75,
    // Head
    showHead: true,
    headStyle: "silhouette",
    headOpacity: 0.45,
    headShade: 0.4,
    headTexture: "none",
    headTexScale: 0.1,
    showWireframe: false,
    wireOpacity: 0.06,
    wireShading: 0,
    // Particles
    particleCount: 200,
    trailLength: 160,
    particleSize: 0.02,
    swarmStrength: 2.7,
    attraction: 3,
    mouseForce: 0.5,
    leaveRate: 0,
    flightRange: 0.4,
    linkDistance: 0,
    // Background
    pageBg: "paper",
    heroBg: "paper",
    bgScope: "hero",
    gridScope: "artwork",
    heroBorder: "frame",
    bgGrid: true,
    bgIntensity: 1.5,
    bgSpacing: 18,
    bgDistort: 0.05,
    bgMajorLines: true,
    bgNodeStyle: "cross",
    bgMouseRadius: 250,
    bgMouseForce: 0.1,
    // Site
    frameStyle: "black",
    wallTone: "plaster",
    navStyle: "ink",
    motion: true
  };

  var ACCENTS = {
    "None": "",
    "Signal red": "#e5372a",
    "Safety orange": "#ff5a1f",
    "Acid green": "#8bd10f",
    "Ink blue": "#2b4cff"
  };

  // Admin writes tuning overrides here; they win over the shipped preset.
  var FX_KEY = "ee_fx_v2";
  function overrides() {
    try { return JSON.parse(localStorage.getItem(FX_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }

  function apply() {
    var p = Object.assign({}, TWEAKS, overrides());
    window.EE_TWEAKS = p;

    window.EE_HERO_CFG = {
      count: p.particleCount,
      tail: p.trailLength,
      curl: p.swarmStrength,
      spring: p.attraction,
      speed: p.simSpeed,
      size: p.particleSize,
      orbit: p.orbitSpeed,
      stage: false,
      head: p.showHead,
      headOpacity: p.headOpacity,
      link: p.linkDistance,
      escape: 0,
      burst: p.leaveRate,
      range: p.flightRange,
      cycle: p.breatheCycleSeconds,
      cycleHold: p.breatheHoldShare,
      cycleStagger: p.breatheStagger,
      cycleRatio: p.breatheGrowShare,
      cycleFloor: p.breatheMinTrails,
      introRamp: p.introRampSeconds,
      introDrift: p.introDriftSeconds,
      headColor: p.headColor,
      inkColor: p.particleColor,
      headShade: p.headShade,
      headTex: null,
      headTexScale: p.headTexScale,
      fov: p.cameraFov,
      restYaw: p.headYawDeg * Math.PI / 180,
      restPitch: p.headPitchDeg * Math.PI / 180,
      blur: p.motionBlur,
      smooth: p.pathSmoothing,
      wireColor: p.wireColor,
      textSize: 0,
      wire: p.showWireframe,
      mouse: p.mouseForce,
      wireOpacity: p.wireOpacity,
      shade: p.wireShading,
      headStyle: p.headStyle
    };

    window.EE_BG_CFG = {
      on: p.bgGrid,
      spacing: p.bgSpacing,
      intensity: p.bgIntensity,
      distort: p.bgDistort,
      major: p.bgMajorLines ? 5 : 0,
      node: p.bgNodeStyle,
      ink: p.bgGridColor,
      mouseR: p.bgMouseRadius,
      mouseF: p.bgMouseForce
    };

    paintShell(p);
    return p;
  }

  // Mirror the tweaks that are expressed as data-attributes / custom properties
  // on the page wrapper, the way the DC logic class did on every render.
  function paintShell(p) {
    var el = document.querySelector("[data-ee-shell]");
    if (!el) return;
    var ca = p.chromaAberration || 0;
    var bleed = p.inkBleed || 0;
    var set = function (k, v) { el.setAttribute(k, v); };

    set("data-frame", p.frameStyle);
    set("data-wall", p.wallTone);
    set("data-bg", p.pageBg);
    set("data-grain", p.filmGrain ? "1" : "0");
    set("data-crop", p.cropMarks ? "1" : "0");
    set("data-chroma", ca > 0 ? "1" : "0");
    set("data-halftone", p.halftone ? "1" : "0");
    set("data-progress", p.scrollProgress ? "1" : "0");
    set("data-simgrain", (p.simGrain || 0) > 0 ? "1" : "0");
    set("data-inkbleed", bleed > 0.01 ? "1" : "0");

    var accent = ACCENTS[p.accentColor] || "";
    var s = el.style;
    s.setProperty("--ee-grain-op", String(p.grainIntensity));
    s.setProperty("--ee-ca", ca + "px");
    s.setProperty("--ee-page", p.paperColor);
    s.setProperty("--ee-paper", p.paperColor);
    s.setProperty("--ee-page-tint", p.paperColor);
    s.setProperty("--paper-tex", String(p.paperTexture));
    s.setProperty("--ee-accent", accent || "var(--text-primary)");
    s.setProperty("--sim-grain", String(p.simGrain));

    var nav = document.getElementById("ee-nav");
    if (nav) nav.setAttribute("data-nav", p.navStyle);
  }

  window.EE_DEFAULT_TWEAKS = TWEAKS;
  window.EE_APPLY_TWEAKS = apply;
  apply();
})();
