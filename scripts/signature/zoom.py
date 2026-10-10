"""Zoomed, numbered edge sheet of one region of graph.json (sheet coords)."""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
g = json.load(open("graph.json"))
ox, oy = 872, 336
x0, y0, x1, y1, out = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
Z = 2.4
base = Image.open(sys.argv[6]).convert("L").crop((x0 + ox, y0 + oy, x1 + ox, y1 + oy))
base = base.resize((int((x1 - x0) * Z), int((y1 - y0) * Z))).point(lambda v: 255 - (255 - v) * 0.3).convert("RGB")
d = ImageDraw.Draw(base)
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
pal = [(220, 40, 40), (30, 120, 220), (20, 150, 60), (200, 120, 0), (150, 40, 200), (0, 150, 160), (200, 40, 140), (60, 60, 60)]
for i, e in enumerate(g["edges"]):
    pts = [((x - ox - x0) * Z, (y - oy - y0) * Z) for y, x in e["chain"]]
    if not any(0 <= px <= (x1 - x0) * Z and 0 <= py <= (y1 - y0) * Z for px, py in pts):
        continue
    c = pal[i % len(pal)]
    d.line(pts, fill=c, width=4)
    # Arrow at 70% shows the chain's stored direction (a -> b).
    k = int(len(pts) * 0.7)
    if 2 < k < len(pts):
        a, b = np.array(pts[k - 3]), np.array(pts[k])
        v = (b - a) / (np.linalg.norm(b - a) + 1e-9); n = np.array([-v[1], v[0]])
        d.polygon([tuple(b), tuple(b - 14 * v + 7 * n), tuple(b - 14 * v - 7 * n)], fill=c)
    mx, my = pts[len(pts) // 2]
    d.text((mx + 6, my - 30), str(i), fill=c, font=font, stroke_width=4, stroke_fill=(255, 255, 255))
base.save(out)
print(out, base.size)
