#!/usr/bin/env python3
"""Validate and encode both 1080p intro cuts before publishing either asset."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / '.intro-build'
OUT = ROOT / 'public/videos/intro'
COMPONENT = ROOT / 'src/xp/IntroVideo.tsx'
INDEX = ROOT / 'index.html'
FPS, FRAMES = 30, 855
TARGETS = {'portrait': (1080, 1920), 'landscape': (1920, 1080)}


def prepare(orient, size):
    folder = BUILD / 'render' / orient
    expected = [folder / f'{i:04d}.png' for i in range(1, FRAMES + 1)]
    if any(not p.is_file() or p.stat().st_size == 0 for p in expected):
        raise ValueError(f'{orient}: missing or empty render frames')
    for frame in expected:
        with Image.open(frame) as image:
            if image.size != size:
                raise ValueError(f'{orient}: wrong render dimensions in {frame.name}')
            image.verify()
    tmp = BUILD / f'intro-{orient}.mp4'
    subprocess.run([
        'ffmpeg', '-v', 'error', '-xerror', '-y', '-framerate', str(FPS),
        '-start_number', '1', '-i', str(folder / '%04d.png'), '-frames:v', str(FRAMES),
        '-vf', f'scale={size[0]}:{size[1]}:flags=lanczos,format=yuv420p',
        '-c:v', 'libx264', '-threads', '4', '-preset', 'medium', '-crf', '16',
        '-profile:v', 'high', '-g', '60', '-movflags', '+faststart', '-an', str(tmp),
    ], check=True)
    stream = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(tmp)
    ]))['streams'][0]
    if int(stream['nb_frames']) != FRAMES or (stream['width'], stream['height']) != size:
        raise ValueError(f'{orient}: invalid frame count or dimensions')
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(tmp), '-f', 'null', '-'], check=True)
    digest = hashlib.sha1(tmp.read_bytes()).hexdigest()[:8]
    poster = BUILD / f'intro-{orient}.jpg'
    # Start with actual work in the poster instead of an empty desktop.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.8', '-i', str(tmp), '-frames:v', '1', '-q:v', '2', str(poster)], check=True)
    return orient, digest, tmp, poster


def publish(prepared):
    """Publish a complete pair after both orientations have been validated."""
    if {item[0] for item in prepared} != set(TARGETS):
        raise ValueError("Both orientations are required before publishing")
    OUT.mkdir(parents=True, exist_ok=True)
    src, index = COMPONENT.read_text(), INDEX.read_text()
    for orient, digest, video, poster in prepared:
        for path in [video, poster]:
            destination = OUT / f'intro-{orient}-{digest}{path.suffix}'
            os.replace(path, destination)
            pattern = rf'"/videos/intro/intro-{orient}-[^"/]+\{path.suffix}"'
            replacement = f'"/videos/intro/{destination.name}"'
            src = re.sub(pattern, replacement, src)
            index = re.sub(pattern, replacement, index)
        print(f'{orient}: {FRAMES} frames, 28.5s, {digest}', flush=True)
    COMPONENT.write_text(src)
    INDEX.write_text(index)
    for orient, digest, *_ in prepared:
        for old in OUT.glob(f'intro-{orient}-*'):
            if f'-{digest}.' not in old.name:
                old.unlink()


def main():
    publish([prepare(orient, size) for orient, size in TARGETS.items()])


if __name__ == '__main__':
    main()
