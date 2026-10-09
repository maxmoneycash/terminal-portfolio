/**
 * International Morse code, timed the way a keyer sends it: dit 1 unit,
 * dah 3, 1 between elements, 3 between characters, 7 between words.
 * Prosigns are written in angle brackets (<BT>, <SK>) and sent as one
 * character. Shared by the site's radio and the intro film.
 */
const CODE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...",
  "8": "---..", "9": "----.", ".": ".-.-.-", ",": "--..--", "?": "..--..", "/": "-..-.", "!": "-.-.--", "'": ".----.",
  "=": "-...-", "<BT>": "-...-", "<SK>": "...-.-", "<AR>": ".-.-.", "<KN>": "-.--.",
};

export type Element = { on: number; off: number };
/** One sent character: when it starts and ends, in units, and how it reads. */
export type Sent = { text: string; start: number; end: number };
export type Timeline = { elements: Element[]; chars: Sent[]; units: number };

/** Split text into Morse characters, keeping <PROSIGNS> whole. */
function tokens(text: string): string[] {
  return text.toUpperCase().match(/<[A-Z]+>|\s+|./g) ?? [];
}

/** Lay out `text` in units. */
export function timeline(text: string): Timeline {
  const elements: Element[] = [];
  const chars: Sent[] = [];
  let t = 0;
  let pendingGap = 0;
  for (const token of tokens(text)) {
    if (/^\s+$/.test(token)) {
      pendingGap = 7;
      continue;
    }
    const code = CODE[token];
    if (!code) continue;
    t += chars.length ? Math.max(3, pendingGap) : 0;
    pendingGap = 0;
    const start = t;
    [...code].forEach((symbol, i) => {
      if (i) t += 1;
      const length = symbol === "." ? 1 : 3;
      elements.push({ on: t, off: t + length });
      t += length;
    });
    chars.push({ text: token, start, end: t });
  }
  return { elements, chars, units: t };
}

/** Seconds per unit at `wpm` words per minute (PARIS = 50 units). */
export const unitSeconds = (wpm: number) => 1.2 / wpm;

/** Whether the key is down at `unit`. */
export function keyed(line: Timeline, unit: number): boolean {
  let lo = 0;
  let hi = line.elements.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const e = line.elements[mid];
    if (unit < e.on) hi = mid - 1;
    else if (unit >= e.off) lo = mid + 1;
    else return true;
  }
  return false;
}

/** How a decoder prints a token: prosigns as their usual shorthand. */
const PRINT: Record<string, string> = { "<BT>": "=", "<AR>": "+", "<SK>": "SK", "<KN>": "KN" };
const printed = (token: string) => PRINT[token] ?? token;

/**
 * What a CW decoder has printed by `unit`: every finished character, with
 * word spaces where the sender paused.
 */
export function decoded(line: Timeline, text: string, unit: number): string {
  const words: string[] = [];
  let index = 0;
  for (const word of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    let current = "";
    for (const letter of word.match(/<[A-Z]+>|./g) ?? []) {
      const sent = line.chars[index];
      if (!sent || sent.end > unit) return [...words, current].filter(Boolean).join(" ");
      current += printed(letter);
      index += 1;
    }
    words.push(current);
  }
  return words.join(" ");
}
