/* Evan Emery — work detail page.
   Switches the stage between the full plate and the detail crops. Detail crops
   with no image of their own are magnified regions of the main scan, expressed
   as background-size / background-position — the same mechanism the original
   catalogue used, so no extra assets are needed. */
(function () {
  "use strict";

  var plate = document.getElementById("ee-plate");
  var plateImg = document.getElementById("ee-plate-img");
  var crop = document.getElementById("ee-crop");
  var caption = document.getElementById("ee-focus-caption");
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-focus]"));
  if (!plate || !crop || !buttons.length) return;

  var current = null;

  function fitCrop() {
    if (crop.hidden) return;
    var bw = crop.clientWidth, bh = crop.clientHeight;
    var iw = plateImg.naturalWidth || 3, ih = plateImg.naturalHeight || 4;
    if (!bw || !bh) return;
    var cover = Math.max(bw / iw, bh / ih);
    var zoom = window.matchMedia("(max-width: 700px)").matches ? 1.25 : 1.5;
    crop.style.backgroundSize = Math.round(iw * cover * zoom) + "px " + Math.round(ih * cover * zoom) + "px";
  }
  window.addEventListener("resize", fitCrop);
  if (plateImg && !plateImg.complete) plateImg.addEventListener("load", fitCrop);

  function select(btn) {
    var isFull = btn.getAttribute("data-focus") === "0";
    var img = btn.getAttribute("data-img");
    var size = btn.getAttribute("data-size");
    var pos = btn.getAttribute("data-pos");

    if (isFull) {
      plate.hidden = false;
      crop.hidden = true;
    } else if (size === "contain") {
      // A real detail photograph: show it in the plate, unmatted.
      plate.hidden = false;
      crop.hidden = true;
      plateImg.src = img;
    } else {
      // A region of the main scan. The catalogue's stored sizes (200-240%)
      // zoomed far past what reads as the artwork, especially on a phone
      // where the box is narrow. Instead the scan is scaled to cover the
      // box and magnified only mildly beyond that, so the region still
      // fills the frame and still looks like the work.
      plate.hidden = true;
      crop.hidden = false;
      crop.style.backgroundImage = 'url("' + img + '")';
      crop.style.backgroundPosition = pos;
      fitCrop();
    }
    if (isFull) plateImg.src = buttons[0].getAttribute("data-img");
    current = btn;

    if (caption) caption.textContent = btn.getAttribute("data-label");
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () { select(b); });
  });

  // Warm every view's image once the page is idle, so a swap is instant
  // rather than showing the previous image while the next one downloads.
  function preload() {
    var seen = {};
    buttons.forEach(function (b) {
      var src = b.getAttribute("data-img");
      if (!src || seen[src]) return;
      seen[src] = true;
      var im = new Image(); im.decoding = "async"; im.src = src;
    });
  }
  if (window.requestIdleCallback) requestIdleCallback(preload); else setTimeout(preload, 800);

  // Arrow-key navigation across the view strip.
  buttons.forEach(function (b, i) {
    b.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = buttons[(i + d + buttons.length) % buttons.length];
      n.focus();
      select(n);
    });
  });

  // The detail page has no hero canvas, so reveal its content directly.
  Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"))
    .forEach(function (el) { el.setAttribute("data-shown", "1"); });
})();
