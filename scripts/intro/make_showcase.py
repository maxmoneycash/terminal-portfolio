#!/usr/bin/env python3
"""Compose large, overlapping XP windows from reviewed original recordings.

Unlike the old one-window montage, each chapter can show several recordings
or distinct parts of an app at once. Landscape and portrait have their own
layouts. Source frames are compressed on disk, never multi-gigabyte raw maps.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
from functools import lru_cache
import hashlib
import json
import math
import re
from pathlib import Path
import subprocess
import sys

import numpy as np
from PIL import Image

import make_screen as xp
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cut_reels import find_source

ROOT = Path(xp.ROOT)
BUILD = Path(xp.BUILD) / "showcase"
FIRST_OPEN, CHAPTER_LENGTH = .3, 2.05
END_FRAME = 783
MANIFEST = Path(__file__).with_name("showcase.json")


@lru_cache(maxsize=64)
def source(pattern):
    return find_source(pattern)


def window(shot, chapter, index, orient):
    """Fit each recording without distorting it; arrange for the actual viewport."""
    win = dict(shot, style="luna", clip=shot["id"], menu=False)
    crop = win["crop"] = shot.get(f"{orient}Crop", shot["crop"])
    ratio = crop[2] / crop[3]
    # A few large windows, never a wall of tiny video thumbnails. Portrait
    # wide clips stack; tall clips cascade at readable size.
    if orient == "landscape":
        if ratio < .9:
            boxes = [(95, 45, 570, 785), (765, 65, 570, 775), (435, 105, 570, 745)]
        else:
            boxes = [(45, 45, 1210, 760), (695, 310, 700, 520), (210, 130, 1130, 680)]
    else:
        if ratio < .9:
            boxes = [(485, 28, 460, 805), (500, 42, 445, 805), (492, 54, 445, 795)]
        else:
            boxes = [(484, 26, 465, 370), (488, 435, 460, 400), (496, 185, 445, 620)]
    bx, by, bw, bh = shot.get(orient, boxes[index % len(boxes)])
    cw = min(bw - 8, (bh - 34) * ratio)
    win["cw"], win["ch"] = round(cw), round(cw / ratio)
    chrome, content = xp.build_luna(win)
    ww, wh = chrome.width / xp.S, chrome.height / xp.S
    win["rect"] = [bx + (bw - ww) / 2, by, ww, wh]
    win["content"] = content
    win["key"] = f"{chapter:02}-{index:02}-{shot['id']}-{orient}"
    # Stagger arrivals slightly. Tall phone views get more time in front than
    # their landscape counterparts, where both can remain visible together.
    delay = shot.get("delay", .28 * index)
    if orient == "portrait" and ratio < .9:
        delay = shot.get("portraitDelay", .64 * index)
    win["t0"] = FIRST_OPEN + chapter * CHAPTER_LENGTH + delay
    win["t1"] = xp.LOGOFF[1] if chapter == 11 else FIRST_OPEN + (chapter + 1) * CHAPTER_LENGTH + .1
    win["source"] = source(shot["recording"])
    return win


def cache_dir(win):
    signature = hashlib.sha1(json.dumps({**{k: win[k] for k in ["source", "crop", "start", "content"]}, "mtime": Path(win["source"]).stat().st_mtime_ns}, sort_keys=True).encode()).hexdigest()[:12]
    return BUILD / "clips" / signature


def extract(win, frame=None):
    folder = cache_dir(win)
    folder.mkdir(parents=True, exist_ok=True)
    count = math.ceil((win["t1"] - win["t0"]) * xp.FPS) + 1
    if frame is not None and (folder / f"{frame:04}.jpg").exists():
        return
    if frame is None and all((folder / f"{i:04}.jpg").exists() for i in range(count)):
        return
    x, y, w, h = win["crop"]
    _, _, cw, ch = win["content"]
    seek = win["start"] + (frame or 0) / xp.FPS
    output = str(folder / (f"{frame:04}.jpg" if frame is not None else "%04d.jpg"))
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-ss", str(seek), "-i", win["source"],
        "-frames:v", str(1 if frame is not None else count),
        "-vf", f"fps={xp.FPS},crop={w}:{h}:{x}:{y},scale={cw}:{ch}:flags=lanczos,setsar=1",
        "-threads", "2", "-q:v", "1", "-pix_fmt", "yuvj444p", "-start_number", "0", output,
    ], check=True, timeout=300)
    if frame is None and not (folder / f"{count - 1:04}.jpg").exists():
        raise ValueError(f"Recording ends before selected sequence: {win['key']}")


STATE = {}


def initialize(windows, orient):
    STATE.update(windows=windows, orient=orient, desktop=xp.build_desktop(), login=xp.login_image())
    STATE["chrome"] = {w["key"]: xp.build_luna(w)[0] for w in windows}


def compose(frame):
    time = frame / xp.FPS
    image = STATE["desktop"].copy()
    for win in STATE["windows"]:
        if not win["t0"] <= time < win["t1"]:
            continue
        chrome = STATE["chrome"][win["key"]]
        x, y = xp.px(win["rect"][0]), xp.px(win["rect"][1])
        image.paste(chrome, (x, y), chrome)
        cx, cy, _, _ = win["content"]
        k = max(0, int((time - win["t0"]) * xp.FPS))
        with Image.open(cache_dir(win) / f"{k:04}.jpg") as source_frame:
            image.paste(source_frame, (x + cx, y + cy))
    image = image.convert("RGB")
    if time >= xp.LOGOFF[0]:
        image = Image.blend(image, STATE["login"], xp.smoothstep(*xp.LOGOFF, time))
    path = BUILD / "screen" / STATE["orient"] / f"{frame + 1:04}.jpg"
    image.save(path, quality=98, subsampling=0)
    mean = np.asarray(image.resize((32, 20)), dtype=np.float32).mean(axis=(0, 1)) / 255
    return frame, mean.tolist()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--at", help="preview timestamps; decode only the frames used")
    parser.add_argument("--chapter", type=int, help="preview one chapter (zero based)")
    parser.add_argument("--jobs", type=int, default=2)
    args = parser.parse_args()
    # A preview overwrites only a subset of textures and its lighting timeline.
    # Invalidate resume markers so a later production build regenerates both.
    (BUILD / "screen-ready").unlink(missing_ok=True)
    if args.at or args.chapter is not None:
        (BUILD / "render-signature").unlink(missing_ok=True)
    chapters = json.loads(MANIFEST.read_text())["chapters"]
    expected = set(re.findall(r'id: "([^"]+)"', (ROOT / "src/data/portfolio.ts").read_text().split("  videos: [", 1)[1].split("  ]", 1)[0]))
    represented = {shot.get("reel", shot["id"]) for chapter in chapters for shot in chapter["shots"]}
    if len(chapters) != 12 or represented != expected:
        raise ValueError(f"Intro coverage mismatch; missing={expected - represented}, unexpected={represented - expected}")
    for orient in ["landscape", "portrait"]:
        folder = BUILD / "screen" / orient
        folder.mkdir(parents=True, exist_ok=True)
        windows = [window(shot, ci, wi, orient) for ci, chapter in enumerate(chapters) for wi, shot in enumerate(chapter["shots"]) if args.chapter is None or ci == args.chapter]
        frames = [round(float(t) * xp.FPS) for t in args.at.split(",")] if args.at else list(range(END_FRAME))
        for win in windows:
            if args.at:
                for frame in frames:
                    time = frame / xp.FPS
                    if win["t0"] <= time < win["t1"]:
                        extract(win, max(0, int((time - win["t0"]) * xp.FPS)))
            else:
                extract(win)
            print(orient, win["key"], "source ready", flush=True)
        with ProcessPoolExecutor(max_workers=args.jobs, initializer=initialize, initargs=(windows, orient)) as pool:
            results = sorted(pool.map(compose, frames, chunksize=4))
        spill = [mean for _, mean in results] if not args.at else [[.25, .35, .45]] * xp.FRAMES
        spill += [spill[-1]] * (xp.FRAMES - len(spill))
        regions = [[440, 20, 540, 850] if orient == "portrait" else [0, 0, 1440, 900] for _ in range(xp.FRAMES)]
        for i in range(round(xp.LOGOFF[0] * xp.FPS), xp.FRAMES):
            regions[i] = list(xp.LOGIN_REGION)
        timeline = {"fps": xp.FPS, "frames": xp.FRAMES, "screen": [xp.LW, xp.LH], "texture": [xp.W, xp.H], "logoff": xp.LOGOFF, "spill": spill, "regions": regions,
                    "windows": [{k: w[k] for k in ["key", "title", "clip", "t0", "t1", "rect"]} for w in windows]}
        (BUILD / f"timeline-{orient}.json").write_text(json.dumps(timeline))
        if args.at and not (folder / "0001.jpg").exists():
            xp.build_desktop().convert("RGB").save(folder / "0001.jpg", quality=98)
        print(orient, "composed", len(frames), "frames", flush=True)


if __name__ == "__main__":
    main()
