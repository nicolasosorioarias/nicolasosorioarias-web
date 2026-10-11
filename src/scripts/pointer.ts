// Shared plumbing for cursor-follow effects.
// - Effects run only with a fine pointer (mouse, trackpad) and when motion is allowed.
// - Pointer events are coalesced to one update per animation frame per element.
// - Nothing here replaces the system cursor.

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export const canFollowPointer = () => finePointer.matches && !reducedMotion.matches;
export const motionAllowed = () => !reducedMotion.matches;

type Local = { x: number; y: number; width: number; height: number };

interface TrackOptions {
  move: (point: Local) => void;
  enter?: () => void;
  leave?: () => void;
}

/** Calls `move` with element-local coordinates, at most once per frame, while the pointer is over `el`. */
export function trackPointer(el: HTMLElement, { move, enter, leave }: TrackOptions) {
  if (!canFollowPointer()) return;
  let rect = el.getBoundingClientRect();
  let frame = 0;
  let last: PointerEvent | null = null;

  const flush = () => {
    frame = 0;
    if (!last) return;
    move({ x: last.clientX - rect.left, y: last.clientY - rect.top, width: rect.width, height: rect.height });
  };

  el.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    rect = el.getBoundingClientRect();
    enter?.();
  });
  el.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    last = event;
    if (!frame) frame = requestAnimationFrame(flush);
  });
  el.addEventListener('pointerleave', () => {
    last = null;
    cancelAnimationFrame(frame);
    frame = 0;
    leave?.();
  });
  window.addEventListener('scroll', () => (rect = el.getBoundingClientRect()), { passive: true });
}

/** Runs `onChange(true|false)` as the element enters or leaves the viewport. */
export function whenVisible(el: Element, onChange: (visible: boolean) => void, rootMargin = '0px') {
  const observer = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting), { rootMargin });
  observer.observe(el);
  return observer;
}

/** Spotlight + magnetic helpers driven by CSS custom properties (transforms only). */
export function initSpotlights(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-spotlight]').forEach((el) => {
    trackPointer(el, {
      move: ({ x, y }) => {
        el.style.setProperty('--sx', `${x.toFixed(0)}px`);
        el.style.setProperty('--sy', `${y.toFixed(0)}px`);
      },
      enter: () => el.classList.add('is-lit'),
      leave: () => el.classList.remove('is-lit'),
    });
  });
}

export function initMagnetic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = 0.22;
    const max = 6;
    trackPointer(el, {
      move: ({ x, y, width, height }) => {
        const dx = Math.max(-max, Math.min(max, (x - width / 2) * strength));
        const dy = Math.max(-max, Math.min(max, (y - height / 2) * strength));
        el.style.setProperty('--mx', `${dx.toFixed(1)}px`);
        el.style.setProperty('--my', `${dy.toFixed(1)}px`);
      },
      leave: () => {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      },
    });
  });
}
