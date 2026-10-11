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

/** Inner SVG markup of the mark on a 32 × 32 grid. `background` adds the rounded navy tile. */
export function markInner({ background = false, radius = 7 } = {}) {
  const tile = background ? `<rect width="32" height="32" rx="${radius}" fill="${COLORS.navy}"/>` : '';
  const lines = `<path d="${PATH}" fill="none" stroke="${COLORS.blue}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dots = NODES.map(
    (node) =>
      `<circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="${node.color}" stroke="${COLORS.navy}" stroke-width="1.2"/>`,
  ).join('');
  return `${tile}${lines}${dots}`;
}

/** Standalone SVG document of the mark. `scale` < 1 shrinks the mark inside a full-bleed tile (maskable icons). */
export function markSvg({ size = 32, background = false, radius = 7, fullBleed = false, scale = 1 } = {}) {
  if (fullBleed) {
    const offset = (32 - 32 * scale) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}"><rect width="32" height="32" fill="${COLORS.navy}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${markInner()}</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">${markInner({ background, radius })}</svg>`;
}
