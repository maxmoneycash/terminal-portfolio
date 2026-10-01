#!/usr/bin/env python3
"""Export the five-second editorial selects and a local review gallery.

Run before the expensive Blender render:
  python3 scripts/intro/review_highlights.py
  open .intro-build/highlights/index.html
"""
import html
import os
import subprocess

from make_screen import BUILD, HIGHLIGHTS, HOLD, SHOW, clip_path, prepare_windows


def main():
    prepare_windows()  # Check source durations and the intro's bounds first.
    out = os.path.join(BUILD, "highlights")
    os.makedirs(out, exist_ok=True)
    cards = []
    for spec in SHOW:
        clip = spec["clip"]
        pick = HIGHLIGHTS[clip]
        filters = ["fps=30"]
        if crop := pick.get("crop"):
            x, y, w, h = crop
            filters.append(f"crop={w}:{h}:{x}:{y}")
        filters += ["scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2", "setsar=1"]
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-ss", str(pick["start"]), "-i", clip_path(clip),
            "-t", str(pick["duration"]), "-vf", ",".join(filters), "-an", "-c:v", "libx264",
            "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            os.path.join(out, f"{clip}.mp4"),
        ], check=True)
        title = html.escape(spec["title"].replace(" - Microsoft Internet Explorer", ""))
        reason = html.escape(pick["reason"])
        offset = pick["intro"] - pick["start"]
        cards.append(f'<article><h2>{title}</h2><video controls playsinline preload="metadata" '
                     f'src="{clip}.mp4"></video><p>{reason}</p><small>Intro uses '
                     f'{offset:.2f}–{offset + HOLD:.2f}s of this five-second select.</small></article>')
        print(clip, "ready", flush=True)
    with open(os.path.join(out, "index.html"), "w") as fh:
        fh.write('''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Intro selects</title>
<style>body{background:#111;color:#eee;font:16px system-ui;margin:32px}main{display:grid;
grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}article{background:#202020;
padding:20px;border-radius:12px}h2{font-size:18px}video{width:100%;height:400px;background:#000}
p{line-height:1.5}small{color:#aaa}</style><h1>Intro selects</h1>
<p>Five-second highlights. The intro remains 28.5 seconds and uses the marked moment from each.</p><main>''')
        fh.write("\n".join(cards) + "</main></html>")


if __name__ == "__main__":
    main()
