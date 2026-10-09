/**
 * The band's look as a pure function of time: a rippling noise floor, a few
 * drifting stations, and our own CW carrier while the key is down. The site
 * animates it live; the intro film renders it frame by frame.
 */
function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const STATIONS = [
  { at: 0.12, level: 28, width: 0.006, drift: 0.004 },
  { at: 0.33, level: 18, width: 0.004, drift: -0.003 },
  { at: 0.71, level: 22, width: 0.005, drift: 0.002 },
  { at: 0.88, level: 14, width: 0.008, drift: -0.005 },
];

/**
 * dBm per bin across the passband at time `t` (seconds). `key` (0..1) puts
 * our carrier at `carrierAt` (0..1 across the span).
 */
export function spectrum(t: number, bins: number, { floor = -122, key = 0, carrierAt = 0.5, busy = 1 }: { floor?: number; key?: number; carrierAt?: number; busy?: number } = {}): number[] {
  const rate = 12;
  const k = Math.floor(t * rate);
  const blend = t * rate - k;
  const raw: number[] = [];
  for (let i = 0; i < bins; i += 1) {
    const x = i / (bins - 1);
    const noise = (1 - blend) * hash(i, k) + blend * hash(i, k + 1);
    const ripple = 3.2 * Math.sin(x * 37 + t * 1.3) + 2.1 * Math.sin(x * 91 - t * 2.2) + 1.4 * Math.sin(x * 13 + t * 0.6);
    let level = floor + ripple + noise * 9;
    for (const s of STATIONS) {
      const centre = s.at + Math.sin(t * 0.4 + s.at * 10) * s.drift;
      const d = (x - centre) / s.width;
      const fade = 0.55 + 0.45 * Math.sin(t * (0.7 + s.at) + s.at * 20);
      level = Math.max(level, floor + s.level * busy * fade * Math.exp(-d * d));
    }
    if (key > 0) {
      // At least about a bin wide, so narrow (phone) displays never miss it.
      const d = (x - carrierAt) / Math.max(0.0035, 0.9 / bins);
      level = Math.max(level, floor + 82 * key * Math.exp(-d * d) + (Math.abs(d) < 6 ? 6 * key : 0));
    }
    raw.push(level);
  }
  // A light blur across bins, like the display's averaging.
  return raw.map((v, i) => (raw[Math.max(0, i - 1)] + 2 * v + raw[Math.min(bins - 1, i + 1)]) / 4);
}

/** S-meter reading in S-units (0..9, then dB over S9 as 9 + dB/10). */
export function sMeter(t: number, key: number): number {
  const wobble = 0.5 * Math.sin(t * 5.1) + 0.3 * Math.sin(t * 13.7) + hash(Math.floor(t * 8), 7) * 0.6;
  return key > 0 ? 9 + 3 * key + wobble * 0.3 : 3 + wobble;
}

/** S-units to dBm (S9 = -73 dBm, 6 dB per S-unit). */
export const sToDbm = (s: number) => (s <= 9 ? -73 - (9 - s) * 6 : -73 + (s - 9) * 10);
