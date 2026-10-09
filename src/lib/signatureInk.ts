/**
 * Where the quill is while writing the signature: the SVG is sampled once
 * into a per-column ink line, so the pen can follow the strokes left to
 * right and lift over the gaps. Shared by the welcome note, the quill window
 * and the intro film.
 */
export const signatureSize = { width: 2048, height: 512 };

export type InkMap = {
  minX: number;
  maxX: number;
  centerYByX: Float32Array;
  previousInkByX: Int32Array;
  nextInkByX: Int32Array;
};

const maps = new Map<string, Promise<InkMap>>();

export function loadInkMap(src: string): Promise<InkMap> {
  const cached = maps.get(src);
  if (cached) return cached;

  const promise = new Promise<InkMap>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = signatureSize.width;
      canvas.height = signatureSize.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("Unable to sample signature ink."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasInk = new Uint8Array(canvas.width);
      const centerYByX = new Float32Array(canvas.width);
      centerYByX.fill(Number.NaN);
      let minX = canvas.width;
      let maxX = 0;

      for (let x = 0; x < canvas.width; x += 1) {
        let weightedY = 0;
        let alphaWeight = 0;
        for (let y = 0; y < canvas.height; y += 1) {
          const alpha = pixels[(y * canvas.width + x) * 4 + 3] ?? 0;
          if (alpha <= 24) continue;
          weightedY += y * alpha;
          alphaWeight += alpha;
        }
        if (alphaWeight === 0) continue;
        hasInk[x] = 1;
        centerYByX[x] = weightedY / alphaWeight;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }

      if (minX >= canvas.width) {
        reject(new Error("Signature image has no visible ink."));
        return;
      }

      const previousInkByX = new Int32Array(canvas.width);
      const nextInkByX = new Int32Array(canvas.width);
      previousInkByX.fill(-1);
      nextInkByX.fill(-1);
      let previous = -1;
      for (let x = 0; x < canvas.width; x += 1) {
        if (hasInk[x]) previous = x;
        previousInkByX[x] = previous;
      }
      let next = -1;
      for (let x = canvas.width - 1; x >= 0; x -= 1) {
        if (hasInk[x]) next = x;
        nextInkByX[x] = next;
      }

      resolve({ minX, maxX, centerYByX, previousInkByX, nextInkByX });
    };
    image.onerror = () => reject(new Error("Unable to load signature image."));
    image.src = src;
  });
  maps.set(src, promise);
  return promise;
}

export function inkPoint(map: InkMap, progress: number) {
  const target = map.minX + (map.maxX - map.minX) * Math.max(0, Math.min(1, progress));
  const rounded = Math.round(target);
  const exactY = map.centerYByX[rounded];
  if (Number.isFinite(exactY)) return { x: target, y: exactY };

  const previous = map.previousInkByX[rounded] ?? -1;
  const next = map.nextInkByX[rounded] ?? -1;
  if (previous >= 0 && next >= 0 && next !== previous) {
    const gapProgress = (target - previous) / (next - previous);
    const previousY = map.centerYByX[previous] || signatureSize.height / 2;
    const nextY = map.centerYByX[next] || previousY;
    const lift = Math.min(34, Math.max(7, (next - previous) * 0.07)) * Math.sin(gapProgress * Math.PI);
    return { x: target, y: previousY + (nextY - previousY) * gapProgress - lift };
  }

  const fallback = previous >= 0 ? previous : next >= 0 ? next : map.minX;
  return { x: fallback, y: map.centerYByX[fallback] || signatureSize.height / 2 };
}
