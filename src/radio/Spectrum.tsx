/**
 * The radio's displays: a glowing panadapter, a scrolling waterfall where
 * sent Morse leaves dots and dashes, and an LED S-meter. Everything is a
 * function of time `t` (and the key history), so the intro film can render
 * any frame exactly.
 */
import { useLayoutEffect, useRef } from "react";
import { spectrum } from "./signal";

const FLOOR = -122;
/** Display range: the noise floor sits ~70% down, a full carrier near the top. */
const BOTTOM = FLOOR - 30;
const TOP = -38;

/**
 * Spectra on a fixed time grid, cached: the waterfall and the peak hold reuse
 * rows across frames, so each frame computes about one new row instead of
 * eighty. Same pixels either way (the film relies on that), much less work
 * on a phone.
 */
const cache = new Map<string, number[]>();
function cachedSpectrum(step: number, index: number, bins: number, key: number, carrierAt: number) {
  const id = `${step}|${index}|${bins}|${key}|${carrierAt}`;
  let levels = cache.get(id);
  if (!levels) {
    levels = spectrum(index * step, bins, { key, carrierAt, floor: FLOOR });
    cache.set(id, levels);
    if (cache.size > 3000) cache.delete(cache.keys().next().value as string);
  }
  return levels;
}

/** "14.0253" → "14.025 3" (the classic SDR axis style). */
function axisLabel(mhz: number) {
  const s = mhz.toFixed(4);
  return s.endsWith("0") ? s.slice(0, -1) : `${s.slice(0, -1)} ${s.slice(-1)}`;
}

/** The trace's peak over the last second, for the hold line. */
function peakHold(t: number, bins: number, key: (t: number) => number, carrierAt: number) {
  const peak = new Array<number>(bins).fill(-200);
  const step = 0.13;
  const base = Math.floor(t / step);
  for (let k = 1; k <= 8; k += 1) {
    const index = base - k + 1;
    const levels = cachedSpectrum(step, index, bins, key(index * step), carrierAt);
    for (let i = 0; i < bins; i += 1) peak[i] = Math.max(peak[i], levels[i] - k * 0.8);
  }
  return peak;
}

export function Panadapter({ t, keyAt, vfo, width, height, zoom = 1, id = "pan" }: {
  t: number;
  keyAt: (t: number) => number;
  vfo: number;
  width: number;
  height: number;
  zoom?: number;
  id?: string;
}) {
  const ruler = 16;
  const plot = height - ruler;
  const carrierAt = 0.5;
  const bins = Math.max(80, Math.round(width / 2.6));
  const levels = spectrum(t, bins, { key: keyAt(t), carrierAt, floor: FLOOR });
  const peak = peakHold(t, bins, keyAt, carrierAt);
  const yOf = (db: number) => ruler + plot - ((db - BOTTOM) / (TOP - BOTTOM)) * plot;
  const xOf = (i: number) => (i / (bins - 1)) * width;
  const trace = levels.map((db, i) => `${xOf(i).toFixed(1)},${Math.max(ruler + 2, Math.min(height, yOf(db))).toFixed(1)}`).join(" ");
  const hold = peak.map((db, i) => `${xOf(i).toFixed(1)},${Math.max(ruler + 2, Math.min(height, yOf(db))).toFixed(1)}`).join(" ");
  const spanKHz = 3 / zoom;
  const left = vfo - spanKHz / 2000;
  const step = 0.25 / zoom >= 0.2 ? 0.25 : 0.1;
  const ticks: number[] = [];
  // Narrow (phone) displays label every other tick so the axis stays readable.
  const every = width < 520 ? 2 : 1;
  for (let k = Math.ceil((left * 1000) / (step * every)) * step * every; k < left * 1000 + spanKHz; k += step * every) ticks.push(k / 1000);
  const toX = (mhz: number) => ((mhz - left) * 1000 * width) / spanKHz;
  const centre = width * carrierAt;
  const pass = width * (0.5 / spanKHz) * 0.5;
  return (
    <svg className="rx-pan" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Spectrum around ${vfo.toFixed(6)} MHz`}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#03050b" />
          <stop offset="1" stopColor="#0a1124" />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ff6ff" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#3fa0ff" stopOpacity="0.62" />
          <stop offset="0.8" stopColor="#3b5bff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#6a2bd8" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${id}-pass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4aa8ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#4aa8ff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#4aa8ff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-5%" y="-30%" width="110%" height="160%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-bg)`} />
      <rect width={width} height={ruler} fill="#020306" />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={`v${i}`} x1={(i * width) / 12} y1={ruler} x2={(i * width) / 12} y2={height} stroke="#2a3c66" strokeOpacity="0.45" />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const y = ruler + (i * plot) / 5;
        return <line key={`h${i}`} x1="0" y1={y} x2={width} y2={y} stroke="#2a3c66" strokeOpacity="0.45" />;
      })}
      <rect x={centre - pass} y={ruler} width={pass * 2} height={plot} fill={`url(#${id}-pass)`} />
      <polygon points={`0,${height} ${trace} ${width},${height}`} fill={`url(#${id}-fill)`} />
      <polyline points={hold} fill="none" stroke="#ffd65a" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="2 3" />
      <polyline points={trace} fill="none" stroke="#c9fbff" strokeWidth="1.5" strokeLinejoin="round" filter={`url(#${id}-glow)`} />
      <line x1={centre} y1={ruler} x2={centre} y2={height} stroke="#ffe14d" strokeWidth="1.2" filter={`url(#${id}-glow)`} />
      <rect x={centre - 34} y={ruler + 4} width="68" height="14" rx="3" fill="#ffe14d" />
      <text x={centre} y={ruler + 14.5} textAnchor="middle" className="rx-pan-tag">{vfo.toFixed(4)}</text>
      {[-40, -60, -80, -100].map((db) => {
        const y = yOf(db);
        return y > ruler + 8 && y < height - 4 ? <text key={db} x="5" y={y - 3} className="rx-pan-db">{db}</text> : null;
      })}
      {ticks.map((mhz) => {
        const x = toX(mhz);
        return x > 24 && x < width - 24 ? <text key={mhz} x={x} y="11.5" textAnchor="middle" className="rx-pan-axis">{axisLabel(mhz)}</text> : null;
      })}
    </svg>
  );
}

/** Classic SDR waterfall palette: black, navy, blue, cyan, yellow, orange, white. */
const PALETTE: [number, [number, number, number]][] = [
  [0, [0, 0, 6]],
  [0.16, [4, 14, 60]],
  [0.36, [12, 66, 178]],
  [0.56, [18, 182, 232]],
  [0.72, [245, 233, 74]],
  [0.86, [255, 122, 24]],
  [1, [255, 255, 255]],
];

function colour(v: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, v));
  for (let i = 1; i < PALETTE.length; i += 1) {
    const [p1, c1] = PALETTE[i];
    if (x <= p1) {
      const [p0, c0] = PALETTE[i - 1];
      const f = (x - p0) / (p1 - p0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return PALETTE[PALETTE.length - 1][1];
}

/**
 * The newest row is at the top; each row below is a moment earlier, so the
 * Morse we send streams down the screen as dots and dashes.
 */
export function Waterfall({ t, keyAt, width, height, rows = 72, history = 2.4 }: {
  t: number;
  keyAt: (t: number) => number;
  width: number;
  height: number;
  rows?: number;
  history?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const bins = Math.max(80, Math.round(width / 4));
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
    if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    // A small buffer, scaled up smoothly: older iPhones lack OffscreenCanvas.
    const small = bufferRef.current ?? (bufferRef.current = document.createElement("canvas"));
    if (small.width !== bins) small.width = bins;
    if (small.height !== rows) small.height = rows;
    const smallContext = small.getContext("2d");
    if (!smallContext) return;
    const image = smallContext.createImageData(bins, rows);
    const step = history / rows;
    const newest = Math.floor(t / step);
    for (let r = 0; r < rows; r += 1) {
      const index = newest - r;
      const levels = cachedSpectrum(step, index, bins, keyAt(index * step), 0.5);
      for (let i = 0; i < bins; i += 1) {
        // Noise reads as blue texture, stations cyan to yellow, our carrier white-hot.
        const [cr, cg, cb] = colour((levels[i] - (FLOOR - 14)) / 66);
        const o = (r * bins + i) * 4;
        image.data[o] = cr;
        image.data[o + 1] = cg;
        image.data[o + 2] = cb;
        image.data[o + 3] = 255;
      }
    }
    smallContext.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(small, 0, 0, canvas.width, canvas.height);
  });
  return <canvas ref={canvasRef} className="rx-fall" style={{ width, height }} aria-hidden="true" />;
}

/** LED S-meter: S1..S9 green, +10..+60 red, with a peak marker. */
export function LedMeter({ s, segments = 30 }: { s: number; segments?: number }) {
  const lit = Math.round((Math.min(15, Math.max(0, s)) / 15) * segments);
  const s9 = Math.round((9 / 15) * segments);
  return (
    <div className="rx-led" aria-label={`Signal S${Math.min(9, Math.round(s))}`}>
      {Array.from({ length: segments }, (_, i) => (
        <i key={i} className={`${i < s9 ? "is-green" : "is-red"}${i < lit ? " is-lit" : ""}`} />
      ))}
    </div>
  );
}
