// Logo mark "A · Signal": the letter N drawn as a four-node network on a 32-unit grid.
// The signal runs bottom-left -> top-left -> bottom-right -> top-right and ends at the
// green-hazel node (a nod to Nicolás' heterochromia). Shared by the header component and
// scripts/build-icons.mjs, so every icon comes from the same geometry.

export const COLORS = {
  navy: '#0A1222',
  blue: '#5B8CFF',
  hazel: '#9DBA6A',
};

/** Nodes in signal order. */
export const NODES = [
  { id: 'bl', x: 9, y: 24, r: 3.2, color: COLORS.blue },
  { id: 'tl', x: 9, y: 8, r: 3.2, color: COLORS.blue },
  { id: 'br', x: 23, y: 24, r: 3.2, color: COLORS.blue },
  { id: 'tr', x: 23, y: 8, r: 3.4, color: COLORS.hazel },
];

export const STROKE = 2.4;
export const PATH = `M${NODES.map((node) => `${node.x} ${node.y}`).join(' L')}`;

/**
 * Icon geometry for favicons and app icons: the same N, opened up to fill ~75% of the tile,
 * with heavier strokes and larger nodes so it stays legible at 16 px.
 */
export const ICON_NODES = [
  { id: 'bl', x: 8, y: 24.5, r: 3.7, color: COLORS.blue },
  { id: 'tl', x: 8, y: 7.5, r: 3.7, color: COLORS.blue },
  { id: 'br', x: 24, y: 24.5, r: 3.7, color: COLORS.blue },
  { id: 'tr', x: 24, y: 7.5, r: 4, color: COLORS.hazel },
];
export const ICON_STROKE = 3.4;
const ICON_PATH = `M${ICON_NODES.map((node) => `${node.x} ${node.y}`).join(' L')}`;

/** Inner SVG markup of the mark on a 32 × 32 grid. `background` adds the rounded navy tile; `icon` uses the bolder icon geometry. */
export function markInner({ background = false, radius = 7, icon = false } = {}) {
  const nodes = icon ? ICON_NODES : NODES;
  const path = icon ? ICON_PATH : PATH;
  const stroke = icon ? ICON_STROKE : STROKE;
  // The tile carries a faint lift toward the top-right, where the signal ends.
  const tile = background
    ? `<defs><radialGradient id="tile-glow" cx="0.85" cy="0.1" r="1"><stop offset="0" stop-color="#16274D"/><stop offset="0.7" stop-color="${COLORS.navy}"/></radialGradient></defs><rect width="32" height="32" rx="${radius}" fill="url(#tile-glow)"/><rect x="0.5" y="0.5" width="31" height="31" rx="${radius - 0.5}" fill="none" stroke="${COLORS.blue}" stroke-opacity="0.35"/>`
    : '';
  const lines = `<path d="${path}" fill="none" stroke="${COLORS.blue}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dots = nodes.map(
    (node) =>
      `<circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="${node.color}" stroke="${COLORS.navy}" stroke-width="1.2"/>`,
  ).join('');
  return `${tile}${lines}${dots}`;
}

/** Standalone SVG document of the mark. `scale` < 1 shrinks the mark inside a full-bleed tile (maskable icons). */
export function markSvg({ size = 32, background = false, radius = 7, fullBleed = false, scale = 1, icon = false } = {}) {
  if (fullBleed) {
    const offset = (32 - 32 * scale) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" fill="${COLORS.navy}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${markInner({ icon })}</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">${markInner({ background, radius, icon })}</svg>`;
}
