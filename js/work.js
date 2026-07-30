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
      // A magnified region of the main scan.
      plate.hidden = true;
      crop.hidden = false;
      crop.style.backgroundImage = 'url("' + img + '")';
      crop.style.backgroundSize = size;
      crop.style.backgroundPosition = pos;
    }
    if (isFull) plateImg.src = buttons[0].getAttribute("data-img");

    if (caption) caption.textContent = btn.getAttribute("data-label");
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () { select(b); });
  });

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
