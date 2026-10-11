// Hero signature: the portrait converges out of the node network, resolves into the
// photo, and a pointer lens turns the photo back into nodes. Signals leave the orbit
// and travel outward through the network: from the person, through technology, to product.
//
// Canvas 2D only. Under prefers-reduced-motion a single static frame is drawn
// (network, no intro, no pulses, no lens). Without JavaScript the photo and the CSS
// orbits remain.

type Dot = { u: number; v: number; size: number; bucket: number; sx: number; sy: number; delay: number };
type NetNode = { bx: number; by: number; x: number; y: number; r: number; phase: number; orbit: number | null };
type Pulse = { path: number[]; seg: number; progress: number; speed: number };
type Flash = { x: number; y: number; born: number };

const DOT_COLORS = ['91, 140, 255', '128, 165, 255', '169, 196, 255', '244, 247, 253'];
const ORBIT_ANCHOR_RADIUS = 1.52; // matches .portrait__orbit--2 in Hero.astro
const INTRO_GATHER_MS = 1300;
const INTRO_REVEAL_AT = 1500;
const INTRO_END_MS = 2500;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / lengthSq);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function initNodePortrait(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  const portrait = hero.querySelector<HTMLElement>('[data-portrait]');
  const img = portrait?.querySelector<HTMLImageElement>('img');
  const copy = hero.querySelector<HTMLElement>('[data-hero-copy]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !portrait || !img || !copy || !ctx) return;

  // Low-power devices and data-saver visitors get the same static frame as reduced motion.
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const lowPower = (navigator.hardwareConcurrency ?? 4) <= 2 || connection?.saveData === true;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || lowPower;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let width = 0;
  let height = 0;
  let center = { x: 0, y: 0, r: 0 };
  let copyRect = { x: 0, y: 0, w: 0, h: 0 };
  let nodes: NetNode[] = [];
  let edges: [number, number][] = [];
  let paths: number[][] = [];
  let dots: Dot[] = [];
  let pulses: Pulse[] = [];
  let flashes: Flash[] = [];

  let introStart = -1;
  let introDone = reduceMotion;
  let revealed = false;
  let nextPulseAt = 0;
  let frame = 0;
  let running = false;
  let inView = true;
  let lastTime = 0;
  const lens = { x: 0, y: 0, px: 0, py: 0, r: 0, target: 0 };

  const reveal = () => {
    if (!revealed) {
      revealed = true;
      portrait.classList.add('is-revealed');
    }
  };

  function layout() {
    const heroBox = hero.getBoundingClientRect();
    const portraitBox = img!.getBoundingClientRect();
    const copyBox = copy!.getBoundingClientRect();
    width = heroBox.width;
    height = heroBox.height;

    const dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2);
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    center = {
      x: portraitBox.left - heroBox.left + portraitBox.width / 2,
      y: portraitBox.top - heroBox.top + portraitBox.height / 2,
      r: portraitBox.width / 2,
    };
    copyRect = {
      x: copyBox.left - heroBox.left - 28,
      y: copyBox.top - heroBox.top - 20,
      w: copyBox.width + 56,
      h: copyBox.height + 40,
    };
    buildNetwork();
    assignDotOrigins();
  }

  function insideCopy(x: number, y: number) {
    return x > copyRect.x && x < copyRect.x + copyRect.w && y > copyRect.y && y < copyRect.y + copyRect.h;
  }

  function crossesCopy(a: NetNode, b: NetNode) {
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      if (insideCopy(a.bx + (b.bx - a.bx) * t, a.by + (b.by - a.by) * t)) return true;
    }
    return false;
  }

  function buildNetwork() {
    const random = mulberry32(20261011);
    const compact = width < 700;
    const target = compact ? 16 : width < 1100 ? 26 : 36;
    const minGap = compact ? 46 : 74;
    const anchorRadius = center.r * ORBIT_ANCHOR_RADIUS;
    const keepOut = center.r * 1.72;

    nodes = [];
    const anchors = compact ? 4 : 6;
    for (let i = 0; i < anchors; i++) {
      const angle = -Math.PI / 2 + (i / anchors) * Math.PI * 2 + 0.35;
      nodes.push({
        bx: center.x + Math.cos(angle) * anchorRadius,
        by: center.y + Math.sin(angle) * anchorRadius,
        x: 0,
        y: 0,
        r: 2.4,
        phase: angle,
        orbit: angle,
      });
    }

    let attempts = 0;
    while (nodes.length < target + anchors && attempts < 4000) {
      attempts++;
      const angle = random() * Math.PI * 2;
      const reach = Math.max(width, height) * 0.85;
      const distance = keepOut + Math.pow(random(), 0.9) * reach;
      const x = center.x + Math.cos(angle) * distance * 1.25;
      const y = center.y + Math.sin(angle) * distance * 0.75;
      if (x < 14 || x > width - 14 || y < 72 || y > height - 18) continue;
      if (Math.hypot(x - center.x, y - center.y) < keepOut) continue;
      if (insideCopy(x, y)) continue;
      if (nodes.some((node) => Math.hypot(node.bx - x, node.by - y) < minGap)) continue;
      nodes.push({ bx: x, by: y, x, y, r: random() < 0.25 ? 2.6 : 1.7, phase: random() * Math.PI * 2, orbit: null });
    }

    const maxLength = compact ? 170 : 260;
    const seen = new Set<string>();
    edges = [];
    nodes.forEach((node, index) => {
      const nearest = nodes
        .map((other, otherIndex) => ({ otherIndex, d: Math.hypot(other.bx - node.bx, other.by - node.by) }))
        .filter(({ otherIndex, d }) => otherIndex !== index && d < maxLength)
        .sort((a, b) => a.d - b.d)
        .slice(0, node.orbit !== null ? 2 : 3);
      for (const { otherIndex } of nearest) {
        const key = index < otherIndex ? `${index}-${otherIndex}` : `${otherIndex}-${index}`;
        if (seen.has(key)) continue;
        const other = nodes[otherIndex];
        if (node.orbit !== null && other.orbit !== null) continue;
        if (crossesCopy(node, other)) continue;
        if (segmentDistance(center.x, center.y, node.bx, node.by, other.bx, other.by) < center.r * 1.3) continue;
        seen.add(key);
        edges.push([index, otherIndex]);
      }
    });

    // Signal paths: from each orbit anchor, keep stepping to the neighbor farthest from the portrait.
    const neighbors = nodes.map(() => [] as number[]);
    edges.forEach(([a, b]) => {
      neighbors[a].push(b);
      neighbors[b].push(a);
    });
    const distanceFromCenter = (index: number) => Math.hypot(nodes[index].bx - center.x, nodes[index].by - center.y);
    paths = [];
    nodes.forEach((node, index) => {
      if (node.orbit === null) return;
      for (const first of neighbors[index]) {
        const path = [index, first];
        let current = first;
        for (let hop = 0; hop < 4; hop++) {
          const next = neighbors[current]
            .filter((candidate) => !path.includes(candidate) && distanceFromCenter(candidate) > distanceFromCenter(current))
            .sort((a, b) => distanceFromCenter(b) - distanceFromCenter(a))[0];
          if (next === undefined) break;
          path.push(next);
          current = next;
        }
        if (path.length >= 3) paths.push(path);
      }
    });
  }

  function sampleDots() {
    const grid = width < 700 ? 64 : 92;
    const sampler = document.createElement('canvas');
    sampler.width = grid;
    sampler.height = grid;
    const sctx = sampler.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;
    sctx.drawImage(img!, 0, 0, grid, grid);
    const { data } = sctx.getImageData(0, 0, grid, grid);
    const random = mulberry32(7);
    dots = [];
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const i = (y * grid + x) * 4;
        const alpha = data[i + 3];
        if (alpha < 150) continue;
        const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        dots.push({
          u: (x + 0.5) / grid,
          v: (y + 0.5) / grid,
          size: (0.22 + Math.pow(lum, 0.85) * 0.78) / grid,
          bucket: lum < 0.22 ? 0 : lum < 0.45 ? 1 : lum < 0.68 ? 2 : 3,
          sx: 0,
          sy: 0,
          delay: random() * 420,
        });
      }
    }
    assignDotOrigins();
  }

  function assignDotOrigins() {
    if (!dots.length || !nodes.length) return;
    const random = mulberry32(99);
    for (const dot of dots) {
      const node = nodes[Math.floor(random() * nodes.length)];
      dot.sx = node.bx + (random() - 0.5) * 60;
      dot.sy = node.by + (random() - 0.5) * 60;
    }
  }

  function dotPosition(dot: Dot) {
    const size = center.r * 2;
    return { x: center.x - center.r + dot.u * size, y: center.y - center.r + dot.v * size, r: dot.size * size * 0.5 };
  }

  function updateNodes(time: number) {
    const anchorRadius = center.r * ORBIT_ANCHOR_RADIUS;
    for (const node of nodes) {
      if (node.orbit !== null) {
        const angle = node.orbit + (reduceMotion ? 0 : time * 0.00004);
        node.x = center.x + Math.cos(angle) * anchorRadius;
        node.y = center.y + Math.sin(angle) * anchorRadius;
      } else if (reduceMotion) {
        node.x = node.bx;
        node.y = node.by;
      } else {
        node.x = node.bx + Math.sin(time * 0.00035 + node.phase) * 3;
        node.y = node.by + Math.cos(time * 0.0003 + node.phase) * 3;
      }
    }
  }

  function drawNetwork(alpha: number) {
    ctx!.lineWidth = 1;
    ctx!.strokeStyle = `rgba(91, 140, 255, ${0.17 * alpha})`;
    ctx!.beginPath();
    for (const [a, b] of edges) {
      ctx!.moveTo(nodes[a].x, nodes[a].y);
      ctx!.lineTo(nodes[b].x, nodes[b].y);
    }
    ctx!.stroke();

    ctx!.fillStyle = `rgba(91, 140, 255, ${0.8 * alpha})`;
    ctx!.beginPath();
    for (const node of nodes) {
      if (node.orbit !== null) continue;
      ctx!.moveTo(node.x + node.r, node.y);
      ctx!.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    }
    ctx!.fill();

    ctx!.fillStyle = `rgba(169, 196, 255, ${alpha})`;
    ctx!.beginPath();
    for (const node of nodes) {
      if (node.orbit === null) continue;
      ctx!.moveTo(node.x + node.r, node.y);
      ctx!.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    }
    ctx!.fill();
  }

  function drawDots(time: number, elapsed: number) {
    if (!dots.length) return;
    const buckets: Path2D[] = DOT_COLORS.map(() => new Path2D());
    let groupAlpha = 0;

    if (!introDone) {
      groupAlpha = 1 - clamp01((elapsed - (INTRO_REVEAL_AT + 200)) / 800);
      for (const dot of dots) {
        const p = easeOutExpo(clamp01((elapsed - dot.delay) / INTRO_GATHER_MS));
        const target = dotPosition(dot);
        const x = dot.sx + (target.x - dot.sx) * p;
        const y = dot.sy + (target.y - dot.sy) * p;
        const r = Math.max(0.5, target.r * (0.5 + 0.5 * p));
        buckets[dot.bucket].moveTo(x + r, y);
        buckets[dot.bucket].arc(x, y, r, 0, Math.PI * 2);
      }
    } else if (lens.r > 0.5) {
      groupAlpha = 1;
      for (const dot of dots) {
        const target = dotPosition(dot);
        const d = Math.hypot(target.x - lens.x, target.y - lens.y);
        if (d > lens.r) continue;
        const focus = 1 - d / lens.r;
        const x = lens.x + (target.x - lens.x) * (1 + 0.1 * focus);
        const y = lens.y + (target.y - lens.y) * (1 + 0.1 * focus);
        const r = target.r * (0.55 + 0.75 * focus) * Math.min(1, focus * 3);
        if (r < 0.3) continue;
        buckets[dot.bucket].moveTo(x + r, y);
        buckets[dot.bucket].arc(x, y, r, 0, Math.PI * 2);
      }
    }

    if (groupAlpha <= 0) return;
    buckets.forEach((path, index) => {
      ctx!.fillStyle = `rgba(${DOT_COLORS[index]}, ${groupAlpha})`;
      ctx!.fill(path);
    });
    void time;
  }

  function spawnPulse(time: number) {
    if (!paths.length || pulses.length >= 3 || time < nextPulseAt) return;
    const path = paths[Math.floor(Math.random() * paths.length)];
    pulses.push({ path, seg: 0, progress: 0, speed: 0.24 + Math.random() * 0.08 });
    nextPulseAt = time + 1100 + Math.random() * 1500;
  }

  function drawPulses(time: number, delta: number) {
    pulses = pulses.filter((pulse) => {
      const a = nodes[pulse.path[pulse.seg]];
      const b = nodes[pulse.path[pulse.seg + 1]];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      pulse.progress += (pulse.speed * delta) / length;
      if (pulse.progress >= 1) {
        pulse.seg += 1;
        pulse.progress = 0;
        if (pulse.seg >= pulse.path.length - 1) {
          flashes.push({ x: b.x, y: b.y, born: time });
          return false;
        }
        return true;
      }
      const x = a.x + (b.x - a.x) * pulse.progress;
      const y = a.y + (b.y - a.y) * pulse.progress;
      const tail = Math.max(0, pulse.progress - 40 / length);
      const tx = a.x + (b.x - a.x) * tail;
      const ty = a.y + (b.y - a.y) * tail;

      const gradient = ctx!.createLinearGradient(tx, ty, x, y);
      gradient.addColorStop(0, 'rgba(169, 196, 255, 0)');
      gradient.addColorStop(1, 'rgba(169, 196, 255, 0.9)');
      ctx!.strokeStyle = gradient;
      ctx!.lineWidth = 1.6;
      ctx!.beginPath();
      ctx!.moveTo(tx, ty);
      ctx!.lineTo(x, y);
      ctx!.stroke();

      ctx!.fillStyle = 'rgba(169, 196, 255, 0.16)';
      ctx!.beginPath();
      ctx!.arc(x, y, 7, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#F4F7FD';
      ctx!.beginPath();
      ctx!.arc(x, y, 2, 0, Math.PI * 2);
      ctx!.fill();
      return true;
    });

    flashes = flashes.filter((flash) => {
      const age = (time - flash.born) / 750;
      if (age >= 1) return false;
      ctx!.strokeStyle = `rgba(169, 196, 255, ${0.55 * (1 - age)})`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(flash.x, flash.y, 3 + easeOutExpo(age) * 14, 0, Math.PI * 2);
      ctx!.stroke();
      return true;
    });
  }

  function updateLens() {
    lens.x += (lens.px - lens.x) * 0.3;
    lens.y += (lens.py - lens.y) * 0.3;
    lens.r += (lens.target - lens.r) * 0.16;
    if (lens.target === 0 && lens.r < 0.5) lens.r = 0;
    const left = center.x - center.r;
    const top = center.y - center.r;
    portrait!.style.setProperty('--lx', `${(lens.x - left).toFixed(1)}px`);
    portrait!.style.setProperty('--ly', `${(lens.y - top).toFixed(1)}px`);
    portrait!.style.setProperty('--lr', `${lens.r.toFixed(1)}px`);
  }

  function render(time: number) {
    const delta = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;
    if (introStart < 0 && dots.length) introStart = time;
    const elapsed = introStart < 0 ? 0 : time - introStart;

    if (!introDone && elapsed >= INTRO_REVEAL_AT) reveal();
    if (!introDone && elapsed >= INTRO_END_MS) introDone = true;

    ctx!.clearRect(0, 0, width, height);
    updateNodes(time);
    drawNetwork(introDone ? 1 : 0.25 + 0.75 * clamp01(elapsed / 900));
    if (introDone) {
      spawnPulse(time);
      updateLens();
    }
    drawPulses(time, delta);
    drawDots(time, elapsed);
  }

  function loop(time: number) {
    if (!running) return;
    render(time);
    frame = requestAnimationFrame(loop);
  }

  function setRunning(next: boolean) {
    if (next === running) return;
    running = next;
    if (running) {
      lastTime = 0;
      frame = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(frame);
    }
  }

  const shouldRun = () => !reduceMotion && inView && document.visibilityState === 'visible';

  function start() {
    layout();
    if (reduceMotion) {
      reveal();
      updateNodes(0);
      drawNetwork(1);
      return;
    }
    if (img!.complete && img!.naturalWidth > 0) sampleDots();
    else {
      img!.addEventListener('load', sampleDots, { once: true });
      img!.addEventListener('error', reveal, { once: true });
    }
    // Never leave the photo hidden if sampling is slow.
    window.setTimeout(reveal, INTRO_END_MS + 1200);
    hero.classList.add('has-canvas');
    setRunning(shouldRun());
  }

  let resizeFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      layout();
      if (reduceMotion) {
        updateNodes(0);
        drawNetwork(1);
      }
    });
  }).observe(hero);

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    setRunning(shouldRun());
  }).observe(hero);

  document.addEventListener('visibilitychange', () => setRunning(shouldRun()));

  if (finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', (event) => {
      if (!introDone) return;
      const box = hero.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const over = Math.hypot(x - center.x, y - center.y) < center.r * 0.98;
      if (over && lens.r < 0.5) {
        lens.x = x;
        lens.y = y;
      }
      lens.px = x;
      lens.py = y;
      lens.target = over ? center.r * 0.42 : 0;
    });
    hero.addEventListener('pointerleave', () => (lens.target = 0));
  }

  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
}
