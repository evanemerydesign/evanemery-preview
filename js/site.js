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
  /* ---------------- justified rows ----------------------------------------- */

  // Canonical plate ratios, matching the stylesheet.
  var AR = { portrait: 3 / 4, landscape: 4 / 3 };
  var JUSTIFIED = ["#ee-works-grid", "#ee-selscroll"];

  function ratioOf(card) {
    return AR[card.getAttribute("data-orient")] || AR.portrait;
  }

  // Horizontal chrome around the plate: the mat's left+right padding.
  function matInset(card) {
    var mat = $(".mat", card);
    if (!mat) return 0;
    var cs = getComputedStyle(mat);
    return (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  }

  // Solve each row's height so the row exactly fills the container:
  //   sum(ratio_i) * H + sum(inset_i) + gaps = width
  // Widths then follow from the canonical ratios, so nothing is cropped beyond
  // the 3:4 / 4:3 fit and no row is left with a gap. Rows are filled in
  // catalogue order — sequence is never rearranged.
  function justify(container) {
    if (!container || isHidden(container)) return;
    var cards = $$(".ee-artcard", container).filter(function (c) { return !c.hidden; });
    if (!cards.length) return;

    var cs = getComputedStyle(container);
    var gap = parseFloat(cs.columnGap) || 0;
    var width = container.clientWidth;
    if (!width) return;

    var target = targetHeight(container);

    // The carousel is one row. If the whole selection fits, justify it so it
    // fills the width like any other row; if there are too many works for that,
    // fall back to the target height and let it scroll.
    if (cs.overflowX === "auto" || cs.overflowX === "scroll") {
      var ratioSum = 0, insetSum = 0;
      cards.forEach(function (c) { ratioSum += ratioOf(c); insetSum += matInset(c); });
      // On a phone the rail shows about one work at a time. Size a portrait
      // work to 86% of the rail, as the original design did, so the card reads
      // large and the next one peeks. A landscape work is capped to the rail so
      // it stays fully visible, which makes it the shorter card here — the
      // trade for never cropping.
      if (width < 620) {
        var hPortrait = (width * 0.86 - matInset(cards[0])) / AR.portrait;
        cards.forEach(function (c) {
          setCardWidth(c, Math.min(ratioOf(c) * hPortrait + matInset(c), width));
        });
        return;
      }

      // Stretch to fill when the selection is small enough to fit; otherwise
      // hold the same plate height as the works grid and let the row scroll,
      // so a work is never shown smaller here than it is on the works page.
      var fit = (width - insetSum - gap * (cards.length - 1)) / ratioSum;
      var h = Math.max(fit, target);

      // No card may be wider than the rail itself.
      var cap = Infinity;
      cards.forEach(function (c) {
        cap = Math.min(cap, (width - matInset(c)) / ratioOf(c));
      });
      h = Math.min(h, cap);
      cards.forEach(function (c) { setCardWidth(c, ratioOf(c) * h + matInset(c)); });
      return;
    }

    // On a phone every work gets its own full-width row, as it did before the
    // justified layout — no solving needed.
    if (width < 620) {
      cards.forEach(function (c) { setCardWidth(c, width); });
      return;
    }

    // Row breaks are solved, not guessed. Each full row is justified to fill the
    // width exactly; a trailing part-row keeps close to the target height and is
    // allowed to leave space at the end. Consistent height across rows matters
    // more than filling the final row.
    //
    // Scales to any catalogue size: the search is over candidate heights, not
    // over arrangements, so adding works costs one linear pass each.
    var TRAIL_CAP = 1.15;   // a part-row may stretch this far to close a near-fit
    var specs = cards.map(function (c) { return { ratio: ratioOf(c), inset: matInset(c) }; });

    function pack(t) {
      var rows = [], row = [], sr = 0, si = 0;
      specs.forEach(function (sp, i) {
        // Close the row *before* adding this work if that lands nearer the
        // target height. Without this the row always keeps the work that
        // tipped it over, which on a narrow screen crushes two works into a
        // row that should hold one.
        if (row.length) {
          var withNew = (width - (si + sp.inset) - gap * row.length) / (sr + sp.ratio);
          var without = (width - si - gap * (row.length - 1)) / sr;
          if (Math.abs(without - t) < Math.abs(withNew - t)) {
            rows.push({ idx: row, ratio: sr, inset: si, full: true });
            row = []; sr = 0; si = 0;
          }
        }
        row.push(i); sr += sp.ratio; si += sp.inset;
        if (sr * t + si + gap * (row.length - 1) >= width) {
          rows.push({ idx: row, ratio: sr, inset: si, full: true });
          row = []; sr = 0; si = 0;
        }
      });
      if (row.length) rows.push({ idx: row, ratio: sr, inset: si, full: false });

      var lastFull = 0;
      rows.forEach(function (r) {
        var avail = width - r.inset - gap * (r.idx.length - 1);
        var solved = avail / r.ratio;
        if (r.full) {
          r.h = solved;
          r.waste = 0;
          lastFull = solved;
        } else {
          // A trailing row never stands taller than the row above it. It may
          // stretch to close a near-fit, but a lone work is shown at the same
          // height as its neighbours and simply leaves space at the end.
          var ceiling = lastFull || t * TRAIL_CAP;
          r.h = Math.min(solved, ceiling);
          r.waste = 1 - (r.ratio * r.h + r.inset + gap * (r.idx.length - 1)) / width;
        }
      });
      return rows;
    }

    function score(rows) {
      // Consistency is judged across every row, including the trailing one,
      // because an outsized final row is exactly what we are avoiding.
      var hs = rows.map(function (r) { return r.h; });
      var spread = Math.max.apply(null, hs) / Math.min.apply(null, hs);
      var avg = hs.reduce(function (a, h) { return a + h; }, 0) / hs.length;
      // Without a size term the search degenerates: more works per row always
      // wastes less, so it would shrink the artwork indefinitely.
      var drift = Math.abs(avg - target) / target;
      // Trailing space is acceptable, so it only breaks ties.
      var waste = rows.reduce(function (a, r) { return a + r.waste; }, 0);
      return (spread - 1) * 40 + drift * 34 + waste * 6;
    }

    var best = null;
    for (var f = 0.82; f <= 1.28; f += 0.015) {   // keep plates near the intended size
      var candidate = pack(target * f);
      var sc = score(candidate);
      if (!best || sc < best.score) best = { rows: candidate, score: sc };
    }

    best.rows.forEach(function (r) {
      r.idx.forEach(function (i) {
        setCardWidth(cards[i], specs[i].ratio * r.h + specs[i].inset);
      });
    });
  }

  function setCardWidth(card, w) {
    w = Math.floor(w * 100) / 100;
    if (card._eeW === w) return;      // idempotent: no write, no resize feedback
    card._eeW = w;
    card.style.width = w + "px";
  }

  // Tall enough to read, and for the works grid short enough that the first row
  // clears the fold. Measured from the container's position on the page.
  function targetHeight(container) {
    var base = Math.min(520, Math.max(300, window.innerHeight * 0.46));
    if (container.id !== "ee-works-grid") return Math.round(base);
    var top = container.getBoundingClientRect().top;
    var toFold = window.innerHeight - top - 150;   // caption + mat + breathing room
    return Math.round(Math.min(base, Math.max(260, toFold)));
  }

  function alignFrames() {
    JUSTIFIED.forEach(function (sel) { justify($(sel)); });
  }

  function watchFrames() {
    var any = false;
    JUSTIFIED.forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      any = true;
      try {
        new ResizeObserver(function () { requestAnimationFrame(alignFrames); }).observe(el.parentNode || el);
      } catch (e) { /* the resize listener below is the fallback */ }
    });
    if (!any) return;
    alignFrames();
    window.addEventListener("load", alignFrames);
    window.addEventListener("resize", alignFrames);
  }

  /* ---------------- selected-works carousel ------------------------------- */

  function setupCarousel() {
    var row = $("#ee-selscroll");
    if (!row) return;
    var rail = $("#ee-rail"), nav = $("#ee-selnav");
    var thumb = $("#ee-railbar-thumb"), hint = $("#ee-railhint"), count = $("#ee-railcount");
    var cards = $$(".ee-artcard", row);

    $$("[data-sel-scroll]").forEach(function (b) {
      b.addEventListener("click", function () {
        var dir = b.getAttribute("data-sel-scroll") === "next" ? 1 : -1;
        row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: "smooth" });
        markUsed();
      });
    });

    function markUsed() { if (hint) hint.setAttribute("data-used", "1"); }
    row.addEventListener("pointerdown", markUsed, { once: true });
    row.addEventListener("wheel", markUsed, { once: true, passive: true });

    function sync() {
      var max = row.scrollWidth - row.clientWidth;
      var overflows = max > 4;

      if (nav) {
        nav.hidden = !overflows;
        nav.style.display = overflows ? "flex" : "none";
      }
      var foot = $(".ee-railfoot");
      if (foot) foot.style.display = overflows ? "flex" : "none";
      if (!overflows) {
        if (rail) { rail.setAttribute("data-at-start", "1"); rail.setAttribute("data-at-end", "1"); }
        return;
      }

      var x = row.scrollLeft;
      var atStart = x <= 2, atEnd = x >= max - 2;
      if (rail) {
        rail.setAttribute("data-at-start", atStart ? "1" : "0");
        rail.setAttribute("data-at-end", atEnd ? "1" : "0");
      }
      $$("[data-sel-scroll]").forEach(function (b) {
        var isNext = b.getAttribute("data-sel-scroll") === "next";
        b.disabled = isNext ? atEnd : atStart;
      });

      if (thumb) {
        // Thumb width is the visible fraction; its offset, expressed relative to
        // its own width, is simply how many viewports along we have scrolled.
        thumb.style.width = (row.clientWidth / row.scrollWidth * 100) + "%";
        thumb.style.transform = "translateX(" + (x / row.clientWidth * 100) + "%)";
      }
      if (count && cards.length) {
        // Which work sits at the left edge of the viewport.
        var first = 1;
        for (var i = 0; i < cards.length; i++) {
          if (cards[i].offsetLeft - row.offsetLeft <= x + 8) first = i + 1;
        }
        count.textContent = String(first).padStart(2, "0") + " / " + String(cards.length).padStart(2, "0");
      }
    }

    row.addEventListener("scroll", function () { requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener("resize", sync);
    window.addEventListener("load", sync);
    try {
      new ResizeObserver(function () { requestAnimationFrame(sync); }).observe(row);
    } catch (e) { /* the resize listener above is the fallback */ }

    // Watch the scroll offset directly rather than trusting the scroll event:
    // momentum scrolling and snap can coalesce or drop it, and the rail state
    // must never disagree with what is on screen. One comparison per frame.
    var seen = -1;
    (function watch() {
      if (row.scrollLeft !== seen) { seen = row.scrollLeft; sync(); }
      requestAnimationFrame(watch);
    })();

    sync();
  }

  /* ---------------- hero cues --------------------------------------------- */

  function setupHeroCue() {
    var canvas = $("#ee-hero-canvas");
    var orbit = $("#ee-orbit-cue");
    var scroll = $("#ee-scrollcue");

    if (orbit && canvas) {
      var hideOrbit = function () { orbit.setAttribute("data-hide", "1"); };
      canvas.addEventListener("pointerdown", hideOrbit, { once: true });
      setTimeout(hideOrbit, 12000);
    }

    // The scroll cue is the one that matters on a phone: retire it as soon as
    // the visitor actually scrolls, but not merely because they touched the
    // head — orbiting is exactly the state they get stuck in.
    if (scroll) {
      var hideScroll = function () { scroll.setAttribute("data-hide", "1"); };
      window.addEventListener("scroll", function () {
        if (window.scrollY > 40) hideScroll();
      }, { passive: true });
      setTimeout(hideScroll, 20000);
    }
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
