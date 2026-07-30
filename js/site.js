/* Evan Emery — site behaviour.
   Replaces the Claude-Design React logic class with plain DOM code. Every view
   is already in the HTML (so crawlers and no-JS visitors get real content);
   this only toggles which one is visible and drives the scroll effects. */
(function () {
  "use strict";

  var ROUTES = ["home", "works", "experiments", "workflow", "about"];
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------------- routing ---------------------------------------------- */

  function routeFromUrl() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    if (ROUTES.indexOf(h) !== -1) return h;
    var v = new URLSearchParams(location.search).get("view");
    if (v && ROUTES.indexOf(v) !== -1) return v;
    return "home";
  }

  function show(route, opts) {
    $$("[data-view]").forEach(function (el) {
      el.hidden = el.getAttribute("data-view") !== route;
    });
    $$("[data-route]").forEach(function (a) {
      var on = a.getAttribute("data-route") === route;
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = titleFor(route);
    if (!opts || !opts.silent) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setupReveal();
    setupDraw();
    alignFrames();
  }

  var TITLES = {
    home: "Evan Emery — generative artwork, plotted and printed",
    works: "Works — Evan Emery",
    experiments: "Experiments — Evan Emery",
    workflow: "Workflow — Evan Emery",
    about: "Statement — Evan Emery"
  };
  function titleFor(r) { return TITLES[r] || TITLES.home; }

  function bindNav() {
    $$("[data-route]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        // let modified clicks open a real tab
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        var r = a.getAttribute("data-route");
        if (routeFromUrl() === r) { show(r); return; }
        location.hash = "#/" + r;
      });
    });
    window.addEventListener("hashchange", function () { show(routeFromUrl()); });
  }

  /* ---------------- reveal on scroll -------------------------------------- */

  var revealIO = null, revealFallback = null;

  function setupReveal() {
    var motion = !(window.EE_TWEAKS && window.EE_TWEAKS.motion === false);
    var els = $$("[data-reveal]").filter(function (el) {
      return el.getAttribute("data-shown") !== "1" && !isHidden(el);
    });

    if (!motion || reduce) {
      els.forEach(function (el) { el.setAttribute("data-shown", "1"); });
      return;
    }

    // Safety net: IntersectionObserver can be starved in a background tab.
    // Never leave content invisible.
    clearTimeout(revealFallback);
    revealFallback = setTimeout(function () {
      $$("[data-reveal]").forEach(function (el) {
        if (!isHidden(el)) el.setAttribute("data-shown", "1");
      });
    }, 1400);

    if (revealIO) revealIO.disconnect();
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var d = parseInt(el.getAttribute("data-reveal-delay") || "0", 10);
        el.style.transitionDelay = d + "ms";
        el.setAttribute("data-shown", "1");
        revealIO.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    els.forEach(function (el) { revealIO.observe(el); });
  }

  function isHidden(el) {
    var v = el.closest("[data-view]");
    return !!(v && v.hidden);
  }

  /* ---------------- draw-in rules ----------------------------------------- */

  var drawIO = null;

  function setupDraw() {
    var on = !(window.EE_TWEAKS && window.EE_TWEAKS.drawInRules === false);
    var rules = $$(".ee-draw");
    if (drawIO) drawIO.disconnect();
    if (!on || reduce) {
      rules.forEach(function (el) { el.setAttribute("data-drawn", "1"); });
      return;
    }
    drawIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.setAttribute("data-drawn", "1");
        drawIO.unobserve(e.target);
      });
    }, { threshold: 0.25 });
    rules.forEach(function (el) {
      if (el.getAttribute("data-drawn") !== "1") drawIO.observe(el);
    });
  }

  /* ---------------- scroll FX rail ---------------------------------------- */

  function setupScrollFx() {
    var bar = $("#ee-progress");
    var shell = $("[data-ee-shell]");
    var nav = $("#ee-nav");
    var parEls = $$("[data-parallax]");
    var lastY = window.scrollY, vel = 0, navScrolled = -1;

    function tick() {
      var p = window.EE_TWEAKS || {};
      var doc = document.documentElement;
      var max = (doc.scrollHeight - window.innerHeight) || 1;
      var y = window.scrollY;
      var frac = Math.max(0, Math.min(1, y / max));

      if (bar) bar.style.width = (frac * 100).toFixed(1) + "%";

      var scrolled = y > 8 ? 1 : 0;
      if (nav && scrolled !== navScrolled) { navScrolled = scrolled; nav.setAttribute("data-scrolled", String(scrolled)); }

      // chromatic misregistration widens with scroll velocity
      var baseCA = parseFloat(p.chromaAberration) || 0;
      vel = vel * 0.82 + Math.abs(y - lastY) * 0.18;
      lastY = y;
      if (shell && baseCA > 0 && !reduce) {
        var dyn = Math.min(1, vel / 46);
        shell.style.setProperty("--ee-ca", (baseCA * (0.5 + dyn * 1.7)).toFixed(2) + "px");
      }

      var par = (p.scrollParallax !== false) && !reduce;
      parEls.forEach(function (el) {
        if (!par) { el.style.transform = ""; return; }
        var s = parseFloat(el.getAttribute("data-parallax")) || 0;
        var r = el.getBoundingClientRect();
        var mid = r.top + r.height / 2 - window.innerHeight / 2;
        el.style.transform = "translate3d(0," + (mid * s).toFixed(1) + "px,0)";
      });

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- nav height (mobile hero sizes to one viewport) --------- */

  function trackNavHeight() {
    var nav = $("#ee-nav");
    if (!nav) return;
    var last = -1;
    function set() {
      var h = nav.offsetHeight;
      if (h === last) return;
      last = h;
      document.documentElement.style.setProperty("--ee-nav-h", h + "px");
    }
    set();
    [200, 800, 2000].forEach(function (ms) { setTimeout(set, ms); });
    try {
      new ResizeObserver(function () { requestAnimationFrame(set); }).observe(nav);
    } catch (e) { window.addEventListener("resize", set); }
  }

  /* ---------------- works filtering --------------------------------------- */

  // The grid is pre-rendered in the HTML; filtering only hides cards, so the
  // markup a crawler sees is always the full catalogue.
  function setupFilters() {
    var grid = $("#ee-works-grid");
    var chipRow = $("#ee-chips");
    if (!grid || !chipRow) return;
    var cards = $$("[data-work]", grid);
    var dim = "Category", filter = "All";

    function valuesOf(card) {
      var raw = card.getAttribute("data-" + dim.toLowerCase()) || "";
      return raw.split("|").map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function renderChips() {
      var seen = [];
      cards.forEach(function (c) {
        valuesOf(c).forEach(function (v) { if (seen.indexOf(v) === -1) seen.push(v); });
      });
      chipRow.textContent = "";
      ["All"].concat(seen).forEach(function (name) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "ee-tag" + (name === filter ? " ee-tag--solid" : "");
        b.textContent = name;
        b.setAttribute("aria-pressed", String(name === filter));
        b.addEventListener("click", function () { filter = name; renderChips(); applyFilter(); });
        chipRow.appendChild(b);
      });
    }

    function applyFilter() {
      var shown = 0;
      cards.forEach(function (c) {
        var on = filter === "All" || valuesOf(c).indexOf(filter) !== -1;
        c.hidden = !on;
        if (on) { c.setAttribute("data-reveal-delay", String((shown % 3) * 90)); shown++; }
      });
      var count = $("#ee-works-count");
      if (count) count.textContent = "Catalogue · " + shown + " works";
      setupReveal();
      alignFrames();
    }

    $$("[data-dim]").forEach(function (b) {
      b.addEventListener("click", function () {
        dim = b.getAttribute("data-dim");
        filter = "All";
        $$("[data-dim]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
        renderChips();
        applyFilter();
      });
    });

    renderChips();
    applyFilter();
  }

  /* ---------------- align landscape frames with portrait frames ----------- */

  // A landscape work spans two cells and is shown at its own aspect, so its
  // plate height cannot be derived in CSS from the column width. Match it to a
  // portrait plate in the same row so every frame in the row lines up.
  // Both the works grid and the home carousel lay portrait and landscape works
  // side by side.
  var FRAME_CONTAINERS = ["#ee-works-grid", "#ee-selscroll"];

  function alignContainer(grid) {
    if (!grid || isHidden(grid)) return;
    var wide = $$('[data-orient="landscape"] .plate', grid);
    if (!wide.length) return;

    // A portrait plate's height comes from the column width alone, so it can be
    // measured without first clearing the landscape height — and not clearing
    // keeps this from fighting the ResizeObserver that its own writes trigger.
    var ref = $('[data-orient="portrait"] .plate', grid);
    if (!ref) return;
    var h = Math.round(ref.getBoundingClientRect().height);
    if (!h) return;

    wide.forEach(function (p) {
      if (p._eeH === h) return;   // idempotent: no write, no resize feedback
      p._eeH = h;
      p.style.height = h + "px";
      p.style.width = "auto";
    });

    // The caption tracks the mat's width so its badge sits on the artwork's
    // right edge, the same as on a portrait card.
    $$('[data-orient="landscape"]', grid).forEach(function (card) {
      var mat = $(".mat", card), cap = $("figcaption", card);
      if (!mat || !cap) return;
      var w = Math.round(mat.getBoundingClientRect().width);
      if (!w || cap._eeW === w) return;
      cap._eeW = w;
      cap.style.width = w + "px";
    });
  }

  function alignFrames() {
    FRAME_CONTAINERS.forEach(function (sel) { alignContainer($(sel)); });
  }

  function watchFrames() {
    var any = false;
    FRAME_CONTAINERS.forEach(function (sel) {
      var grid = $(sel);
      if (!grid) return;
      any = true;
      try {
        new ResizeObserver(function () { requestAnimationFrame(alignFrames); }).observe(grid);
      } catch (e) { /* fall back to the resize listener below */ }
    });
    if (!any) return;
    alignFrames();
    // re-measure once images have real boxes
    window.addEventListener("load", alignFrames);
    window.addEventListener("resize", alignFrames);
  }

  /* ---------------- selected-works carousel ------------------------------- */

  function setupCarousel() {
    var row = $("#ee-selscroll");
    if (!row) return;
    $$("[data-sel-scroll]").forEach(function (b) {
      b.addEventListener("click", function () {
        var dir = b.getAttribute("data-sel-scroll") === "next" ? 1 : -1;
        row.scrollBy({ left: dir * row.clientWidth, behavior: "smooth" });
      });
    });

    // Show the arrows whenever the row actually overflows. A landscape work
    // spans two cells, so four works can overflow just as six would.
    var nav = $("#ee-selnav");
    function syncNav() {
      if (!nav) return;
      var overflows = row.scrollWidth - row.clientWidth > 4;
      nav.hidden = !overflows;
      nav.style.display = overflows ? "flex" : "none";
    }
    syncNav();
    window.addEventListener("load", syncNav);
    window.addEventListener("resize", syncNav);
    try {
      new ResizeObserver(function () { requestAnimationFrame(syncNav); }).observe(row);
    } catch (e) { /* resize listener above is the fallback */ }
  }

  /* ---------------- hero cues --------------------------------------------- */

  function setupHeroCue() {
    var cue = $("#ee-orbit-cue");
    var canvas = $("#ee-hero-canvas");
    if (!cue || !canvas) return;
    var hide = function () {
      cue.setAttribute("data-hide", "1");
      canvas.removeEventListener("pointerdown", hide);
    };
    canvas.addEventListener("pointerdown", hide, { once: true });
    setTimeout(hide, 12000);
  }

  /* ---------------- boot --------------------------------------------------- */

  function boot() {
    bindNav();
    trackNavHeight();
    setupFilters();
    watchFrames();
    setupCarousel();
    setupHeroCue();
    show(routeFromUrl(), { silent: true });
    setupScrollFx();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
