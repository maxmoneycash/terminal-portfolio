#!/usr/bin/env python3
"""Turn the signature's centre-line graph (graph.py) into pen strokes.

A pen moving through a junction keeps its heading, so at every junction the
route continues along the unused edge that turns least; at a dead end (the
top of an i, a retraced stem) it retraces back down rather than lifting.
Words are written left to right, the dot after its word, and the long swash
through the name last, as a flourish. The strokes are then smoothed,
resampled, given the ink's own width, and timed like handwriting: slower in
tight curves, easing in and out of each stroke, quick hops between strokes.

Writes src/lib/signatureStrokes.json for the site and the intro film.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "src" / "lib" / "signatureStrokes.json"
ROUTE = json.loads((HERE / "route.json").read_text()) if (HERE / "route.json").exists() else {}

# Merging: junction pixels closer than this are one crossing (source px).
MERGE = 16
# Edges shorter than this between two junctions are thinning artefacts.
TINY = 22
# How far into an edge its end tangent is measured.
TANGENT = 16


class Graph:
    def __init__(self, data: dict):
        self.nodes = data["nodes"]
        parent = list(range(len(self.nodes)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra

        raw = data["edges"]
        for e in raw:
            if e["a"] >= 0 and e["b"] >= 0 and e["a"] != e["b"] and len(e["chain"]) < TINY:
                union(e["a"], e["b"])
        xy = np.array([[n["x"], n["y"]] for n in self.nodes])
        for i in range(len(xy)):
            for j in range(i + 1, len(xy)):
                if np.hypot(*(xy[i] - xy[j])) < MERGE:
                    union(i, j)
        self.find = find
        # Every traced edge, merged or not, for explicit plans.
        self.raw = {i: np.array(e["chain"], dtype=float)[:, ::-1] for i, e in enumerate(raw)}
        self.edges = []
        for i, e in enumerate(raw):
            a, b = find(e["a"]), find(e["b"]) if e["b"] >= 0 else -1
            if a == b and len(e["chain"]) < TINY * 3 and e["a"] != e["b"]:
                continue  # collapsed into a junction
            self.edges.append({"id": i, "a": a, "b": b, "chain": np.array(e["chain"], dtype=float)[:, ::-1], "w": np.array(e["w"])})
        self.adj: dict[int, list[int]] = {}
        for k, e in enumerate(self.edges):
            self.adj.setdefault(e["a"], []).append(k)
            if e["b"] != e["a"]:
                self.adj.setdefault(e["b"], []).append(k)
        pos = {}
        for n in range(len(self.nodes)):
            pos.setdefault(find(n), []).append(xy[n])
        self.pos = {k: np.mean(v, axis=0) for k, v in pos.items()}

    def by_id(self, raw_id: int) -> int:
        return next(k for k, e in enumerate(self.edges) if e["id"] == raw_id)

    def oriented(self, k: int, start_node: int, prefer: np.ndarray | None = None) -> np.ndarray:
        """Edge k's chain (x, y) running away from start_node."""
        e = self.edges[k]
        chain = e["chain"]
        if e["a"] == e["b"]:
            # A loop: run whichever way continues the heading.
            fwd, back = tangent_out(chain), tangent_out(chain[::-1])
            if prefer is not None and float(back @ prefer) > float(fwd @ prefer):
                return chain[::-1]
            return chain
        return chain if e["a"] == start_node else chain[::-1]

    def far(self, k: int, start_node: int) -> int:
        e = self.edges[k]
        return e["b"] if e["a"] == start_node else e["a"]


def unit(v: np.ndarray) -> np.ndarray:
    n = float(np.hypot(*v))
    return v / n if n > 1e-9 else np.array([1.0, 0.0])


def tangent_out(chain: np.ndarray) -> np.ndarray:
    k = min(TANGENT, len(chain) - 1)
    return unit(chain[k] - chain[0])


def tangent_in(chain: np.ndarray) -> np.ndarray:
    k = min(TANGENT, len(chain) - 1)
    return unit(chain[-1] - chain[-1 - k])


# route.json points are in graph-sheet coordinates (graph.py's crop origin).
SHEET = np.array([872.0, 336.0])


def route(g: Graph) -> list[dict]:
    """Strokes as lists of (edge, chain) in writing order.

    route.json's "plan" lists explicit strokes ({"edges": [ids], "word": n,
    "start": [x, y], "continue": bool}) and auto-walked ones ({"auto": [x, y],
    "word": n}). An id twice in a row retraces that edge. Edges no plan
    covers are walked afterwards (the x's crossing, the i's dot), then the
    swash ("kind": "swash") is written last.
    """
    plan = ROUTE.get("plan", [])
    by_id = {e["id"]: k for k, e in enumerate(g.edges)}
    reserved = {by_id[i] for item in plan for i in item.get("edges", []) if i in by_id}
    skip = {by_id[i] for i in ROUTE.get("skip", []) if i in by_id}
    unused = {k for k in range(len(g.edges)) if k not in reserved and k not in skip}

    def degree(node):
        return sum(1 for k in g.adj.get(node, []) if k in unused)

    def nearest_node(point, live=True):
        cands = [n for n in g.pos if not live or degree(n) > 0]
        return min(cands, key=lambda n: float(np.hypot(*(g.pos[n] - point))))

    def walk(node, heading):
        parts = []
        while True:
            options = [k for k in g.adj.get(node, []) if k in unused]
            if not options:
                # A dead end mid-stroke: retrace the last edge if more ink
                # waits at its other end (cursive's up-and-back strokes).
                if parts:
                    last_k, last_chain = parts[-1]
                    loop = g.edges[last_k]["a"] == g.edges[last_k]["b"]
                    back = node if loop else g.far(last_k, node)
                    if back != node and degree(back) > 0 and len(last_chain) < 260:
                        parts.append((last_k, last_chain[::-1]))
                        node, heading = back, tangent_in(last_chain[::-1])
                        continue
                return parts, node
            if heading is None:
                k = min(options, key=lambda k: -float(tangent_out(g.oriented(k, node)) @ unit(np.array([0.4, -1.0]))))
            else:
                k = min(options, key=lambda k: -float(tangent_out(g.oriented(k, node, heading)) @ heading))
            chain = g.oriented(k, node, heading)
            unused.discard(k)
            parts.append((k, chain))
            heading = tangent_in(chain)
            node = node if g.edges[k]["a"] == g.edges[k]["b"] else g.far(k, node)

    def explicit(ids, start):
        parts = []
        for n, i in enumerate(ids):
            k = by_id.get(i, -1 - i)
            chain = g.raw[i]
            closed = np.hypot(*(chain[0] - chain[-1])) < 6
            if parts:
                prev_end, heading = parts[-1][1][-1], tangent_in(parts[-1][1])
                if closed:
                    if float(tangent_out(chain[::-1]) @ heading) > float(tangent_out(chain) @ heading):
                        chain = chain[::-1]
                elif np.hypot(*(chain[-1] - prev_end)) < np.hypot(*(chain[0] - prev_end)):
                    chain = chain[::-1]
            elif start is not None:
                if np.hypot(*(chain[-1] - start)) < np.hypot(*(chain[0] - start)):
                    chain = chain[::-1]
            elif n + 1 < len(ids):
                nxt = g.raw[ids[n + 1]]
                d_fwd = min(np.hypot(*(chain[-1] - nxt[0])), np.hypot(*(chain[-1] - nxt[-1])))
                d_back = min(np.hypot(*(chain[0] - nxt[0])), np.hypot(*(chain[0] - nxt[-1])))
                if d_back < d_fwd:
                    chain = chain[::-1]
            if parts:
                gap = float(np.hypot(*(chain[0] - parts[-1][1][-1])))
                if gap > 14:
                    print(f"  warning: {gap:.0f}px gap before edge {i}")
            parts.append((k, chain))
        return parts

    strokes = []
    for item in plan:
        word = item.get("word", 0)
        kind = item.get("kind", "letter")
        if "edges" in item:
            start = np.array(item["start"]) + SHEET if "start" in item else None
            parts = explicit(item["edges"], start)
            if item.get("continue"):
                end = parts[-1][1][-1]
                more, _ = walk(nearest_node(end), tangent_in(parts[-1][1]))
                parts += more
        else:
            node = nearest_node(np.array(item["auto"]) + SHEET)
            parts, _ = walk(node, None)
        if not parts:
            continue
        if item.get("join") and strokes:
            gap = float(np.hypot(*(parts[0][1][0] - strokes[-1]["parts"][-1][1][-1])))
            if gap > 20:
                print(f"  warning: join gap {gap:.0f}px")
            strokes[-1]["parts"] += parts
        else:
            strokes.append({"parts": parts, "kind": kind, "word": word})

    # Whatever no plan reached: small strokes written after the name.
    extra = []
    while unused:
        ends = {n for k in unused for n in (g.edges[k]["a"], g.edges[k]["b"])}
        tips = [n for n in ends if degree(n) == 1]
        node = min(tips or list(ends), key=lambda n: g.pos[n][0])
        parts, _ = walk(node, None)
        if not parts:
            break
        x = float(np.mean(np.concatenate([c for _, c in parts])[:, 0])) - SHEET[0]
        extra.append({"parts": parts, "kind": "extra", "word": 0 if x < 1100 else 1})
    extra.sort(key=lambda s: float(s["parts"][0][1][0][0]))
    swash = [s for s in strokes if s["kind"] == "swash"]
    letters = [s for s in strokes if s["kind"] != "swash"]
    return letters + extra + swash


def edge_id(g: Graph, k: int) -> int:
    return g.edges[k]["id"] if k >= 0 else -1 - k


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet", help="draw the route (PNG)")
    args = parser.parse_args()
    g = Graph(json.loads((HERE / "graph.json").read_text()))
    strokes = route(g)
    print(f"{len(g.edges)} edges after merging, {len(strokes)} strokes")
    for i, s in enumerate(strokes):
        print(i, s["kind"], s["word"], [edge_id(g, k) for k, _ in s["parts"]])
    (HERE / "route-debug.json").write_text(json.dumps([[edge_id(g, k) for k, _ in s["parts"]] for s in strokes]))
    if args.sheet:
        draw(g, strokes, args.sheet)


def draw(g: Graph, strokes: list, path: str) -> None:
    from PIL import Image, ImageDraw, ImageFont
    import colorsys

    allpts = np.concatenate([c for s in strokes for _, c in s["parts"]])
    x0, y0 = allpts.min(axis=0) - 40
    x1, y1 = allpts.max(axis=0) + 40
    img = Image.new("RGB", (int(x1 - x0), int(y1 - y0)), (255, 255, 255))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 24)
    n = len(strokes)
    for i, s in enumerate(strokes):
        pts = np.concatenate([c for _, c in s["parts"]])
        m = len(pts)
        for j in range(m - 1):
            r, gg, b = colorsys.hsv_to_rgb(0.8 * (i + j / m) / n, 0.9, 0.85)
            d.line([tuple(pts[j] - (x0, y0)), tuple(pts[j + 1] - (x0, y0))], fill=(int(r * 255), int(gg * 255), int(b * 255)), width=4)
        sx, sy = pts[0] - (x0, y0)
        d.ellipse((sx - 7, sy - 7, sx + 7, sy + 7), fill=(0, 0, 0))
        d.text((sx + 6, sy - 30), str(i), fill=(0, 0, 0), font=font, stroke_width=3, stroke_fill=(255, 255, 255))
        # Arrow heads along the stroke show direction.
        for j in range(30, m - 1, 90):
            a, bpt = pts[j - 8] - (x0, y0), pts[j] - (x0, y0)
            v = unit(bpt - a)
            nrm = np.array([-v[1], v[0]])
            tip = bpt
            d.polygon([tuple(tip), tuple(tip - 12 * v + 6 * nrm), tuple(tip - 12 * v - 6 * nrm)], fill=(0, 0, 0))
    img.save(path)
    print(f"route sheet: {path}")


if __name__ == "__main__":
    main()
