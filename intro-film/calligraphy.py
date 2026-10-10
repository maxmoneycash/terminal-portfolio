#!/usr/bin/env python3
"""Turn the traced signature into a writing order for the intro's calligraphy.

The signature SVG is one filled outline (a vectorized scan), so there are no
pen strokes to animate. This rebuilds them: rasterize the ink a touch bolder,
thin it to a one-pixel skeleton, then walk the skeleton the way a hand would,
continuing straight through junctions and loops, lifting the pen to the next
stroke when one ends, slowing on curves and speeding up on straights. Every
ink pixel gets the moment the pen reaches it, so the film reveals the ink
exactly where the quill is.

Writes .intro-build/film/public/signature/ink.bin (per ink pixel: index u32,
time u16, coverage u8) and path.json (the quill's track).
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SVG = ROOT / "public" / "maxwell_mohammadi_signature_full_canvas.svg"
OUT = ROOT / ".intro-build" / "film" / "public" / "signature"
W, H = 2048, 512
# Extra outline stroke (px at 2048 wide): a bolder, more confident line.
EMBOLDEN = 2.6


def rasterize() -> np.ndarray:
    svg = SVG.read_text().replace('fill="#000000"', f'fill="#000000" stroke="#000000" stroke-width="{EMBOLDEN}" stroke-linejoin="round"')
    png = subprocess.run(["rsvg-convert", "-w", str(W), "-h", str(H), "-f", "png"], input=svg.encode(), capture_output=True, check=True).stdout
    raw = subprocess.run(["magick", "png:-", "-alpha", "extract", "-depth", "8", "gray:-"], input=png, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(H, W).astype(np.float32) / 255


def thin(mask: np.ndarray) -> np.ndarray:
    """Zhang-Suen thinning."""
    img = np.pad(mask.astype(np.uint8), 1)
    while True:
        changed = False
        for step in (0, 1):
            p2, p3, p4, p5 = img[:-2, 1:-1], img[:-2, 2:], img[1:-1, 2:], img[2:, 2:]
            p6, p7, p8, p9 = img[2:, 1:-1], img[2:, :-2], img[1:-1, :-2], img[:-2, :-2]
            ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            b = sum(r.astype(np.int16) for r in ring[:8])
            a = sum(((ring[i] == 0) & (ring[i + 1] == 1)).astype(np.int16) for i in range(8))
            if step == 0:
                c1, c2 = p2 * p4 * p6, p4 * p6 * p8
            else:
                c1, c2 = p2 * p4 * p8, p2 * p6 * p8
            core = img[1:-1, 1:-1]
            kill = (core == 1) & (b >= 2) & (b <= 6) & (a == 1) & (c1 == 0) & (c2 == 0)
            if kill.any():
                core[kill] = 0
                changed = True
        if not changed:
            return img[1:-1, 1:-1].astype(bool)


NEIGHBOURS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def neighbours(p, pool):
    return [(p[0] + dy, p[1] + dx) for dy, dx in NEIGHBOURS if (p[0] + dy, p[1] + dx) in pool]


def prune(skeleton: np.ndarray, shortest: int = 12) -> set[tuple[int, int]]:
    """Drop the short spurs thinning leaves on a traced outline."""
    pool = set(zip(*[a.tolist() for a in np.nonzero(skeleton)]))
    for _ in range(2):
        for end in [p for p in pool if len(neighbours(p, pool)) == 1]:
            if end not in pool:
                continue
            branch, prev, cur = [end], None, end
            while True:
                nxt = [q for q in neighbours(cur, pool) if q != prev and q not in branch]
                if len(nxt) != 1 or len(neighbours(nxt[0], pool)) > 2:
                    break
                prev, cur = cur, nxt[0]
                branch.append(cur)
                if len(branch) > shortest:
                    break
            if len(branch) <= shortest and len(neighbours(cur, pool)) >= 2:
                pool.difference_update(branch[:-1])
    return pool


def swash_of(pool: set[tuple[int, int]], band: tuple[int, int] = (240, 300), longest: int = 40) -> set[tuple[int, int]]:
    """The long horizontal flourish through the middle of the name: written last."""
    flat = set()
    for p in pool:
        if not band[0] <= p[0] <= band[1]:
            continue
        near = np.array([q for q in pool if abs(q[0] - p[0]) <= 5 and abs(q[1] - p[1]) <= 5], dtype=float)
        if len(near) < 4:
            continue
        cov = np.cov((near - near.mean(axis=0)).T)
        vals, vecs = np.linalg.eigh(cov)
        dy, dx = vecs[:, -1]
        if abs(dx) > 3 * abs(dy):
            flat.add(p)
    # Keep only long runs of flat pixels.
    swash, seen = set(), set()
    for p in flat:
        if p in seen:
            continue
        run, todo = [], [p]
        seen.add(p)
        while todo:
            q = todo.pop()
            run.append(q)
            for r in neighbours(q, flat):
                if r not in seen:
                    seen.add(r)
                    todo.append(r)
        if max(r[1] for r in run) - min(r[1] for r in run) >= longest:
            swash.update(run)
    return swash


def walk(pool: set[tuple[int, int]], lead=None, minimum: int = 10) -> list[tuple[int, int, bool]]:
    """Visit the skeleton pixels in writing order: (y, x, pen_down)."""
    unvisited = set(pool)
    order: list[tuple[int, int, bool]] = []

    def component(p):
        seen, todo = {p}, [p]
        while todo:
            q = todo.pop()
            for r in neighbours(q, unvisited):
                if r not in seen:
                    seen.add(r)
                    todo.append(r)
        return seen

    def next_start(cy: float, cx: float):
        # The next stroke: the nearest unwritten piece, so each letter is
        # finished before the hand moves on, slightly favouring what lies
        # behind and stroke ends.
        best, score = None, float("inf")
        for p in unvisited:
            dx = p[1] - cx
            deg = len(neighbours(p, unvisited))
            s = abs(p[0] - cy) * 0.6 + (dx if dx >= 0 else -dx * 0.8) + (0 if deg <= 1 else 12)
            if s < score:
                best, score = p, s
        return best

    current = lead or min(unvisited, key=lambda p: (p[1], p[0]))
    direction = np.array([0.0, 1.0])
    pen_down = False
    while unvisited:
        unvisited.discard(current)
        order.append((current[0], current[1], pen_down))
        pen_down = True
        options = neighbours(current, unvisited)
        if options:
            def turn(q):
                step = np.array([q[0] - current[0], q[1] - current[1]], dtype=float)
                return -float(step @ direction) / np.linalg.norm(step)
            nxt = min(options, key=turn)
            step = np.array([nxt[0] - current[0], nxt[1] - current[1]], dtype=float)
            direction = 0.75 * direction + 0.25 * step / np.linalg.norm(step)
            direction /= np.linalg.norm(direction)
            current = nxt
            continue
        # Scraps too small to be a stroke join the ink around them later.
        while unvisited:
            start = next_start(*current)
            if len(component(start)) >= minimum:
                break
            unvisited.difference_update(component(start))
        else:
            break
        current = start
        direction = np.array([0.0, 1.0])
        pen_down = False
    return order


def main() -> None:
    alpha = rasterize()
    ink = alpha > 0.02
    pool = prune(thin(alpha > 0.5))
    swash = swash_of(pool)
    letters = pool - swash
    # "Maxwell", then "Mohammadi", then the flourish swept left to right.
    swash_order = walk(swash)
    order = walk(letters) + swash_order

    # Time along the walk: arc length, slower on curves, quick pen lifts.
    pts = np.array([(y, x) for y, x, _ in order], dtype=float)
    down = np.array([d for _, _, d in order])
    seg = np.r_[0.0, np.linalg.norm(np.diff(pts, axis=0), axis=1)]
    heading = np.r_[0.0, np.arctan2(np.diff(pts[:, 0]), np.diff(pts[:, 1]))]
    bend = np.abs(np.angle(np.exp(1j * np.diff(heading, prepend=heading[0]))))
    bend = ndimage.uniform_filter1d(bend, 9)
    cost = np.where(down, seg * (1.0 + 1.6 * bend), 10.0 + seg * 0.18)
    cost[0] = 0
    t = np.cumsum(cost)
    t /= t[-1]

    # Every ink pixel takes the time of its nearest skeleton pixel; where
    # strokes cross, the earlier stroke inks the crossing.
    time_map = np.full((H, W), np.inf)
    time_map[pts[:, 0].astype(int), pts[:, 1].astype(int)] = t
    dist, (iy, ix) = ndimage.distance_transform_edt(~np.isfinite(time_map), return_indices=True)
    nearest = time_map[iy, ix]
    yy, xx = np.mgrid[-4:5, -4:5]
    disk = (yy ** 2 + xx ** 2) <= 4.5 ** 2
    earliest = ndimage.minimum_filter(np.where(np.isfinite(time_map), time_map, 9.0), footprint=disk)
    nearest = np.where((dist <= 4.5) & (earliest < 9.0), np.minimum(nearest, earliest), nearest)
    idx = np.flatnonzero(ink)
    times = np.round(nearest.ravel()[idx] * 65535).astype("<u2")
    cover = np.round(alpha.ravel()[idx] * 255).astype(np.uint8)

    OUT.mkdir(parents=True, exist_ok=True)
    packed = np.zeros(len(idx), dtype=[("i", "<u4"), ("t", "<u2"), ("a", "u1")])
    packed["i"], packed["t"], packed["a"] = idx, times, cover
    (OUT / "ink.bin").write_bytes(packed.tobytes())

    # The quill's track, resampled evenly in time.
    samples = np.linspace(0, 1, 900)
    path = []
    for s in samples:
        k = int(np.searchsorted(t, s))
        k = min(max(k, 0), len(t) - 1)
        path.append([round(float(pts[k, 1]), 1), round(float(pts[k, 0]), 1), bool(down[k])])
    # Where each stroke starts (time, x, y), and where the swash begins: the
    # portrait layout splits the name into two lines by stroke.
    lifts = [[round(float(t[k]), 5), int(pts[k, 1]), int(pts[k, 0])] for k in np.flatnonzero(~down)]
    swash_at = round(float(t[len(order) - len(swash_order)]), 5)
    (OUT / "path.json").write_text(json.dumps({"width": W, "height": H, "count": int(len(idx)), "path": path, "strokes": lifts, "swash": swash_at}))
    lifts = int((~down).sum())
    print(f"calligraphy: {len(idx)} ink px, {len(order)} skeleton px ({len(swash)} swash), {lifts} pen lifts -> {OUT}")


if __name__ == "__main__":
    main()
