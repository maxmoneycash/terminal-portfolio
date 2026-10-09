/**
 * Plays a Morse timeline as a CW sidetone through Web Audio, scheduled ahead
 * on the audio clock so the visuals can follow the exact same clock.
 */
import { unitSeconds, type Timeline } from "./morse";

export type CwPlayback = {
  /** Audio-clock time (seconds) at which unit 0 starts. */
  start: number;
  context: AudioContext;
  stop: () => void;
};

const EDGE = 0.005; // 5 ms rise and fall: no key clicks

/**
 * `fromUnits` joins a send already in progress (keyed silently until sound
 * was allowed): unit 0 lands in the past and only what is still ahead plays.
 */
export function playCw(context: AudioContext, line: Timeline, { wpm, pitch, level }: { wpm: number; pitch: number; level: number }, fromUnits = 0): CwPlayback {
  const unit = unitSeconds(wpm);
  // A fresh send starts 120 ms ahead; a join keeps the clock exactly where
  // the silent keying is and lets the tone in from 40 ms on.
  const first = context.currentTime + (fromUnits > 0 ? 0.04 : 0.12);
  const start = fromUnits > 0 ? context.currentTime - fromUnits * unit : first;
  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.value = pitch;
  const key = context.createGain();
  key.gain.setValueAtTime(0, context.currentTime);
  for (const element of line.elements) {
    const on = start + element.on * unit;
    const off = start + element.off * unit;
    // An element already under way when the tone joins is skipped whole.
    if (on < first) continue;
    key.gain.setValueAtTime(0, on);
    key.gain.linearRampToValueAtTime(level, on + EDGE);
    key.gain.setValueAtTime(level, off - EDGE);
    key.gain.linearRampToValueAtTime(0, off);
  }
  osc.connect(key).connect(context.destination);
  osc.start(first);
  osc.stop(start + line.units * unit + 0.1);
  let stopped = false;
  return {
    start,
    context,
    stop: () => {
      if (stopped) return;
      stopped = true;
      const now = context.currentTime;
      key.gain.cancelScheduledValues(now);
      key.gain.setValueAtTime(key.gain.value, now);
      key.gain.linearRampToValueAtTime(0, now + EDGE);
      try { osc.stop(now + EDGE + 0.01); } catch { /* already stopped */ }
    },
  };
}
