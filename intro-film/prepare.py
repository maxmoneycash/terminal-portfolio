#!/usr/bin/env python3
"""Cut the film's source clips from the original screen recordings.

Each clip is a reviewed crop of one app (never the full desktop take), cut to
30 fps H.264 at near-source sharpness. Outputs land in .intro-build/film/public,
which Remotion serves as its public folder; nothing here is published.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "scripts"))
from cut_reels import find_source  # noqa: E402

PUBLIC = ROOT / ".intro-build" / "film" / "public"
CLIPS = PUBLIC / "clips"
STILLS = PUBLIC / "stills"
XP_ASSETS = ["gui", "fonts", "sounds"]


def cut(clip_id: str, clip: dict) -> str:
    out = CLIPS / f"{clip_id}.mp4"
    meta = CLIPS / f"{clip_id}.json"
    signature = json.dumps(clip, sort_keys=True)
    if out.exists() and meta.exists() and meta.read_text() == signature:
        return f"{clip_id}: cached"
    x, y, w, h = clip["crop"]
    width = clip["width"]
    height = round(h * width / w / 2) * 2
    width -= width % 2
    speed = clip.get("speed", 1)
    # A timelapse keeps whole frames (no blending) so every frame stays legible;
    # "duration" is source time either way.
    timing = f"setpts=PTS/{speed}," if speed != 1 else ""
    vf = f"crop={w}:{h}:{x}:{y},{timing}fps=30,scale={width}:{height}:flags=lanczos,setsar=1,format=yuv420p"
    tmp = out.with_suffix(".tmp.mp4")
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-ss", str(clip["start"]), "-t", str(clip["duration"]),
        "-i", find_source(clip["recording"]), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "14",
        "-g", "15", "-profile:v", "high", "-movflags", "+faststart", str(tmp),
    ], check=True)
    tmp.replace(out)
    thumb(clip_id)
    meta.write_text(signature)
    poster(clip_id)
    return f"{clip_id}: {width}x{height} {clip['duration'] / speed:.2f}s"


def wallpaper() -> None:
    """The live desktop's animated Bliss, looped past the film's length at
    output resolution so every scene can pick up the clouds where they are."""
    loops = {
        "landscape": ("bliss-loop-landscape.mp4", "scale=1920:1080:flags=lanczos"),
        "portrait": ("bliss-loop-portrait.mp4", "scale=1080:-2:flags=lanczos,crop=1080:1920:0:(ih-1920)*0.55"),
    }
    for orient, (name, vf) in loops.items():
        out = PUBLIC / f"wallpaper-{orient}.mp4"
        if out.exists():
            continue
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-stream_loop", "5", "-i", str(ROOT / "public" / "xp" / "video" / name),
            "-t", "52", "-an", "-vf", f"fps=30,{vf},unsharp=5:5:0.35,format=yuv420p",
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-g", "15", str(out),
        ], check=True)
        print(f"wallpaper {orient}", flush=True)


def still(still_id: str, item: dict) -> str:
    """A reviewed crop of one app screenshot, at most 2400 px wide."""
    from PIL import Image
    out = STILLS / f"{still_id}.jpg"
    meta = STILLS / f"{still_id}.json"
    signature = json.dumps(item, sort_keys=True)
    if out.exists() and meta.exists() and meta.read_text() == signature:
        return f"{still_id}: cached"
    x, y, w, h = item["crop"]
    with Image.open(find_source(item["file"])) as image:
        image = image.convert("RGB").crop((x, y, x + w, y + h))
        if image.width > 2400:
            image = image.resize((2400, round(image.height * 2400 / image.width)), Image.LANCZOS)
        image.save(out, quality=90)
    meta.write_text(signature)
    return f"{still_id}: {image.width}x{image.height}"


def thumb(clip_id: str) -> None:
    """A 640-wide copy for the small bouncing and cascading windows."""
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", str(CLIPS / f"{clip_id}.mp4"), "-an", "-vf", "scale=640:-2:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-g", "15", str(CLIPS / f"{clip_id}.thumb.mp4"),
    ], check=True)


def poster(clip_id: str) -> None:
    """A still for windows that sit underneath others (cheaper than video)."""
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-ss", "1", "-i", str(CLIPS / f"{clip_id}.mp4"), "-frames:v", "1",
        "-vf", "scale='min(1200,iw)':-2", "-q:v", "3", str(CLIPS / f"{clip_id}.jpg"),
    ], check=True)


def fetch_stats() -> None:
    """Public commits.sh numbers for the search and Task Manager gags."""
    import urllib.request
    url = "https://commits.sh/api/v1/ticker/maxmoneycash"
    target = HERE / "src" / "stats.json"
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            data = json.load(response)["ticker"]["stats"]
    except Exception as error:  # keep the last reviewed numbers offline
        print(f"commits.sh unavailable ({error}); keeping {target.name}")
        return
    keep = {k: data[k] for k in ["commits52w", "peakWeek", "busiestDay", "longestStreak"]}
    target.write_text(json.dumps(keep, indent=1) + "\n")


def main() -> None:
    CLIPS.mkdir(parents=True, exist_ok=True)
    for name in XP_ASSETS:
        shutil.copytree(ROOT / "public" / "xp" / name, PUBLIC / "xp" / name, dirs_exist_ok=True)
    # The signature and quill for the opening calligraphy.
    for name in ("maxwell_mohammadi_signature_full_canvas.svg", "quill-pen-transparent.png"):
        shutil.copy2(ROOT / "public" / name, PUBLIC / name)
    # The opening's writing order: per-pixel ink times and the quill's track.
    subprocess.run([sys.executable, str(HERE / "calligraphy.py")], check=True)
    clips = json.loads((HERE / "clips.json").read_text())["clips"]
    only = set(sys.argv[1:])
    jobs = {k: v for k, v in clips.items() if not only or k in only}
    fetch_stats()
    wallpaper()
    STILLS.mkdir(parents=True, exist_ok=True)
    for still_id, item in json.loads((HERE / "stills.json").read_text())["stills"].items():
        if not only or still_id in only:
            print(still(still_id, item), flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for line in pool.map(lambda item: cut(*item), jobs.items()):
            print(line, flush=True)
    for clip_id in jobs:
        if not (CLIPS / f"{clip_id}.jpg").exists():
            poster(clip_id)
        if not (CLIPS / f"{clip_id}.thumb.mp4").exists():
            thumb(clip_id)
    # The soundtrack, arranged from GarageBand's loops on the film's beat grid.
    if not only:
        subprocess.run([sys.executable, str(HERE / "music.py")], check=True)


if __name__ == "__main__":
    main()
