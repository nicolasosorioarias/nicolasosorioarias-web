// Builds the hero portrait assets from a source photo.
// Usage: npm run photo -- "assets/Fotos Reales/photo.png"
//
// The photo should have a plain, light background (studio style). The script
// flood-fills that background from the image border into an alpha matte, so
// the hero can place the subject directly on the night-blue page.

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Usage: npm run photo -- <path-to-photo>');
  process.exit(1);
}

const OUT_DIR = 'public/assets/profile';
const WORK_SIZE = 1200;
const SIZES = [480, 960];

await mkdir(OUT_DIR, { recursive: true });

const { data, info } = await sharp(source)
  .rotate()
  .resize(WORK_SIZE, WORK_SIZE, { fit: 'cover', position: 'attention' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const pixelCount = width * height;

// Background candidates: light, low-saturation, blue-leaning pixels.
const isBackground = new Uint8Array(pixelCount);
for (let i = 0; i < pixelCount; i++) {
  const r = data[i * 3];
  const g = data[i * 3 + 1];
  const b = data[i * 3 + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const saturation = max === 0 ? 0 : (max - min) / max;
  isBackground[i] = b >= r + 12 && lum > 95 && saturation < 0.42 ? 1 : 0;
}

// Flood fill from the border so only background connected to the edge is removed.
const matte = new Uint8Array(pixelCount).fill(255);
const stack = [];
const seed = (x, y) => {
  const i = y * width + x;
  if (isBackground[i] && matte[i] === 255) {
    matte[i] = 0;
    stack.push(i);
  }
};
for (let x = 0; x < width; x++) {
  seed(x, 0);
  seed(x, height - 1);
}
for (let y = 0; y < height; y++) {
  seed(0, y);
  seed(width - 1, y);
}
while (stack.length) {
  const i = stack.pop();
  const x = i % width;
  const y = (i - x) / width;
  if (x > 0) seed(x - 1, y);
  if (x < width - 1) seed(x + 1, y);
  if (y > 0) seed(x, y - 1);
  if (y < height - 1) seed(x, y + 1);
}

// Erode one pixel and feather the edge to avoid a light halo around the hair.
const matteImage = await sharp(Buffer.from(matte), { raw: { width, height, channels: 1 } })
  .median(5)
  .blur(1.6)
  .linear(1.25, -48)
  .extractChannel(0)
  .raw()
  .toBuffer();

// Fade the bottom of the shoulders into the page.
const alpha = Buffer.alloc(pixelCount);
const fadeStart = height * 0.78;
for (let y = 0; y < height; y++) {
  const fade = y < fadeStart ? 1 : Math.max(0, 1 - (y - fadeStart) / (height - fadeStart));
  const eased = fade * fade * (3 - 2 * fade);
  for (let x = 0; x < width; x++) {
    const i = y * width + x;
    alpha[i] = Math.round(matteImage[i] * eased);
  }
}

const cutout = sharp(data, { raw: { width, height, channels: 3 } }).joinChannel(alpha, {
  raw: { width, height, channels: 1 },
});
const cutoutPng = await cutout.png().toBuffer();

for (const size of SIZES) {
  const resized = sharp(cutoutPng).resize(size, size);
  await resized.clone().webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(OUT_DIR, `portrait-${size}.webp`));
  await resized.clone().avif({ quality: 58 }).toFile(path.join(OUT_DIR, `portrait-${size}.avif`));
}

// Square photo with background for social cards and the no-matte fallback.
await sharp(data, { raw: { width, height, channels: 3 } })
  .resize(600, 600)
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(path.join(OUT_DIR, 'portrait-square.jpg'));

console.log(`Portrait assets written to ${OUT_DIR} from ${source}`);
