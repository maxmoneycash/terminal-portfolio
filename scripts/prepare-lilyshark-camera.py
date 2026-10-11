#!/usr/bin/env python3
"""Recover the camera explanations at natural speed from the original take.

The old edited summaries shortened individual words. The saved Lilyshark brief
asks to preserve Max's voice, so these cuts use complete phrases at 1.00x.
Original and previous exports remain untouched.
"""
from pathlib import Path
import hashlib, json, subprocess

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path.home() / 'Documents/Eric Photos/P1010579.MOV'
OUT = ROOT / 'public/videos/reels'
STAGE = ROOT / '.intro-build/lilyshark-camera'
TAKES = [
    ('why-i-built-it', 'Why I built Lilyshark', 227.92, 12.08,
     'Max explains why he is building a packet analyzer for the radio traffic around him.'),
    ('device-explained', 'The device, explained by Max', 3.02, 24.8,
     'The original camera explanation of the T-Deck and its long-range radio, in Max’s natural voice.'),
    ('spectrum-demo', 'Max demonstrates the spectrum scan', 265.26, 19.25,
     'A hands-on demonstration from the original recording, with natural speech and timing.'),
]


def run(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def main():
    STAGE.mkdir(parents=True, exist_ok=True)
    (OUT / 'posters').mkdir(parents=True, exist_ok=True)
    catalog = ROOT / 'src/data/lilyshark-videos.json'
    videos = [v for v in json.loads(catalog.read_text()) if not v['id'].startswith('lilyshark-camera-')]
    manifest = ROOT / 'scripts/release-media.json'
    media = json.loads(manifest.read_text())
    media['files'] = {k:v for k,v in media['files'].items() if not k.startswith('videos/reels/lilyshark-camera-')}
    for slug, title, start, duration, description in TAKES:
        name = 'lilyshark-camera-' + slug
        target = STAGE / (name + '.mp4')
        run('-ss', str(start), '-t', str(duration), '-i', str(SOURCE),
            '-vf', 'scale=1280:-2:flags=lanczos,fps=30', '-c:v', 'libx264', '-threads', '2',
            '-crf', '22', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-g', '30',
            '-c:a', 'aac', '-b:a', '128k', '-af', 'volume=10dB,alimiter=limit=0.891:level=false', '-movflags', '+faststart', str(target))
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        video = OUT / f'{name}-{digest[:8]}.mp4'
        target.replace(video)
        info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video)]))
        stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
        poster = OUT / 'posters' / f'{video.stem}.jpg'
        run('-ss', '1', '-i', str(video), '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', str(poster))
        url = '/videos/reels/' + video.name
        media['files'][url[1:]] = dict(sha256=digest, bytes=video.stat().st_size)
        videos.append(dict(id=name, title='Lilyshark: ' + title, date='On camera', summary=description,
            sourceFilename=SOURCE.name, poster='/videos/reels/posters/' + poster.name, link='https://lilyshark.com/',
            durationSeconds=float(info['format']['duration']), sizeBytes=video.stat().st_size, hasAudio=True,
            width=stream['width'], height=stream['height'], sources=[dict(src=url, type='video/mp4', quality='HD')]))
        print(f'{name}: {duration:.2f}s, natural speed', flush=True)
    catalog.write_text(json.dumps(videos, indent=2) + '\n')
    manifest.write_text(json.dumps(media, indent=2) + '\n')


if __name__ == '__main__': main()
