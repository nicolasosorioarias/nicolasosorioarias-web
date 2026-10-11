// Extracts the hero v2 image sequence from assets/hero/hero.mp4.
// Usage: npm run frames            (requires ffmpeg on PATH)
//
// Output: public/assets/hero/{desktop,mobile}/NNN.{avif,webp}, a static
// close-up for reduced motion, and src/content/hero-frames.json (manifest).
//
// The colour grade and vignette are baked into the frames: they hide the
// softness of the 720p source, calm the large out-of-focus particles at the
// edges, and dark corners compress better. Film grain is a CSS overlay instead,
// because grain inside the frames would multiply their weight.

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = 'assets/hero/hero.mp4';
const OUT_DIR = 'public/assets/hero';
const MANIFEST = 'src/content/hero-frames.json';
const AVIF_QUALITY = 50;
const WEBP_QUALITY = 68;

// Soft navy grade + vignette.
const GRADE = [
  'eq=contrast=1.04:saturation=0.9:gamma=0.97',
  'colorbalance=bs=0.06:bm=0.03:bh=-0.02',
  'vignette=angle=PI/4.2',
].join(',');

const VARIANTS = [
  {
    name: 'desktop',
    // 240 source frames, every 2nd -> 120 frames at 1280x720.
    every: 2,
    filters: [],
    width: 1280,
    height: 720,
  },
  {
    name: 'mobile',
    // Every 4th -> 60 frames. Portrait 4:5 crop that follows the face, which
    // drifts from x≈850 to x≈750 as the camera pushes in.
    every: 4,
    filters: ["crop=576:720:'562-n*100/59':0", 'scale=480:600'],
    width: 480,
    height: 600,
  },
];

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed with exit code ${result.status}`);
}

async function folderSize(dir) {
  const files = await readdir(dir);
  const sizes = await Promise.all(files.map(async (file) => (await stat(path.join(dir, file))).size));
  return sizes.reduce((total, size) => total + size, 0);
}

const manifest = { source: SOURCE, avifQuality: AVIF_QUALITY, webpQuality: WEBP_QUALITY, variants: {} };

for (const variant of VARIANTS) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), `hero-${variant.name}-`));
  const outDir = path.join(OUT_DIR, variant.name);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const filter = [`select='not(mod(n\\,${variant.every}))'`, ...variant.filters, GRADE].join(',');
  ffmpeg(['-i', SOURCE, '-an', '-vf', filter, '-fps_mode', 'vfr', path.join(tmp, '%03d.png')]);

  const frames = (await readdir(tmp)).filter((file) => file.endsWith('.png')).sort();
  let avifBytes = 0;
  let webpBytes = 0;
  for (const [index, file] of frames.entries()) {
    const id = String(index).padStart(3, '0');
    const input = sharp(path.join(tmp, file));
    const avif = await input.clone().avif({ quality: AVIF_QUALITY, effort: 6 }).toFile(path.join(outDir, `${id}.avif`));
    const webp = await input.clone().webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(path.join(outDir, `${id}.webp`));
    avifBytes += avif.size;
    webpBytes += webp.size;
  }

  // Static close-up (last frame) for reduced motion and low-power devices.
  const last = path.join(tmp, frames[frames.length - 1]);
  await sharp(last).avif({ quality: AVIF_QUALITY, effort: 6 }).toFile(path.join(OUT_DIR, `still-${variant.name}.avif`));
  await sharp(last).webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(path.join(OUT_DIR, `still-${variant.name}.webp`));

  manifest.variants[variant.name] = {
    count: frames.length,
    width: variant.width,
    height: variant.height,
    path: `/assets/hero/${variant.name}/`,
    still: `/assets/hero/still-${variant.name}`,
    avifBytes,
    webpBytes,
  };
  await rm(tmp, { recursive: true, force: true });

  const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
  console.log(`${variant.name}: ${frames.length} frames · AVIF ${kb(avifBytes)} · WebP ${kb(webpBytes)}`);
}

await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
const total = (await folderSize(path.join(OUT_DIR, 'desktop'))) + (await folderSize(path.join(OUT_DIR, 'mobile')));
console.log(`Total on disk (both formats, both sizes): ${(total / 1024 / 1024).toFixed(2)} MB`);
