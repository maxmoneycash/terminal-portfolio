import { Easing, interpolate, random } from "remotion";

export const FPS = 30;

/** Seconds to frames. */
export const sec = (seconds: number) => Math.round(seconds * FPS);

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

/** 0→1 over [start, start + length] frames, clamped, with an optional easing. */
export function progress(frame: number, start: number, length: number, easing: (t: number) => number = (t) => t) {
  return easing(interpolate(frame, [start, start + Math.max(1, length)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Human typing: each character gets a deterministic, slightly irregular delay,
 * with a beat after punctuation. Returns the visible prefix at `frame`.
 */
export function typed(text: string, frame: number, start: number, cps = 20, seed = text): string {
  if (frame < start) return "";
  const elapsed = frame - start;
  let t = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const jitter = 0.65 + random(`${seed}-${i}`) * 0.7;
    t += (FPS / cps) * jitter;
    if (i > 0 && /[.,!?\n]/.test(text[i - 1])) t += FPS * 0.16;
    if (t > elapsed) return text.slice(0, i);
    if (ch === "\n") t += FPS * 0.12;
  }
  return text;
}

/** Frames needed to type `text` completely with `typed`. */
export function typingLength(text: string, cps = 20, seed = text): number {
  let t = 0;
  for (let i = 0; i < text.length; i += 1) {
    const jitter = 0.65 + random(`${seed}-${i}`) * 0.7;
    t += (FPS / cps) * jitter;
    if (i > 0 && /[.,!?\n]/.test(text[i - 1])) t += FPS * 0.16;
    if (text[i] === "\n") t += FPS * 0.12;
  }
  return Math.ceil(t);
}

/** XP's text caret blinks at roughly 530 ms. */
export const caretVisible = (frame: number) => Math.floor(frame / 16) % 2 === 0;

/** Keyframed value with per-segment easing. */
export type Key<T> = { f: number; v: T; ease?: (t: number) => number };

export function keyed(frame: number, keys: Key<number>[]): number {
  if (frame <= keys[0].f) return keys[0].v;
  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame <= b.f) {
      const t = (b.ease ?? easeInOut)((frame - a.f) / Math.max(1, b.f - a.f));
      return lerp(a.v, b.v, t);
    }
  }
  return keys[keys.length - 1].v;
}

export type Point = { x: number; y: number };

export function keyedPoint(frame: number, keys: Key<Point>[]): Point {
  return {
    x: keyed(frame, keys.map((k) => ({ f: k.f, v: k.v.x, ease: k.ease }))),
    y: keyed(frame, keys.map((k) => ({ f: k.f, v: k.v.y, ease: k.ease }))),
  };
}
