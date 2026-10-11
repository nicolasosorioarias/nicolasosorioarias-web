# nicolasosorioarias.com

[![Preview of nicolasosorioarias.com](public/og/og-en.jpg)](https://nicolasosorioarias.com)

Source of [nicolasosorioarias.com](https://nicolasosorioarias.com), the personal website of Nicolás Osorio Arias, Senior Software Engineer (Full-Stack & AI Product). One page in English (`/`) and Spanish (`/es/`).

## Lighthouse (production build)

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Desktop, EN and ES | 100 | 100 | 100 | 100 |
| Mobile, EN and ES | 97 | 100 | 100 | 100 |

## Engineering decisions

**Scroll-driven image sequence instead of video.** The hero is a sticky canvas that maps scroll progress to one of 120 pre-rendered frames. Frames are upscaled 4x with Real-ESRGAN (no face restoration), blended 65/35 with a Lanczos upscale of the same frame, and encoded as AVIF with a WebP fallback.

| Tier | Who gets it | Frames | Size (AVIF) |
|---|---|---|---|
| `desktop2x` 2560×1440 | DPR ≥ 1.5, ≥ 1024 px, no Save-Data, not 2g/3g | 120 | 7.8 MB |
| `desktop` 1920×1080 | other desktops | 120 | 5.6 MB |
| `mobile` 800×1000 | phones | 60 | 1.7 MB |
| static still | reduced motion, Save-Data, 2g/3g phones, ≤ 2 cores | 1 | ~75 KB |

One hero image is preloaded per visitor; the rest streams coarse-to-fine after the first interaction or when the page is idle, and a missing frame falls back to the nearest loaded one. Initial load: 443 KB desktop, 341 KB mobile. Frames live in a content-hashed folder, so they are cached for a year as immutable.

**Accessibility.** All text is HTML from the content files, never baked into images. Every pointer effect has a keyboard-focus or scroll equivalent, and nothing depends on hover. `prefers-reduced-motion` turns off the sequence and all animation. Visible focus rings, measured contrast ≥ 4.5:1 over the footage (worst case 5.9:1), skip link, bilingual 404.

**Internationalisation.** EN and ES are real routes generated from `src/content/en.json` and `es.json`, with `hreflang`, canonical URLs, a sitemap and per-language Open Graph images. No client-side text swapping.

**Interaction layer.** One `requestAnimationFrame`-coalesced pointer handler, transforms and opacity only, canvases paused off-screen and in background tabs. No animation or smooth-scroll libraries.

**Hosting.** Cloudflare Worker with static assets (`wrangler.jsonc`): no Worker script, so pages are served directly from assets; custom 404 via `not_found_handling`; security and cache headers in `public/_headers`. Deploys on every push to `main`.

## Stack

Astro 7 (static output) · TypeScript · CSS custom properties · Canvas 2D · sharp · ffmpeg · Real-ESRGAN (ncnn-vulkan) · Puppeteer · Cloudflare Workers static assets · Wrangler

## Run locally

Requires Node 22 or newer.

```bash
npm ci
npm run dev                      # http://localhost:4321
npm run build                    # static output in dist/
npx wrangler deploy --dry-run    # validate the Cloudflare config
```

| Script | What it does |
|---|---|
| `npm run frames` | Rebuilds the hero frame sets from `assets/hero/hero.mp4` (needs ffmpeg; the first run needs Real-ESRGAN via `REALESRGAN_PATH`) |
| `npm run og` | Builds the 1200×630 share images (EN, ES) |
| `npm run icons` | Builds the favicon set and PWA icons from `src/lib/logo.mjs` |
| `npm run projects` | Captures project screenshots (`SI_CAPTURE_URL` optional) |
| `npm run check:pending` | Lists any `[PENDING]` copy |

## License

Code: [MIT](LICENSE). Content, copy, photos, video, frames, CVs and the logo: © Nicolás Osorio Arias, all rights reserved (see [CONTENT-LICENSE.md](CONTENT-LICENSE.md)).
