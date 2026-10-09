/**
 * The film's beat grid, shared with music.py through score.json: 128.57 BPM,
 * so one beat is exactly 14 frames at 30 fps. Scenes last whole beats, cuts
 * land on bar lines, and the drops push the frame on every kick.
 */
import score from "../score.json";

export const BEAT = score.framesPerBeat;
export const BAR = BEAT * 4;
/** Frames for `n` beats. */
export const beats = (n: number) => Math.round(n * BEAT);

type Section = { name: string; bars: number; start: number; end: number };
export const SECTIONS: Section[] = score.sections.reduce<Section[]>((list, section) => {
  const start = list.length ? list[list.length - 1].end : 0;
  list.push({ ...section, start: start, end: start + section.bars * BAR });
  return list;
}, []);

export const FILM_BEATS = SECTIONS[SECTIONS.length - 1].end / BEAT;

export function sectionAt(frame: number): Section {
  return SECTIONS.find((s) => frame >= s.start && frame < s.end) ?? SECTIONS[SECTIONS.length - 1];
}

const isDrop = (s: Section) => s.name.startsWith("drop");

/**
 * Kick envelope at an absolute film frame: 1 on the beat, decaying over a few
 * frames. Downbeats hit harder; only the drops have a kick at all.
 */
export function kick(frame: number): number {
  const section = sectionAt(frame);
  if (!isDrop(section) || frame >= SECTIONS[SECTIONS.length - 1].end - BAR) return 0;
  const sinceBeat = (frame - section.start) % BEAT;
  const downbeat = Math.floor((frame - section.start) / BEAT) % 4 === 0;
  return (downbeat ? 1 : 0.55) * Math.exp(-sinceBeat / 2.6);
}

/** 1 on the first frames of each drop (and the final hit), for the flash. */
export function dropFlash(frame: number): number {
  const hits = [...SECTIONS.filter(isDrop).map((s) => s.start), SECTIONS[SECTIONS.length - 1].end - BAR];
  const since = Math.min(...hits.map((h) => (frame >= h ? frame - h : Infinity)));
  return since === Infinity ? 0 : Math.exp(-since / 3.2) * (since < 12 ? 1 : 0);
}
