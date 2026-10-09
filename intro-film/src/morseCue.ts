/**
 * The film's Morse, keyed on the beat grid (one unit = a 32nd note). The
 * soundtrack plays the same cues (music.py), so the TX lamp and the beeps
 * land together.
 */
import score from "../score.json";
import { decoded, keyed, timeline } from "../../src/radio/morse";

export type CueId = "boot" | "station";
const cues = Object.fromEntries(score.morse.map((cue) => [cue.id, { ...cue, line: timeline(cue.text) }]));

/** Keying state of a cue at an absolute film frame. */
export function cueAt(id: CueId, frame: number) {
  const cue = cues[id];
  const unit = (frame - cue.start) / cue.framesPerUnit;
  const done = unit >= cue.line.units;
  return {
    key: unit >= 0 && !done && keyed(cue.line, unit) ? 1 : 0,
    sending: unit >= 0 && !done,
    started: unit >= 0,
    text: unit >= 0 ? decoded(cue.line, cue.text, unit) : "",
    lastFrame: cue.start + cue.line.units * cue.framesPerUnit,
  };
}
