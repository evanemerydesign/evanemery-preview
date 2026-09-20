#!/bin/sh
# Regenerate the card-sized derivatives in assets/works/grid (1800px) and
# assets/works/grid/sm (900px) from the full-size work files. macOS `sips`.
# Run after adding a work, then `node tools/build.mjs`.
cd "$(dirname "$0")/.." || exit 1
mkdir -p assets/works/grid/sm
for f in assets/works/*.jpg assets/works/new/*-main.webp; do
  b=$(basename "$f"); b="${b%.*}.jpg"
  sips -s format jpeg -s formatOptions 82 -Z 1800 "$f" --out "assets/works/grid/$b" >/dev/null
  sips -s format jpeg -s formatOptions 78 -Z 900 "assets/works/grid/$b" --out "assets/works/grid/sm/$b" >/dev/null
done
ls assets/works/grid | wc -l
