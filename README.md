# evanemery.art — review build

Preview of the rebuilt **evanemery.art** so it can be reviewed and tweaked
before it goes to the deploy repo.

**This is not the live site.** Every page is `noindex,nofollow` and
`robots.txt` disallows everything, so it cannot compete with `evanemery.art`
in search. The live site deploys from the private repo
`evanemerydesign/evanemery-portfolio` via Cloudflare Pages.

Regenerate after editing `js/works-data.js`:

```sh
node tools/build.mjs            # production build
PREVIEW=1 node tools/build.mjs  # this review build (adds noindex)
```
