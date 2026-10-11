#!/usr/bin/env python3
"""Publish HD and smaller mobile renditions; retain every frame and full framing."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MASTERS = ROOT / '.intro-build/film/out'
STAGE = ROOT / '.intro-build/film/publish'
OUT = ROOT / 'public/videos/intro'
SOURCES = ROOT / 'src/data/intro-sources.json'
MANIFEST = HERE / 'published.json'
TARGETS = {'landscape': (1920, 1080), 'portrait': (1080, 1920)}


def probe(path: Path) -> dict:
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path),
    ]))


def prepare(item: tuple[str, str]) -> dict:
    orient, quality = item
    master = MASTERS / f'intro-{orient}.mp4'
    info = probe(master)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    if (video['width'], video['height']) != TARGETS[orient]:
        raise ValueError(f'{orient}: unexpected master dimensions')
    if not any(s['codec_type'] == 'audio' for s in info['streams']):
        raise ValueError(f'{orient}: master has no soundtrack')
    score = json.loads((HERE / 'score.json').read_text())
    chapters = json.loads((ROOT / 'src/intro/chapters.json').read_text())
    expected_frames = sum(chapter['beats'] for chapter in chapters) * score['framesPerBeat']
    if int(video['nb_frames']) != expected_frames:
        raise ValueError(f'{orient}: master frame count does not match the chapter timeline')

    mobile = quality == 'mobile'
    name = f'intro-{orient}-{quality}'
    STAGE.mkdir(parents=True, exist_ok=True)
    web = STAGE / f'{name}.mp4'
    scale = (1280, 720) if orient == 'landscape' else (720, 1280)
    options = ['-vf', f'scale={scale[0]}:{scale[1]}:flags=lanczos', '-maxrate', '1400k', '-bufsize', '2800k'] if mobile else []
    subprocess.run([
        'ffmpeg', '-v', 'error', '-xerror', '-y', '-i', str(master), *options,
        '-c:v', 'libx264', '-threads', '2', '-preset', 'slow', '-crf', '24' if mobile else '23',
        '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'aac',
        '-b:a', '96k' if mobile else '128k', '-ac', '2', '-movflags', '+faststart', str(web),
    ], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-threads', '1', '-i', str(web), '-f', 'null', '-'], check=True)
    exported = probe(web)
    exported_video = next(s for s in exported['streams'] if s['codec_type'] == 'video')
    if int(exported_video['nb_frames']) != expected_frames:
        raise ValueError(f'{name}: encoded frame count changed')
    digest = hashlib.sha256(web.read_bytes()).hexdigest()
    filename = f'{name}-{digest[:8]}.mp4'
    poster = None
    if quality == 'hd':
        poster = STAGE / f'{name}-{digest[:8]}.jpg'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '0.8', '-i', str(web), '-frames:v', '1', '-q:v', '3', str(poster)], check=True)
    duration = float(exported['format']['duration'])
    print(f'{name}: {duration:.2f}s, {web.stat().st_size / 1e6:.1f} MB', flush=True)
    return dict(orient=orient, quality=quality, web=web, filename=filename, poster=poster, sha256=digest, bytes=web.stat().st_size)


def main() -> None:
    with ThreadPoolExecutor(max_workers=2) as pool:
        prepared = list(pool.map(prepare, [(orient, quality) for orient in TARGETS for quality in ['hd', 'mobile']]))
    # Nothing references an export until all four files have passed a full decode.
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text())
    manifest['files'] = {}
    sources = {orient: {} for orient in TARGETS}
    keep = set()
    for item in prepared:
        filename = item['filename']
        item['web'].replace(OUT / filename)
        keep.add(filename)
        sources[item['orient']][item['quality']] = f'/videos/intro/{filename}'
        manifest['files'][filename] = {key: item[key] for key in ['sha256', 'bytes']}
        if item['poster']:
            poster = item['poster']
            poster.replace(OUT / poster.name)
            sources[item['orient']]['poster'] = f'/videos/intro/{poster.name}'
            keep.add(poster.name)
    SOURCES.write_text(json.dumps(sources, indent=2) + '\n')
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    for old in OUT.glob('intro-*'):
        if old.name not in keep and old.suffix in ['.mp4', '.jpg']:
            old.unlink()
    print('Upload all renditions before deployment: npm run intro:upload', flush=True)


if __name__ == '__main__': main()
