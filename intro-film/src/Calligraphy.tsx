/**
 * The quill writing "Maxwell Mohammadi", stroke by stroke. calligraphy.py
 * gives every ink pixel the moment the pen reaches it; here the vector
 * signature is drawn crisp at any size and revealed through that time map,
 * with a wet sheen on fresh ink and the quill riding the pen's track
 * (lifting between strokes). Pure function of `progress`.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, Img, staticFile } from "remotion";

const SOURCE = { width: 2048, height: 512 };
/** Ink bounds in source pixels (x0, x1, y0, y1), with a little room. */
const BOUNDS = { x0: 440, x1: 1596, y0: 150, y1: 372 };
/** Portrait splits the name into a signature block: strokes starting left of
 * this belong to "Maxwell", and the swash is divided here. */
const SPLIT_X = 1000;
const INK = "#0d1a3d";
const SHEEN = "#3f68d8";
const EMBOLDEN = 2.6;

type Box = { x0: number; x1: number; y0: number; y1: number };
type Data = {
  times: Uint16Array;
  index: Uint32Array;
  /** 0 for "Maxwell" (and the swash's left half), 1 for "Mohammadi". */
  word: Uint8Array;
  words: [Box, Box];
  path: [number, number, boolean][];
  strokes: [number, number, number][];
  swash: number;
  svg: HTMLImageElement;
};

/** Which word ink at (x, y), written at time t (0..1), belongs to. */
function wordAt(strokes: Data["strokes"], swash: number, t: number, x: number, y: number) {
  if (t >= swash) return x < SPLIT_X ? 0 : 1;
  // Right of the split, "Maxwell" only reaches up into the ll loops; ink on
  // the baseline there is the start of "Mohammadi".
  if (x >= SPLIT_X && y >= 285) return 1;
  let lo = 0;
  for (let k = 0; k < strokes.length && strokes[k][0] <= t; k += 1) lo = k;
  return strokes[lo][1] < SPLIT_X ? 0 : 1;
}
let cache: Data | null = null;
let loading: Promise<Data> | null = null;

function load(): Promise<Data> {
  if (cache) return Promise.resolve(cache);
  loading ??= (async () => {
    const [bin, pathJson, svgText] = await Promise.all([
      fetch(staticFile("signature/ink.bin")).then((r) => r.arrayBuffer()),
      fetch(staticFile("signature/path.json")).then((r) => r.json()),
      fetch(staticFile("maxwell_mohammadi_signature_full_canvas.svg")).then((r) => r.text()),
    ]);
    const count = bin.byteLength / 7;
    const view = new DataView(bin);
    const index = new Uint32Array(count);
    const times = new Uint16Array(count);
    for (let k = 0; k < count; k += 1) {
      index[k] = view.getUint32(k * 7, true);
      times[k] = view.getUint16(k * 7 + 4, true);
    }
    // The same bolder line the time map was traced from, in ink colour.
    const bold = svgText.replace('fill="#000000"', `fill="${INK}" stroke="${INK}" stroke-width="${EMBOLDEN}" stroke-linejoin="round"`);
    const svg = new Image();
    await new Promise<void>((resolve, reject) => {
      svg.onload = () => resolve();
      svg.onerror = () => reject(new Error("signature svg"));
      svg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bold)}`;
    });
    const strokes: Data["strokes"] = pathJson.strokes;
    const swash: number = pathJson.swash;
    const word = new Uint8Array(count);
    const words: [Box, Box] = [
      { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
      { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
    ];
    for (let k = 0; k < count; k += 1) {
      const x = index[k] % SOURCE.width;
      const y = Math.floor(index[k] / SOURCE.width);
      const w = wordAt(strokes, swash, times[k] / 65535, x, y);
      word[k] = w;
      const box = words[w];
      box.x0 = Math.min(box.x0, x - 4);
      box.x1 = Math.max(box.x1, x + 4);
      box.y0 = Math.min(box.y0, y - 4);
      box.y1 = Math.max(box.y1, y + 4);
    }
    cache = { times, index, word, words, path: pathJson.path, strokes, swash, svg };
    return cache;
  })();
  return loading;
}

function useData() {
  const [data, setData] = useState<Data | null>(cache);
  const [handle] = useState(() => (cache ? null : delayRender("Loading the calligraphy")));
  useEffect(() => {
    if (cache) return;
    void load().then((d) => {
      setData(d);
      if (handle !== null) continueRender(handle);
    });
  }, [handle]);
  return data;
}

/** Pen position at progress p, in source pixels, and whether it is on the paper. */
function penAt(path: Data["path"], p: number) {
  const f = Math.max(0, Math.min(1, p)) * (path.length - 1);
  const i = Math.floor(f);
  const a = path[i];
  const b = path[Math.min(path.length - 1, i + 1)];
  const t = f - i;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, down: a[2] && b[2] };
}

type Line = Box & { left: number; top: number; scale: number; word: -1 | 0 | 1 };

export function Calligraphy({ progress, width, twoLines = false, quill = 1 }: {
  /** 0..1 while writing; may run past 1 so the ink finishes drying. */
  progress: number;
  /** Display width of the signature block. */
  width: number;
  /** Portrait: "Maxwell" over "Mohammadi". */
  twoLines?: boolean;
  /** Quill size multiplier. */
  quill?: number;
}) {
  const data = useData();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const p = Math.max(0, Math.min(1, progress));
  // Past 1 the name is finished but the last strokes keep drying.
  const dry = Math.max(0, progress) * 65535;

  // Layout: one line, or two stacked lines each filling the width.
  const lines: Line[] = twoLines && data
    ? (() => {
        const [a, b] = data.words;
        const scale = width / Math.max(a.x1 - a.x0, b.x1 - b.x0);
        return [
          { ...a, left: 0, top: 0, scale, word: 0 as const },
          { ...b, left: width - (b.x1 - b.x0) * scale, top: (a.y1 - a.y0) * scale * 0.92, scale, word: 1 as const },
        ];
      })()
    : [{ ...BOUNDS, left: 0, top: 0, scale: width / (BOUNDS.x1 - BOUNDS.x0), word: -1 as const }];
  const height = Math.max(...lines.map((l) => l.top + (l.y1 - l.y0) * l.scale));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !data) return;
    const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    // Reveal mask at source resolution: written ink is opaque, a short
    // feather at the pen, and fresh ink also lands in the sheen channel.
    const mask = maskRef.current ?? (maskRef.current = document.createElement("canvas"));
    mask.width = SOURCE.width;
    mask.height = SOURCE.height;
    const mctx = mask.getContext("2d");
    if (!mctx) return;
    const now = p * 65535;
    const feather = 0.0025 * 65535;
    const wet = 0.05 * 65535;
    const maskFor = (word: number) => {
      const image = mctx.createImageData(SOURCE.width, SOURCE.height);
      const sheen = mctx.createImageData(SOURCE.width, SOURCE.height);
      for (let k = 0; k < data.index.length; k += 1) {
        const t = data.times[k];
        if (t > now + feather || (word >= 0 && data.word[k] !== word)) continue;
        const o = data.index[k] * 4;
        const a = t <= now ? 255 : Math.round(255 * (1 - (t - now) / feather));
        image.data[o + 3] = a;
        if (dry - t < wet) sheen.data[o + 3] = Math.round(a * (1 - Math.max(0, dry - t) / wet));
      }
      return { image, sheen };
    };

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const lctx = layer.getContext("2d");
    if (!lctx) return;
    lctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const line of lines) {
      const { image, sheen } = maskFor(line.word);
      const dx = line.left - line.x0 * line.scale;
      const dy = line.top - line.y0 * line.scale;
      for (const pass of ["ink", "sheen"] as const) {
        lctx.save();
        lctx.clearRect(0, 0, width, height);
        // No clip: the stroke mask alone picks this line's ink (a clip's
        // antialiased edge would leave a sliver of the other word behind).
        lctx.drawImage(data.svg, dx, dy, SOURCE.width * line.scale, SOURCE.height * line.scale);
        if (pass === "sheen") {
          lctx.globalCompositeOperation = "source-in";
          lctx.fillStyle = SHEEN;
          lctx.fillRect(0, 0, width, height);
        }
        mctx.putImageData(pass === "ink" ? image : sheen, 0, 0);
        lctx.globalCompositeOperation = "destination-in";
        lctx.imageSmoothingEnabled = true;
        lctx.imageSmoothingQuality = "high";
        lctx.drawImage(mask, dx, dy, SOURCE.width * line.scale, SOURCE.height * line.scale);
        lctx.restore();
        ctx.globalAlpha = pass === "ink" ? 1 : 0.7;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layer, 0, 0);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
  });

  // The quill rides the pen: tip on the paper while writing, lifted between
  // strokes, and gone once the name is finished.
  let pen = null;
  if (data && p > 0 && p < 1) {
    const at = penAt(data.path, p);
    const word = wordAt(data.strokes, data.swash, p, at.x, at.y);
    const line = lines.find((l) => l.word === -1 || l.word === word) ?? lines[0];
    const ahead = penAt(data.path, Math.min(1, p + 0.01));
    const lift = at.down ? 0 : 1;
    pen = {
      x: line.left + (at.x - line.x0) * line.scale,
      y: line.top + (at.y - line.y0) * line.scale - lift * 10,
      tilt: -6 + Math.max(-5, Math.min(5, (ahead.y - at.y) * 0.25)),
      lift,
    };
  }
  const fadeIn = Math.min(1, p / 0.015);
  const fadeOut = Math.min(1, (1 - p) / 0.04);
  const quillW = (BOUNDS.y1 - BOUNDS.y0) * lines[0].scale * 1.25 * quill;

  return (
    <div style={{ position: "relative", width, height }}>
      <canvas ref={canvasRef} style={{ position: "absolute", left: 0, top: 0, width, height }} />
      {pen ? (
        <div style={{ position: "absolute", left: pen.x, top: pen.y, opacity: Math.min(fadeIn, fadeOut), transform: `rotate(${pen.tilt}deg)`, transformOrigin: "0 0" }}>
          <Img
            src={staticFile("quill-pen-transparent.png")}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: quillW,
              transform: "translate(-0.6475%, -99.0955%)",
              filter: `drop-shadow(${4 + pen.lift * 6}px ${6 + pen.lift * 8}px ${4 + pen.lift * 4}px rgb(30 34 20 / ${0.3 - pen.lift * 0.08}))`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
