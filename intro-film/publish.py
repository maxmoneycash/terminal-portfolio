#!/usr/bin/env python3
"""Validate both rendered intro films, encode them for the web, and swap the
content-hashed assets into the site. Nothing is published unless both pass.
The MP4s stay out of git: published.json records their hashes, `npm run
intro:upload` puts them on the intro-films release, and the site build fetches
them from there."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MASTERS = ROOT / ".intro-build" / "film" / "out"
STAGE = ROOT / ".intro-build" / "film" / "publish"
OUT = ROOT / "public" / "videos" / "intro"
COMPONENT = ROOT / "src" / "xp" / "IntroVideo.tsx"
MANIFEST = HERE / "published.json"
TARGETS = {"landscape": (1920, 1080), "portrait": (1080, 1920)}
# An early frame of the quill writing over banknote engravings.
POSTER_AT = 0.8


def probe(path: Path) -> dict:
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path),
    ]))


def prepare(orient: str, size: tuple[int, int]) -> tuple[str, str, Path, Path, float]:
    master = MASTERS / f"intro-{orient}.mp4"
    info = probe(master)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    if (video["width"], video["height"]) != size:
        raise ValueError(f"{orient}: master is {video['width']}x{video['height']}, expected {size}")
    if not any(s["codec_type"] == "audio" for s in info["streams"]):
        raise ValueError(f"{orient}: master has no sound track")

    STAGE.mkdir(parents=True, exist_ok=True)
    web = STAGE / f"intro-{orient}.mp4"
    subprocess.run([
        "ffmpeg", "-v", "error", "-xerror", "-y", "-i", str(master),
        "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-g", "60", "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", str(web),
    ], check=True)
    # Full decode: a truncated or corrupt export never reaches the site.
    subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(web), "-f", "null", "-"], check=True)
    duration = float(probe(web)["format"]["duration"])

    poster = STAGE / f"intro-{orient}.jpg"
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-ss", str(POSTER_AT), "-i", str(web), "-frames:v", "1", "-q:v", "3", str(poster),
    ], check=True)
    digest = hashlib.sha1(web.read_bytes()).hexdigest()[:8]
    return orient, digest, web, poster, duration


def publish(prepared: list[tuple[str, str, Path, Path, float]]) -> None:
    if {item[0] for item in prepared} != set(TARGETS):
        raise ValueError("Both orientations are required before publishing")
    OUT.mkdir(parents=True, exist_ok=True)
    source = COMPONENT.read_text()
    for orient, digest, web, poster, duration in prepared:
        for path in (web, poster):
            destination = OUT / f"intro-{orient}-{digest}{path.suffix}"
            path.replace(destination)
            pattern = rf'"/videos/intro/intro-{orient}-[^"/]+\{path.suffix}"'
            source, count = re.subn(pattern, f'"/videos/intro/{destination.name}"', source)
            if count != 1:
                raise ValueError(f"{COMPONENT.name}: expected one {orient} {path.suffix} path, found {count}")
        size = (OUT / f"intro-{orient}-{digest}.mp4").stat().st_size
        print(f"{orient}: {duration:.2f}s, {size / 1e6:.1f} MB, {digest}", flush=True)
    COMPONENT.write_text(source)
    manifest = json.loads(MANIFEST.read_text())
    manifest["files"] = {}
    for orient, digest, *_ in prepared:
        film = OUT / f"intro-{orient}-{digest}.mp4"
        manifest["files"][film.name] = {"sha256": hashlib.sha256(film.read_bytes()).hexdigest(), "bytes": film.stat().st_size}
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print("Upload the films before deploying: npm run intro:upload", flush=True)
    for orient, digest, *_ in prepared:
        for old in OUT.glob(f"intro-{orient}-*"):
            if f"-{digest}." not in old.name:
                old.unlink()


def main() -> None:
    publish([prepare(orient, size) for orient, size in TARGETS.items()])


if __name__ == "__main__":
    main()
