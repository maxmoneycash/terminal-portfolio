#!/usr/bin/env python3
"""MaxXP intro, final step: encode the Blender renders for the web.

Turns .intro-build/render/{portrait,landscape}/*.png into H.264 MP4s with a
phone-camera finish (fine grain, soft vignette, light sharpening), writes a
poster frame for each, names both by content hash (/videos is served as
immutable), and points src/xp/IntroVideo.tsx at the new files.

  python3 scripts/intro/encode.py
"""
from __future__ import annotations

import glob
import hashlib
import os
import re
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BUILD = os.path.join(ROOT, ".intro-build")
OUT = os.path.join(ROOT, "public", "videos", "intro")
COMPONENT = os.path.join(ROOT, "src", "xp", "IntroVideo.tsx")
INDEX = os.path.join(ROOT, "index.html")  # preloads the poster frames
FPS = 30

TARGETS = {
    # orient: (output size, crf)
    "portrait": ((720, 1280), 24),
    "landscape": ((1600, 900), 24),
}
FINISH = "noise=alls=3:allf=t,vignette=angle=PI/6,unsharp=5:5:0.3:5:5:0"


def encode(orient: str) -> tuple[str, str]:
    (w, h), crf = TARGETS[orient]
    frames = sorted(glob.glob(os.path.join(BUILD, "render", orient, "*.png")))
    if not frames:
        raise SystemExit(f"no renders for {orient}; run scene.py first")
    tmp = os.path.join(BUILD, f"intro-{orient}.mp4")
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(BUILD, "render", orient, "%04d.png"),
        "-vf", f"scale={w}:{h}:flags=lanczos,{FINISH},format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-profile:v", "high",
        "-g", "60", "-movflags", "+faststart", "-an", tmp,
    ], check=True)
    digest = hashlib.sha1(open(tmp, "rb").read()).hexdigest()[:8]
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, f"intro-{orient}-*")):
        os.remove(old)
    video = os.path.join(OUT, f"intro-{orient}-{digest}.mp4")
    os.replace(tmp, video)
    poster = os.path.join(OUT, f"intro-{orient}-{digest}.jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-frames:v", "1", "-q:v", "4", poster], check=True)
    print(f"{orient:<9} {w}x{h}  {os.path.getsize(video) / 1e6:5.2f} MB  poster {os.path.getsize(poster) / 1e3:.0f} KB")
    return f"/videos/intro/{os.path.basename(video)}", f"/videos/intro/{os.path.basename(poster)}"


def main():
    src = open(COMPONENT).read()
    index = open(INDEX).read()
    for orient in TARGETS:
        video, poster = encode(orient)
        src = re.sub(rf'"/videos/intro/intro-{orient}-[^"]+\.mp4"', f'"{video}"', src)
        src = re.sub(rf'"/videos/intro/intro-{orient}-[^"]+\.jpg"', f'"{poster}"', src)
        index = re.sub(rf'"/videos/intro/intro-{orient}-[^"]+\.jpg"', f'"{poster}"', index)
    open(COMPONENT, "w").write(src)
    open(INDEX, "w").write(index)
    print("updated", os.path.relpath(COMPONENT, ROOT), "and", os.path.relpath(INDEX, ROOT))


if __name__ == "__main__":
    main()
