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

export function playCw(context: AudioContext, line: Timeline, { wpm, pitch, level }: { wpm: number; pitch: number; level: number }): CwPlayback {
  const unit = unitSeconds(wpm);
  const start = context.currentTime + 0.12;
  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.value = pitch;
  const key = context.createGain();
  key.gain.setValueAtTime(0, context.currentTime);
  for (const element of line.elements) {
    const on = start + element.on * unit;
    const off = start + element.off * unit;
    key.gain.setValueAtTime(0, on);
    key.gain.linearRampToValueAtTime(level, on + EDGE);
    key.gain.setValueAtTime(level, off - EDGE);
    key.gain.linearRampToValueAtTime(0, off);
  }
  osc.connect(key).connect(context.destination);
  osc.start(start);
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
