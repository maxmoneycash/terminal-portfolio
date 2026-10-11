/** Keep XP metrics legible while matching the viewport's actual shape. */
export function filmDimensions(width: number, height: number) {
  const portrait = height > width;
  const scale = portrait ? width / 540 : height / 720;
  return { width: Math.round(width / scale), height: Math.round(height / scale), portrait };
}
