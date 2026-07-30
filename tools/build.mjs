/* evanemery.art — static page generator.
 *
 * Reads js/works-data.js (the single source of truth for the catalogue) and
 * emits fully-formed HTML: index.html plus one page per work under work/<id>/.
 * Output is committed, so Cloudflare Pages needs no build command.
 *
 *   node tools/build.mjs
 *
 * Re-run after editing js/works-data.js or after exporting new content from
 * admin.html.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://evanemery.art";
const EMAIL = "evanemerydesign@gmail.com";
/* PREVIEW=1 -> a review build for GitHub Pages: noindex everywhere and a
   blanket robots.txt, so the preview can never outrank the real site. */
const PREVIEW = process.env.PREVIEW === "1";

/* ---------- load the catalogue ------------------------------------------- */

function loadData() {
  const src = readFileSync(join(ROOT, "js/works-data.js"), "utf8");
  const store = {};
  const win = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    }
  };
  new Function("window", "localStorage", src)(win, win.localStorage);
  return win.EE_WORKS_DATA;
}

/* ---------- helpers ------------------------------------------------------- */

/* Intrinsic image dimensions, read straight from the file header, so every
   <img> can reserve its box. Without this, images inside a hidden view collapse
   to zero height before they load. Supports JPEG, PNG and WebP (VP8/VP8L/VP8X). */
const dimCache = new Map();
function imageSize(relPath) {
  if (dimCache.has(relPath)) return dimCache.get(relPath);
  let out = null;
  try {
    const b = readFileSync(join(ROOT, relPath));
    if (b[0] === 0xff && b[1] === 0xd8) {                       // JPEG
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          out = { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
          break;
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    } else if (b.toString("ascii", 1, 4) === "PNG") {            // PNG
      out = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    } else if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const fmt = b.toString("ascii", 12, 16);
      if (fmt === "VP8X") {
        out = { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      } else if (fmt === "VP8 ") {
        out = { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      } else if (fmt === "VP8L") {
        const n = b.readUInt32LE(21);
        out = { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
      }
    }
  } catch (e) { /* asset missing — fall through to no attributes */ }
  if (!out) console.warn("  ! could not read dimensions:", relPath);
  dimCache.set(relPath, out);
  return out;
}

/** width/height attributes for a source path, or "" when unknown. */
function sizeAttrs(relPath) {
  const d = imageSize(relPath);
  return d ? ` width="${d.w}" height="${d.h}"` : "";
}

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const attr = esc;

/** Cards are wrapped in <a>, so a work needs a stable URL. */
const workUrl = (id) => `work/${id}/`;

function specLabel(text, id) {
  return `<div class="ee-speclabel"${id ? ` id="${id}"` : ""}>${esc(text)}</div>`;
}

function figTag(number, label) {
  return `<span class="ee-figtag ee-figtag--outline">`
    + `<span class="fig">FIG.</span><span class="num">${esc(number)}</span>`
    + (label ? `<span class="lbl">${esc(label)}</span>` : "")
    + `</span>`;
}

function divider(label) {
  return `<div class="ee-divider"><span>${esc(label)}</span></div>`;
}

function tag(text, variant) {
  const v = variant ? ` ee-tag--${variant}` : "";
  return `<span class="ee-tag${v}">${esc(text)}</span>`;
}

/** ArtworkCard, as an anchor so it is a real, crawlable link. */
function artworkCard(w, { delay = 0, prefix = "" } = {}) {
  const dims = [w.dims, w.medium].filter(Boolean);
  return `
          <a class="ee-artcard" href="${prefix}${workUrl(w.id)}" data-work
             data-category="${attr(w.series || "")}"
             data-type="${attr((w.badge || "").split("—")[0].trim())}"
             data-reveal data-reveal-delay="${delay}">
            <div class="mat">
              <div class="plate">
                <img src="${prefix}${attr(w.image)}" alt="${attr(w.title)}, ${attr(w.year)} — ${attr(w.medium || "artwork")}" loading="lazy" decoding="async"${sizeAttrs(w.image)}>
              </div>
            </div>
            <figcaption>
              ${w.series ? `<span class="series">${esc(w.series)}</span>` : ""}
              <div class="titlerow">
                <h3>${esc(w.title)}<span class="yr">, ${esc(w.year)}</span></h3>
                ${w.badge ? `<span class="status">${esc(w.badge)}</span>` : ""}
              </div>
              <div class="dims"><span>${esc(dims[0] || "")}</span><span></span></div>
            </figcaption>
          </a>`;
}

/* ---------- shared chrome -------------------------------------------------- */

function head({ title, desc, canonical, ogImage, prefix = "", noindex = false }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}">
${(noindex || PREVIEW) ? `<meta name="robots" content="noindex,nofollow">\n` : ""}<link rel="canonical" href="${attr(canonical)}">
<meta name="theme-color" content="#f6f3ec">
<meta name="author" content="Evan Emery">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Evan Emery">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(SITE + "/" + ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(desc)}">
<meta name="twitter:image" content="${attr(SITE + "/" + ogImage)}">
<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${prefix}css/tokens/fonts.css">
<link rel="stylesheet" href="${prefix}css/tokens/colors.css">
<link rel="stylesheet" href="${prefix}css/tokens/typography.css">
<link rel="stylesheet" href="${prefix}css/tokens/spacing.css">
<link rel="stylesheet" href="${prefix}css/tokens/effects.css">
<link rel="stylesheet" href="${prefix}css/site.css">
<link rel="preload" href="${prefix}assets/fonts/ChakraPetch-700n.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${prefix}assets/fonts/SpaceGrotesk-400n.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${prefix}assets/fonts/SpaceMono-400n.woff2" as="font" type="font/woff2" crossorigin>`;
}

function nav({ prefix = "", standalone = false }) {
  const item = (route, label) => standalone
    ? `<a class="ee-navlink" href="${prefix}#/${route}">${label}</a>`
    : `<a class="ee-navlink" href="#/${route}" data-route="${route}">${label}</a>`;
  return `  <header id="ee-nav" data-nav="ink" data-scrolled="0">
    <div class="ee-navbar">
      <a class="ee-brand" href="${prefix}"${standalone ? "" : ` data-route="home"`}>Evan Emery</a>
      <nav aria-label="Primary">
        ${item("home", "Index")}
        ${item("works", "Works")}
        ${item("experiments", "Experiments")}
        ${item("workflow", "Workflow")}
        ${item("about", "About")}
      </nav>
    </div>
  </header>`;
}

function fxLayers() {
  return `  <div id="ee-paper-tex" aria-hidden="true"></div>
  <div id="ee-progress" aria-hidden="true"></div>
  <div id="ee-grain" aria-hidden="true"></div>
  <div id="ee-frame" aria-hidden="true"><span class="reg tl"></span><span class="reg tr"></span><span class="reg bl"></span><span class="reg br"></span></div>`;
}

function footer(site) {
  return `  <footer class="ee-footer">
    <span class="mark">Evan Emery</span>
    <span class="ee-mono">${esc(site.tagline)}</span>
    <div class="links">
      <a href="https://www.instagram.com/evanemerydesign/" target="_blank" rel="noopener">Instagram ↗</a>
      <a href="https://github.com/evanemerydesign" target="_blank" rel="noopener">GitHub ↗</a>
      <a href="https://www.linkedin.com/in/evan-emery-2021/" target="_blank" rel="noopener">LinkedIn ↗</a>
      <a href="mailto:${EMAIL}">${EMAIL}</a>
    </div>
  </footer>`;
}

/* ---------- static copy ---------------------------------------------------- */

const STAGES = [
  { n: "01", tag: "Capture", title: "Reference & capture", body: "A photograph or scan of the human head becomes the raw signal — the single input the program will interrogate.", tool: "Camera · scanner", output: "→ source plate" },
  { n: "02", tag: "Field", title: "Field & displacement", body: "A generative program reads the head as data — vector fields, depth maps, pixel-sorting or faceted meshes drive the image away from its source.", tool: "Custom code · editor", output: "→ generative sketch" },
  { n: "03", tag: "Plot", title: "Plot & render", body: "The resolved geometry is committed to a path — a continuous plotter line, or a high-resolution render staged for print.", tool: "Pen plotter · render", output: "→ proof" },
  { n: "04", tag: "Print", title: "Pigment print", body: "The final mark is pressed into natural material — pigment on cotton rag — then matted and framed. Machine precision meets the grain.", tool: "Pigment · cotton rag", output: "→ editioned print" }
];

const VOCAB = ["Vector fields", "Pixel-sorting", "Depth extrusion", "Faceted geometry", "Plotter paths", "Cotton rag", "Pigment"];

/* ---------- index.html ------------------------------------------------------ */

function buildIndex(D) {
  const works = D.loadWorks();
  const site = D.BASE_SITE;
  const exps = D.loadExperiments();
  const byId = (id) => works.find((w) => w.id === id);

  const selected = [site.selected1, site.selected2, site.selected3, site.selected4]
    .map(byId).filter(Boolean);

  const desc = "Generative programs redraw the human head — vector fields, depth extrusions, faceted geometry, continuous plotter paths — then each result is printed into cotton rag. Work by Evan Emery.";

  const homeSection = `
    <section data-view="home" aria-label="Index">

      <div class="ee-hero">
        <div class="ee-hero-stack">
          <div class="ee-hero-copy" data-reveal>
            ${specLabel("Process-driven artwork · 2023–2025")}
            <h1 class="ee-h1 ee-h1--hero ee-chroma" data-text="${attr(site.heroHeading)}">${esc(site.heroHeading)}</h1>
            <p class="ee-lede">${esc(site.heroIntro)}</p>
            <div class="ee-hero-cta">
              <a class="ee-btn" href="#/works" data-route="works">View the works →</a>
              <a class="ee-btn ee-btn--ghost" href="#/about" data-route="about">Statement</a>
            </div>
          </div>
          <div class="ee-hero-tile" data-reveal>
            <div class="ee-sheet">
              <span class="ee-sheet-tag tl" aria-hidden="true">Vector field — live</span>
              <span class="ee-sheet-tag br" aria-hidden="true">θ 0–360° · growing</span>
              <div id="ee-orbit-cue" aria-hidden="true"><span class="cue">↻</span><span>Drag to orbit</span></div>
              <div class="ee-scrollcue" aria-hidden="true"><span class="cue">↓</span><span>More below</span></div>
              <canvas id="ee-hero-canvas" aria-label="Live particle simulation tracing a three-dimensional scan of a human head" role="img"></canvas>
              <div id="ee-hero-grain" aria-hidden="true"></div>
            </div>
          </div>
          <div class="ee-hero-cta-m" style="display:none">
            <a class="ee-btn" href="#/works" data-route="works">View the works →</a>
            <a class="ee-btn ee-btn--ghost" href="#/about" data-route="about">Statement</a>
          </div>
        </div>
      </div>

      <div class="ee-rulewrap"><div class="ee-draw"></div></div>

      <div style="padding:clamp(44px,5vw,72px) var(--page-gutter)">
        <div class="ee-secthead" data-reveal>
          ${specLabel("Selected works")}
          <div style="display:flex;align-items:center;gap:16px">
            <div style="display:${selected.length > 4 ? "flex" : "none"};align-items:center;gap:6px">
              <button type="button" class="ee-arrowbtn" data-sel-scroll="prev" aria-label="Previous works">←</button>
              <button type="button" class="ee-arrowbtn" data-sel-scroll="next" aria-label="Next works">→</button>
            </div>
            <a class="ee-textbtn" href="#/works" data-route="works">All works →</a>
          </div>
        </div>
        <div id="ee-selscroll" class="ee-selrow">
${selected.map((w, i) => artworkCard(w, { delay: (i % 4) * 90 })).join("\n")}
        </div>
      </div>

      <div class="ee-dark ee-band" style="padding:clamp(48px,6vw,96px) var(--page-gutter)">
        <div class="ee-band-inner" data-reveal>
          <div class="ee-stack" style="gap:var(--sp-3);margin-bottom:var(--sp-6);max-width:52ch">
            ${specLabel("Behind the scenes")}
            <h2 class="ee-h2">Every piece begins as a process.</h2>
            <p class="ee-body">Early states, generative sketches, plotter runs and the print itself. Four stages, run in the same order every time.</p>
          </div>
          <div class="ee-grid-3 ee-grid-3--tight" style="gap:clamp(16px,2vw,28px)">
${STAGES.slice(0, 3).map((s, i) => `            <div data-reveal data-reveal-delay="${i * 100}" class="ee-stack" style="gap:12px">
              ${figTag(s.n, s.tag)}
              <span class="ee-body" style="font-size:15px">${esc(s.title)}</span>
            </div>`).join("\n")}
          </div>
          <div style="margin-top:var(--sp-7)">
            <a class="ee-btn ee-btn--secondary" href="#/workflow" data-route="workflow">Explore the workflow →</a>
          </div>
        </div>
      </div>

    </section>`;

  const worksSection = `
    <section data-view="works" class="ee-sec" aria-label="Works" hidden style="position:relative;overflow:hidden">
      <div class="ee-stack" data-reveal style="position:relative;z-index:1;gap:var(--sp-4);margin-bottom:var(--sp-7)">
        <div class="ee-speclabel" id="ee-works-count">Catalogue · ${works.length} works</div>
        <h1 class="ee-h1 ee-chroma" data-text="Works">Works</h1>
        <div class="ee-dimrow">
          <span class="lbl">Group by</span>
          <button type="button" class="ee-dimbtn" data-dim="Category" aria-pressed="true">Category</button>
          <button type="button" class="ee-dimbtn" data-dim="Type" aria-pressed="false">Type</button>
        </div>
        <div class="ee-chiprow" id="ee-chips"></div>
      </div>
      <div class="ee-grid-3" id="ee-works-grid">
${works.map((w, i) => artworkCard(w, { delay: (i % 3) * 90 })).join("\n")}
      </div>
    </section>`;

  const experimentsSection = `
    <section data-view="experiments" aria-label="Experiments" hidden>
      <div class="ee-sec ee-sec--tight" style="position:relative;overflow:hidden">
        <div class="ee-splitend" data-reveal style="position:relative;z-index:1">
          <div class="ee-stack" style="gap:var(--sp-4);max-width:44ch">
            ${specLabel(`The sketchbook · ${String(exps.length).padStart(2, "0")} tests`)}
            <h1 class="ee-h1 ee-chroma" data-text="Experiments">Experiments</h1>
            <p class="ee-body" style="font-size:16px;line-height:1.62">${esc(site.expIntro)}</p>
          </div>
          <div class="ee-datasheet">
            <div class="hd">Status</div>
            <div>studies · not for sale</div>
            <div>proofs · variable state</div>
            <div>logged by seed</div>
          </div>
        </div>
      </div>

      <div class="ee-rulewrap"><div class="ee-draw"></div></div>

      <div style="padding:clamp(36px,4.5vw,72px) var(--page-gutter) clamp(56px,7vw,112px)">
        <div class="ee-grid-3 ee-grid-3--tight">
${exps.map((x, i) => `          <div class="ee-exp" data-reveal data-reveal-delay="${(i % 3) * 90}">
            <div class="sheet"><span>${esc(x.no)} · plate not yet exposed</span></div>
            <div class="ee-stack" style="gap:6px">
              <div class="titlerow"><span class="t">${esc(x.title)}</span><span class="no">${esc(x.no)}</span></div>
              <div class="ee-chiprow">${tag(x.technique, "outline")}</div>
              <span class="params">${esc(x.params)}</span>
            </div>
          </div>`).join("\n")}
        </div>

        <div class="ee-stack" data-reveal style="margin-top:clamp(44px,5vw,72px);gap:var(--sp-4)">
          ${divider("From test to work")}
          <p class="ee-note">A handful of these become editioned prints. Most stay here — the record of what the machine drew before a piece resolved.</p>
          <div style="margin-top:var(--sp-2)">
            <a class="ee-btn" href="#/works" data-route="works">See the finished works →</a>
          </div>
        </div>
      </div>
    </section>`;

  const workflowSection = `
    <section data-view="workflow" aria-label="Workflow" hidden>
      <div class="ee-sec ee-sec--tight" style="position:relative;overflow:hidden">
        <div class="ee-splitend" data-reveal style="position:relative;z-index:1">
          <div class="ee-stack" style="gap:var(--sp-4);max-width:40ch">
            ${specLabel("The process · 2023–2025")}
            <h1 class="ee-h1 ee-chroma" data-text="Workflow">Workflow</h1>
            <p class="ee-body" style="font-size:16px;line-height:1.62">Every piece runs the same pipeline — from a captured reference, through a generative program, to plotter and pigment. The process is the work; this is the sheet that catalogs it.</p>
          </div>
          <div class="ee-datasheet">
            <div class="hd">Pipeline</div>
            <div>01 — reference / capture</div>
            <div>02 — field · displacement</div>
            <div>03 — plot / render</div>
            <div>04 — pigment print · cotton rag</div>
          </div>
        </div>
      </div>

      <div class="ee-rulewrap"><div class="ee-draw"></div></div>

      <div class="ee-dark ee-band">
        <div class="ee-band-inner ee-stages">
${STAGES.map((s) => `          <div class="ee-stage" data-reveal data-wf-stage data-wf-n="${s.n}" data-wf-title="${attr(s.title)}">
            <div class="rail">
              <span class="n">${s.n}</span>
              ${figTag(s.n, s.tag)}
            </div>
            <div class="ee-stack body" style="gap:var(--sp-3)">
              <h2 class="ee-h2" style="font-size:clamp(24px,2.8vw,40px);line-height:1.06">${esc(s.title)}</h2>
              <p class="ee-body" style="font-size:16px;line-height:1.62">${esc(s.body)}</p>
              <div class="meta"><span>${esc(s.tool)}</span><span>${esc(s.output)}</span></div>
            </div>
          </div>`).join("\n")}
        </div>
      </div>

      <div class="ee-sec">
        <div class="ee-stack" data-reveal style="gap:var(--sp-5)">
          ${divider("Process vocabulary")}
          <div class="ee-chiprow">${VOCAB.map((v) => tag(v, "soft")).join("")}</div>
          <p class="ee-note">Each work's page carries its own record — dimensions, medium, the tools that made it and the analog output it ends on. This sheet is the shared method behind all of them.</p>
          <div style="margin-top:var(--sp-2)">
            <a class="ee-btn" href="#/works" data-route="works">See the works →</a>
          </div>
        </div>
      </div>
    </section>`;

  const aw = byId("self-portrait") || works[0];
  const aboutSection = `
    <section data-view="about" class="ee-sec" aria-label="Statement" hidden>
      <div class="ee-about">
        <div class="ee-stack" data-reveal style="gap:var(--sp-5);max-width:56ch">
          ${specLabel("Statement")}
          <h1 class="ee-h1" style="font-size:clamp(32px,3.8vw,56px);line-height:1.02">The work lives between the machine's precision and the material's resistance.</h1>
          <p class="ee-body">Each piece begins as a process — a generative program that reads the human head as data: vector fields, depth maps, faceted meshes, a single continuous plotter path. The program is coaxed, seeded and re-run until an image resolves.</p>
          <p class="ee-body">What the machine makes is then pressed into the grain of natural material — pigment on cotton rag, plotter ink on paper, the black frame and its mat. The tension between the two is the subject.</p>
          ${divider("Process vocabulary")}
          <div class="ee-chiprow">${VOCAB.slice(0, 5).map((v) => tag(v, "soft")).join("")}</div>
          <div style="margin-top:var(--sp-3)">
            <a class="ee-mail" href="mailto:${EMAIL}">${EMAIL}</a>
          </div>
        </div>
        <div data-reveal>
          <div class="ee-sheetframe">
            <span class="ee-sheet-tag tl" aria-hidden="true">Sheet — ${esc(aw.series)} · ${esc(aw.year)}</span>
            <figure class="ee-framed">
              <div class="mat"><div class="plate">
                <img src="${attr(aw.image)}" alt="${attr(aw.title)}, ${attr(aw.year)} — ${attr(aw.medium)}" decoding="async"${sizeAttrs(aw.image)}>
              </div></div>
            </figure>
            <span class="ee-sheet-tag br" aria-hidden="true">${esc(aw.params)}</span>
          </div>
          <div class="ee-mono" style="text-align:center;margin-top:14px">${esc(aw.title)} · ${esc(aw.year)} · ${esc(aw.dims)}</div>
        </div>
      </div>
    </section>`;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Evan Emery",
    url: SITE,
    email: `mailto:${EMAIL}`,
    jobTitle: "Artist",
    description: "Artist working between generative programs and analog output — pen plotter, cyanotype and pigment print.",
    sameAs: [
      "https://www.instagram.com/evanemerydesign/",
      "https://github.com/evanemerydesign",
      "https://www.linkedin.com/in/evan-emery-2021/"
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({
    title: "Evan Emery — generative artwork, plotted and printed",
    desc,
    canonical: SITE + "/",
    ogImage: "assets/works/duality.jpg"
  })}
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<a class="ee-skip" href="#ee-main">Skip to content</a>
<div class="ee-page" data-ee-shell data-frame="black" data-wall="plaster" data-bg="paper">
${fxLayers()}
${nav({})}
  <main class="ee-main" id="ee-main">
${homeSection}
${worksSection}
${experimentsSection}
${workflowSection}
${aboutSection}
  </main>
${footer(site)}
</div>

<script src="js/works-data.js"></script>
<script src="js/site-config.js"></script>
<script src="assets/vendor/three.min.js"></script>
<script src="js/head-points.js"></script>
<script src="js/head-mesh.js"></script>
<script src="js/hero-field.js"></script>
<script src="js/bg-grid.js"></script>
<script src="js/site.js"></script>
</body>
</html>
`;
}

/* ---------- work/<id>/index.html -------------------------------------------- */

function buildWork(D, w, index, all) {
  const site = D.BASE_SITE;
  const prev = all[(index - 1 + all.length) % all.length];
  const next = all[(index + 1) % all.length];
  const P = "../../";

  const details = w.details || [];
  const hasMockup = !!w.mockupImage;

  // Focus options: full plate, each detail crop, then the in-situ mockup.
  const opts = [
    { key: "full", label: "Full work", img: w.image, size: "contain", pos: "center" },
    ...details.map((d) => ({
      key: "detail", label: "Detail — " + d.label,
      img: d.img || w.image,
      size: d.img ? "contain" : d.size,
      pos: d.img ? "center" : d.pos
    })),
    ...(hasMockup ? [{ key: "mockup", label: "In situ", img: w.mockupImage, size: "contain", pos: "center" }] : [])
  ];

  const specRows = [
    ["Dimensions", w.dims], ["Edition", w.edition], ["Medium", w.medium],
    ["Workflow", w.workflow], ["Tools", w.tools], ["Analog output", w.analog],
    ["Year", String(w.year)], ["Series", w.series]
  ].filter(([, v]) => v);

  const desc = `${w.title} (${w.year}) — ${w.medium}. ${w.blurb}`;

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: w.title,
    creator: { "@type": "Person", name: "Evan Emery", url: SITE },
    dateCreated: String(w.year),
    artMedium: w.medium,
    artform: "Print",
    description: w.blurb,
    image: `${SITE}/${w.image}`,
    url: `${SITE}/${workUrl(w.id)}`
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({
    title: `${w.title}, ${w.year} — Evan Emery`,
    desc,
    canonical: `${SITE}/${workUrl(w.id)}`,
    ogImage: w.image,
    prefix: P
  })}
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<a class="ee-skip" href="#ee-main">Skip to content</a>
<div class="ee-page" data-ee-shell data-frame="black" data-wall="plaster" data-bg="paper">
${fxLayers()}
${nav({ prefix: P, standalone: true })}
  <main class="ee-main ee-sec" id="ee-main">

    <nav class="ee-mono" aria-label="Breadcrumb" style="margin-bottom:var(--sp-5)">
      <a href="${P}#/works">Works</a> <span aria-hidden="true">/</span> ${esc(w.title)}
    </nav>

    <div class="ee-work">
      <div data-reveal>
        <div class="ee-work-stage">
          <div class="ee-work-plate" id="ee-plate">
            <img id="ee-plate-img" src="${P}${attr(w.image)}" alt="${attr(w.title)}, ${attr(w.year)} — ${attr(w.medium)}" decoding="async"${sizeAttrs(w.image)}>
          </div>
          <div class="ee-work-crop" id="ee-crop" hidden></div>
        </div>
        <div class="ee-mono" id="ee-focus-caption" style="margin-top:12px;text-align:center">Full work</div>
${opts.length > 1 ? `        <div class="ee-focusrow" role="group" aria-label="Views of this work">
${opts.map((o, i) => `          <button type="button" class="ee-focusbtn" aria-pressed="${i === 0}"
                  data-focus="${i}" data-img="${attr(P + o.img)}" data-size="${attr(o.size)}" data-pos="${attr(o.pos)}" data-label="${attr(o.label)}">
            <span class="th" style="background-image:url('${attr(P + o.img)}');background-size:${o.key === "full" ? "cover" : attr(o.size)};background-position:${o.key === "full" ? "center" : attr(o.pos)}"></span>
            <span class="cap">${esc(o.label)}</span>
          </button>`).join("\n")}
        </div>` : ""}
      </div>

      <div class="ee-stack" data-reveal style="gap:var(--sp-5)">
        ${specLabel(`${w.series || "Work"} · ${w.year}`)}
        <h1 class="ee-h1" style="font-size:clamp(30px,3.4vw,50px)">${esc(w.title)}</h1>
        ${w.badge ? `<div class="ee-chiprow">${tag(w.badge, "outline")}</div>` : ""}
        <p class="ee-body">${esc(w.blurb)}</p>
        ${w.params ? `<div class="ee-datasheet"><div class="hd">Parameters</div><div>${esc(w.params)}</div></div>` : ""}
        <table class="ee-spec">
          <caption class="ee-sr">Specifications for ${esc(w.title)}</caption>
          <tbody>
${specRows.map(([k, v]) => `            <tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("\n")}
          </tbody>
        </table>
        <div>
          <a class="ee-btn" href="mailto:${EMAIL}?subject=${encodeURIComponent("Enquiry — " + w.title)}">Enquire about this work</a>
        </div>
      </div>
    </div>

    <div class="ee-prevnext">
      <a href="${P}${workUrl(prev.id)}"><span class="k">← Previous</span><span class="t">${esc(prev.title)}</span></a>
      <a href="${P}${workUrl(next.id)}"><span class="k">Next →</span><span class="t">${esc(next.title)}</span></a>
    </div>

  </main>
${footer(site)}
</div>

<script src="${P}js/works-data.js"></script>
<script src="${P}js/site-config.js"></script>
<script src="${P}js/work.js"></script>
</body>
</html>
`;
}

/* ---------- sitemap + robots ------------------------------------------------ */

function buildSitemap(works) {
  const urls = [
    `${SITE}/`,
    ...works.map((w) => `${SITE}/${workUrl(w.id)}`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
}

/* ---------- run -------------------------------------------------------------- */

const D = loadData();
const works = D.loadWorks();

writeFileSync(join(ROOT, "index.html"), buildIndex(D));
console.log("index.html");

const workDir = join(ROOT, "work");
if (existsSync(workDir)) rmSync(workDir, { recursive: true });
works.forEach((w, i) => {
  const dir = join(workDir, w.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), buildWork(D, w, i, works));
  console.log("work/" + w.id + "/index.html");
});

writeFileSync(join(ROOT, "sitemap.xml"), buildSitemap(works));
writeFileSync(join(ROOT, "robots.txt"), PREVIEW
  ? `# Review build. Not the live site — see https://evanemery.art
User-agent: *
Disallow: /
`
  : `User-agent: *
Allow: /
Disallow: /admin.html

Sitemap: ${SITE}/sitemap.xml
`);
console.log("sitemap.xml, robots.txt");
console.log(`\n${works.length} works generated.`);
