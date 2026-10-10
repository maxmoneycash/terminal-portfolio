#!/usr/bin/env python3
"""Pen strokes for the quill: route.py's writing order made into motion.

Each stroke's centre line is smoothed (never across the sharp up-and-back
turns, so the pen still reaches every tip), resampled, and given the ink's
own width. Time follows handwriting: the pen eases into and out of every
stroke, slows through tight curves, and hops quickly between strokes. Any
ink no stroke reaches (the dot of the i) becomes a short tap after the
letters. The swash is written last.

Writes src/lib/signatureStrokes.json, read by the site's signature window
and the intro film. `--preview DIR` renders reveal frames for review.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from scipy import ndimage

from graph import H, W, rasterize
from route import Graph, ROUTE, route

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "src" / "lib" / "signatureStrokes.json"

# Total writing time, seconds: the film's 168 frames at 30 fps.
DURATION = 5.6
# Output spacing along a stroke (source px).
SPACING = 3.0
# Mask margin over the ink's own width (source px), to cover antialiasing.
MARGIN = 4.0
# Where the portrait film splits the swash between the two lines (source x).
SPLIT_X = 2002.0
# The bolder line the site and film draw: an outline stroke, in SVG units.
EMBOLDEN = 2.6


def unit(v: np.ndarray) -> np.ndarray:
    n = float(np.hypot(*v))
    return v / n if n > 1e-9 else np.array([1.0, 0.0])


def join(parts: list, trim: int = 10) -> np.ndarray:
    """Concatenate a stroke's edge chains. At a crossing the skeleton bends
    toward the junction, so each side is trimmed and bridged with a curve that
    keeps the pen's heading; a retrace (the same edge back) keeps its tip."""
    pts = resample(parts[0][1], 1.0)
    for (pk, _), (k, chain) in zip(parts, parts[1:]):
        cur = resample(chain, 1.0)
        if k == pk or len(pts) < 3 * trim or len(cur) < 3 * trim:
            pts = np.r_[pts, cur[1:] if np.hypot(*(cur[0] - pts[-1])) < 3 else cur]
            continue
        a, c = pts[:-trim], cur[trim:]
        p0, p1 = a[-1], c[0]
        d0, d1 = unit(a[-1] - a[-9]), unit(c[8] - c[0])
        span = float(np.hypot(*(p1 - p0)))
        u = np.linspace(0, 1, max(2, int(span)))[1:-1, None]
        h00, h10, h01, h11 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u, -2 * u**3 + 3 * u**2, u**3 - u**2
        bridge = h00 * p0 + h10 * d0 * span + h01 * p1 + h11 * d1 * span
        pts = np.r_[a, bridge, c]
    return pts


def resample(pts: np.ndarray, step: float) -> np.ndarray:
    seg = np.r_[0.0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    if seg[-1] < step:
        return pts[[0, -1]]
    s = np.arange(0.0, seg[-1], step)
    s = np.r_[s, seg[-1]]
    return np.c_[np.interp(s, seg, pts[:, 0]), np.interp(s, seg, pts[:, 1])]


def cusps(pts: np.ndarray, reach: int = 6) -> list[int]:
    """Indices where the pen turns back on itself (retraces, sharp tips)."""
    out = []
    for i in range(reach, len(pts) - reach):
        a = pts[i] - pts[i - reach]
        b = pts[i + reach] - pts[i]
        na, nb = np.hypot(*a), np.hypot(*b)
        if na > 1e-6 and nb > 1e-6 and float(a @ b) / (na * nb) < -0.3:
            out.append(i)
    # One index per turn.
    merged = []
    for i in out:
        if merged and i - merged[-1] <= reach * 2:
            continue
        merged.append(i)
    return merged


def smooth(pts: np.ndarray, sigma: float = 3.5) -> np.ndarray:
    """Gaussian smoothing piecewise between cusps, endpoints pinned."""
    if len(pts) < 8:
        return pts
    cuts = [0] + cusps(pts) + [len(pts) - 1]
    out = pts.copy()
    for a, b in zip(cuts[:-1], cuts[1:]):
        piece = pts[a:b + 1]
        if len(piece) < 6:
            continue
        sm = np.c_[ndimage.gaussian_filter1d(piece[:, 0], sigma, mode="nearest"), ndimage.gaussian_filter1d(piece[:, 1], sigma, mode="nearest")]
        # Pin the ends so pieces meet exactly and tips keep their reach.
        ramp = np.minimum(1.0, np.minimum(np.arange(len(piece)), np.arange(len(piece))[::-1]) / (2 * sigma))
        out[a:b + 1] = piece + (sm - piece) * ramp[:, None]
    return out


def width_along(pts: np.ndarray, width_map: np.ndarray) -> np.ndarray:
    ys = np.clip(np.round(pts[:, 1]).astype(int), 0, H - 1)
    xs = np.clip(np.round(pts[:, 0]).astype(int), 0, W - 1)
    # The widest ink within 2 px: the centre line can sit a little off the ridge.
    wide = ndimage.maximum_filter(width_map, size=5)
    w = wide[ys, xs]
    # Crossings inflate the distance transform (two strokes' ink merge into a
    # blob); hold each stroke to its own running width so a crossing never
    # uncovers knobs of the other stroke early.
    med = ndimage.median_filter(w, size=41, mode="nearest")
    return np.minimum(w, med * 1.08)


def speeds(pts: np.ndarray) -> np.ndarray:
    """Relative pen speed at each 1 px sample: slow in tight curves, easing in and out."""
    n = len(pts)
    k = 6
    heading = np.arctan2(np.gradient(pts[:, 1]), np.gradient(pts[:, 0]))
    turn = np.abs(np.angle(np.exp(1j * (np.roll(heading, -k) - np.roll(heading, k)))))
    turn[:k] = turn[k] if n > 2 * k else 0
    turn[-k:] = turn[-k - 1] if n > 2 * k else 0
    turn = ndimage.gaussian_filter1d(turn, 4)
    v = 1.0 / (1.0 + 1.8 * turn)
    # Ease in over the first 40 px and out over the last 30 px.
    s = np.arange(n, dtype=float)
    ease_in = np.clip(s / 40.0, 0, 1)
    ease_out = np.clip((n - 1 - s) / 30.0, 0, 1)
    ease = np.minimum(0.35 + 0.65 * np.sin(ease_in * np.pi / 2), 0.35 + 0.65 * np.sin(ease_out * np.pi / 2))
    return v * ease


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", help="render reveal frames into this directory")
    args = parser.parse_args()

    graph = Graph(json.loads((HERE / "graph.json").read_text()))
    planned = route(graph)
    alpha = rasterize(EMBOLDEN)
    ink = alpha > 0.04
    width_map = 2 * ndimage.distance_transform_edt(alpha > 0.5)

    strokes = []
    for st in planned:
        pts = join(st["parts"])
        pts = smooth(resample(pts, 1.0))
        pts = resample(pts, 1.0)
        strokes.append({"kind": st["kind"], "word": st["word"], "pts": pts})

    # Coverage: ink no stroke reaches becomes a tap (the i's dot).
    covered = np.zeros((H, W), dtype=bool)
    yy, xx = np.mgrid[0:H, 0:W]
    for st in strokes:
        w = width_along(st["pts"], width_map) + MARGIN
        st["w"] = w
        for (x, y), r in zip(st["pts"][::2], w[::2] / 2 + 1):
            x0, x1, y0, y1 = int(x - r - 1), int(x + r + 2), int(y - r - 1), int(y + r + 2)
            sub = (xx[y0:y1, x0:x1] - x) ** 2 + (yy[y0:y1, x0:x1] - y) ** 2 <= r * r
            covered[y0:y1, x0:x1] |= sub
    # Where a letter crosses the swash, reveal only the letter's own ink: no
    # margin and its plain running width, so no swash shows before the swash.
    sw = next((st for st in strokes if st["kind"] == "swash"), None)
    if sw is not None:
        order = np.argsort(sw["pts"][:, 0])
        sx, sy = sw["pts"][order, 0], sw["pts"][order, 1]
        band = float(np.median(sw["w"])) / 2 + 3
        for st in strokes:
            if st is sw:
                continue
            on = (st["pts"][:, 0] >= sx[0]) & (st["pts"][:, 0] <= sx[-1])
            near = on & (np.abs(st["pts"][:, 1] - np.interp(st["pts"][:, 0], sx, sy)) < band)
            if near.any():
                plain = ndimage.median_filter(width_map[np.clip(np.round(st["pts"][:, 1]).astype(int), 0, H - 1), np.clip(np.round(st["pts"][:, 0]).astype(int), 0, W - 1)], size=41, mode="nearest")
                st["w"] = np.where(near, np.minimum(st["w"], plain), st["w"])
    missing, count = ndimage.label(ink & ~ndimage.binary_dilation(covered, iterations=2))
    taps = []
    for label in range(1, count + 1):
        ys, xs = np.nonzero(missing == label)
        if len(ys) < 40:
            continue
        blob = np.c_[xs, ys].astype(float)
        cx, cy = blob.mean(axis=0)
        # The nearest point any stroke passes.
        best = None
        for st in strokes:
            d = np.hypot(st["pts"][:, 0] - cx, st["pts"][:, 1] - cy)
            i = int(np.argmin(d))
            if best is None or d[i] < best[0]:
                best = (float(d[i]), st, i)
        dist, st, i = best
        if dist < 28:
            # A pruned tip: the pen reaches into it and comes back.
            p0 = st["pts"][i]
            far = blob[int(np.argmax(np.hypot(*(blob - p0).T)))]
            go = resample(np.array([p0, far]), 1.0)
            detour = np.r_[go[1:], go[::-1][1:]]
            tip_w = float(np.clip(2 * ndimage.distance_transform_edt(missing == label).max(), 4, 30)) + MARGIN
            st["pts"] = np.r_[st["pts"][: i + 1], detour, st["pts"][i + 1:]]
            st["w"] = np.r_[st["w"][: i + 1], np.full(len(detour), tip_w), st["w"][i + 1:]]
            print(f"tip at ({cx:.0f}, {cy:.0f}): {len(ys)} px, reached from its stroke ({dist:.0f} px away)")
            continue
        r = float(np.max(np.hypot(xs - cx, ys - cy)))
        word = 0 if cx < SPLIT_X else 1
        pts = np.array([[cx - r * 0.3, cy - r * 0.3], [cx + r * 0.3, cy + r * 0.3]])
        taps.append({"kind": "dot", "word": word, "pts": resample(pts, 1.0), "w": np.full(2, 2 * r + MARGIN + 2), "r": r})
        print(f"dot at ({cx:.0f}, {cy:.0f}) r {r:.1f}: {len(ys)} px")
    for tap in taps:
        tap["w"] = np.full(len(tap["pts"]), 2 * tap["r"] + MARGIN + 2)
    # Order: letters, then crossings and dots, then the swash.
    letters = [s for s in strokes if s["kind"] == "letter"]
    extras = [s for s in strokes if s["kind"] == "extra"] + taps
    swash = [s for s in strokes if s["kind"] == "swash"]
    ordered = letters + extras + swash

    # Time: integrate 1 / speed along every stroke; hops between strokes take
    # a beat plus travel time; then scale everything to DURATION.
    raw_t, clock = [], 0.0
    hop_speed = 3.0  # air travel is quicker than writing
    for i, st in enumerate(ordered):
        if i:
            gap = float(np.hypot(*(st["pts"][0] - ordered[i - 1]["pts"][-1])))
            clock += 18.0 + gap / hop_speed
        v = speeds(st["pts"]) if st["kind"] != "dot" else np.full(len(st["pts"]), 0.25)
        seg = np.r_[0.0, np.hypot(*np.diff(st["pts"], axis=0).T)]
        t = clock + np.cumsum(seg / np.maximum(v, 0.05))
        raw_t.append(t)
        clock = float(t[-1])
    scale = DURATION / clock

    out = {"width": W, "height": H, "duration": DURATION, "split": SPLIT_X, "embolden": EMBOLDEN, "strokes": []}
    ys, xs = np.nonzero(ink)
    out["bounds"] = [int(xs.min()) - 8, int(ys.min()) - 8, int(xs.max()) + 8, int(ys.max()) + 8]
    for st, t in zip(ordered, raw_t):
        t = t * scale
        idx = np.unique(np.r_[np.arange(0, len(st["pts"]), int(SPACING)), len(st["pts"]) - 1])
        pts, w, tt = st["pts"][idx], st["w"][idx], t[idx]
        out["strokes"].append({
            "kind": st["kind"],
            "word": st["word"],
            "x": [round(float(v), 1) for v in pts[:, 0]],
            "y": [round(float(v), 1) for v in pts[:, 1]],
            "w": [round(float(v), 1) for v in w],
            "t": [round(float(v), 3) for v in tt],
        })
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    n = sum(len(s["x"]) for s in out["strokes"])
    print(f"{len(out['strokes'])} strokes, {n} points, {OUT.stat().st_size / 1024:.0f} KB -> {OUT}")
    print("starts:", [round(s["t"][0], 2) for s in out["strokes"]], "ends:", [round(s["t"][-1], 2) for s in out["strokes"]])
    if args.preview:
        preview(alpha, out, Path(args.preview))


def reveal_mask(data: dict, at: float) -> np.ndarray:
    """Mask of everything the pen has inked by time `at` (for preview / coverage)."""
    from PIL import Image, ImageDraw

    img = Image.new("L", (data["width"], data["height"]), 0)
    d = ImageDraw.Draw(img)
    for st in data["strokes"]:
        xs, ys, ws, ts = st["x"], st["y"], st["w"], st["t"]
        for i in range(len(xs) - 1):
            if ts[i + 1] > at:
                break
            d.line([(xs[i], ys[i]), (xs[i + 1], ys[i + 1])], fill=255, width=max(1, int(round(ws[i]))))
            r = ws[i] / 2
            d.ellipse((xs[i] - r, ys[i] - r, xs[i] + r, ys[i] + r), fill=255)
        if len(xs) == 2 or (ts and ts[-1] <= at):
            r = ws[-1] / 2
            d.ellipse((xs[-1] - r, ys[-1] - r, xs[-1] + r, ys[-1] + r), fill=255)
    return np.asarray(img) > 0


def preview(alpha: np.ndarray, data: dict, out: Path) -> None:
    from PIL import Image

    out.mkdir(parents=True, exist_ok=True)
    x0, y0, x1, y1 = data["bounds"]
    frames = []
    for k, at in enumerate(np.linspace(0.25, data["duration"] + 0.01, 16)):
        mask = reveal_mask(data, float(at))
        shown = alpha * mask
        crop = (255 - shown[y0:y1, x0:x1] * 230).astype(np.uint8)
        frames.append(Image.fromarray(crop).resize(((x1 - x0) // 3, (y1 - y0) // 3)))
    w, h = frames[0].size
    sheet = Image.new("L", (w * 2, h * 8), 255)
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % 2) * w, (i // 2) * h))
    sheet.save(out / "reveal.png")
    final = alpha * reveal_mask(data, data["duration"] + 1)
    lost = float((alpha - final).clip(0).sum() / alpha.sum())
    print(f"preview: {out / 'reveal.png'}; ink never revealed: {lost * 100:.2f}%")


if __name__ == "__main__":
    main()
