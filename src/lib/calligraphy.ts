/**
 * The quill writing "Maxwell Mohammadi". signatureStrokes.json (built by
 * scripts/signature from the traced signature) holds the pen's strokes in
 * writing order: centre lines with the ink's width and the moment the pen
 * reaches every point. Ink is the signature itself, revealed along those
 * strokes, so the result matches the signature exactly while the motion
 * follows a hand.
 *
 * Pure functions of time, shared by the site's quill window and the intro
 * film; no site imports.
 */
import strokes from "./signatureStrokes.json";

export type Stroke = {
  kind: "letter" | "extra" | "dot" | "swash";
  word: number;
  x: number[];
  y: number[];
  w: number[];
  t: number[];
};

export type Signature = {
  width: number;
  height: number;
  duration: number;
  split: number;
  embolden: number;
  bounds: [number, number, number, number];
  strokes: Stroke[];
};

export const signature = strokes as unknown as Signature;

export const INK = "#0d1a3d";
export const SHEEN = "#3f68d8";
const SVG_URL = "/maxwell_mohammadi_signature_full_canvas.svg";

/** The signature as an image in ink colour, slightly bolder than the trace. */
export function loadInk(url = SVG_URL, color = INK): Promise<HTMLImageElement> {
  return fetch(url)
    .then((r) => r.text())
    .then(
      (text) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const svg = text.replace('fill="#000000"', `fill="${color}" stroke="${color}" stroke-width="${signature.embolden}" stroke-linejoin="round"`);
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("signature ink"));
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }),
    );
}

/** Which line of a two-line layout a point belongs to: the swash splits by x. */
export function wordOf(stroke: Stroke, x: number) {
  return stroke.word >= 0 ? stroke.word : x < signature.split ? 0 : 1;
}

export type Pen = {
  x: number;
  y: number;
  /** 0 on the paper, up to 1 at the top of a hop between strokes. */
  lift: number;
  /** Direction of travel, radians. */
  heading: number;
  word: number;
};

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

/** Index of the last point at or before time t (t inside the stroke). */
function seek(times: number[], t: number) {
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Where the quill tip is at time t (seconds), in signature coordinates. */
export function penAt(t: number, data: Signature = signature): Pen {
  const list = data.strokes;
  const first = list[0];
  if (t <= first.t[0]) return { x: first.x[0], y: first.y[0], lift: 1, heading: 0, word: wordOf(first, first.x[0]) };
  for (let s = 0; s < list.length; s += 1) {
    const st = list[s];
    const end = st.t[st.t.length - 1];
    if (t <= end) {
      const i = seek(st.t, t);
      const j = Math.min(i + 1, st.t.length - 1);
      const u = j === i ? 0 : (t - st.t[i]) / Math.max(1e-6, st.t[j] - st.t[i]);
      const x = lerp(st.x[i], st.x[j], u);
      const y = lerp(st.y[i], st.y[j], u);
      const a = Math.max(0, i - 3);
      const b = Math.min(st.x.length - 1, i + 4);
      return { x, y, lift: 0, heading: Math.atan2(st.y[b] - st.y[a], st.x[b] - st.x[a]), word: wordOf(st, x) };
    }
    const next = list[s + 1];
    if (next && t < next.t[0]) {
      // A hop: the quill rises, travels, and comes down at the next stroke.
      const u = (t - end) / Math.max(1e-6, next.t[0] - end);
      const e = u * u * (3 - 2 * u);
      const x = lerp(st.x[st.x.length - 1], next.x[0], e);
      return {
        x,
        y: lerp(st.y[st.y.length - 1], next.y[0], e),
        lift: Math.sin(Math.PI * u),
        heading: Math.atan2(next.y[0] - st.y[st.y.length - 1], next.x[0] - st.x[st.x.length - 1]),
        word: u < 0.5 ? wordOf(st, st.x[st.x.length - 1]) : wordOf(next, next.x[0]),
      };
    }
  }
  const last = list[list.length - 1];
  const n = last.x.length - 1;
  return { x: last.x[n], y: last.y[n], lift: 1, heading: 0, word: wordOf(last, last.x[n]) };
}

export type View = {
  /** Display pixels per signature unit. */
  scale: number;
  /** Where signature (0, 0) lands, display pixels. */
  dx: number;
  dy: number;
  /** Only strokes (and swash points) on this line, for a two-line layout. */
  word?: number;
};

/** Paint the pen's strokes up to time t into `mask` (alpha = reach). */
function paintStrokes(ctx: CanvasRenderingContext2D, t: number, view: View, data: Signature, fresh?: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
  for (const st of data.strokes) {
    if (st.t[0] > t) break;
    const n = st.x.length;
    const px = (i: number) => view.dx + st.x[i] * view.scale;
    const py = (i: number) => view.dy + st.y[i] * view.scale;
    let width = -1;
    let open = false;
    for (let i = 0; i + 1 < n && st.t[i] <= t; i += 1) {
      if (view.word !== undefined && wordOf(st, st.x[i]) !== view.word) {
        if (open) ctx.stroke();
        open = false;
        continue;
      }
      if (fresh !== undefined && t - st.t[i + 1] > fresh) continue;
      let x1 = px(i + 1);
      let y1 = py(i + 1);
      if (st.t[i + 1] > t) {
        const u = (t - st.t[i]) / Math.max(1e-6, st.t[i + 1] - st.t[i]);
        x1 = lerp(px(i), x1, u);
        y1 = lerp(py(i), y1, u);
      }
      // Batch runs of nearly equal width into one path.
      const w = Math.max(0.6, Math.round(st.w[i] * view.scale * 4) / 4);
      if (fresh !== undefined) {
        if (open) ctx.stroke();
        ctx.globalAlpha = Math.max(0, 1 - (t - st.t[i]) / fresh);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(px(i), py(i));
        ctx.lineTo(x1, y1);
        ctx.stroke();
        open = false;
        continue;
      }
      if (!open || w !== width) {
        if (open) ctx.stroke();
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(px(i), py(i));
        width = w;
        open = true;
      }
      ctx.lineTo(x1, y1);
    }
    if (open) ctx.stroke();
    // A dot is a tap: it lands whole.
    if (st.kind === "dot" && st.t[0] <= t && (view.word === undefined || st.word === view.word)) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(...st.w) * view.scale;
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      ctx.lineTo(px(n - 1), py(n - 1));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

const scratch = new Map<string, HTMLCanvasElement>();

function canvasFor(key: string, width: number, height: number) {
  let c = scratch.get(key);
  if (!c) {
    c = document.createElement("canvas");
    scratch.set(key, c);
  }
  if (c.width !== width || c.height !== height) {
    c.width = width;
    c.height = height;
  }
  return c;
}

/**
 * Draw the signature as written by time t (seconds) onto ctx, whose canvas
 * pixels are `ratio` times the view's display pixels. Fresh ink carries a
 * brief wet sheen.
 */
export function drawSignature(ctx: CanvasRenderingContext2D, ink: CanvasImageSource, t: number, view: View, ratio = 1, data: Signature = signature) {
  const { width, height } = ctx.canvas;
  const at = { ...view, scale: view.scale * ratio, dx: view.dx * ratio, dy: view.dy * ratio };
  const mask = canvasFor("mask", width, height);
  const layer = canvasFor("layer", width, height);
  const mctx = mask.getContext("2d");
  const lctx = layer.getContext("2d");
  if (!mctx || !lctx) return;
  for (const pass of ["ink", "sheen"] as const) {
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, width, height);
    paintStrokes(mctx, t, at, data, pass === "sheen" ? 0.45 : undefined);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, width, height);
    lctx.imageSmoothingQuality = "high";
    lctx.drawImage(ink, at.dx, at.dy, data.width * at.scale, data.height * at.scale);
    if (pass === "sheen") {
      lctx.globalCompositeOperation = "source-in";
      lctx.fillStyle = SHEEN;
      lctx.fillRect(0, 0, width, height);
    }
    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(mask, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = pass === "ink" ? 1 : 0.55;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
}

/** The ink's extent for one line of a two-line layout (or the whole name). */
export function boundsOf(word?: number, data: Signature = signature) {
  if (word === undefined) {
    const [x0, y0, x1, y1] = data.bounds;
    return { x0, y0, x1, y1 };
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const st of data.strokes) {
    for (let i = 0; i < st.x.length; i += 1) {
      if (wordOf(st, st.x[i]) !== word) continue;
      const r = st.w[i] / 2;
      x0 = Math.min(x0, st.x[i] - r);
      x1 = Math.max(x1, st.x[i] + r);
      y0 = Math.min(y0, st.y[i] - r);
      y1 = Math.max(y1, st.y[i] + r);
    }
  }
  return { x0, y0, x1, y1 };
}
