/** Fit the window frame to the media, reserving only its real XP chrome. */
export type MediaBox = { x: number; y: number; w: number; h: number };
export function fitMedia(ratio: number, area: MediaBox, chrome = 33): MediaBox {
  const w = Math.min(area.w, Math.max(1, area.h - chrome) * ratio + 6);
  const h = (w - 6) / ratio + chrome;
  return { x: Math.round(area.x + (area.w - w) / 2), y: Math.round(area.y + (area.h - h) / 2), w: Math.round(w), h: Math.round(h) };
}

/** Two related views share the screen without covering either one's content. */
export function mediaLayout(ratios: number[], W: number, H: number, chrome: number[] = []): MediaBox[] {
  const portrait = H > W;
  const area = { x: 12, y: 14, w: W - 24, h: H - 58 };
  if (ratios.length === 1) return [fitMedia(ratios[0], area, chrome[0])];
  const gap = 14;
  // Two wide views stack on a phone; two narrow views sit alongside each other.
  const stack = portrait && ratios.every(r => r >= 1);
  if (stack) {
    const heights = ratios.map((r, i) => (area.w - 6) / r + (chrome[i] ?? 33));
    const total = heights.reduce((a, b) => a + b, 0) + gap;
    const scale = Math.min(1, area.h / total);
    let y = area.y + (area.h - total * scale) / 2;
    return ratios.map((r, i) => {
      const box = fitMedia(r, { ...area, y, h: heights[i] * scale }, chrome[i]);
      y += heights[i] * scale + gap * scale;
      return box;
    });
  }
  if (portrait && ratios.some(r => r < 1) && ratios.some(r => r >= 1)) {
    // A wide companion gets a full-width strip; the phone keeps the remaining height.
    const wide = ratios.findIndex(r => r >= 1);
    const h = Math.min(area.h * 0.36, (area.w - 6) / ratios[wide] + (chrome[wide] ?? 33));
    return ratios.map((r, i) => fitMedia(r, i === wide
      ? { ...area, h }
      : { ...area, y: area.y + h + gap, h: area.h - h - gap }, chrome[i]));
  }
  const available = area.w - gap;
  // Proportional widths give differently shaped sources the same useful height.
  const first = Math.max(available * 0.25, Math.min(available * 0.75, available * ratios[0] / (ratios[0] + ratios[1])));
  return ratios.map((r, i) => fitMedia(r, { ...area, x: area.x + (i ? first + gap : 0), w: i ? available - first : first }, chrome[i]));
}
