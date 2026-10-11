// Builds the 1200x630 share images (Open Graph / Twitter) for EN and ES from the
// hero's final close-up, with the real brand fonts and copy from the content JSON.
// Usage: npm run og   (needs a local Chrome; set CHROME_PATH if it is not in the default place)

import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { markSvg } from '../src/lib/logo.mjs';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH to your Chrome executable.');
  process.exit(1);
}

const OUT_DIR = 'public/og';
const SITE_LABEL = 'nicolasosorioarias.com';

const dataUri = async (file, type) => `data:${type};base64,${(await readFile(file)).toString('base64')}`;
const frames = JSON.parse(await readFile('src/content/hero-frames.json', 'utf8'));
const still = await dataUri(path.join('public', `${frames.variants.desktop2x.still}.webp`), 'image/webp');
const sora = await dataUri('node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2', 'font/woff2');
const soraExt = await dataUri('node_modules/@fontsource-variable/sora/files/sora-latin-ext-wght-normal.woff2', 'font/woff2');
const plex = await dataUri('node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', 'font/woff2');

const mark = markSvg({ size: 40 });
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(t) {
  const { hero, heroV2 } = t;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Sora; src: url(${sora}) format('woff2'); font-weight: 100 800; unicode-range: U+0000-00FF; }
    @font-face { font-family: Sora; src: url(${soraExt}) format('woff2'); font-weight: 100 800; unicode-range: U+0100-024F; }
    @font-face { font-family: Plex; src: url(${plex}) format('woff2'); font-weight: 500; }
    * { margin: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px; overflow: hidden; background: #0A1222; font-family: Sora; position: relative; }
    img { position: absolute; top: 0; right: -90px; height: 630px; }
    .shade { position: absolute; inset: 0; background:
      linear-gradient(90deg, #0A1222 0%, rgb(10 18 34 / .94) 34%, rgb(10 18 34 / .35) 58%, rgb(10 18 34 / 0) 72%),
      linear-gradient(180deg, rgb(10 18 34 / 0) 70%, rgb(10 18 34 / .7) 100%); }
    .light { position: absolute; inset: 0 0 auto; height: 2px; background: linear-gradient(90deg, transparent, #5B8CFF 30%, #A9C4FF 50%, #5B8CFF 70%, transparent); }
    .copy { position: absolute; left: 72px; top: 92px; width: 600px; }
    h1 { color: #F4F7FD; font-size: 56px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; }
    .role { margin-top: 18px; color: #8AB8FF; font: 500 16px Plex; letter-spacing: .16em; text-transform: uppercase; }
    .headline { margin-top: 30px; color: #F4F7FD; font-size: 44px; font-weight: 600; line-height: 1.08; letter-spacing: -0.03em; text-wrap: balance; }
    .key { color: #A9C4FF; }
    .site { position: absolute; left: 72px; bottom: 56px; display: flex; align-items: center; gap: 14px; color: #B8C6E0; font: 500 18px Plex; letter-spacing: .04em; }
    .site svg { display: block; }
  </style></head><body>
    <img src="${still}" alt="">
    <div class="shade"></div><div class="light"></div>
    <div class="copy">
      <h1>${escape(hero.name)}</h1>
      <p class="role">${escape(heroV2.role)}</p>
      <p class="headline">${escape(heroV2.headline.before)}<span class="key">${escape(heroV2.headline.highlight)}</span>${escape(heroV2.headline.after)}</p>
    </div>
    <p class="site">${mark}${SITE_LABEL}</p>
  </body></html>`;
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
for (const locale of ['en', 'es']) {
  const t = JSON.parse(await readFile(`src/content/${locale}.json`, 'utf8'));
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await tab.setContent(page(t), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const png = await tab.screenshot({ type: 'png' });
  const out = path.join(OUT_DIR, `og-${locale}.jpg`);
  const info = await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
  console.log(`${out}: ${(info.size / 1024).toFixed(0)} KB`);
  await tab.close();
}
await browser.close();
