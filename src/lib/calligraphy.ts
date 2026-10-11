/** Recorded handwriting, retimed once and shared by the site and intro film. */
import recording from "./signatureRecording.json";

export const signature = recording;
export const INK = "#0d1a3d";
export const SHEEN = "#3f68d8";
export type Pen = { x: number; y: number; lift: number; heading: number; word: number };
export type View = { scale: number; dx: number; dy: number; word?: number };
type Layer = { canvas: HTMLCanvasElement; pixels: ImageData; at: number };
type Ink = { times: Uint16Array; coverage: Uint8Array; words: Uint8Array; indices: number[]; layers: Map<number, Layer> };
const images = new WeakMap<HTMLImageElement, Ink>();

/** The opaque atlas stores arrival time in R/G and ink coverage in B. */
export function loadInk(url = signature.atlas): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const layer = document.createElement("canvas");
        layer.width = signature.width;
        layer.height = signature.height;
        const ctx = layer.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Signature canvas unavailable");
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, layer.width, layer.height).data;
        const times = new Uint16Array(layer.width * layer.height);
        const coverage = new Uint8Array(times.length);
        const indices: number[] = [];
        const words = new Uint8Array(times.length);
        for (let i = 0; i < times.length; i++) {
          const encoded = data[i * 4] * 256 + data[i * 4 + 1];
          times[i] = encoded & 32767;
          words[i] = encoded >> 15;
          coverage[i] = data[i * 4 + 2];
          if (coverage[i]) indices.push(i);
        }
        images.set(image, { times, coverage, words, indices, layers: new Map() });
        resolve(image);
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Signature ink could not load"));
    image.src = url;
  });
}

function seek(t: number) {
  const points = signature.pen;
  let lo = 0, hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid][0] <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}
const breaks = new Set(signature.breaks);
const overlaps = new Map(signature.overlaps.map(([index, time]) => [index, time]));

/** Follow the newly recorded ink; travel above the page between strokes. */
export function penAt(t: number): Pen {
  const points = signature.pen;
  const i = seek(t), j = Math.min(i + 1, points.length - 1);
  const a = points[i], b = points[j];
  const u = Math.max(0, Math.min(1, (t - a[0]) / Math.max(0.0001, b[0] - a[0])));
  const lifted = breaks.has(j) && i !== j;
  const e = lifted ? u * u * (3 - 2 * u) : u;
  const x = a[1] + (b[1] - a[1]) * e;
  const y = a[2] + (b[2] - a[2]) * e;
  return { x, y, lift: t <= 0 || t >= signature.duration ? 1 : lifted ? Math.sin(Math.PI * u) : 0,
    heading: Math.atan2(b[2] - a[2], b[1] - a[1]), word: u < 0.5 ? a[3] : b[3] };
}

/** Deterministic at any timestamp, including backwards seeks during rendering. */
export function drawSignature(ctx: CanvasRenderingContext2D, image: HTMLImageElement, t: number, view: View, ratio = 1) {
  const ink = images.get(image);
  if (!ink) return;
  const key = view.word ?? -1;
  let layer = ink.layers.get(key);
  if (!layer) {
    const canvas = document.createElement("canvas");
    canvas.width = signature.width;
    canvas.height = signature.height;
    layer = { canvas, pixels: canvas.getContext("2d")!.createImageData(canvas.width, canvas.height), at: -Infinity };
    ink.layers.set(key, layer);
  }
  if (layer.at !== t) {
    const data = layer.pixels.data;
    for (const i of ink.indices) {
      const crossing = key === 1 ? overlaps.get(i) : undefined;
      const age = t - ((crossing ?? ink.times[i]) - 1) / 32766 * signature.duration;
      const fresh = Math.max(0, 1 - age / 0.4) * 0.35;
      data[i * 4] = Math.round(13 + 50 * fresh);
      data[i * 4 + 1] = Math.round(26 + 78 * fresh);
      data[i * 4 + 2] = Math.round(61 + 155 * fresh);
      data[i * 4 + 3] = t > 0 && age >= 0 && (key < 0 || ink.words[i] === key || crossing !== undefined) ? ink.coverage[i] : 0;
    }
    layer.canvas.getContext("2d")!.putImageData(layer.pixels, 0, 0);
    layer.at = t;
  }
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(layer.canvas, view.dx, view.dy, signature.width * view.scale, signature.height * view.scale);
  ctx.restore();
}

export function boundsOf(word?: number) {
  const [x0, y0, x1, y1] = word === undefined ? signature.bounds : signature.wordBounds[word];
  return { x0, y0, x1, y1 };
}
