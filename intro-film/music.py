#!/usr/bin/env python3
"""Arrange the intro's soundtrack from GarageBand's Apple Loops.

GarageBand's license allows its loops in your own soundtracks, royalty-free.
Everything sits on the film's beat grid (score.json): 128.57 BPM, so one beat
is exactly 14 frames at 30 fps and every cut can land on a beat. The loops are
the Electro House pack's C-minor set, chosen because their chords line up bar
by bar; risers, impacts and the crash are synthesized here in C.

Writes .intro-build/film/public/music/soundtrack.wav (48 kHz stereo).
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import ndimage, signal

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / ".intro-build" / "film" / "public" / "music" / "soundtrack.wav"
LOOPS = Path("/Library/Audio/Apple Loops/Apple/02 Electro House")

SCORE = json.loads((HERE / "score.json").read_text())
SR = 48000
BPM = 30 * 60 / SCORE["framesPerBeat"]
BEAT = round(SR * SCORE["framesPerBeat"] / 30)  # 22,400 samples: exactly 14 frames
BAR = BEAT * 4
SECTIONS = []
_bar = 0
for _s in SCORE["sections"]:
    SECTIONS.append({**_s, "start": _bar})
    _bar += _s["bars"]
TOTAL_BARS = _bar
LENGTH = TOTAL_BARS * BAR + SR * 2  # room for the final tail
rng = np.random.default_rng(7)


def bar_of(name: str) -> int:
    return next(s["start"] for s in SECTIONS if s["name"] == name)


def db(value: float) -> float:
    return 10 ** (value / 20)


def loop(name: str, source_bpm: float = 128, beats: int | None = None) -> np.ndarray:
    """Decode an Apple Loop to 48 kHz stereo at the film's tempo, trimmed to whole beats."""
    path = LOOPS / f"{name}.caf"
    raw = subprocess.run([
        "ffmpeg", "-v", "error", "-i", str(path), "-af", f"atempo={BPM / source_bpm:.8f}",
        "-ar", str(SR), "-ac", "2", "-f", "f32le", "-",
    ], capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.astype(np.float64)
    n = beats or round(audio.shape[1] / BEAT)
    audio = audio[:, : n * BEAT]
    if audio.shape[1] < n * BEAT:
        audio = np.pad(audio, ((0, 0), (0, n * BEAT - audio.shape[1])))
    # Level-match every loop so the mix gains below mean the same thing.
    rms = np.sqrt((audio ** 2).mean()) + 1e-9
    return audio * (0.12 / rms)


def place(track: np.ndarray, clip: np.ndarray, bar: float, bars: float, gain_db: float = 0.0, fade_in: float = 0.0) -> None:
    """Repeat `clip` from `bar` for `bars` bars."""
    start = int(round(bar * BAR))
    end = int(round((bar + bars) * BAR))
    pos = start
    while pos < end:
        n = min(clip.shape[1], end - pos)
        track[:, pos:pos + n] += clip[:, :n] * db(gain_db)
        pos += n
    if fade_in:
        ramp = np.linspace(0, 1, int(fade_in * BAR)) ** 2
        track[:, start:start + len(ramp)] *= ramp


def sweep(audio: np.ndarray, start_bar: float, bars: float, f0: float, f1: float, kind: str = "lowpass") -> None:
    """Time-varying Butterworth filter over a span (blockwise, state carried)."""
    a = int(start_bar * BAR)
    b = int((start_bar + bars) * BAR)
    block = 256
    zi = None
    for pos in range(a, b, block):
        t = (pos - a) / max(1, b - a)
        cutoff = f0 * (f1 / f0) ** t
        sos = signal.butter(2, min(cutoff, SR * 0.45), kind, fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2, 2))
        for ch in range(2):
            audio[ch, pos:pos + block], zi[:, ch] = signal.sosfilt(sos, audio[ch, pos:pos + block], zi=zi[:, ch])


def static_filter(audio: np.ndarray, cutoff: float, kind: str) -> np.ndarray:
    sos = signal.butter(2, cutoff, kind, fs=SR, output="sos")
    return signal.sosfiltfilt(sos, audio, axis=1)


def duck(track: np.ndarray, bars: tuple[float, float], depth_db: float = -5.0) -> None:
    """Sidechain-style dip on every beat, as if keyed by the kick."""
    a, b = int(bars[0] * BAR), int(bars[1] * BAR)
    t = np.arange(BEAT) / SR
    shape = 1 - (1 - db(depth_db)) * np.exp(-t / 0.09) * np.minimum(1, t / 0.004 + 0.4)
    env = np.tile(shape, (b - a) // BEAT + 1)[: b - a]
    track[:, a:b] *= env


# --- CW: the callsign in Morse, keyed on 32nd notes ---------------------------

MORSE = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.", "G": "--.", "H": "....", "I": "..",
    "J": ".---", "K": "-.-", "L": ".-..", "M": "--", "N": "-.", "O": "---", "P": ".--.", "Q": "--.-", "R": ".-.",
    "S": "...", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-", "Y": "-.--", "Z": "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-", "5": ".....", "6": "-....",
    "7": "--...", "8": "---..", "9": "----.", ",": "--..--", "'": ".----.", "!": "-.-.--",
}


def morse_elements(text: str) -> list[tuple[int, int]]:
    """(on, off) in units; same timing as src/radio/morse.ts."""
    out: list[tuple[int, int]] = []
    t = 0
    first = True
    for word_index, word in enumerate(text.upper().split()):
        for char_index, char in enumerate(word):
            if not first:
                t += 7 if char_index == 0 else 3
            first = False
            for i, symbol in enumerate(MORSE[char]):
                if i:
                    t += 1
                length = 1 if symbol == "." else 3
                out.append((t, t + length))
                t += length
    return out


def cw(cue: dict) -> tuple[int, np.ndarray]:
    """A sidetone keyed by the cue, with 5 ms edges; returns (start sample, audio)."""
    unit = int(round(cue["framesPerUnit"] / 30 * SR))
    elements = morse_elements(cue["text"])
    n = elements[-1][1] * unit + int(0.05 * SR)
    t = np.arange(n) / SR
    env = np.zeros(n)
    edge = int(0.005 * SR)
    for on, off in elements:
        a, b = on * unit, off * unit
        env[a:b] = 1
        env[a:a + edge] *= np.linspace(0, 1, edge)
        env[b - edge:b] *= np.linspace(1, 0, edge)
    tone = np.sin(2 * np.pi * cue["pitch"] * t) * env * db(cue["gainDb"])
    start = int(round(cue["start"] / 30 * SR))
    return start, np.vstack([tone, tone])


# --- the quill on paper ----------------------------------------------------------

def quill_scratch() -> tuple[int, np.ndarray]:
    """Nib noise that follows the pen: louder when it moves fast, silent on
    lifts. Same track and timing as the film's calligraphy (calligraphy.py)."""
    spec = SCORE["calligraphy"]
    path = json.loads((ROOT / ".intro-build" / "film" / "public" / "signature" / "path.json").read_text())["path"]
    n = int(spec["frames"] / 30 * SR)
    xy = np.array([[p[0], p[1]] for p in path], dtype=float)
    down = np.array([p[2] for p in path], dtype=float)
    speed = np.r_[0.0, np.linalg.norm(np.diff(xy, axis=0), axis=1)] * down
    speed = np.minimum(speed, np.percentile(speed[speed > 0], 95)) if (speed > 0).any() else speed
    env = np.interp(np.linspace(0, len(path) - 1, n), np.arange(len(path)), speed / (speed.max() + 1e-9))
    env = ndimage.uniform_filter1d(env, int(0.02 * SR)) ** 0.7
    grain = 0.6 + 0.4 * np.abs(signal.sosfilt(signal.butter(2, 45, "lowpass", fs=SR, output="sos"), rng.standard_normal(n))) * 6
    noise = rng.standard_normal((2, n))
    noise = signal.sosfilt(signal.butter(2, [1800, 7000], "bandpass", fs=SR, output="sos"), noise, axis=1)
    start = int(round(spec["start"] / 30 * SR))
    return start, noise * env * np.minimum(grain, 1.6) * 0.5


# --- synthesized FX (all in C) -------------------------------------------------

def impact(seconds: float = 2.2) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    freq = 32.7 + (130.8 - 32.7) * np.exp(-t / 0.05)  # C1 sub with a C3 click
    sub = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.55)
    noise = rng.standard_normal(n) * np.exp(-t / 0.09)
    noise = signal.sosfilt(signal.butter(2, 3500, "lowpass", fs=SR, output="sos"), noise)
    mono = np.tanh(1.6 * (0.9 * sub + 0.35 * noise))
    return np.vstack([mono, mono])


def crash(seconds: float = 2.6) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = []
    for _ in range(2):
        noise = rng.standard_normal(n)
        noise = signal.sosfilt(signal.butter(2, 6000, "highpass", fs=SR, output="sos"), noise)
        out.append(noise * np.exp(-t / 0.7) * 0.35)
    return np.vstack(out)


def riser(bars: float) -> np.ndarray:
    """Noise swell plus a saw gliding up from C3 to C6, over `bars`."""
    n = int(bars * BAR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal((2, n))
    out = np.zeros((2, n))
    block = 512
    for pos in range(0, n, block):
        c = 300 * (9000 / 300) ** t[pos]
        sos = signal.butter(2, [c * 0.7, min(c * 1.4, SR * 0.45)], "bandpass", fs=SR, output="sos")
        out[:, pos:pos + block] = signal.sosfilt(sos, noise[:, pos:pos + block], axis=1)
    freq = 130.81 * 2 ** (3 * t ** 1.6)
    phase = np.cumsum(freq) / SR
    saw = 2 * (phase % 1) - 1
    saw = signal.sosfilt(signal.butter(2, 5000, "lowpass", fs=SR, output="sos"), saw)
    swell = t ** 2.2
    return (out * 1.2 + 0.18 * saw) * swell


def reverb(audio: np.ndarray, seconds: float = 2.4, mix: float = 0.35) -> np.ndarray:
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t / (seconds / 6.9))
    ir = signal.sosfilt(signal.butter(1, 6000, "lowpass", fs=SR, output="sos"), ir, axis=1)
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    wet = np.vstack([signal.fftconvolve(audio[c], ir[c])[: audio.shape[1]] for c in range(2)])
    return audio * (1 - mix) + wet * mix * 1.4


# --- master ---------------------------------------------------------------------

def compress(audio: np.ndarray, threshold_db: float = -14.0, ratio: float = 2.2) -> np.ndarray:
    level = np.sqrt(signal.sosfiltfilt(signal.butter(1, 12, "lowpass", fs=SR, output="sos"), (audio ** 2).mean(axis=0)).clip(1e-12))
    over = np.maximum(0, 20 * np.log10(level) - threshold_db)
    return audio * db(-over * (1 - 1 / ratio))


def limit(audio: np.ndarray, ceiling_db: float = -1.0) -> np.ndarray:
    """Look-ahead peak limiter: hold the lowest needed gain around each peak, smooth the release."""
    ceiling = db(ceiling_db)
    peak = np.abs(audio).max(axis=0)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    held = ndimage.minimum_filter1d(need, size=int(0.01 * SR) | 1)
    smooth = signal.sosfiltfilt(signal.butter(1, 15, "lowpass", fs=SR, output="sos"), held)
    return np.clip(audio * np.minimum(held, smooth), -ceiling, ceiling)


def main() -> None:
    SG, RA, D1, D2, D3 = (bar_of(n) for n in ("sign", "radio", "drop1", "drop2", "drop3"))
    END = TOTAL_BARS

    pad = loop("Airy Vox Synth")
    strum = loop("Data Strum Synth Layers")
    stutter = loop("Stutter Synth Layers")
    anthem = loop("Big Anthem Synth")
    lead = loop("Lightspeed Lead Layers")
    bass = loop("Waves Bass")
    beat = loop("Chronograph Set Beat 01")
    beat2 = loop("Blueprint Beat 01")
    top = loop("Static Electricity Topper 08")
    hats = loop("Hat Clap Shuffle Topper")
    roll = loop("Big Snare Roll Topper")

    drums = np.zeros((2, LENGTH))
    low = np.zeros((2, LENGTH))
    music = np.zeros((2, LENGTH))
    fx = np.zeros((2, LENGTH))

    # The signature: an airy pad opening up, washed in reverb, and the quill.
    opening = np.zeros((2, LENGTH))
    place(opening, pad, SG, RA - SG, -7, fade_in=1.0)
    place(opening, strum, SG + 2, 2, -13)
    sweep(opening, SG, RA - SG, 300, 7000)
    music += reverb(opening, 3.0, 0.4)
    start, scratch = quill_scratch()
    fx[:, start:start + scratch.shape[1]] += scratch * db(-17)

    # The radio: a sparse groove under the Morse, then a build into drop 1.
    place(music, pad, RA, D1 - RA, -9)
    place(music, strum, RA, D1 - RA, -12)
    sweep(music, RA, D1 - RA, 700, 9000)
    place(drums, hats, RA + 1, D1 - RA - 3, -15)
    place(drums, beat2, RA + 3, D1 - RA - 5, -13)
    drums[:, int((RA + 3) * BAR):int((D1 - 2) * BAR)] = static_filter(drums[:, int((RA + 3) * BAR):int((D1 - 2) * BAR)], 700, "highpass")
    place(low, bass, RA + 5, D1 - RA - 7, -11)
    low[:, int((RA + 5) * BAR):int((D1 - 2) * BAR)] = static_filter(low[:, int((RA + 5) * BAR):int((D1 - 2) * BAR)], 300, "lowpass")
    place(drums, roll, D1 - 2, 2, -9)
    fx[:, int((D1 - 2) * BAR):int(D1 * BAR)] += riser(2) * db(-9)

    # Drop 1, the best work: beat, bass and lead; the topper joins halfway.
    place(drums, beat, D1, D2 - D1, 0)
    place(drums, top, D1 + 4, D2 - D1 - 4, -10)
    place(low, bass, D1, D2 - D1, -2)
    place(music, lead, D1, D2 - D1, -6)
    place(drums, roll, D2 - 1, 1, -11)

    # Drop 2: the anthem, a project a bar.
    place(drums, beat, D2, D3 - D2, 0)
    place(drums, top, D2, D3 - D2, -9)
    place(low, bass, D2, D3 - D2, -2)
    place(music, anthem, D2, D3 - D2, -6)
    place(music, lead, D2 + 2, D3 - D2 - 2, -9)
    place(drums, roll, D3 - 1, 1, -9)

    # Drop 3, overload: everything, faster and denser every two bars.
    place(drums, beat, D3, END - 1 - D3, 0)
    place(drums, top, D3, END - 1 - D3, -8)
    place(drums, hats, D3 + 2, END - 1 - D3 - 2, -10)
    place(low, bass, D3, END - 1 - D3, -2)
    place(music, anthem, D3, END - 1 - D3, -6)
    place(music, lead, D3, END - 1 - D3, -8)
    place(music, stutter, D3 + 2, END - 1 - D3 - 2, -9)
    place(drums, roll, D3 + 4, 3, -9)
    fx[:, int((D3 + 4) * BAR):int((D3 + 7) * BAR)] += riser(3) * db(-8)
    tail = np.zeros((2, LENGTH))
    place(tail, pad, END - 1, 1, -4)
    tail[:, int((END - 0.5) * BAR):] *= np.linspace(1, 0, LENGTH - int((END - 0.5) * BAR)) ** 2
    music += reverb(tail, 3.0, 0.5)

    # Sidechain the tonal parts to the kick in every drop.
    for a, b in ((D1, D2), (D2, D3), (D3, END - 1)):
        duck(low, (a, b), -7)
        duck(music, (a, b), -4)

    # A breath before each drop, then impact + crash on the downbeat; the
    # overload peaks one bar before the end and the last hit closes it.
    for d in (D1, D2, D3):
        gap = int((d - 0.125) * BAR)
        for track in (drums, low, music):
            track[:, gap:int(d * BAR)] *= np.linspace(1, 0, int(d * BAR) - gap) ** 3
    for d in (D1, D2, D3, END - 2, END - 1):
        hit = impact()
        fx[:, int(d * BAR):int(d * BAR) + hit.shape[1]] += hit * db(-5)
        cr = crash()
        fx[:, int(d * BAR):int(d * BAR) + cr.shape[1]] += cr * db(-10)

    # The greeting in Morse over the radio.
    for cue in SCORE.get("morse", []):
        start, tone = cw(cue)
        fx[:, start:start + tone.shape[1]] += tone

    low = static_filter(low, 30, "highpass")
    # Synths up and sub down a little: most visitors hear this on phone speakers.
    mix = drums * db(-1) + low * db(-4.5) + music * db(0) + fx * db(-3)
    mix = static_filter(mix, 25, "highpass")
    # Gentle master EQ: a little less sub, a little more presence and air.
    mix = mix - static_filter(mix, 80, "lowpass") * (1 - db(-2.0)) + static_filter(mix, 4000, "highpass") * (db(1.5) - 1)
    mix = compress(mix)
    # Loudness: aim near -14 LUFS-ish (RMS of the drops), then a -1 dBFS ceiling.
    drops = np.concatenate([mix[:, int(a * BAR):int(b * BAR)] for a, b in ((D1, D2), (D2, D3), (D3, END - 1))], axis=1)
    mix *= db(-13.0) / (np.sqrt((drops ** 2).mean()) + 1e-9)
    mix = limit(mix, -1.0)
    mix = mix[:, : TOTAL_BARS * BAR + int(1.2 * SR)]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2").T.tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", str(OUT)], input=pcm, check=True)
    peak = 20 * np.log10(np.abs(mix).max() + 1e-12)
    print(f"soundtrack: {mix.shape[1] / SR:.2f}s, {TOTAL_BARS} bars at {BPM:.3f} BPM, peak {peak:.2f} dBFS -> {OUT}")


if __name__ == "__main__":
    main()
