// Hero v2: maps scroll progress through the sticky section to a frame of the
// pre-rendered sequence and draws it on a canvas. No scroll-jacking: the page
// scrolls natively, the canvas only follows.
//
// Loading: frame 0 is preloaded in <head>, frames 1–8 follow, and the rest
// streams in coarse-to-fine (every 8th, 4th, 2nd, then the remainder) once the
// visitor interacts or the page is idle. A missing frame falls back to the
// nearest loaded one, so fast scrolling never shows a gap.

import manifest from '../content/hero-frames.json';

type Variant = (typeof manifest.variants)['desktop'];

// Node in the clip's final network that the page's signal line grows from
// (source-frame pixels, desktop variant).
const LINK_ANCHOR = { x: 335, y: 485 };
const MAX_ZOOM = 0.12;
const CONCURRENCY = 4;

const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

function coarseToFine(count: number) {
  const order: number[] = [];
  const seen = new Set<number>();
  for (const step of [8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  if (!seen.has(count - 1)) order.push(count - 1);
  return order;
}

export function initHeroSequence(section: HTMLElement) {
  if (!document.documentElement.classList.contains('seq')) return;

  const stage = section.querySelector<HTMLElement>('.hs__stage');
  const canvas = section.querySelector<HTMLCanvasElement>('[data-hs-canvas]');
  const ctx = canvas?.getContext('2d');
  const intro = section.querySelector<HTMLElement>('[data-hs-intro]');
  const linkLine = section.querySelector<SVGLineElement>('[data-hs-link-line]');
  const linkNode = section.querySelector<SVGCircleElement>('[data-hs-link-node]');
  const flow = document.querySelector<HTMLElement>('[data-flow]');
  if (!stage || !canvas || !ctx || !intro) return;

  const phone = window.matchMedia('(max-width: 759px)');
  let variant: Variant;
  let ext: 'avif' | 'webp' = 'avif';
  let frames: (HTMLImageElement | null)[] = [];
  let queue: number[] = [];
  let inFlight = 0;
  let bulkStarted = false;
  let generation = 0;

  let progress = 0;
  let drawnIndex = -1;
  let drawnZoom = -1;
  let ticking = false;

  const src = (index: number) => `${variant.path}${String(index).padStart(3, '0')}.${ext}`;

  function loadFrame(index: number, gen: number): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        img
          .decode()
          .catch(() => undefined)
          .then(() => {
            if (gen !== generation) return resolve();
            frames[index] = img;
            if (Math.abs(index - targetIndex()) <= 2) schedule(true);
            resolve();
          });
      };
      img.onerror = () => resolve();
      img.src = src(index);
    });
  }

  function pump(gen: number) {
    while (inFlight < CONCURRENCY && queue.length && gen === generation) {
      const index = queue.shift()!;
      if (frames[index]) continue;
      inFlight++;
      loadFrame(index, gen).then(() => {
        inFlight--;
        pump(gen);
      });
    }
  }

  function startBulk() {
    if (bulkStarted) return;
    bulkStarted = true;
    queue = coarseToFine(variant.count).filter((index) => index > 8);
    pump(generation);
  }

  async function setup() {
    generation++;
    const gen = generation;
    variant = phone.matches ? manifest.variants.mobile : manifest.variants.desktop;
    frames = new Array(variant.count).fill(null);
    queue = [];
    inFlight = 0;
    bulkStarted = false;
    drawnIndex = -1;

    // Frame 0 decides the format: AVIF when the browser decodes it, WebP otherwise.
    await loadFrame(0, gen);
    if (gen !== generation) return;
    if (!frames[0]) {
      ext = 'webp';
      await loadFrame(0, gen);
    }
    queue = Array.from({ length: 8 }, (_, i) => i + 1);
    pump(gen);
    schedule(true);

    // Stream the rest on the first sign of intent, or when the page is idle.
    const start = () => startBulk();
    ['scroll', 'pointermove', 'keydown', 'touchstart'].forEach((type) =>
      window.addEventListener(type, start, { once: true, passive: true }),
    );
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback;
    const later = () => (idle ? idle(start, { timeout: 4000 }) : window.setTimeout(start, 2500));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
  }

  function targetIndex() {
    return Math.round(progress * (variant.count - 1));
  }

  function nearestLoaded(index: number) {
    for (let offset = 0; offset < variant.count; offset++) {
      const before = frames[index - offset];
      if (before) return before;
      const after = frames[index + offset];
      if (after) return after;
    }
    return null;
  }

  function resizeCanvas() {
    // The frames are at most 1280px wide, so a higher pixel ratio only costs memory.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const box = canvas!.getBoundingClientRect();
    canvas!.width = Math.round(box.width * dpr);
    canvas!.height = Math.round(box.height * dpr);
    drawnIndex = -1;
  }

  function readProgress() {
    const box = section.getBoundingClientRect();
    const travel = box.height - window.innerHeight;
    progress = travel > 0 ? Math.min(1, Math.max(0, -box.top / travel)) : 0;
  }

  function flowLineX() {
    if (!flow) return null;
    const left = parseFloat(getComputedStyle(flow, '::before').left);
    return Number.isFinite(left) ? left : null;
  }

  function render(force = false) {
    ticking = false;
    readProgress();
    const p = progress;

    // Story beats, timed to the clip.
    const s1 = 1 - smooth(0.22, 0.36, p);
    const s2 = smooth(0.66, 0.78, p);
    const zoom = smooth(0.4, 0.65, p) * MAX_ZOOM;
    const scrim = Math.max(s1, s2, 0.3);
    const link = smooth(0.86, 0.98, p);
    const end = smooth(0.82, 1, p);

    section.style.setProperty('--s1', s1.toFixed(3));
    section.style.setProperty('--s2', s2.toFixed(3));
    section.style.setProperty('--scrim', scrim.toFixed(3));
    section.style.setProperty('--end', end.toFixed(3));
    section.classList.toggle('is-intro-off', s1 < 0.5);
    section.classList.toggle('is-outro-on', s2 > 0.5);

    const index = targetIndex();
    if (!force && index === drawnIndex && Math.abs(zoom - drawnZoom) < 0.0005) return;
    const img = nearestLoaded(index);
    if (!img) return;

    const cw = canvas!.width;
    const ch = canvas!.height;
    // Desktop: the face starts right of the headline and pans further right as the opening line arrives.
    const fx = phone.matches ? 0.5 : 0.8 - 0.65 * smooth(0.45, 0.8, p);
    const fy = phone.matches ? 0.4 : 0.45;
    const scale = Math.max(cw / variant.width, ch / variant.height) * (1 + zoom);
    const dw = variant.width * scale;
    const dh = variant.height * scale;
    const dx = (cw - dw) * fx;
    const dy = (ch - dh) * fy;
    ctx!.drawImage(img, dx, dy, dw, dh);
    if (frames[index]) {
      drawnIndex = index;
      drawnZoom = zoom;
    }

    // Grow the page's signal line out of the video's final network.
    if (linkLine && linkNode && !phone.matches) {
      const ratio = canvas!.getBoundingClientRect().width / cw;
      const ax = (dx + LINK_ANCHOR.x * scale) * ratio;
      const ay = (dy + LINK_ANCHOR.y * scale) * ratio;
      const bx = flowLineX() ?? ax;
      const by = stage!.getBoundingClientRect().height;
      const length = Math.hypot(bx - ax, by - ay);
      linkLine.setAttribute('x1', ax.toFixed(1));
      linkLine.setAttribute('y1', ay.toFixed(1));
      linkLine.setAttribute('x2', bx.toFixed(1));
      linkLine.setAttribute('y2', by.toFixed(1));
      linkLine.style.strokeDasharray = `${length}`;
      linkLine.style.strokeDashoffset = `${length * (1 - link)}`;
      linkNode.setAttribute('cx', ax.toFixed(1));
      linkNode.setAttribute('cy', ay.toFixed(1));
      linkNode.style.opacity = link.toFixed(3);
    }
  }

  function schedule(force = false) {
    if (force) drawnIndex = -1;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => render());
    }
  }

  // Keyboard users reaching the hero actions after scrolling past them: bring them back into view.
  intro.addEventListener('focusin', () => {
    if (section.classList.contains('is-intro-off')) {
      window.scrollTo({ top: section.offsetTop, behavior: 'auto' });
    }
  });

  window.addEventListener('scroll', () => schedule(), { passive: true });
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeCanvas();
      schedule(true);
    });
  });
  phone.addEventListener('change', () => {
    resizeCanvas();
    setup();
  });

  resizeCanvas();
  setup();
}
