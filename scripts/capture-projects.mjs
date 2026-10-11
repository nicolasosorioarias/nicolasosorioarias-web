// Captures the live client sites shown in Featured projects and writes optimized
// tall screenshots (the card scrolls through them on hover).
// Usage: npm run projects   (needs a local Chrome; set CHROME_PATH if it is not in the default place)

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

// `url` is only where the screenshot is taken; the card always links to the production domain
// (set in src/content/*.json). SI_CAPTURE_URL can point the capture at another build of the same
// site (for example a pre-release preview); it is read from the environment and never committed.
const SITES = [
  { id: 'servicios-informaticos', url: process.env.SI_CAPTURE_URL || 'https://serviciosinformaticos.com.co' },
  { id: 'rosita-store', url: 'https://rositastore.co' },
];
const VIEWPORT = { width: 1280, height: 800 };
const MAX_HEIGHT = 3200; // CSS px of the page kept in the screenshot
const OUT_DIR = 'public/assets/projects';
const WIDTH = 960;

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
]
  .filter(Boolean)
  .find((candidate) => existsSync(candidate));
if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH to your Chrome executable.');
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });

for (const site of SITES) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // Block the hosting toolbar that preview deploys inject ("Powered by Netlify"); it is not part of the design.
  await page.setRequestInterception(true);
  page.on('request', (request) => (request.url().includes('/.netlify/scripts/') ? request.abort() : request.continue()));
  try {
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (error) {
    // Keep the previous screenshot (if any) when a site is unreachable.
    console.warn(`${site.id}: skipped, ${error.message}`);
    await page.close();
    continue;
  }

  // Scroll through once so lazy content and reveal animations settle, then return to the top.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(total, MAX_HEIGHT); y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const height = Math.min(total, MAX_HEIGHT);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: VIEWPORT.width, height }, captureBeyondViewport: true });
  const image = sharp(png).resize({ width: WIDTH });
  const avif = await image.clone().avif({ quality: 55, effort: 6 }).toFile(path.join(OUT_DIR, `${site.id}.avif`));
  const webp = await image.clone().webp({ quality: 74, effort: 6 }).toFile(path.join(OUT_DIR, `${site.id}.webp`));
  console.log(`${site.id}: ${avif.width}x${avif.height} · AVIF ${(avif.size / 1024).toFixed(0)} KB · WebP ${(webp.size / 1024).toFixed(0)} KB`);
  await page.close();
}

await browser.close();
