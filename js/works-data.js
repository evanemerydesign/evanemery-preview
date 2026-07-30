/* Shared works catalogue for the Evan Emery site.
   Loaded as a classic script in every page's <helmet>; exposes window.EE_WORKS_DATA.
   Both the portfolio index and the per-artwork page read from here, so adding a
   work (or editing one via Admin) shows up everywhere. */
(function () {
  var STORE_KEY = "ee-portfolio-content-v1";

  var BASE_WORKS = [
    { id:"dazzle-dim", title:"Dazzle Dim", year:2024, dims:"25 × 31 in", series:"Vector Field", edition:"", badge:"Print", badgeTone:"ok", blurb:"A portrait resolved from a swarm of vector arrows — direction and magnitude sampled across the head.", params:"seed 0906 · vectors 4,120 · θ 0–360°", image:"assets/works/dazzle-dim.jpg", medium:"Archival pigment on fine art paper", workflow:"Vector-field arrow swarm", tools:"Rhino · Grasshopper", analog:"CNC pen plotter", mockupImage:"assets/works/mockups/dazzle-dim.webp", details:[{label:"Arrows",size:"230%",pos:"50% 35%"},{label:"Field",size:"230%",pos:"45% 65%"}] },
    { id:"deep-blue", title:"Deep Blue", year:2025, dims:"25 × 31 in", series:"Depth Field", edition:"", badge:"Print", badgeTone:"ok", blurb:"Two heads extruded from a depth map — the brighter values pushed forward off the plate.", params:"seed 1147 · z-scale 1.85 · 512² samples", image:"assets/works/deep-blue.jpg", medium:"Cyanotype print on watercolor paper", workflow:"Fractal geometry × human 3D model", tools:"Octane Render · Vectron · C4D", analog:"Cyanotype", mockupImage:"assets/works/mockups/deep-blue.webp", details:[{label:"Lower",size:"220%",pos:"28% 55%"},{label:"Upper",size:"220%",pos:"72% 30%"}] },
    { id:"distant-blues", title:"Distant Blues", year:2025, dims:"25 × 31 in", series:"Depth Field", edition:"", badge:"Print", badgeTone:"ok", blurb:"A single figure raised out of a height field, the body reading as terrain.", params:"seed 0451 · z-scale 2.10", image:"assets/works/distant-blues.jpg", medium:"Cyanotype print on watercolor paper", workflow:"Fractal geometry × human 3D model", tools:"Octane Render · Vectron · C4D", analog:"Cyanotype", mockupImage:"assets/works/mockups/distant-blues.webp", details:[{label:"Head",size:"230%",pos:"30% 22%"},{label:"Scanlines",size:"230%",pos:"58% 62%"}] },
    { id:"duality", title:"Duality", year:2025, dims:"30 × 40 in", series:"Duality", edition:"", badge:"Print", badgeTone:"ok", blurb:"Two systems reading one signal — linework and point cloud facing across a plotted field.", params:"seed 2231 · nodes 1,904 · X:14.25 Y:−8.15", image:"assets/works/duality.jpg", medium:"White ink on mat board", workflow:"UV texture map · data abstraction", tools:"Rhino · Grasshopper", analog:"CNC pen plotter", mockupImage:"assets/works/mockups/duality.webp", details:[{label:"Left",size:"210%",pos:"26% 45%"},{label:"Right",size:"210%",pos:"74% 45%"}] },
    { id:"falling", title:"Falling", year:2025, dims:"25 × 31 in", series:"Depth Field", edition:"", badge:"Print", badgeTone:"ok", blurb:"A figure caught mid-fall, extruded and inverted so the mass unspools downward.", params:"seed 0770 · z-scale 1.60", image:"assets/works/falling.jpg", medium:"Cyanotype print on watercolor paper", workflow:"Fractal geometry × human 3D model", tools:"Octane Render · Vectron · C4D", analog:"Cyanotype", details:[{label:"Torso",size:"240%",pos:"55% 30%"},{label:"Descent",size:"240%",pos:"48% 76%"}] },
    { id:"fractal-blues", title:"Fractal Blues", year:2025, dims:"25 × 31 in", series:"Depth Field", edition:"", badge:"Print", badgeTone:"ok", blurb:"Recursive displacement folds the profile into itself — self-similar at every zoom.", params:"seed 1902 · octaves 6", image:"assets/works/fractal-blues.jpg", medium:"Cyanotype print on watercolor paper", workflow:"Fractal geometry × human 3D model", tools:"Octane Render · Vectron · C4D", analog:"Cyanotype", details:[{label:"Face",size:"220%",pos:"60% 40%"},{label:"Bands",size:"220%",pos:"42% 72%"}] },
    { id:"fracture-head", title:"Fracture Head", year:2024, dims:"25 × 31 in", series:"Fracture", edition:"", badge:"Print", badgeTone:"ok", blurb:"A faceted profile split along an algorithmic seam — low-poly geometry pressed into paper.", params:"seed 0311 · faces 2,048", image:"assets/works/fracture-head.jpg", medium:"Mixed media on fine art paper", workflow:"Fracture physics · UV mapping", tools:"Rhino · Grasshopper · Blender · DrawingBot v3", analog:"Spray paint · CNC pen plotter", details:[{label:"Facets",size:"230%",pos:"50% 35%"},{label:"Seam",size:"230%",pos:"55% 62%"}] },
    { id:"self-portrait", title:"Self Portrait", year:2024, dims:"18 × 22 in", series:"Linework", edition:"", badge:"Original — not for sale", badgeTone:"neutral", blurb:"One continuous plotter path builds density into likeness — thousands of strokes, a single gesture.", params:"seed 0006 · path 1 · length 214 m", image:"assets/works/self-portrait.jpg", medium:"White ink on archival paper", workflow:"3D scanning · datamoshing", tools:"Rhino · Grasshopper", analog:"AxiDraw", details:[{label:"Weave",size:"240%",pos:"52% 30%"},{label:"Strokes",size:"240%",pos:"45% 60%"}] },
    // ---- New intake (drop sheet) — copy is a first pass; edit via Admin or the rework ----
    { id:"dazzle-mass", title:"Dazzle Mass", year:2025, dims:"25 × 31 in", series:"Dazzle", edition:"", badge:"Print", badgeTone:"ok", blurb:"A gridded volume carved into a figure — the cut faces flashing dazzle pattern where the form breaks.", params:"seed —— · faces —— · grid 16px", image:"assets/works/new/ee-work-01-main.webp", medium:"Archival pigment on fine art paper", workflow:"Faceted geometry · dazzle mapping", tools:"Rhino · Grasshopper · Blender", analog:"Archival inkjet", mockupImage:"assets/works/new/ee-work-01-mockup.webp", detailImages:["assets/works/new/ee-work-01-detail-1.webp","assets/works/new/ee-work-01-detail-2.webp"], details:[{label:"Facets",img:"assets/works/new/ee-work-01-detail-1.webp",size:"220%",pos:"50% 30%"},{label:"Pattern",img:"assets/works/new/ee-work-01-detail-2.webp",size:"220%",pos:"45% 65%"}] },
    { id:"disassembly", title:"Disassembly", year:2025, dims:"25 × 31 in", series:"Voxel Field", edition:"", badge:"Print", badgeTone:"ok", blurb:"An isometric mass drawn block by block on graph paper, its edges shaking loose into fragments.", params:"seed —— · blocks —— · iso 30°", image:"assets/works/new/ee-work-02-main.webp", medium:"Ink on graph paper", workflow:"Voxel decomposition · plotter path", tools:"Rhino · Grasshopper · DrawingBot v3", analog:"CNC pen plotter", mockupImage:"assets/works/new/ee-work-02-mockup.webp", detailImages:["assets/works/new/ee-work-02-detail-1.webp"], details:[{label:"Blocks",img:"assets/works/new/ee-work-02-detail-1.webp",size:"220%",pos:"40% 40%"},{label:"Break",size:"220%",pos:"75% 60%"}] },
    { id:"survey-figure", title:"Survey Figure", year:2025, dims:"18 × 40 in", series:"Annotation", edition:"", badge:"Original", badgeTone:"neutral", blurb:"A figure surveyed rather than drawn — thousands of coordinates, angles and tick marks accumulate into a body.", params:"X:—— Y:—— θ:—— · marks ——", image:"assets/works/new/ee-work-03-main.webp", medium:"White ink on black archival paper", workflow:"Point sampling · numeric annotation", tools:"Rhino · Grasshopper", analog:"AxiDraw", mockupImage:"assets/works/new/ee-work-03-mockup.webp", detailImages:["assets/works/new/ee-work-03-detail-1.webp"], details:[{label:"Marks",img:"assets/works/new/ee-work-03-detail-1.webp",size:"230%",pos:"50% 30%"},{label:"Density",size:"230%",pos:"48% 68%"}] },
  ];

  var BASE_EXPERIMENTS = [
    { id:"exp-01", slot:"exp-01", title:"Arrow density", technique:"Vector field", params:"seed 0912 · vectors 1,280" },
    { id:"exp-02", slot:"exp-02", title:"Sort threshold", technique:"Pixel sort", params:"seed 0448 · lum 0.62" },
    { id:"exp-03", slot:"exp-03", title:"Facet count", technique:"Low-poly", params:"seed 0311 · faces 512" },
    { id:"exp-04", slot:"exp-04", title:"Single path", technique:"Plotter linework", params:"seed 0006 · length 38 m" },
    { id:"exp-05", slot:"exp-05", title:"Z-scale study", technique:"Depth extrusion", params:"seed 1147 · z 0.9" },
    { id:"exp-06", slot:"exp-06", title:"Dazzle offset", technique:"Dazzle pattern", params:"seed 2231 · θ 21.7°" },
  ];

  function store() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) { return {}; }
  }
  function writeStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  // Stable image-slot ids so a drop in Admin shows on every page that renders
  // the matching <image-slot>. Each gallery (details / experiments / BTS) has a
  // variable count, 0–4, controlled from Admin.
  function withSlots(w) {
    function clamp(n) { return Math.max(0, Math.min(4, n)); }
    var nd = clamp(w.detailCount != null ? w.detailCount : ((w.details && w.details.length) || 0));
    var nb = clamp(w.btsCount != null ? w.btsCount : 0);
    var ids = function (prefix, n) { var a = []; for (var i = 0; i < n; i++) a.push(prefix + "-" + w.id + "-" + (i + 1)); return a; };
    return Object.assign({}, w, {
      detailCount: nd, btsCount: nb,
      mainId: "main-" + w.id,
      mockupId: "mockup-" + w.id,
      detailIds: ids("detail", nd),
      btsIds: ids("bts", nb),
    });
  }

  // Effective catalogue: base works + admin-added works, each merged with any
  // saved copy overrides, then decorated with stable slot ids.
  function loadWorks() {
    var s = store();
    var ov = s.works || {};
    var added = s.added || [];
    var all = BASE_WORKS.concat(added);
    return all.map(function (w) {
      return withSlots(Object.assign({}, w, ov[w.id] || {}));
    });
  }

  function slugify(t) {
    return (t || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
  }
  function addWork(partial) {
    var s = store();
    s.added = s.added || [];
    var base = slugify(partial && partial.title ? partial.title : "new-work");
    var id = base, n = 2;
    var taken = BASE_WORKS.map(function (w) { return w.id; })
      .concat(s.added.map(function (w) { return w.id; }));
    while (taken.indexOf(id) !== -1) { id = base + "-" + (n++); }
    var work = Object.assign({
      id: id, title: "Untitled", year: new Date().getFullYear(), dims: "25 \u00d7 31 in",
      series: "", edition: "", badge: "Print", badgeTone: "ok", blurb: "", params: "",
      status: "Available", exhibitions: "",
      image: "", medium: "", workflow: "", tools: "", analog: "", details: [], videoUrl: "",
    }, partial || {}, { id: id });
    s.added.push(work);
    writeStore(s);
    return id;
  }
  function deleteWork(id) {
    var s = store();
    if (s.added) s.added = s.added.filter(function (w) { return w.id !== id; });
    if (s.works) delete s.works[id];
    writeStore(s);
  }
  function saveField(id, field, value) {
    var s = store();
    // Added works store their fields inline; base works store copy overrides.
    var inAdded = (s.added || []).some(function (w) { return w.id === id; });
    if (inAdded) {
      s.added = s.added.map(function (w) {
        if (w.id !== id) return w;
        var nw = Object.assign({}, w); nw[field] = value; return nw;
      });
    } else {
      s.works = s.works || {};
      s.works[id] = Object.assign({}, s.works[id] || {}, (function () { var o = {}; o[field] = value; return o; })());
    }
    writeStore(s);
  }
  function isAdded(id) {
    return (store().added || []).some(function (w) { return w.id === id; });
  }

  // ---- Experiments: a separate catalogue with the same add/edit/delete features ----
  function loadExperiments() {
    var s = store();
    var ov = s.exps || {};
    var all = BASE_EXPERIMENTS.concat(s.addedExps || []);
    return all.map(function (x, i) {
      var m = Object.assign({}, x, ov[x.id] || {});
      m.no = "EXP." + String(i + 1).padStart(2, "0");
      m.slot = x.slot || ("exp-" + x.id);
      return m;
    });
  }
  function addExperiment(partial) {
    var s = store();
    s.addedExps = s.addedExps || [];
    var base = slugify(partial && partial.title ? partial.title : "new-experiment");
    var id = base, n = 2;
    var taken = BASE_EXPERIMENTS.map(function (x) { return x.id; })
      .concat(s.addedExps.map(function (x) { return x.id; }));
    while (taken.indexOf(id) !== -1) { id = base + "-" + (n++); }
    var exp = Object.assign({ id: id, title: "Untitled test", technique: "", params: "" }, partial || {}, { id: id, slot: "exp-" + id });
    s.addedExps.push(exp);
    writeStore(s);
    return id;
  }
  function deleteExperiment(id) {
    var s = store();
    if (s.addedExps) s.addedExps = s.addedExps.filter(function (x) { return x.id !== id; });
    if (s.exps) delete s.exps[id];
    writeStore(s);
  }
  function saveExpField(id, field, value) {
    var s = store();
    var inAdded = (s.addedExps || []).some(function (x) { return x.id === id; });
    if (inAdded) {
      s.addedExps = s.addedExps.map(function (x) {
        if (x.id !== id) return x;
        var nx = Object.assign({}, x); nx[field] = value; return nx;
      });
    } else {
      s.exps = s.exps || {};
      s.exps[id] = Object.assign({}, s.exps[id] || {}, (function () { var o = {}; o[field] = value; return o; })());
    }
    writeStore(s);
  }
  function isAddedExp(id) {
    return (store().addedExps || []).some(function (x) { return x.id === id; });
  }

  function getWork(id) {
    var list = loadWorks();
    return list.filter(function (w) { return w.id === id; })[0] || list[0];
  }

  function neighbors(id) {
    var list = loadWorks();
    var i = list.map(function (w) { return w.id; }).indexOf(id);
    if (i < 0) i = 0;
    return {
      index: i,
      total: list.length,
      current: list[i],
      prev: list[(i - 1 + list.length) % list.length],
      next: list[(i + 1) % list.length],
    };
  }

  // ---- Site-wide copy (landing + hero pieces), edited from Admin ----
  // Registry of available landing simulations — add future sims here and they
  // appear in Site admin's Landing picker.
  var SIMULATIONS = [
    { id: "vector-field-head", name: "Vector-field head — live particle sim" },
  ];

  var BASE_SITE = {
    heroSim: "vector-field-head",
    heroMode: "Simulation only",
    promo1: "", promo2: "",
    heroHeading: "Digital art grounding in analog output",
    heroIntro: "Generative programs redraw the human head — vector fields, depth extrusions, faceted geometry, continuous plotter paths — then each result is printed into cotton rag. The process is part of the work; every piece opens onto how it was made.",
    tagline: "Marks made by machine · grain made by hand",
    selected1: "fracture-head", selected2: "deep-blue", selected3: "dazzle-dim", selected4: "duality",
    expIntro: "Smaller tests, off-cuts, and studies — the seeds and misfires the finished works grow out of. Unframed, uneditioned, kept as a running log of what the process turns up.",
  };
  var BASE_HERO = [
    { title: "Vector Field", desc: "Arrow-swarm displacement sampled across the head.", pos: "50% 35%", workId: "" },
    { title: "Fracture", desc: "Low-poly faceting split along an algorithmic seam.", pos: "62% 52%", workId: "" },
    { title: "Depth Extrusion", desc: "Height-mapped relief pushed off the plate.", pos: "100% 72%", workId: "" },
    { title: "Pixel Sort", desc: "Tonal bands dragged along the luminance axis.", pos: "30% 92%", workId: "" },
    { title: "Plotter Linework", desc: "One continuous path building density into likeness.", pos: "82% 8%", workId: "" },
  ];
  // Sanitize on read: legacy admin bugs could persist non-string values (e.g. a
  // stored event object). Never let those shadow the string defaults.
  function strOnly(ov) {
    var out = {};
    for (var k in ov) { if (typeof ov[k] === "string" && ov[k].indexOf("[object ") === -1) out[k] = ov[k]; }
    return out;
  }
  function loadSite() { return Object.assign({}, BASE_SITE, strOnly(store().site || {})); }
  function saveSiteField(f, v) { var s = store(); s.site = strOnly(Object.assign({}, s.site || {})); s.site[f] = String(v == null ? "" : v); writeStore(s); }
  function loadHero() {
    var ov = store().hero || {};
    return BASE_HERO.map(function (h, i) { return Object.assign({}, h, strOnly(ov[i] || {})); });
  }
  function saveHeroField(i, f, v) {
    var s = store(); s.hero = s.hero || {};
    s.hero[i] = strOnly(Object.assign({}, s.hero[i] || {}));
    s.hero[i][f] = String(v == null ? "" : v); writeStore(s);
  }

  window.EE_WORKS_DATA = {
    STORE_KEY: STORE_KEY,
    BASE_WORKS: BASE_WORKS,
    loadWorks: loadWorks,
    getWork: getWork,
    neighbors: neighbors,
    addWork: addWork,
    deleteWork: deleteWork,
    saveField: saveField,
    isAdded: isAdded,
    loadExperiments: loadExperiments,
    addExperiment: addExperiment,
    deleteExperiment: deleteExperiment,
    saveExpField: saveExpField,
    isAddedExp: isAddedExp,
    BASE_SITE: BASE_SITE,
    SIMULATIONS: SIMULATIONS,
    BASE_HERO: BASE_HERO,
    loadSite: loadSite,
    saveSiteField: saveSiteField,
    loadHero: loadHero,
    saveHeroField: saveHeroField,
  };
})();
