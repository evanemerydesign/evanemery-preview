# evanemery.art — handoff

Last session: 2026-07-29. Everything below is committed and pushed to this repo.

## Where things stand

`evanemery.art` was rebuilt from the delivered Claude-Design export into a
dependency-free static site. It is **not live yet** — it is under review at
https://evanemerydesign.github.io/evanemery-preview/ (all pages `noindex`).

**Nothing has been pushed to the deploy repo.** `evanemerydesign/evanemery-portfolio`
still serves the placeholder holding page. See "To go live" below.

## Pick up on a new machine

```sh
git clone https://github.com/evanemerydesign/evanemery-preview.git
cd evanemery-preview
python3 -m http.server 8931        # or any static server
open http://127.0.0.1:8931/
```

Node is needed only to regenerate pages: `node tools/build.mjs`.
The Google Drive library (`Personal/Websites/`) syncs separately and holds the
source art, fonts and the design-system master.

## What was done

- Stripped the Claude-Design runtime: no `<x-dc>` / `<sc-if>` / `{{ }}`, no
  `support.js`, and **no React/ReactDOM/Babel from unpkg.com at page load**.
- Real HTML: `index.html` plus one crawlable page per work under `work/<id>/`.
- Replaced the `_ds` React bundle with CSS on the same design-system tokens.
- Dropped `image-slot.js` and the 1.72 MB `.image-slots.state.json`; the four
  wall mockups it held are now real `.webp` files.
- Added title/description/canonical/OG/JSON-LD, favicon, `robots.txt`, `sitemap.xml`.
- Admin kept but unlinked and `noindex`, with the unfinished simulations-import
  tab removed. It writes to `localStorage` only and **cannot publish** — its
  Export button emits a `works-data.js` to commit.
- Migrated `_drop/` into the Drive scaffold (design system, fonts, curated
  artwork, head geometry), so `_drop/` is now purgeable.

### The layout system (the bulk of the session)

Two canonical plate ratios — **3:4 portrait, 4:3 landscape**. Work is scaled to
fill the plate width; taller pieces crop top/bottom, shorter ones show mat. The
full uncropped piece is always on its detail page. Mat is a constant 18px.

3:4 was chosen against the real catalogue (portrait aspects 0.647–0.838): max
13.8% crop, max 11.7% mat, 2.9% average crop, with two works sitting on it
exactly. 25:31 would have cropped the tall works ~20%.

Rows are **justified**: each row's height is solved so the row fills the width
exactly — `H = (width − mat insets − gaps) / Σ ratios`. Row breaks come from a
search over candidate heights, scored on height consistency first, plate size
second, trailing space last. Catalogue order is never rearranged.

Guards that exist for a reason, all found by testing — do not remove:
- A trailing part-row **never stands taller than the row above it**.
- The search range is bounded, or it shrinks the artwork (it reached 236px).
- Below 620px every work gets its own full-width row.
- Rows close *before* adding a work when that lands nearer the target, or a
  narrow screen crushes two works into a row that should hold one.

Verified by cloning the catalogue to 13/17/24/31/45/60/80 works: every row
level, height spread 1.15–1.26 throughout.

## Open — pick this up first

**The carousel scroll affordances are implemented but NOT verified.** Added this
session, based on published carousel-UX guidance: edge fades on the live edge, a
position bar, an `01 / 08` counter, end-aware arrows, and a swipe/drag hint that
retires once used. Selected works went from 4 to 8.

They did not respond in my testing, but **I could not prove whether that is a
real bug**: `requestAnimationFrame` does not run in the automation context I was
using (a probe ticked once and stopped; the site-wide scroll progress bar never
updated either). Scroll events and `behavior: "smooth"` were dead for the same
reason. So the rail state, which is driven per frame, could not be exercised.

**First thing to do: open the preview in a normal browser and check** whether
the fades, counter, position bar and arrows respond to scrolling. If they do,
this is done. If they do not, the suspects in `js/site.js` `setupCarousel()` are
the per-frame watcher and the arrow handler's `scrollBy({behavior:"smooth"})`.

Also unverified for the same reason: the hero gesture fix. `hero-field.js` now
decides the axis on the first touch move — horizontal orbits, vertical is handed
back to the page. Previously `touchmove` called `preventDefault()` on any drag,
which is why a phone visitor got stuck orbiting the head and could not scroll.
Needs a real touch device to confirm.

## Deferred, by decision

- **Persistent docking hero on scroll** — the refinement named in
  `DEPLOY-NOTES.md`. The rebuild keeps `fitCamera()` and `publishHeadScreen()`
  intact so it stays buildable.
- **Process / experiment / behind-the-scenes photography** — none was ever
  supplied, so those sections are built from type and rules. Adding images is a
  data edit, not a redesign. Do not invent placeholder imagery.
- **`evanemery.design`** — Step 2, blocked: `squarespace-export/` is empty. It
  needs the robotmadeit.com XML export and full-res images.

## To go live

1. Copy this build into `evanemerydesign/evanemery-portfolio` (private) and push.
   That repo currently holds one **unpushed local commit** with an earlier
   version of this build — supersede it.
2. Evan does a one-time browser step: Cloudflare → Workers & Pages → Create →
   Pages → Connect to Git → `evanemery-portfolio`. Framework preset **None**,
   build command **empty**, output directory **`/`**.
3. Attach `evanemery.art` as the custom domain. SSL/TLS **Full**.

Production build is `node tools/build.mjs`; `PREVIEW=1 node tools/build.mjs`
adds the `noindex` used here.

## Verification gates

Run before any push:

```sh
node --check js/*.js
# no Claude-Design constructs
grep -rE '<x-dc|<sc-if|<sc-for|<x-import|support\.js|_ds/' --include='*.html' --include='*.js' --include='*.css' .
# no third-party runtime hosts
grep -rohE 'https?://[a-zA-Z0-9.-]+' --include='*.html' --include='*.js' .
# nothing crops
grep -c 'object-fit: cover' css/site.css     # must be 0
```

`node --check` only validates syntax. Twice this session it passed over code
that was actually broken — once with `alignFrames` deleted while three call
sites remained, once with two competing `alignContainer` definitions where the
stale one won. Both were invisible until the page misbehaved. The build now also
checks for duplicate function definitions; keep that.
