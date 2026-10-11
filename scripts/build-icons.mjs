// Builds every icon from the logo geometry in src/lib/logo.mjs.
// Usage: npm run icons
// Writes: public/favicon.svg, public/favicon.ico (16 + 32 px), public/apple-touch-icon.png (180),
// public/icons/icon-{192,512}.png (any) and public/icons/maskable-{192,512}.png.

import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { markSvg } from '../src/lib/logo.mjs';

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * (size / 32) * 2 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

await mkdir('public/icons', { recursive: true });

const tile = markSvg({ background: true });
await writeFile('public/favicon.svg', `${tile}\n`);

await writeFile(
  'public/favicon.ico',
  ico([
    { size: 16, data: await png(tile, 16) },
    { size: 32, data: await png(tile, 32) },
  ]),
);

// iOS rounds the corners itself, so the touch icon is a full-bleed tile.
await writeFile('public/apple-touch-icon.png', await png(markSvg({ fullBleed: true, scale: 0.72 }), 180));

for (const size of [192, 512]) {
  await writeFile(`public/icons/icon-${size}.png`, await png(markSvg({ background: true, radius: 7 }), size));
  // Maskable: the mark stays inside the 80% safe zone of any mask shape.
  await writeFile(`public/icons/maskable-${size}.png`, await png(markSvg({ fullBleed: true, scale: 0.58 }), size));
}

console.log('Icons written to public/');
