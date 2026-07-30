/* Evan Emery — local content admin.
   Edits the same localStorage overlay that works-data.js merges on read, so the
   preview matches the live layout exactly. It cannot publish: the deployed site
   is static. The Export buttons emit files to commit. The unfinished "Import
   simulations" flow from the original Admin page is deliberately not carried
   over — it never worked. */
(function () {
  "use strict";

  var D = window.EE_WORKS_DATA;
  if (!D) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("a-toast");
    t.textContent = msg;
    t.setAttribute("data-on", "1");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.removeAttribute("data-on"); }, 2200);
  }

  /* ---------------- tabs -------------------------------------------------- */

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".a-tab"));
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute("aria-selected", String(on));
        document.getElementById(o.getAttribute("aria-controls")).hidden = !on;
      });
    });
  });

  /* ---------------- field builder ----------------------------------------- */

  function field(label, value, opts, onInput) {
    var wrap = el("div", "a-f" + (opts && opts.wide ? " wide" : ""));
    var id = "f-" + Math.random().toString(36).slice(2, 9);
    var lab = el("label", null, label);
    lab.setAttribute("for", id);
    var input = document.createElement(opts && opts.multi ? "textarea" : "input");
    input.id = id;
    input.value = value == null ? "" : value;
    input.addEventListener("input", function () { onInput(input.value); });
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  /* ---------------- works ------------------------------------------------- */

  var WORK_FIELDS = [
    ["title", "Title"], ["series", "Series"], ["year", "Year"], ["dims", "Dimensions"],
    ["medium", "Medium"], ["edition", "Edition"], ["badge", "Badge"],
    ["workflow", "Workflow"], ["tools", "Tools"], ["analog", "Analog output"],
    ["params", "Parameters"], ["image", "Main image path"], ["mockupImage", "Mockup image path"]
  ];

  function renderWorks() {
    var panel = document.getElementById("p-works");
    panel.textContent = "";
    D.loadWorks().forEach(function (w) {
      var card = el("div", "a-card");
      card.appendChild(el("h3", null, w.title + " · " + w.year));
      var grid = el("div", "a-fields");
      WORK_FIELDS.forEach(function (f) {
        grid.appendChild(field(f[1], w[f[0]], null, function (v) {
          D.saveField(w.id, f[0], v);
        }));
      });
      grid.appendChild(field("Blurb", w.blurb, { multi: true, wide: true }, function (v) {
        D.saveField(w.id, "blurb", v);
      }));
      card.appendChild(grid);
      panel.appendChild(card);
    });
  }

  /* ---------------- experiments ------------------------------------------- */

  function renderExps() {
    var panel = document.getElementById("p-exps");
    panel.textContent = "";
    D.loadExperiments().forEach(function (x) {
      var card = el("div", "a-card");
      card.appendChild(el("h3", null, x.no + " · " + x.title));
      var grid = el("div", "a-fields");
      [["title", "Title"], ["technique", "Technique"], ["params", "Parameters"]].forEach(function (f) {
        grid.appendChild(field(f[1], x[f[0]], null, function (v) {
          D.saveExpField(x.id, f[0], v);
        }));
      });
      card.appendChild(grid);
      panel.appendChild(card);
    });
  }

  /* ---------------- site copy ---------------------------------------------- */

  var SITE_FIELDS = [
    ["heroHeading", "Hero heading", { wide: true }],
    ["heroIntro", "Hero intro", { multi: true, wide: true }],
    ["tagline", "Tagline (footer + margin)", { wide: true }],
    ["expIntro", "Experiments intro", { multi: true, wide: true }],
    ["selected1", "Selected work 1 (id)"], ["selected2", "Selected work 2 (id)"],
    ["selected3", "Selected work 3 (id)"], ["selected4", "Selected work 4 (id)"]
  ];

  function renderSite() {
    var panel = document.getElementById("p-site");
    panel.textContent = "";
    var s = D.loadSite();
    var card = el("div", "a-card");
    card.appendChild(el("h3", null, "Landing + shared copy"));
    var grid = el("div", "a-fields");
    SITE_FIELDS.forEach(function (f) {
      grid.appendChild(field(f[1], s[f[0]], f[2], function (v) { D.saveSiteField(f[0], v); }));
    });
    card.appendChild(grid);

    var ids = el("div", "a-group");
    ids.appendChild(el("h4", null, "Available work ids"));
    ids.appendChild(el("p", "ee-note", D.loadWorks().map(function (w) { return w.id; }).join(" · ")));
    card.appendChild(ids);

    panel.appendChild(card);
  }

  /* ---------------- hero tuning -------------------------------------------- */

  // Mirrors the tweak groups from the original export's props panel.
  var HERO_GROUPS = [
    ["Timing", [
      ["introRampSeconds", "range", 1, 15, 0.5], ["introDriftSeconds", "range", 0, 40, 1],
      ["breatheCycleSeconds", "range", 0, 90, 1], ["breatheMinTrails", "range", 0, 0.95, 0.05],
      ["breatheGrowShare", "range", 0.1, 0.9, 0.05], ["breatheHoldShare", "range", 0, 0.45, 0.01],
      ["breatheStagger", "range", 0, 1, 0.05], ["simSpeed", "range", 0.02, 4, 0.02],
      ["orbitSpeed", "range", 0, 3, 0.1]
    ]],
    ["Colors", [
      ["headColor", "color"], ["particleColor", "color"], ["wireColor", "color"],
      ["bgGridColor", "color"], ["paperColor", "color"]
    ]],
    ["Camera", [
      ["cameraFov", "range", 20, 90, 1], ["headYawDeg", "range", -180, 180, 1],
      ["headPitchDeg", "range", -30, 30, 1], ["motionBlur", "range", 0, 0.92, 0.02],
      ["pathSmoothing", "range", 0, 1, 0.05]
    ]],
    ["Head", [
      ["showHead", "bool"], ["headStyle", "enum", ["shaded", "silhouette"]],
      ["headOpacity", "range", 0, 1, 0.05], ["headShade", "range", 0, 1, 0.05],
      ["showWireframe", "bool"], ["wireOpacity", "range", 0, 0.6, 0.02],
      ["wireShading", "range", 0, 0.5, 0.02]
    ]],
    ["Particles", [
      ["particleCount", "range", 200, 4000, 100], ["trailLength", "range", 2, 400, 2],
      ["particleSize", "range", 0.02, 0.16, 0.005], ["swarmStrength", "range", 0, 3, 0.1],
      ["attraction", "range", 0.2, 3, 0.1], ["mouseForce", "range", 0, 3, 0.1],
      ["leaveRate", "range", 0, 3, 0.1], ["flightRange", "range", 0.4, 3, 0.1],
      ["linkDistance", "range", 0, 0.5, 0.01]
    ]],
    ["Background", [
      ["bgGrid", "bool"], ["bgIntensity", "range", 0, 2.5, 0.1],
      ["bgSpacing", "range", 18, 160, 4], ["bgDistort", "range", 0, 1, 0.05],
      ["bgMajorLines", "bool"], ["bgNodeStyle", "enum", ["sphere", "cross"]],
      ["bgMouseRadius", "range", 40, 600, 10], ["bgMouseForce", "range", 0, 3, 0.1]
    ]],
    ["Page", [
      ["pageBg", "enum", ["grid", "paper", "paper-grid"]],
      ["navStyle", "enum", ["paper", "contrast", "ink"]],
      ["frameStyle", "enum", ["black", "oak", "walnut"]],
      ["wallTone", "enum", ["plaster", "concrete", "warm"]],
      ["paperTexture", "range", 0, 1, 0.05], ["simGrain", "range", 0, 1, 0.05],
      ["filmGrain", "bool"], ["grainIntensity", "range", 0, 1, 0.05],
      ["cropMarks", "bool"], ["chromaAberration", "range", 0, 12, 0.5],
      ["halftone", "bool"], ["marginalia", "bool"], ["scrollProgress", "bool"],
      ["bigNumerals", "bool"], ["scrollParallax", "bool"], ["drawInRules", "bool"],
      ["stickyWorkflow", "bool"]
    ]]
  ];

  var FX_KEY = "ee_fx_v2";
  function fx() {
    try { return JSON.parse(localStorage.getItem(FX_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function setFx(k, v) {
    var o = fx(); o[k] = v;
    localStorage.setItem(FX_KEY, JSON.stringify(o));
    window.EE_APPLY_TWEAKS();
  }

  function renderHero() {
    var panel = document.getElementById("p-hero");
    panel.textContent = "";

    var note = el("div", "a-card");
    note.appendChild(el("h3", null, "Live hero tuning"));
    var p = el("p", "ee-note",
      "Every value is hot: hero-field.js re-reads the config each frame, so the "
      + "simulation never restarts. Only particle count and trail length rebuild "
      + "buffers. Tune here, then press Export hero preset and paste the result "
      + "into the TWEAKS object in js/site-config.js to make it the shipped default.");
    note.appendChild(p);
    panel.appendChild(note);

    var cur = Object.assign({}, window.EE_DEFAULT_TWEAKS, fx());

    HERO_GROUPS.forEach(function (g) {
      var card = el("div", "a-card");
      card.appendChild(el("h3", null, g[0]));
      g[1].forEach(function (spec) {
        var key = spec[0], kind = spec[1];
        var row = el("div", "a-slider");
        row.appendChild(el("label", null, key));

        var input, out = el("output");

        if (kind === "range") {
          input = document.createElement("input");
          input.type = "range";
          input.min = spec[2]; input.max = spec[3]; input.step = spec[4];
          input.value = cur[key];
          out.textContent = cur[key];
          input.addEventListener("input", function () {
            var v = parseFloat(input.value);
            out.textContent = String(v);
            setFx(key, v);
          });
        } else if (kind === "color") {
          input = document.createElement("input");
          input.type = "color";
          input.value = cur[key];
          out.textContent = cur[key];
          input.addEventListener("input", function () {
            out.textContent = input.value;
            setFx(key, input.value);
          });
        } else if (kind === "bool") {
          input = document.createElement("input");
          input.type = "checkbox";
          input.checked = !!cur[key];
          out.textContent = cur[key] ? "on" : "off";
          input.addEventListener("change", function () {
            out.textContent = input.checked ? "on" : "off";
            setFx(key, input.checked);
          });
        } else {
          input = document.createElement("select");
          spec[2].forEach(function (o) {
            var op = document.createElement("option");
            op.value = o; op.textContent = o;
            if (o === cur[key]) op.selected = true;
            input.appendChild(op);
          });
          out.textContent = cur[key];
          input.addEventListener("change", function () {
            out.textContent = input.value;
            setFx(key, input.value);
          });
        }

        input.setAttribute("aria-label", key);
        row.appendChild(input);
        row.appendChild(out);
        card.appendChild(row);
      });
      panel.appendChild(card);
    });
  }

  /* ---------------- export ------------------------------------------------- */

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function js(v) { return JSON.stringify(v); }

  var WORK_KEYS = ["id", "title", "year", "dims", "series", "edition", "badge", "badgeTone",
    "blurb", "params", "image", "medium", "workflow", "tools", "analog",
    "mockupImage", "detailImages", "details"];

  document.getElementById("a-export").addEventListener("click", function () {
    var works = D.loadWorks().map(function (w) {
      var o = {};
      WORK_KEYS.forEach(function (k) {
        if (w[k] !== undefined && w[k] !== "" && !(Array.isArray(w[k]) && !w[k].length)) o[k] = w[k];
      });
      return o;
    });
    var exps = D.loadExperiments().map(function (x) {
      return { id: x.id, slot: x.slot, title: x.title, technique: x.technique, params: x.params };
    });
    var site = D.loadSite();

    var src = document.getElementById("a-source").textContent
      .replace("/*__WORKS__*/", works.map(function (w) { return "    " + js(w); }).join(",\n"))
      .replace("/*__EXPS__*/", exps.map(function (x) { return "    " + js(x); }).join(",\n"))
      .replace("/*__SITE__*/", js(site));

    download("works-data.js", src, "text/javascript");
    toast("works-data.js downloaded");
  });

  document.getElementById("a-export-fx").addEventListener("click", function () {
    var merged = Object.assign({}, window.EE_DEFAULT_TWEAKS, fx());
    download("hero-preset.json", JSON.stringify(merged, null, 2), "application/json");
    toast("hero-preset.json downloaded");
  });

  document.getElementById("a-reset").addEventListener("click", function () {
    if (!window.confirm("Discard every local edit (content and hero tuning) in this browser?")) return;
    localStorage.removeItem(D.STORE_KEY);
    localStorage.removeItem(FX_KEY);
    window.EE_APPLY_TWEAKS();
    renderWorks(); renderExps(); renderSite(); renderHero();
    toast("Local edits discarded");
  });

  renderWorks();
  renderExps();
  renderSite();
  renderHero();
})();
