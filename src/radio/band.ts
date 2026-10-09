/**
 * The 20 m CW band as an SDR sees it, one FFT row at a time: Rayleigh noise
 * grain, other stations keying their own Morse with fading and drift, a
 * birdie, the odd static crash, and our carrier (with key clicks) while the
 * key is down. Every row is a pure function of its index, so the site and
 * the intro film draw the same pixels.
 */
import { keyed, timeline, type Timeline } from "./morse";

/** One waterfall row. At 25 WPM a dot is exactly two rows. */
export const ROW_SECONDS = 0.024;
/** Displayed span at zoom 1. */
export const SPAN_HZ = 3000;
/** Noise floor in dBm: 0 dB SNR on every display. */
export const FLOOR_DBM = -122;
/** Our transmit signal at the VFO, in dB over the noise. */
const OWN_SNR = 63;

type Station = {
  hz: number;
  snr: number;
  wpm: number;
  text: string;
  /** Pause between repeats, seconds. */
  gap: number;
  phase: number;
  /** Fading depth (dB) and period (s). */
  qsb: number;
  qsbPeriod: number;
  /** What a skimmer would label the trace with. */
  tag: string;
};

const STATIONS: Station[] = [
  { hz: -1085, snr: 31, wpm: 18, text: "CQ CQ TEST", gap: 2.2, phase: 1.3, qsb: 9, qsbPeriod: 11, tag: "CQ TEST" },
  { hz: -560, snr: 20, wpm: 28, text: "5NN 05 TU", gap: 1.4, phase: 4.1, qsb: 6, qsbPeriod: 7, tag: "5NN" },
  { hz: 640, snr: 26, wpm: 22, text: "R R TNX FER QSO 73 GL", gap: 2.6, phase: 0.4, qsb: 7, qsbPeriod: 13, tag: "73 GL" },
  { hz: 1190, snr: 11, wpm: 15, text: "CQ DX CQ DX", gap: 3.5, phase: 2.2, qsb: 5, qsbPeriod: 17, tag: "CQ DX" },
];
const BIRDIE = { hz: 905, snr: 7 };

type Keyer = Station & { line: Timeline; unit: number; cycle: number };
const KEYERS: Keyer[] = STATIONS.map((s) => {
  const line = timeline(s.text);
  const unit = 1.2 / s.wpm;
  return { ...s, line, unit, cycle: line.units * unit + s.gap };
});

function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Where a station is in its message at time `t`: key state and units sent. */
function keyerAt(s: Keyer, t: number) {
  const local = (((t + s.phase) % s.cycle) + s.cycle) % s.cycle;
  const units = local / s.unit;
  return { down: units < s.line.units && keyed(s.line, units), units, local };
}

function stationHz(s: Station, t: number) {
  return s.hz + 2.4 * Math.sin(t * 0.07 + s.phase * 3);
}

function stationSnr(s: Station, t: number) {
  return s.snr - s.qsb * (0.5 - 0.5 * Math.sin((2 * Math.PI * t) / s.qsbPeriod + s.phase));
}

/** Short bursts of lightning static across the whole band, a few rows long. */
function crashDb(row: number) {
  const burst = Math.floor(row / 3);
  if (hash(burst, 9001) > 0.011) return 0;
  return (7 + 10 * hash(burst, 9002)) * (1 - 0.3 * (row % 3));
}

const lin = (db: number) => 10 ** (db / 10);

/**
 * Linear power per bin (noise mean = 1) for waterfall row `row`. `own` is
 * our key level on that row and its neighbours, for the key clicks.
 */
export function bandRow(row: number, bins: number, spanHz: number, own: { now: number; before: number; after: number }): Float32Array {
  const t = row * ROW_SECONDS;
  const out = new Float32Array(bins);
  const binHz = spanHz / Math.max(1, bins - 1);
  // The band breathes a little, and static crashes lift every bin at once.
  const floorGain = lin(0.7 * Math.sin(t * 0.9) + 0.4 * Math.sin(t * 2.3 + 1)) * lin(crashDb(row));

  const sources: { hz: number; power: number; sigma: number; skirt: number }[] = [];
  for (const s of KEYERS) {
    if (!keyerAt(s, t).down) continue;
    // Scintillation: strong signals still shimmer row to row.
    const shimmer = 0.8 + 0.4 * hash(row, Math.round(s.hz));
    sources.push({ hz: stationHz(s, t), power: lin(stationSnr(s, t)) * shimmer, sigma: Math.max(7, binHz * 1.1), skirt: 30 });
  }
  sources.push({ hz: BIRDIE.hz + 1.2 * Math.sin(t * 0.5), power: lin(BIRDIE.snr), sigma: Math.max(1.6, binHz * 0.8), skirt: 12 });
  if (own.now > 0) sources.push({ hz: 0, power: lin(OWN_SNR) * own.now, sigma: Math.max(8, binHz * 1.2), skirt: 34 });
  // Key clicks: a faint splash either side of the trace where our key changes.
  const click = own.now !== own.before || own.now !== own.after ? lin(OWN_SNR - 50) : 0;

  for (let i = 0; i < bins; i += 1) {
    const hz = (i / (bins - 1) - 0.5) * spanHz;
    // Rayleigh-distributed noise: exponential power, two FFTs averaged.
    const e1 = -Math.log(Math.max(1e-7, hash(i, row, 17)));
    const e2 = -Math.log(Math.max(1e-7, hash(i, row, 29)));
    let p = 0.5 * (e1 + e2) * floorGain;
    for (const s of sources) {
      const d = hz - s.hz;
      // Gaussian main lobe plus a phase-noise skirt about 55 dB down.
      p += s.power * (Math.exp(-0.5 * (d / s.sigma) ** 2) + 3e-6 / (1 + (d / s.skirt) ** 2));
    }
    if (click) p += (click / (1 + (hz / 60) ** 4)) * (0.6 + 0.8 * hash(i, row, 41));
    out[i] = p;
  }
  return out;
}

/** dB over the noise floor for a linear power. */
export const snrDb = (power: number) => 10 * Math.log10(Math.max(1e-9, power));

export type SkimmerTag = { hz: number; label: string; ageRows: number; snr: number };

/**
 * Skimmer-style labels: each station's trace is tagged where its last
 * message ended, and the tag scrolls down with the waterfall.
 */
export function skimmerTags(t: number, rows: number): SkimmerTag[] {
  const tags: SkimmerTag[] = [];
  for (const s of KEYERS) {
    const { local } = keyerAt(s, t);
    const sentFor = s.line.units * s.unit;
    // The end of each recent message, newest first.
    for (let end = t - local + sentFor - (local < sentFor ? s.cycle : 0), n = 0; n < 3; end -= s.cycle, n += 1) {
      const ageRows = (t - end) / ROW_SECONDS;
      if (ageRows < 0 || ageRows > rows) continue;
      tags.push({ hz: stationHz(s, end), label: `${s.tag} ${s.wpm}`, ageRows, snr: stationSnr(s, end) });
    }
  }
  return tags;
}

/** Stations keying right now, for the panadapter's detection marks. */
export function activeStations(t: number) {
  return KEYERS.filter((s) => {
    const { local } = keyerAt(s, t);
    return local < s.line.units * s.unit + 0.4;
  }).map((s) => ({ hz: stationHz(s, t), snr: stationSnr(s, t), tag: s.tag, wpm: s.wpm }));
}
