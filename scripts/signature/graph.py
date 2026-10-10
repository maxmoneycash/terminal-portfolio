#!/usr/bin/env python3
"""Centre-line graph of the traced signature, for routing its strokes by hand.

Rasterizes public/maxwell_mohammadi_signature_full_canvas.svg, thins the ink
to a one-pixel skeleton, prunes the spurs thinning leaves, and splits the
skeleton into edges between junctions and stroke ends. `graph.json` holds
every edge's pixel chain; `--sheet out.png` draws them numbered so a writing
order can be chosen in route.json.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SVG = ROOT / "public" / "maxwell_mohammadi_signature_full_canvas.svg"
HERE = Path(__file__).resolve().parent
# Source scale: the SVG's 2048x512 canvas at 2x, for smooth centre lines.
W, H = 4096, 1024
NEIGHBOURS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def rasterize(embolden: float = 0.0) -> np.ndarray:
    """The signature's ink coverage at W x H; `embolden` adds an outline
    stroke in SVG units (the bolder line the site and film draw)."""
    svg = SVG.read_text()
    if embolden:
        svg = svg.replace('fill="#000000"', f'fill="#000000" stroke="#000000" stroke-width="{embolden}" stroke-linejoin="round"')
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


def neighbours(p, pool):
    return [(p[0] + dy, p[1] + dx) for dy, dx in NEIGHBOURS if (p[0] + dy, p[1] + dx) in pool]


def minimal(pool: set, smallest: int = 24) -> set:
    """Strip staircase pixels (whose neighbours stay connected without them),
    so every pixel is an end (1), a run (2) or a real junction (3+); then drop
    specks too small to be ink."""
    changed = True
    while changed:
        changed = False
        for p in sorted(pool):
            around = neighbours(p, pool)
            if len(around) < 2:
                continue
            # Are the neighbours 8-connected among themselves?
            seen, todo = {around[0]}, [around[0]]
            while todo:
                q = todo.pop()
                for r in around:
                    if r not in seen and max(abs(r[0] - q[0]), abs(r[1] - q[1])) == 1:
                        seen.add(r)
                        todo.append(r)
            if len(seen) == len(around) and len(around) <= 3:
                pool.discard(p)
                changed = True
    kept, seen = set(), set()
    for p in pool:
        if p in seen:
            continue
        part, todo = [], [p]
        seen.add(p)
        while todo:
            q = todo.pop()
            part.append(q)
            for r in neighbours(q, pool):
                if r not in seen:
                    seen.add(r)
                    todo.append(r)
        if len(part) >= smallest:
            kept.update(part)
    return kept


def build(pool: set) -> tuple[dict, list]:
    """Nodes are clusters of junction / end pixels; edges are the chains between them."""
    special = {p for p in pool if len(neighbours(p, pool)) != 2}
    node_of, nodes = {}, []
    for p in special:
        if p in node_of:
            continue
        cluster, todo = [], [p]
        node_of[p] = len(nodes)
        while todo:
            q = todo.pop()
            cluster.append(q)
            for r in neighbours(q, special):
                if r not in node_of:
                    node_of[r] = len(nodes)
                    todo.append(r)
        ys, xs = zip(*cluster)
        nodes.append({"y": float(np.mean(ys)), "x": float(np.mean(xs)), "pixels": cluster})
    edges, used = [], set()
    for p in special:
        for q in neighbours(p, pool):
            if q in special or (p, q) in used:
                continue
            chain, prev, cur = [p, q], p, q
            while cur not in special:
                nxt = [r for r in neighbours(cur, pool) if r != prev and r not in chain[-3:]]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                chain.append(cur)
            used.add((p, q))
            used.add((cur, chain[-2]))
            a, b = node_of[p], node_of.get(cur, -1)
            edges.append({"a": a, "b": b, "chain": [[int(y), int(x)] for y, x in chain]})
    # Closed loops with no junction at all.
    seen = {tuple(c) for e in edges for c in e["chain"]}
    for p in pool - seen - special:
        if tuple(p) in seen:
            continue
        chain, prev, cur = [p], None, p
        while True:
            nxt = [r for r in neighbours(cur, pool) if r != prev and r not in chain]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            chain.append(cur)
        seen.update(chain)
        node = len(nodes)
        nodes.append({"y": float(p[0]), "x": float(p[1]), "pixels": [p]})
        edges.append({"a": node, "b": node, "chain": [[int(y), int(x)] for y, x in chain + [p]]})
    return nodes, edges


def prune(pool: set, width: np.ndarray, factor: float = 1.6) -> set:
    """Drop end branches shorter than the stroke is wide: thinning artefacts."""
    for _ in range(3):
        nodes, edges = build(pool)
        degree = {}
        for e in edges:
            degree[e["a"]] = degree.get(e["a"], 0) + 1
            degree[e["b"]] = degree.get(e["b"], 0) + 1
        removed = False
        for e in edges:
            da, db = degree.get(e["a"], 0), degree.get(e["b"], 0)
            if not ((da == 1 and db >= 3) or (db == 1 and da >= 3)):
                continue
            # Orient the branch tip -> junction; keep the junction pixel.
            chain = e["chain"] if da == 1 else e["chain"][::-1]
            jy, jx = chain[-1]
            if len(chain) < factor * width[jy, jx]:
                pool.difference_update(tuple(c) for c in chain[:-1])
                removed = True
        if not removed:
            break
    return pool


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet", help="write a numbered edge sheet (PNG)")
    args = parser.parse_args()
    alpha = rasterize()
    ink = alpha > 0.5
    # Full stroke width at every pixel: twice the distance to the paper.
    width = 2 * ndimage.distance_transform_edt(ink)
    pool = minimal({tuple(p) for p in np.argwhere(thin(ink)).tolist()})
    pool = minimal(prune(pool, width))
    nodes, edges = build(pool)
    out = {
        "width": W,
        "height": H,
        "nodes": [{"x": n["x"], "y": n["y"]} for n in nodes],
        "edges": [{"a": e["a"], "b": e["b"], "chain": e["chain"], "w": [round(float(width[y, x]), 2) for y, x in e["chain"]]} for e in edges],
    }
    (HERE / "graph.json").write_text(json.dumps(out))
    print(f"{len(nodes)} nodes, {len(edges)} edges")
    if args.sheet:
        sheet(alpha, out, args.sheet)


def sheet(alpha: np.ndarray, graph: dict, path: str) -> None:
    from PIL import Image, ImageDraw, ImageFont

    ys, xs = np.nonzero(alpha > 0.1)
    x0, x1, y0, y1 = xs.min() - 30, xs.max() + 30, ys.min() - 30, ys.max() + 30
    base = (255 - alpha[y0:y1, x0:x1] * 70).astype(np.uint8)
    img = Image.fromarray(base).convert("RGB")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)
    palette = [(220, 40, 40), (30, 120, 220), (20, 150, 60), (200, 120, 0), (150, 40, 200), (0, 150, 160), (200, 40, 140), (90, 90, 90)]
    for i, e in enumerate(graph["edges"]):
        color = palette[i % len(palette)]
        pts = [(x - x0, y - y0) for y, x in e["chain"]]
        draw.line(pts, fill=color, width=3)
        mx, my = pts[len(pts) // 2]
        draw.text((mx + 4, my - 26), str(i), fill=color, font=font, stroke_width=3, stroke_fill=(255, 255, 255))
    for i, n in enumerate(graph["nodes"]):
        x, y = n["x"] - x0, n["y"] - y0
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(0, 0, 0))
        draw.text((x + 5, y + 3), f"n{i}", fill=(0, 0, 0), font=small)
    img.save(path)
    print(f"sheet: {path} (crop origin {x0},{y0})")


if __name__ == "__main__":
    main()
