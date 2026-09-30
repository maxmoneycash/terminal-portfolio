#!/usr/bin/env python3
"""Cut Demo Reel clips from the raw screen recordings.

Each job crops a recording to the app itself (no desktop, menu bar, terminal,
or browser chrome), optionally keeps only some stretches of it, and writes an
H.264 MP4 plus a poster frame to public/videos/reels/ under a content-hashed
name (/videos is served immutable). Scan every frame of a new recording for
private windows before adding a job: see the reels privacy notes.

  python3 scripts/cut_reels.py              # every job
  python3 scripts/cut_reels.py peptide-tracker aptos-hft-demo
"""
import glob
import hashlib
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REELS = os.path.join(ROOT, "public", "videos", "reels")
POSTERS = os.path.join(REELS, "posters")
HASH = "[0-9a-f]" * 8  # so "aptos-vs-megaeth" never matches "aptos-vs-megaeth-rerun"
SEARCH = [
    os.path.expanduser("~/Screenshots"),
    os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/Screenshots"),
    os.path.expanduser("~/Downloads"),
]

# crop is (x, y, w, h) in source pixels. keep lists (start, end) seconds of the
# source to keep, in order; None keeps it all. width is the output width
# (height follows the crop's shape). poster is seconds into the output.
JOBS = {
    "aptos-velociraptr": dict(
        source="Screen Recording 2025-12-22 at 1.13*", crop=(140, 90, 1070, 2110), width=730, poster=18),
    "peptide-tracker": dict(
        source="Screen Recording 2026-06-15 at 10.11*", crop=(250, 262, 856, 1762), width=700, poster=38),
    # 3-12s shows a "Cannot connect to HFT server" error and Arc's tab sidebar
    "aptos-hft-demo": dict(
        source="Screen Recording 2026-01-06 at 5.16*", crop=(1302, 85, 1228, 2050), width=862, poster=1,
        keep=[(0, 2.6), (12.8, 34.2)]),
    "sol2move-boringvault": dict(
        source="veda-transpiler.mp4", crop=(560, 60, 2910, 2080), width=1600, poster=7,
        keep=[(0, 8.5), (10, 14), (21, 25), (27, 37), (53, 59)]),
    "sol2move-first-run": dict(
        source="Screen Recording 2026-02-24 at 3.11*", crop=(380, 120, 2890, 2110), width=1600, poster=12),
    "aptos-vs-megaeth": dict(
        source="best_1.*", crop=(10, 88, 3430, 2146), width=1600, poster=40),
    "aptos-vs-megaeth-rerun": dict(
        source="Screen Recording 2026-01-31 at 1.11*", crop=(10, 88, 3430, 2146), width=1600, poster=12),
}


def find_source(pattern: str) -> str:
    for folder in SEARCH:
        hits = sorted(glob.glob(os.path.join(folder, pattern)))
        if hits:
            return hits[0]
    raise SystemExit(f"recording not found: {pattern}")


def probe(path: str, entry: str) -> str:
    return subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", entry,
                           "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout.strip()


def cut(job_id: str, job: dict) -> None:
    source = find_source(job["source"])
    x, y, w, h = job["crop"]
    width = job["width"]
    height = round(h * width / w / 2) * 2
    filters = ["fps=30", f"crop={w}:{h}:{x}:{y}", f"scale={width}:{height}:flags=lanczos", "setsar=1"]
    if job.get("keep"):
        expr = "+".join(f"between(t\\,{a}\\,{b})" for a, b in job["keep"])
        filters += [f"select='{expr}'", "setpts=N/(30*TB)"]
    filters.append("format=yuv420p")
    tmp = os.path.join(REELS, f".{job_id}.tmp.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", source, "-an", "-vf", ",".join(filters),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high",
                    "-movflags", "+faststart", tmp], check=True)
    digest = hashlib.sha1(open(tmp, "rb").read()).hexdigest()[:8]
    stale = glob.glob(os.path.join(REELS, f"{job_id}-{HASH}.mp4")) + glob.glob(os.path.join(POSTERS, f"{job_id}-{HASH}.jpg"))
    for old in stale:
        os.remove(old)
    video = os.path.join(REELS, f"{job_id}-{digest}.mp4")
    os.replace(tmp, video)
    poster = os.path.join(POSTERS, f"{job_id}-{digest}.jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(job["poster"]), "-i", video, "-frames:v", "1",
                    "-q:v", "4", poster], check=True)
    duration = float(probe(video, "format=duration") or probe(video, "stream=duration"))
    print(f"{job_id:<24} {width}x{height}  {duration:6.1f}s  {os.path.getsize(video):>9} B  "
          f"/videos/reels/{os.path.basename(video)}")


def main() -> None:
    wanted = sys.argv[1:] or list(JOBS)
    for job_id in wanted:
        cut(job_id, JOBS[job_id])


if __name__ == "__main__":
    main()
