/**
 * The radio's displays. `Scope` is the SDR view: a stats strip, a live FFT
 * panadapter with the CW filter, peak hold and detection marks, a frequency
 * ruler, and a per-pixel waterfall with UTC time ticks, a dB colour bar and
 * skimmer tags that scroll down with each station's trace. Everything is a
 * function of time `t` and the key history, so the intro film renders any
 * frame exactly; rows are cached so a live frame computes about one new row.
 */
import { useLayoutEffect, useRef } from "react";
import { activeStations, bandRow, FLOOR_DBM, ROW_SECONDS, skimmerTags, snrDb, SPAN_HZ } from "./band";

/** Waterfall colours by dB over the noise: navy grain, cyan, yellow, red, white-hot. */
const STOPS: [number, string][] = [
  [-9, "#000105"],
  [-3, "#01071e"],
  [1, "#05154c"],
  [5, "#0a288a"],
  [10, "#1553d2"],
  [16, "#1492ec"],
  [22, "#19cbe8"],
  [28, "#70f2b4"],
  [34, "#e9f24e"],
  [41, "#ffb321"],
  [49, "#ff5a1f"],
  [57, "#ff2f55"],
  [66, "#fff6f2"],
];
const LUT_MIN = STOPS[0][0];
const LUT_MAX = STOPS[STOPS.length - 1][0];
const LUT = (() => {
  const rgb = STOPS.map(([db, hex]) => [db, parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i += 1) {
    const db = LUT_MIN + (i / 255) * (LUT_MAX - LUT_MIN);
    let k = 1;
    while (k < rgb.length - 1 && db > rgb[k][0]) k += 1;
    const [d0, r0, g0, b0] = rgb[k - 1];
    const [d1, r1, g1, b1] = rgb[k];
    const f = Math.max(0, Math.min(1, (db - d0) / (d1 - d0)));
    lut[i * 3] = r0 + (r1 - r0) * f;
    lut[i * 3 + 1] = g0 + (g1 - g0) * f;
    lut[i * 3 + 2] = b0 + (b1 - b0) * f;
  }
  return lut;
})();

function paint(power: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(power.length * 4);
  for (let i = 0; i < power.length; i += 1) {
    const v = Math.round(((snrDb(power[i]) - LUT_MIN) / (LUT_MAX - LUT_MIN)) * 255);
    const j = Math.max(0, Math.min(255, v)) * 3;
    out[i * 4] = LUT[j];
    out[i * 4 + 1] = LUT[j + 1];
    out[i * 4 + 2] = LUT[j + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

const MONO = "Consolas, 'Lucida Console', Menlo, monospace";
const PAN_TOP = -38;
const PAN_BOTTOM = -134;
const AVERAGE = 4;
const HOLD_ROWS = 50;

type Store = { id: string; power: Map<number, Float32Array>; rgba: Map<number, Uint8ClampedArray>; buffer: HTMLCanvasElement | null; image: ImageData | null };

/** "14.0245" style axis label. */
const mhzLabel = (mhz: number) => mhz.toFixed(4);
const utc = (ms: number) => new Date(ms).toISOString().slice(11, 19) + "Z";

export function Scope({ t, keyAt, vfo, width, height, zoom = 1, epochMs, tx }: {
  t: number;
  keyAt: (t: number) => number;
  vfo: number;
  width: number;
  height: number;
  zoom?: number;
  /** Wall-clock ms at t = 0, for the waterfall's time ticks. */
  epochMs: number;
  /** Label for our own trace while sending, e.g. "KK6OQA 25 WPM". */
  tx?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef<Store>({ id: "", power: new Map(), rgba: new Map(), buffer: null, image: null });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Logical size from layout (CSS may stretch it on phones); device ratio
    // includes any transform scale on the radio stage, so pixels stay crisp.
    const W = canvas.offsetWidth || width;
    const H = canvas.offsetHeight || height;
    const shown = canvas.getBoundingClientRect().width;
    const ratio = Math.max(1, Math.min(4, (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1) * (shown > 0 ? shown / W : 1)));
    const deviceW = Math.round(W * ratio);
    const deviceH = Math.round(H * ratio);
    if (canvas.width !== deviceW) canvas.width = deviceW;
    if (canvas.height !== deviceH) canvas.height = deviceH;

    const narrow = W < 520;
    const head = 14;
    const ruler = 15;
    const pan = Math.round((H - head - ruler) * (narrow ? 0.36 : 0.4));
    const panTop = head;
    const rulerTop = panTop + pan;
    const fallTop = rulerTop + ruler;
    const fallH = H - fallTop;
    const spanHz = SPAN_HZ / zoom;
    const xOf = (hz: number) => (hz / spanHz + 0.5) * W;
    const yOf = (dbm: number) => panTop + ((PAN_TOP - dbm) / (PAN_TOP - PAN_BOTTOM)) * pan;

    // One waterfall pixel ("grain") is a whole number of device pixels.
    const grain = Math.max(1, Math.round(ratio));
    const bins = Math.max(96, Math.min(1800, Math.round(deviceW / grain)));
    const rows = Math.max(32, Math.round((fallH * ratio) / grain));
    const store = storeRef.current;
    const id = `${bins}|${spanHz}`;
    if (store.id !== id) {
      store.id = id;
      store.power.clear();
      store.rgba.clear();
    }
    const newest = Math.floor(t / ROW_SECONDS);
    const row = (k: number) => {
      let p = store.power.get(k);
      if (!p) {
        p = bandRow(k, bins, spanHz, { now: keyAt(k * ROW_SECONDS), before: keyAt((k - 1) * ROW_SECONDS), after: keyAt((k + 1) * ROW_SECONDS) });
        store.power.set(k, p);
        store.rgba.set(k, paint(p));
      }
      return p;
    };
    for (const k of store.power.keys()) {
      if (k < newest - rows - HOLD_ROWS - 8 || k > newest + 2) {
        store.power.delete(k);
        store.rgba.delete(k);
      }
    }

    // --- Waterfall pixels, newest row on top -------------------------------
    const buffer = store.buffer ?? (store.buffer = document.createElement("canvas"));
    if (buffer.width !== bins) buffer.width = bins;
    if (buffer.height !== rows) buffer.height = rows;
    const bctx = buffer.getContext("2d");
    if (!bctx) return;
    if (store.image?.width !== bins || store.image.height !== rows) store.image = bctx.createImageData(bins, rows);
    const image = store.image;
    for (let r = 0; r < rows; r += 1) {
      row(newest - r);
      image.data.set(store.rgba.get(newest - r) as Uint8ClampedArray, r * bins * 4);
    }
    bctx.putImageData(image, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#03060c";
    ctx.fillRect(0, 0, deviceW, deviceH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0, bins, rows, 0, Math.round(fallTop * ratio), bins * grain, rows * grain);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // --- Averaged spectrum and peak hold -----------------------------------
    const avg = new Float32Array(bins);
    for (let a = 0; a < AVERAGE; a += 1) {
      const p = row(newest - a);
      for (let i = 0; i < bins; i += 1) avg[i] += p[i] / AVERAGE;
    }
    const hold = new Float32Array(bins).fill(-999);
    for (let a = 0; a < HOLD_ROWS; a += 2) {
      const p = row(newest - a);
      for (let i = 0; i < bins; i += 1) hold[i] = Math.max(hold[i], snrDb(p[i]) - a * 0.09);
    }
    let peak = -999;
    let quiet = 0;
    let quietBins = 0;
    for (let i = 0; i < bins; i += 1) {
      const db = snrDb(avg[i]);
      peak = Math.max(peak, db);
      if (db < 6) {
        quiet += db;
        quietBins += 1;
      }
    }
    const binX = (i: number) => (i / (bins - 1)) * W;

    // --- Stats strip -------------------------------------------------------
    ctx.fillStyle = "#060b15";
    ctx.fillRect(0, 0, W, head);
    ctx.fillStyle = "#1a2a47";
    ctx.fillRect(0, head - 1, W, 1);
    ctx.font = `9px ${MONO}`;
    ctx.textBaseline = "middle";
    const rbw = spanHz / bins;
    ctx.fillStyle = "#6fa2d8";
    ctx.textAlign = "left";
    ctx.fillText(narrow ? `RBW ${rbw.toFixed(1)} Hz · ${Math.round(1 / ROW_SECONDS)} fps` : `FFT 16384 · RBW ${rbw.toFixed(1)} Hz · ${Math.round(1 / ROW_SECONDS)} fps · AVG ${AVERAGE} · BH4`, 6, head / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9fd8ff";
    const nf = FLOOR_DBM + (quietBins ? quiet / quietBins : 0);
    ctx.fillText(narrow ? `PK ${(FLOOR_DBM + peak).toFixed(1)} dBm` : `NF ${nf.toFixed(1)} dBm   PK ${(FLOOR_DBM + peak).toFixed(1)} dBm`, W - 6, head / 2);

    // --- Panadapter --------------------------------------------------------
    const bg = ctx.createLinearGradient(0, panTop, 0, panTop + pan);
    bg.addColorStop(0, "#02050c");
    bg.addColorStop(1, "#08132a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, panTop, W, pan);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, panTop, W, pan);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgb(86 128 196 / 0.16)";
    for (let db = -40; db >= -130; db -= 10) {
      const y = Math.round(yOf(db)) + 0.5;
      ctx.beginPath();
      ctx.setLineDash(db % 20 ? [1, 3] : []);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.setLineDash([1, 3]);
    for (let hz = -1500; hz <= 1500; hz += 250) {
      const x = Math.round(xOf(hz)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, panTop);
      ctx.lineTo(x, panTop + pan);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // CW filter passband (500 Hz) around the VFO.
    const pl = xOf(-250);
    const pr = xOf(250);
    ctx.fillStyle = "rgb(255 196 64 / 0.075)";
    ctx.fillRect(pl, panTop, pr - pl, pan);
    ctx.strokeStyle = "rgb(255 196 64 / 0.55)";
    ctx.beginPath();
    ctx.moveTo(Math.round(pl) + 0.5, panTop);
    ctx.lineTo(Math.round(pl) + 0.5, panTop + pan);
    ctx.moveTo(Math.round(pr) - 0.5, panTop);
    ctx.lineTo(Math.round(pr) - 0.5, panTop + pan);
    ctx.stroke();

    // Trace: filled, glowing, then a crisp line on top.
    const trace = new Path2D();
    for (let i = 0; i < bins; i += 1) {
      const y = Math.max(panTop + 1, yOf(FLOOR_DBM + snrDb(avg[i])));
      if (i === 0) trace.moveTo(0, y);
      else trace.lineTo(binX(i), y);
    }
    const area = new Path2D(trace);
    area.lineTo(W, panTop + pan);
    area.lineTo(0, panTop + pan);
    area.closePath();
    const fill = ctx.createLinearGradient(0, panTop, 0, panTop + pan);
    fill.addColorStop(0, "rgb(120 220 255 / 0.42)");
    fill.addColorStop(0.55, "rgb(40 120 240 / 0.20)");
    fill.addColorStop(1, "rgb(20 50 140 / 0.04)");
    ctx.fillStyle = fill;
    ctx.fill(area);

    const holdLine = new Path2D();
    for (let i = 0; i < bins; i += 1) {
      const y = Math.max(panTop + 1, yOf(FLOOR_DBM + hold[i]));
      if (i === 0) holdLine.moveTo(0, y);
      else holdLine.lineTo(binX(i), y);
    }
    ctx.strokeStyle = "rgb(255 168 64 / 0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke(holdLine);

    ctx.strokeStyle = "rgb(80 190 255 / 0.32)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke(trace);
    ctx.strokeStyle = "#e3f7ff";
    ctx.lineWidth = 1;
    ctx.stroke(trace);

    // Detection marks on every station keying now; M1 on the strongest.
    const live = activeStations(t).filter((s) => s.snr > 12);
    let m1: (typeof live)[number] | null = null;
    ctx.fillStyle = "#7fe6ff";
    for (const s of live) {
      const i = Math.round((s.hz / spanHz + 0.5) * (bins - 1));
      let top = -999;
      for (let j = Math.max(0, i - 3); j <= Math.min(bins - 1, i + 3); j += 1) top = Math.max(top, snrDb(avg[j]));
      if (top < 10) continue;
      const x = xOf(s.hz);
      const y = Math.max(panTop + 10, yOf(FLOOR_DBM + top) - 5);
      ctx.beginPath();
      ctx.moveTo(x - 3.5, y - 6);
      ctx.lineTo(x + 3.5, y - 6);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      if (!m1 || s.snr > m1.snr) m1 = s;
    }
    if (m1 && !narrow) {
      ctx.font = `9px ${MONO}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#7fe6ff";
      ctx.fillText(`M1 ${(vfo + m1.hz / 1e6).toFixed(6)} MHz  ${(FLOOR_DBM + m1.snr).toFixed(1)} dBm`, W - 6, panTop + 5);
    }

    // dB scale.
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#5e7fb0";
    for (let db = -40; db >= -120; db -= 20) {
      const y = yOf(db);
      if (y > panTop + 10 && y < panTop + pan - 2) ctx.fillText(String(db), 4, y - 1);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgb(255 196 64 / 0.8)";
    ctx.fillText("CW 500", pr + 3, panTop + 4);
    ctx.restore();

    // --- Frequency ruler ---------------------------------------------------
    ctx.fillStyle = "#050913";
    ctx.fillRect(0, rulerTop, W, ruler);
    ctx.fillStyle = "#1a2a47";
    ctx.fillRect(0, rulerTop, W, 1);
    ctx.fillRect(0, rulerTop + ruler - 1, W, 1);
    ctx.strokeStyle = "#5d7db0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let hz = -1500; hz <= 1500; hz += 50) {
      const x = Math.round(xOf(hz)) + 0.5;
      const major = hz % 250 === 0;
      ctx.moveTo(x, rulerTop + 1);
      ctx.lineTo(x, rulerTop + (major ? 5 : 3));
    }
    ctx.stroke();
    ctx.font = `9px ${MONO}`;
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";
    ctx.fillStyle = "#9cbbe6";
    const labelEvery = narrow ? 1000 : 500;
    for (let hz = -1500; hz <= 1500; hz += labelEvery) {
      const x = xOf(hz);
      if (x > 24 && x < W - 24) ctx.fillText(mhzLabel(vfo + hz / 1e6), x, rulerTop + ruler - 1);
    }
    ctx.fillStyle = "#ff3b3b";
    const cx = xOf(0);
    ctx.beginPath();
    ctx.moveTo(cx - 4, rulerTop + ruler - 1);
    ctx.lineTo(cx + 4, rulerTop + ruler - 1);
    ctx.lineTo(cx, rulerTop + ruler - 6);
    ctx.closePath();
    ctx.fill();

    // --- VFO line through both displays -----------------------------------
    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(Math.round(cx), panTop, 1, pan);
    ctx.fillStyle = "rgb(255 59 59 / 0.32)";
    for (let y = fallTop; y < H; y += 6) ctx.fillRect(Math.round(cx), y, 1, 3);

    // --- Waterfall overlays -----------------------------------------------
    const rowY = (age: number) => fallTop + (age * fallH) / rows;
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const oldest = t - rows * ROW_SECONDS;
    for (let s = Math.ceil(oldest); s <= t; s += 1) {
      const y = rowY((t - s) / ROW_SECONDS);
      if (y < fallTop + 2 || y > H - 2) continue;
      ctx.fillStyle = "rgb(200 225 255 / 0.55)";
      ctx.fillRect(0, Math.round(y), 6, 1);
      if (s % 2 === 0 && y > fallTop + 6 && y < H - 6) {
        ctx.fillStyle = "rgb(0 0 0 / 0.55)";
        ctx.fillText(utc(epochMs + s * 1000), 9, y + 1);
        ctx.fillStyle = "rgb(214 232 255 / 0.82)";
        ctx.fillText(utc(epochMs + s * 1000), 8, y);
      }
    }

    // Skimmer tags ride down with each trace.
    ctx.font = `bold 9px ${MONO}`;
    ctx.textBaseline = "middle";
    for (const tag of skimmerTags(t, rows)) {
      const y = rowY(tag.ageRows);
      if (y < fallTop + 6 || y > H - 7) continue;
      const text = tag.label;
      const w = ctx.measureText(text).width + 8;
      let x = xOf(tag.hz) + 6;
      if (x + w > W - 14) x = xOf(tag.hz) - 6 - w;
      ctx.fillStyle = "rgb(2 8 22 / 0.72)";
      ctx.fillRect(x, y - 6, w, 12);
      ctx.fillStyle = tag.snr > 24 ? "#ffd23f" : "#4fd8ff";
      ctx.fillRect(x, y - 6, 2, 12);
      ctx.fillStyle = "#e4f4ff";
      ctx.fillText(text, x + 5, y + 0.5);
    }
    if (tx) {
      const text = `TX ${tx}`;
      const w = ctx.measureText(text).width + 10;
      const x = Math.min(W - w - 14, cx + 8);
      ctx.fillStyle = "rgb(30 4 6 / 0.8)";
      ctx.fillRect(x, fallTop + 5, w, 13);
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(x, fallTop + 5, 2, 13);
      ctx.fillStyle = "#ffd9d4";
      ctx.fillText(text, x + 6, fallTop + 12);
    }

    // dB colour bar.
    const barX = W - 7;
    const barTop = fallTop + 6;
    const barH = fallH - 12;
    const bar = ctx.createLinearGradient(0, barTop + barH, 0, barTop);
    STOPS.forEach(([db, hex]) => bar.addColorStop((db - LUT_MIN) / (LUT_MAX - LUT_MIN), hex));
    ctx.fillStyle = "rgb(0 0 0 / 0.5)";
    ctx.fillRect(barX - 1, barTop - 1, 6, barH + 2);
    ctx.fillStyle = bar;
    ctx.fillRect(barX, barTop, 4, barH);
    if (!narrow) {
      ctx.font = `8px ${MONO}`;
      ctx.textAlign = "right";
      ctx.fillStyle = "rgb(214 232 255 / 0.7)";
      for (const db of [-60, -90, -120]) {
        const y = barTop + barH - ((db - FLOOR_DBM - LUT_MIN) / (LUT_MAX - LUT_MIN)) * barH;
        if (y > barTop + 4 && y < barTop + barH - 2) ctx.fillText(String(db), barX - 3, y);
      }
    }

    ctx.strokeStyle = "#1d2c48";
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  });

  return <canvas ref={canvasRef} className="rx-scope" style={{ width, height }} role="img" aria-label={`Spectrum and waterfall around ${vfo.toFixed(6)} MHz`} />;
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
