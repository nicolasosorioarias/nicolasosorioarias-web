// Builds the hero image sequence from assets/hero/hero.mp4.
// Usage: npm run frames   (needs ffmpeg on PATH; Real-ESRGAN for the first run, see below)
//
// 1. Masters (cached in .cache/hero/, git-ignored): every 2nd source frame (120 frames),
//    upscaled 4x with Real-ESRGAN (realesrgan-x4plus, GPU, no face restoration), brought to
//    2560 px and blended 65/35 with a plain Lanczos upscale of the same source frame. The
//    blend keeps Real-ESRGAN's crisp eyes, brows and hair while restoring natural skin texture.
//    Masters are made once; later runs only re-encode.
// 2. Variants: desktop2x (2560x1440, high-DPR screens), desktop (1920x1080) and mobile
//    (800x1000 portrait crop that follows the face, every 2nd master = 60 frames), each AVIF
//    with a WebP fallback, plus a static close-up per variant.
// 3. Output: public/assets/hero/<version>/… and src/content/hero-frames.json. <version> hashes
//    the source and every setting, so frames can be cached for a year as immutable.
//
// The colour grade and a soft vignette are baked into the frames; film grain is a CSS overlay.
//
// Real-ESRGAN: realesrgan-ncnn-vulkan v0.2.5.0 (github.com/xinntao/Real-ESRGAN releases).
// Default path %LOCALAPPDATA%/Programs/realesrgan-ncnn-vulkan/; override with REALESRGAN_PATH.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = 'assets/hero/hero.mp4';
const HERO_DIR = 'public/assets/hero';
const CACHE_DIR = '.cache/hero/masters-2560';
const MANIFEST = 'src/content/hero-frames.json';

const MASTER = { every: 2, width: 2560, height: 1440, model: 'realesrgan-x4plus', blend: 0.65 };

// Soft navy grade + a gentler vignette than v1.0 (PI/4.2), so it frames the face without hiding it.
const GRADE = [
  'eq=contrast=1.04:saturation=0.9:gamma=0.97',
  'colorbalance=bs=0.06:bm=0.03:bh=-0.02',
  'vignette=angle=PI/5.2',
].join(',');

const WEBP_QUALITY = 70;
const VARIANTS = [
  { name: 'desktop2x', width: 2560, height: 1440, step: 1, avif: 62 },
  { name: 'desktop', width: 1920, height: 1080, step: 1, avif: 62 },
  // Portrait 4:5 crop for phones at 2x DPR. The face drifts from x≈850 to x≈750 (in 1280 space)
  // as the camera pushes in, so the crop follows it.
  { name: 'mobile', width: 800, height: 1000, step: 2, avif: 58, crop: { width: 1152, startX: 1124, endX: 924 } },
];

const REALESRGAN =
  process.env.REALESRGAN_PATH ??
  path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'realesrgan-ncnn-vulkan', 'realesrgan-ncnn-vulkan.exe');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} failed with exit code ${result.status}`);
}
const ffmpeg = (args) => run('ffmpeg', ['-v', 'error', '-y', ...args]);

async function folderSize(dir) {
  const files = await readdir(dir);
  const sizes = await Promise.all(files.map(async (file) => (await stat(path.join(dir, file))).size));
  return sizes.reduce((total, size) => total + size, 0);
}

// ---------- 1. Masters ----------
const expectedMasters = 240 / MASTER.every;
await mkdir(CACHE_DIR, { recursive: true });
const cached = (await readdir(CACHE_DIR)).filter((file) => file.endsWith('.png'));
if (cached.length !== expectedMasters) {
  if (!existsSync(REALESRGAN)) {
    throw new Error(`Real-ESRGAN not found at ${REALESRGAN}. Install realesrgan-ncnn-vulkan or set REALESRGAN_PATH.`);
  }
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'hero-masters-'));
  const src = path.join(tmp, 'src');
  const up = path.join(tmp, 'up');
  await mkdir(src);
  await mkdir(up);
  ffmpeg(['-i', SOURCE, '-an', '-vf', `select='not(mod(n\\,${MASTER.every}))'`, '-fps_mode', 'vfr', path.join(src, '%03d.png')]);
  console.log(`Upscaling ${expectedMasters} frames with ${MASTER.model} (GPU)…`);
  run(REALESRGAN, ['-i', src, '-o', up, '-n', MASTER.model, '-s', '4', '-f', 'png']);
  const frames = (await readdir(src)).filter((file) => file.endsWith('.png')).sort();
  for (const [index, file] of frames.entries()) {
    const out = path.join(CACHE_DIR, `${String(index).padStart(3, '0')}.png`);
    const blend = `[0:v]scale=${MASTER.width}:${MASTER.height}:flags=lanczos[a];[1:v]scale=${MASTER.width}:${MASTER.height}:flags=lanczos[b];[a][b]blend=all_expr='A*${MASTER.blend}+B*${(1 - MASTER.blend).toFixed(2)}'`;
    ffmpeg(['-i', path.join(up, file), '-i', path.join(src, file), '-filter_complex', blend, out]);
  }
  await rm(tmp, { recursive: true, force: true });
}
const masters = (await readdir(CACHE_DIR)).filter((file) => file.endsWith('.png')).sort();

// ---------- 2. Variants ----------
const version = createHash('sha256')
  .update(await readFile(SOURCE))
  .update(JSON.stringify({ MASTER, GRADE, WEBP_QUALITY, VARIANTS }))
  .digest('hex')
  .slice(0, 10);
const OUT_DIR = path.join(HERO_DIR, version);
const BASE_URL = `/assets/hero/${version}`;
await rm(HERO_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const manifest = { source: SOURCE, version, master: MASTER, webpQuality: WEBP_QUALITY, variants: {} };
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

for (const variant of VARIANTS) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), `hero-${variant.name}-`));
  const outDir = path.join(OUT_DIR, variant.name);
  await mkdir(outDir, { recursive: true });
  const picked = masters.filter((_, index) => index % variant.step === 0);

  // Grade (and crop) every picked master with ffmpeg, then encode with sharp.
  for (const [index, file] of picked.entries()) {
    const filters = [];
    if (variant.crop) {
      const t = picked.length > 1 ? index / (picked.length - 1) : 0;
      const x = Math.round(variant.crop.startX + (variant.crop.endX - variant.crop.startX) * t);
      filters.push(`crop=${variant.crop.width}:${MASTER.height}:${x}:0`);
    }
    filters.push(`scale=${variant.width}:${variant.height}:flags=lanczos`, GRADE);
    ffmpeg(['-i', path.join(CACHE_DIR, file), '-vf', filters.join(','), path.join(tmp, `${String(index).padStart(3, '0')}.png`)]);
  }

  const frames = (await readdir(tmp)).filter((file) => file.endsWith('.png')).sort();
  let avifBytes = 0;
  let webpBytes = 0;
  for (const [index, file] of frames.entries()) {
    const id = String(index).padStart(3, '0');
    const input = sharp(path.join(tmp, file));
    avifBytes += (await input.clone().avif({ quality: variant.avif, effort: 6 }).toFile(path.join(outDir, `${id}.avif`))).size;
    webpBytes += (await input.clone().webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(path.join(outDir, `${id}.webp`))).size;
  }

  // Static close-up (last frame) for reduced motion, data saver and slow connections.
  const last = path.join(tmp, frames[frames.length - 1]);
  await sharp(last).avif({ quality: variant.avif, effort: 6 }).toFile(path.join(OUT_DIR, `still-${variant.name}.avif`));
  await sharp(last).webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(path.join(OUT_DIR, `still-${variant.name}.webp`));

  manifest.variants[variant.name] = {
    count: frames.length,
    width: variant.width,
    height: variant.height,
    avifQuality: variant.avif,
    path: `${BASE_URL}/${variant.name}/`,
    still: `${BASE_URL}/still-${variant.name}`,
    avifBytes,
    webpBytes,
  };
  await rm(tmp, { recursive: true, force: true });
  console.log(`${variant.name}: ${frames.length} frames · AVIF ${kb(avifBytes)} · WebP ${kb(webpBytes)}`);
}

await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
let total = 0;
for (const variant of VARIANTS) total += await folderSize(path.join(OUT_DIR, variant.name));
console.log(`Total on disk (all variants, both formats): ${(total / 1024 / 1024).toFixed(2)} MB`);
